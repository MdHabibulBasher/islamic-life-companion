"""Prayer Tracker endpoints (Module 3 of the PRD).

Routes (mounted at ``/api/v1/prayer-tracking``):

* ``POST   /track``                    — upsert today's check-off for one prayer
* ``GET    /today``                    — 5/5 status for today + scheduled times
* ``GET    /day/{day}``                — same, for any day
* ``GET    /week``                     — last 7 days, dense
* ``GET    /month/{year}/{month}``     — month grid for the calendar view
* ``GET    /streaks``                  — current/longest + badges for all 6 rows
* ``GET    /qada``                     — outstanding qada + totals
* ``GET    /qada/history``             — audit-log slice (added / made-up)
* ``GET    /qada/stats``               — range-scoped per-prayer + lifetime counters
* ``POST   /qada/adjust``              — signed delta to qada owed
* ``GET    /settings``                 — user prefs
* ``PUT    /settings``                 — replace user prefs (partial-update semantics)
* ``GET    /statistics``               — cached dashboard aggregates
* ``GET    /export.csv``               — CSV download of full history

Auth: every endpoint requires a Bearer token (``get_current_user``).
"""
from __future__ import annotations

import csv
import io
from datetime import date, datetime, timedelta
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import StreamingResponse
from sqlalchemy import and_
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models.prayer import (
    CalculationMethod,
    JamaahStatus,
    JuristicMethod,
    PrayerName,
    PrayerQada,
    PrayerQadaEntry,
    PrayerQadaEvent,
    PrayerSettings,
    PrayerStatistics,
    PrayerStreak,
    PrayerTracking,
)
from app.models.user import User, UserLocationSetting
from app.schemas.prayer import (
    AllQadaEntriesResponse,
    AllQadaResponse,
    AllStreaksResponse,
    CsvExportResponse,
    DayPrayerStatus,
    DayTrackingResponse,
    PrayerQadaEntryResponse,
    PrayerQadaResponse,
    PrayerSettingsResponse,
    PrayerSettingsUpdate,
    PrayerStreakResponse,
    PrayerStatisticsResponse,
    PrayerTrackingCreate,
    PrayerTrackingResponse,
    PrayerTrackingUpdate,
    QadaPrayerStats,
    QadaStatsResponse,
    QadaUpdateRequest,
)
from app.services.prayer_tracker import (
    PRAYER_ORDER,
    adjust_qada,
    create_qada_entry,
    delete_latest_qada_entry,
    get_user_signup_date,
    increment_qada,
    recompute_all_streaks,
    recompute_statistics,
    recompute_streak,
)


class _DummyUser:
    """Lightweight stand-in for ``User`` — ``auto_populate_from_prayers``
    only reads ``.id``, so we avoid a full DB round-trip."""

    def __init__(self, user_id: int) -> None:
        self.id = user_id


def _sync_prayer_challenges(db: Session, user_id: int) -> None:
    """After a prayer tracking row changes, re-sync every prayer-related
    challenge the user has joined so the challenge progress mirrors the
    Prayer Tracker.

    This is the ONLY path that auto-completes prayer challenges — the
    "Mark Today Done" button is blocked for prayer-related challenges.
    """
    # Import here to avoid a circular import at module load time.
    from app.models.challenge import (
        Challenge,
        UserChallengeProgress,
    )
    from app.api.v1.endpoints.challenges import (
        auto_populate_from_prayers,
        _is_prayer_related,
    )

    progresses = (
        db.query(UserChallengeProgress)
        .filter(UserChallengeProgress.user_id == user_id)
        .all()
    )
    for progress in progresses:
        challenge = (
            db.query(Challenge)
            .filter(Challenge.id == progress.challenge_id)
            .first()
        )
        if challenge and _is_prayer_related(challenge):
            try:
                auto_populate_from_prayers(db, _DummyUser(user_id), challenge, progress)
            except Exception:
                # Never let a challenge-sync error break the prayer toggle.
                import traceback
                traceback.print_exc()


def _name(value) -> str:
    """Coerce a PrayerName enum or its plain-string form to a lowercase str.

    The DB column is ``VARCHAR(16)``, so reads return plain strings. Writes
    pass through Pydantic, which accepts ``PrayerName.FAJR`` and serializes
    it to ``"fajr"``. This helper makes both directions uniform.
    """
    if value is None:
        return ""
    return value.value if hasattr(value, "value") else str(value)


router = APIRouter()


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------


def _get_or_create_settings(db: Session, user_id: int) -> PrayerSettings:
    s = (
        db.query(PrayerSettings)
        .filter(PrayerSettings.user_id == user_id)
        .first()
    )
    if s is None:
        s = PrayerSettings(user_id=user_id)
        db.add(s)
        db.flush()
    return s


def _resolve_location(
    db: Session,
    user: User,
    city: Optional[str],
    country: Optional[str],
) -> tuple[Optional[str], Optional[str]]:
    """Pick the best city/country pair available.

    Priority order:
      1. Query parameters (``city``, ``country``) — used by callers who want
         a preview without persisting.
      2. The user's saved ``UserLocationSetting`` row — set whenever they
         pick a city on the Prayer Times page.
      3. ``(None, None)`` — caller will render placeholders.

    This is the single source of truth for "where is this user praying
    today?", so both ``/today`` and ``/day/{date}`` use it.
    """
    if city and country:
        return city, country
    loc = (
        db.query(UserLocationSetting)
        .filter(UserLocationSetting.user_id == user.id)
        .one_or_none()
    )
    if loc:
        return loc.city, loc.country
    return None, None


def _scheduled_times_for(city: Optional[str], country: Optional[str], day: date) -> dict[PrayerName, str]:
    """Best-effort fetch of today's scheduled times from Aladhan.

    Never raises — if the network fails we still return an empty dict so
    the tracker can render the check-off grid without times.

    Order of attempts:
      1. /timingsByAddress endpoint if both city and country are known
         (works for users who haven't enabled geolocation).
      2. Otherwise empty dict — the UI will simply show "—" placeholders.
    """
    if not city or not country:
        return {}
    try:
        from app.services.prayer_times import fetch_prayer_times_by_city
        import asyncio

        coro = fetch_prayer_times_by_city(
            city=city,
            country=country,
            prayer_date=day,
            method="ISNA",
        )
        try:
            result = asyncio.run(coro)
        except RuntimeError:
            # Already inside an event loop (e.g. tests) — fall back to a
            # fresh loop so we don't break the existing one.
            loop = asyncio.new_event_loop()
            try:
                result = loop.run_until_complete(coro)
            finally:
                loop.close()
        return _times_from_payload(result)
    except Exception as exc:
        print(f"[prayer-tracking] _scheduled_times_for failed: {exc}")
        return {}


def _times_from_payload(payload: Optional[dict]) -> dict:
    """Extract HH:MM strings from either shape returned by the service.

    Accepts:
      • ``{"fajr": ..., "dhuhr": ..., "sunrise": ..., "midnight": ...}``
        (current shape from :func:`fetch_prayer_times_by_city`)
      • ``{"prayers": {"fajr": ..., ...}}`` (legacy shape)

    Returns a dict with prayer names mapped to HH:MM strings, plus
    ``"sunrise"`` and ``"midnight"`` keys for the day-level bounds
    (used to draw the correct end-time for Fajr and Isha windows).
    """
    if not payload:
        return {}
    p = payload.get("prayers", {}) if isinstance(payload, dict) and payload.get("prayers") else payload
    mapping = {
        PrayerName.FAJR: p.get("fajr", ""),
        PrayerName.DHUHR: p.get("dhuhr", ""),
        PrayerName.ASR: p.get("asr", ""),
        PrayerName.MAGHRIB: p.get("maghrib", ""),
        PrayerName.ISHA: p.get("isha", ""),
    }
    # Strip any " (CST)" suffix Aladhan sometimes appends.
    result = {k: (v.split(" ")[0] if v else "") for k, v in mapping.items()}
    sunrise = p.get("sunrise", "")
    midnight = p.get("midnight", "")
    if sunrise:
        result["sunrise"] = sunrise.split(" ")[0]
    # Use a sentinel — Aladhan returns "00:00" for midnight which is falsy
    # in Python (would be dropped by a plain `if midnight:` check).
    if midnight != "":
        result["midnight"] = midnight.split(" ")[0]
    return result


def _build_day(
    db: Session,
    user_id: int,
    day: date,
    scheduled: dict,
) -> DayTrackingResponse:
    rows = (
        db.query(PrayerTracking)
        .filter(
            PrayerTracking.user_id == user_id,
            PrayerTracking.tracking_date == day,
        )
        .all()
    )
    by_name = {r.prayer_name: r for r in rows}

    statuses: list[DayPrayerStatus] = []
    for prayer in PRAYER_ORDER:
        row = by_name.get(prayer)
        statuses.append(
            DayPrayerStatus(
                prayer_name=prayer,
                scheduled_time=scheduled.get(prayer) or None,
                is_completed=bool(row and row.is_completed),
                completed_at=row.completed_at if row else None,
                is_jamaaah=bool(row and row.is_jamaaah),
                notes=row.notes if row else None,
            )
        )
    completed = sum(1 for s in statuses if s.is_completed)
    return DayTrackingResponse(
        date=day,
        prayers=statuses,
        completed_count=completed,
        is_full_day=(completed == len(PRAYER_ORDER)),
        sunrise=scheduled.get("sunrise"),
        midnight=scheduled.get("midnight"),
        signup_date=get_user_signup_date(db, user_id),
    )


def _streak_response(row: PrayerStreak) -> PrayerStreakResponse:
    return PrayerStreakResponse(
        prayer_name=row.prayer_name,
        current_streak=row.current_streak or 0,
        longest_streak=row.longest_streak or 0,
        last_completed_date=row.last_completed_date,
        badges=[b for b in (row.badges or "").split(",") if b],
    )


def _age_qada_for_day(
    db: Session,
    user_id: int,
    target_day: date,
    day_scheduled: dict,
    *,
    now: Optional[datetime] = None,
) -> None:
    """Bump the lifetime ``prayer_qada.owed_count`` for any prayer on
    ``target_day`` whose time has passed without a check-off.

    Used by GET /today (target_day = today) and GET /day/{date}
    (target_day can be any day in the past). For each prayer that
    doesn't already have a tracking row on ``target_day`` and whose
    time has passed, we increment the lifetime qada counter.

    Pass / fail semantics:
      • If we have no scheduled times for the day (location missing,
        Aladhan down, or ``day_scheduled`` is empty), we skip silently —
        better to under-count than to wrongly age a prayer that might
        still be prayed.
      • For past days we treat every scheduled prayer as past its
        window (the whole day is "in the past"), so all unchecked
        prayers get aged.
      • For today we compare against the current time.

    Note: this function only touches the lifetime ``PrayerQada``
    counter (which feeds ``GET /qada`` and the dashboard summary).
    The daily Qada card on the front-end is driven directly by the
    presence / absence of a ``PrayerTracking`` row for the day, so
    we no longer write ``PrayerQadaEvent`` rows here — those are
    written exclusively by ``POST /track`` and ``POST /qada/adjust``
    when the user actually toggles a prayer. This keeps the audit
    log reflecting only deliberate user actions.

    Idempotent: we only bump for prayers that don't already have a
    tracking row, so re-opening the page won't double-count.
    """
    if not day_scheduled:
        return

    existing_tracking = {
        _name(r.prayer_name)
        for r in db.query(PrayerTracking)
        .filter(
            PrayerTracking.user_id == user_id,
            PrayerTracking.tracking_date == target_day,
        )
        .all()
    }
    settings = _get_or_create_settings(db, user_id)
    if not settings.track_qada:
        return

    now_time = (now or datetime.utcnow()).time()
    is_past_day = target_day < date.today()

    for prayer in PRAYER_ORDER:
        name = _name(prayer)
        if name in existing_tracking:
            continue
        scheduled = day_scheduled.get(prayer)
        if not scheduled:
            continue
        try:
            hh, mm = scheduled.split(":")[:2]
            prayer_time = datetime.strptime(f"{int(hh):02d}:{int(mm):02d}", "%H:%M").time()
        except (ValueError, AttributeError):
            continue

        # A whole past day is "past its window" — age every unchecked
        # prayer on it. For today, only age prayers whose time has
        # already passed.
        if not (is_past_day or now_time > prayer_time):
            continue

        # Bump the lifetime counter only. We do NOT write a
        # PrayerQadaEvent here — the audit log is reserved for
        # explicit user actions (toggling the Prayer Row or the
        # Qada tile), and the daily Qada card renders directly
        # from the prayer-row state.
        increment_qada(db, user_id, name)


# Backwards-compat alias — keep the old name working for existing
# callers so the diff is minimal.
def _age_today_qada(
    db: Session,
    user_id: int,
    today_scheduled: dict,
) -> None:
    """Deprecated: use ``_age_qada_for_day(db, user_id, date.today(), ...)``."""
    _age_qada_for_day(db, user_id, date.today(), today_scheduled)


# ---------------------------------------------------------------------------
# Tracking endpoints
# ---------------------------------------------------------------------------


@router.post("/track", response_model=PrayerTrackingResponse, status_code=status.HTTP_201_CREATED)
def upsert_tracking(
    payload: PrayerTrackingCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Create-or-update the (date, prayer) row for the current user.

    Idempotent on the unique triple — repeated POSTs with the same fields
    are no-ops; toggling ``is_completed`` flips the row.

    This endpoint is the canonical "did the user pray this prayer on
    this day?" source. It writes ONLY to ``prayer_tracking`` — it
    does NOT touch ``prayer_qada`` counters or write a
    ``PrayerQadaEvent``. The audit log is reserved for explicit
    qada-makeup actions via the Qada tile (``POST /qada/adjust``)
    so the Stats view's "qada made up" tally reflects the user's
    actual makeup activity rather than every prayer-row toggle.

    Distinction between the two write paths:

    * **Prayer Row toggle (this endpoint)** — "I prayed this on
      time." Pure state mutation, no qada accounting. The daily
      Qada card on the front-end mirrors this state (a prayer
      disappears from Qada when its row flips to completed), but
      no qada event is recorded.
    * **Qada tile "Mark complete"** (``POST /qada/adjust``) —
      "I made up a previously-missed prayer." Decrements
      ``prayer_qada.owed_count``, increments ``made_up_count``,
      AND writes a ``PrayerQadaEvent`` so the Stats view can
      count "qada made up in this range".

    Past dates are accepted so the user can back-fill / catch up
    on missed prayers from earlier days — the daily view
    surfaces those days via the date picker (capped at today).
    Future dates are rejected so the user can't accidentally
    schedule prayers that haven't happened yet.
    """
    if payload.tracking_date > date.today():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Cannot track prayers for a future date "
                f"({payload.tracking_date.isoformat()})."
            ),
        )

    row = (
        db.query(PrayerTracking)
        .filter(
            PrayerTracking.user_id == current_user.id,
            PrayerTracking.tracking_date == payload.tracking_date,
            PrayerTracking.prayer_name == payload.prayer_name,
        )
        .first()
    )
    # Remember the previous completion state so we only emit a qada
    # event when this call actually toggled the check-off (avoids
    # double-counting when the user re-POSTs the same fields).
    was_completed = bool(row and row.is_completed)

    if row is None:
        row = PrayerTracking(
            user_id=current_user.id,
            tracking_date=payload.tracking_date,
            prayer_name=payload.prayer_name,
            is_completed=payload.is_completed,
            is_jamaaah=payload.is_jamaaah,
            notes=payload.notes,
            completed_at=datetime.utcnow() if payload.is_completed else None,
        )
        db.add(row)
    else:
        row.is_completed = payload.is_completed
        row.is_jamaaah = payload.is_jamaaah
        row.notes = payload.notes
        row.completed_at = datetime.utcnow() if payload.is_completed else None

    db.flush()

    # Mirror the un-tick transition into the qada audit log so the
    # Stats view's "qada made up" tally decreases when the user
    # un-ticks a prayer they previously marked complete via the Qada
    # tile. Without this, the user could un-tick Dhuhr on Jun 25 via
    # the Prayer Row, but the qada event with delta = -1 would still
    # be in the audit log and the stats would over-report.
    #
    # The un-tick is treated as an implicit qada undo (same effect as
    # the Qada tile's "Undo" button). A *new* tick (completed:
    # false → true) does NOT write an event here — the Qada tile is
    # the only path that creates "mark complete" events, so a Prayer
    # Row toggle never artificially inflates the qada tally.
    if not payload.is_completed and was_completed:
        adjust_qada(db, current_user.id, _name(payload.prayer_name), 1)
        # Remove the saved qada entry so the Stats view's "qada made
        # up" count decreases when the user un-ticks a prayer they
        # previously marked complete (via the Qada tile or the Prayer
        # Row). This mirrors the Qada tile's "Undo" button behavior.
        delete_latest_qada_entry(
            db,
            current_user.id,
            _name(payload.prayer_name),
            payload.tracking_date,
        )
        db.add(
            PrayerQadaEvent(
                user_id=current_user.id,
                prayer_name=_name(payload.prayer_name),
                delta=1,
                reason="track_uncheck",
                tracking_date=payload.tracking_date,
            )
        )

    # Recompute the affected streak + statistics. Cheap, and the dashboard
    # expects a fresh answer after every check-off.
    recompute_streak(db, current_user.id, _name(payload.prayer_name))
    recompute_streak(db, current_user.id, "all")
    recompute_statistics(db, current_user.id)

    db.commit()
    db.refresh(row)
    return row


@router.patch("/track/{tracking_id}", response_model=PrayerTrackingResponse)
def patch_tracking(
    tracking_id: int,
    payload: PrayerTrackingUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Partial update of an existing tracking row."""
    row = (
        db.query(PrayerTracking)
        .filter(PrayerTracking.id == tracking_id, PrayerTracking.user_id == current_user.id)
        .first()
    )
    if row is None:
        raise HTTPException(status_code=404, detail="Tracking row not found")

    if payload.is_completed is not None:
        row.is_completed = payload.is_completed
        row.completed_at = datetime.utcnow() if payload.is_completed else None
    if payload.is_jamaaah is not None:
        row.is_jamaaah = payload.is_jamaaah
    if payload.notes is not None:
        row.notes = payload.notes

    db.flush()

    # Qada accounting note:
    # PATCH no longer auto-touches prayer_qada. Same reason as
    # upsert_tracking — qada is now exclusively managed through the
    # Qada tile and the prayer_qada_event audit log. See the comment
    # in upsert_tracking for the full reasoning.
    recompute_streak(db, current_user.id, _name(row.prayer_name))
    recompute_streak(db, current_user.id, "all")
    recompute_statistics(db, current_user.id)

    db.commit()
    db.refresh(row)
    return row


@router.delete("/track/{tracking_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_tracking(
    tracking_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    row = (
        db.query(PrayerTracking)
        .filter(PrayerTracking.id == tracking_id, PrayerTracking.user_id == current_user.id)
        .first()
    )
    if row is None:
        raise HTTPException(status_code=404, detail="Tracking row not found")

    prayer_name = _name(row.prayer_name)
    db.delete(row)
    db.flush()

    # Qada accounting note:
    # DELETE no longer auto-decrements qada. Same reason as
    # upsert_tracking / patch_tracking — qada is now exclusively
    # managed through the Qada tile and the audit log. Deleting a
    # tracking row doesn't undo the auto-aged qada; the user can
    # explicitly tap "+ I missed this" on the Qada tile if they want
    # to add to their qada tally.
    recompute_streak(db, current_user.id, prayer_name)
    recompute_streak(db, current_user.id, "all")
    recompute_statistics(db, current_user.id)

    db.commit()
    return None


# ---------------------------------------------------------------------------
# Day / week / month views
# ---------------------------------------------------------------------------


@router.get("/today", response_model=DayTrackingResponse)
def get_today(
    city: Optional[str] = None,
    country: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Today's 5-prayer check-off status + scheduled times (best effort).

    Side effect: any of today's prayers whose scheduled time has already
    passed *and* the user has not marked complete get aged into the qada
    counter. This is what makes the Qada card actually light up with
    Fajr/Dhuhr/Asr at, say, 4 pm if you forgot to check them off.
    """
    today = date.today()
    resolved_city, resolved_country = _resolve_location(db, current_user, city, country)
    scheduled = _scheduled_times_for(resolved_city, resolved_country, today)
    _age_today_qada(db, current_user.id, scheduled)
    db.commit()
    return _build_day(db, current_user.id, today, scheduled)


@router.get("/day/{day}", response_model=DayTrackingResponse)
def get_day(
    day: date,
    city: Optional[str] = None,
    country: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Any day's check-off status.

    Past dates are accepted so the user can review and catch up on
    missed prayers from earlier days — the daily view surfaces
    those days via the date picker (capped at today). Future
    dates are rejected so the user can't accidentally look at
    prayer rows that haven't happened yet.

    Side effect (same as /today): for any day that's already in the past
    (or today after the prayer's window), we age any unchecked prayer
    into the qada counter so the Qada card reflects reality the moment
    the user opens the date.
    """
    if day > date.today():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Cannot look up a future day "
                f"({day.isoformat()})."
            ),
        )
    resolved_city, resolved_country = _resolve_location(db, current_user, city, country)
    scheduled = _scheduled_times_for(resolved_city, resolved_country, day)
    _age_qada_for_day(db, current_user.id, day, scheduled)
    db.commit()
    return _build_day(db, current_user.id, day, scheduled)


@router.get("/week", response_model=List[DayTrackingResponse])
def get_week(
    end_date: Optional[date] = Query(None, description="Last day of the window (default: today)."),
    city: Optional[str] = None,
    country: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Last 7 days, dense (no gaps even if a day has no rows).

    The window is truncated to start at the user's signup day — we never
    return empty pre-signup days in the list.
    """
    end = end_date or date.today()
    signup_date = get_user_signup_date(db, current_user.id)
    days = [end - timedelta(days=i) for i in range(6, -1, -1)]
    days = [d for d in days if d >= signup_date]
    # Only fetch scheduled times once per day
    return [_build_day(db, current_user.id, d, {}) for d in days]


@router.get("/month/{year}/{month}", response_model=List[DayTrackingResponse])
def get_month(
    year: int,
    month: int,
    city: Optional[str] = None,
    country: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Every day in ``(year, month)`` for the calendar grid view.

    Pre-signup days in the same month are omitted entirely so the grid
    only shows days the user could conceivably have prayed on.
    """
    import calendar

    if month < 1 or month > 12:
        raise HTTPException(status_code=400, detail="month must be 1..12")
    days_in_month = calendar.monthrange(year, month)[1]
    signup_date = get_user_signup_date(db, current_user.id)
    return [
        _build_day(db, current_user.id, date(year, month, d), {})
        for d in range(1, days_in_month + 1)
        if date(year, month, d) >= signup_date
    ]


@router.get("/summary")
def get_summary(
    start: date = Query(..., description="Earliest tracking_date (inclusive)."),
    end: date = Query(..., description="Latest tracking_date (inclusive)."),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Aggregate per-prayer and overall counts for a date range.

    Used by the Stats view. Returns:

    * ``days_in_range`` — total calendar days in the range
    * ``days_tracked`` — days that have at least one row in
      ``prayer_tracking`` for the user in this range
    * ``prayed`` — total ``is_completed=true`` rows
    * ``missed`` — every prayer slot in the range the user did NOT
      complete. Computed as ``(days_in_range × 5) - prayed`` so that
      days the user simply never opened (no row at all) still count
      as missed — matching the user's mental model of "I missed N
      prayers in this range".
    * ``full_days`` — days where all 5 prayers are completed
    * ``per_prayer`` — one row per prayer with the same split

    The qada audit log (``PrayerQadaEvent``) is NOT used here — that
    table is append-only and counts every toggle click (which inflates
    the numbers during testing). The Stats view reads from
    ``prayer_tracking`` so the numbers reflect the current state of
    each prayer slot in the range.
    """
    if end < start:
        raise HTTPException(status_code=400, detail="end must be on or after start")
    signup_date = get_user_signup_date(db, current_user.id)
    if end < signup_date:
        # User didn't exist for any of the requested range. Return
        # zero-everything so the Stats view doesn't crash, but still
        # echo the requested window so the UI can render the "no
        # data" state cleanly.
        return {
            "start": start.isoformat(),
            "end": end.isoformat(),
            "days_in_range": (end - start).days + 1,
            "days_tracked": 0,
            "prayed": 0,
            "missed": 0,
            "full_days": 0,
            "per_prayer": [],
        }

    days_in_range = (end - start).days + 1
    # Past days are still queryable even if they pre-date the user's
    # account — the user may have back-filled data via the daily
    # view, or have qada events from auto-aging that pre-date signup.
    # We just clamp ``effective_days`` so the lifetime "missed"
    # calculation doesn't count pre-signup slots as missed (those
    # are days the user genuinely couldn't have logged).
    pre_signup_days = max(0, (signup_date - start).days)
    effective_days = max(0, days_in_range - pre_signup_days)

    rows = (
        db.query(PrayerTracking)
        .filter(
            PrayerTracking.user_id == current_user.id,
            PrayerTracking.tracking_date >= start,
            PrayerTracking.tracking_date <= end,
        )
        .all()
    )

    days_tracked: set[date] = set()
    full_days: set[date] = set()
    prayed = 0
    missed = 0
    per_prayer: dict[str, dict] = {
        p.value: {"prayer_name": p.value, "prayed": 0, "missed": 0}
        for p in PRAYER_ORDER
    }
    for r in rows:
        name = _name(r.prayer_name)
        days_tracked.add(r.tracking_date)
        if r.is_completed:
            prayed += 1
            per_prayer[name]["prayed"] += 1
        else:
            # Explicit unchecked row — still counts as missed for
            # the per-prayer breakdown so the user can see which
            # prayers they actually un-ticked. The aggregate
            # `missed` total below fills in the days that have no
            # row at all.
            per_prayer[name]["missed"] += 1

    # full_days = days with 5 completed rows.
    by_date: dict[date, set[str]] = {}
    for r in rows:
        if r.is_completed:
            by_date.setdefault(r.tracking_date, set()).add(_name(r.prayer_name))
    full_days = {d for d, names in by_date.items() if len(names) == len(PRAYER_ORDER)}

    # Aggregate "missed" = every prayer the user could have
    # logged in the range but didn't complete. We compute it as
    # ``(days × 5) - prayed`` rather than just counting
    # ``is_completed=false`` rows, because days the user simply
    # never opened (no row at all) still count as missed. This
    # matches the user-facing mental model: "I missed N prayers
    # in this range".
    total_prayers_in_range = effective_days * len(PRAYER_ORDER)
    missed = max(0, total_prayers_in_range - prayed)

    # Per-prayer "missed" similarly: every prayer slot the user
    # could have completed but didn't. We can't enumerate empty
    # slots from a single aggregate query, but we can back-fill
    # using ``effective_days - prayed - (explicit missed rows)``
    # which is equivalent. The breakdown line in the UI shows
    # both the row-derived counts and the lifetime qada deltas
    # side-by-side, so a small mismatch here is acceptable.
    for p in PRAYER_ORDER:
        name = p.value
        slot_count = effective_days
        explicit_missed = per_prayer[name]["missed"]
        per_prayer[name]["missed"] = max(
            0,
            slot_count - per_prayer[name]["prayed"] - explicit_missed,
        ) + explicit_missed

    return {
        "start": start.isoformat(),
        "end": end.isoformat(),
        "days_in_range": days_in_range,
        "days_tracked": len(days_tracked),
        "prayed": prayed,
        "missed": missed,
        "full_days": len(full_days),
        "per_prayer": list(per_prayer.values()),
    }


# ---------------------------------------------------------------------------
# Streaks
# ---------------------------------------------------------------------------


@router.get("/streaks", response_model=AllStreaksResponse)
def get_streaks(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """All 6 streak rows (5 prayers + 'all').

    The first call may have empty rows if no check-offs have been logged
    yet — the caller can interpret that as 0/0/None.
    """
    rows = (
        db.query(PrayerStreak)
        .filter(PrayerStreak.user_id == current_user.id)
        .all()
    )
    by_name = {r.prayer_name: r for r in rows}

    out: list[PrayerStreakResponse] = []
    for name in [p.value for p in PRAYER_ORDER] + ["all"]:
        if name in by_name:
            out.append(_streak_response(by_name[name]))
        else:
            out.append(
                PrayerStreakResponse(
                    prayer_name=name,
                    current_streak=0,
                    longest_streak=0,
                    last_completed_date=None,
                    badges=[],
                )
            )
    return AllStreaksResponse(streaks=out)


@router.post("/streaks/recompute", response_model=AllStreaksResponse)
def force_recompute_streaks(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Wipe and rebuild all streak rows from scratch.

    Useful for back-fills, timezone corrections, or after the user changes
    their Hijri offset (which retroactively shifts what counts as a
    "completed" day).
    """
    recompute_all_streaks(db, current_user.id)
    db.commit()
    return get_streaks(current_user=current_user, db=db)


# ---------------------------------------------------------------------------
# Qada
# ---------------------------------------------------------------------------


@router.get("/qada", response_model=AllQadaResponse)
def get_qada(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    rows = (
        db.query(PrayerQada)
        .filter(PrayerQada.user_id == current_user.id)
        .all()
    )
    by_name = {r.prayer_name: r for r in rows}

    items: list[PrayerQadaResponse] = []
    for prayer in PRAYER_ORDER:
        row = by_name.get(prayer)
        items.append(
            PrayerQadaResponse(
                prayer_name=prayer,
                owed_count=row.owed_count if row else 0,
                made_up_count=row.made_up_count if row else 0,
            )
        )
    return AllQadaResponse(
        qada=items,
        total_owed=sum(i.owed_count for i in items),
        total_made_up=sum(i.made_up_count for i in items),
    )


@router.post("/qada/adjust", response_model=PrayerQadaResponse)
def adjust_qada_endpoint(
    payload: QadaUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """"Mark complete" / "Undo" on a Qada tile.

    This endpoint is the audit-log entry point for EXPLICIT qada
    actions — the Prayer Row toggle does NOT write here, so the
    Stats view's "qada made up in range" tally reflects the user's
    actual makeup activity via the Qada tile.

    Two paths:

    * **Mark complete** (``delta = -1``) — the user marked a Qada
      tile's "Mark complete" button. This:
      - Decrements ``prayer_qada.owed_count``, increments
        ``made_up_count`` (via :func:`adjust_qada`).
      - Upserts a ``prayer_tracking`` row with
        ``is_completed = true`` and ``completed_at = now`` so the
        daily checklist mirrors the makeup and the streaks /
        completion-rate stats see the prayer as completed.
      - Writes a ``PrayerQadaEvent`` with ``delta = -1``,
        ``reason = "qada_tile_mark_complete"`` for the Stats view.

    * **Undo** (``delta = +1``) — the user tapped "Undo" within
      the Qada tile's 4-second undo window. This:
      - Increments ``prayer_qada.owed_count``, decrements
        ``made_up_count`` (via :func:`adjust_qada`).
      - Flips the prayer_tracking row back to
        ``is_completed = false`` (if it exists) so the daily Qada
        card re-shows the prayer as owed.
      - Writes a ``PrayerQadaEvent`` with ``delta = +1``,
        ``reason = "qada_tile_undo"`` for the Stats view.

    Un-ticking a Prayer Row directly (without going through the
    Qada tile) does NOT write a qada event — the user is simply
    saying "I missed this prayer" via the row toggle, which
    re-shows the prayer on the Qada card but doesn't increment
    the lifetime "made up" tally.
    """
    row = adjust_qada(db, current_user.id, payload.prayer_name, payload.delta)
    tracking_date = payload.tracking_date or date.today()

    existing_track = (
        db.query(PrayerTracking)
        .filter(
            PrayerTracking.user_id == current_user.id,
            PrayerTracking.tracking_date == tracking_date,
            PrayerTracking.prayer_name == _name(payload.prayer_name),
        )
        .first()
    )

    if payload.delta < 0:
        # Mark complete: upsert the tracking row as completed.
        if existing_track is None:
            db.add(
                PrayerTracking(
                    user_id=current_user.id,
                    tracking_date=tracking_date,
                    prayer_name=_name(payload.prayer_name),
                    is_completed=True,
                    is_jamaaah=False,
                    completed_at=datetime.utcnow(),
                )
            )
        else:
            existing_track.is_completed = True
            existing_track.completed_at = datetime.utcnow()

        # Save a standalone qada entry (the separately-saved qada data).
        create_qada_entry(
            db,
            current_user.id,
            _name(payload.prayer_name),
            tracking_date,
        )

        recompute_streak(db, current_user.id, _name(payload.prayer_name))
        recompute_streak(db, current_user.id, "all")
        recompute_statistics(db, current_user.id)

        event_reason = "qada_tile_mark_complete"
    else:
        # Undo: flip the tracking row back to unchecked so the
        # Qada tile re-shows the prayer as owed. We only touch
        # the row if it currently has is_completed = true — this
        # avoids accidentally clearing a row the user has set
        # independently via the Prayer Row.
        if existing_track is not None and existing_track.is_completed:
            existing_track.is_completed = False
            existing_track.completed_at = None

            recompute_streak(db, current_user.id, _name(payload.prayer_name))
            recompute_streak(db, current_user.id, "all")
            recompute_statistics(db, current_user.id)

        # Remove the qada entry so the saved qada data stays in sync
        # with the user's intent (undo = the makeup didn't happen).
        delete_latest_qada_entry(
            db,
            current_user.id,
            _name(payload.prayer_name),
            tracking_date,
        )

        event_reason = "qada_tile_undo"

    db.add(
        PrayerQadaEvent(
            user_id=current_user.id,
            prayer_name=_name(payload.prayer_name),
            delta=payload.delta,
            reason=event_reason,
            tracking_date=tracking_date,
        )
    )
    db.commit()
    db.refresh(row)
    return PrayerQadaResponse(
        prayer_name=PrayerName(_name(row.prayer_name)),
        owed_count=row.owed_count,
        made_up_count=row.made_up_count,
    )


@router.get("/qada/history")
def get_qada_history(
    start: Optional[date] = Query(
        None,
        description=(
            "Earliest tracking_date (inclusive). For legacy events "
            "without a tracking_date, falls back to created_at::date."
        ),
    ),
    end: Optional[date] = Query(
        None,
        description=(
            "Latest tracking_date (inclusive). For legacy events "
            "without a tracking_date, falls back to created_at::date."
        ),
    ),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Per-prayer qada state in a date range, derived from the audit
    log filtered to Qada tile actions only.

    Returns one row per prayer that has at least one qada-tile
    event in the range, with the count of mark-completes
    (``delta = -1`` events) and undos (``delta = +1`` events).

    Filtering by ``reason LIKE 'qada_tile_%'`` ensures we only
    count explicit Qada tile clicks — Prayer Row toggles do
    NOT write any qada event, so a Prayer Row tick contributes
    0 to "made up" here. This matches the user's mental model:
    only Qada tile clicks count as makeup activity.
    """
    from sqlalchemy import func

    q = db.query(PrayerQadaEvent).filter(
        PrayerQadaEvent.user_id == current_user.id,
        PrayerQadaEvent.reason.like("qada_tile_%"),
    )
    if start is not None:
        q = q.filter(func.date(PrayerQadaEvent.created_at) >= start)
    if end is not None:
        q = q.filter(func.date(PrayerQadaEvent.created_at) <= end)
    rows = q.all()

    by_name: dict[str, dict] = {}
    for ev in rows:
        entry = by_name.setdefault(
            _name(ev.prayer_name),
            {"prayer_name": _name(ev.prayer_name), "net_delta": 0, "made_up": 0, "added": 0},
        )
        entry["net_delta"] += ev.delta
        if ev.delta < 0:
            entry["made_up"] += -ev.delta
        elif ev.delta > 0:
            entry["added"] += ev.delta

    items = [by_name[p.value] for p in PRAYER_ORDER if p.value in by_name]
    return {
        "items": items,
        "total_made_up": sum(i["made_up"] for i in items),
        "total_added": sum(i["added"] for i in items),
    }


@router.get("/qada/entries", response_model=AllQadaEntriesResponse)
def get_qada_entries(
    start: Optional[date] = Query(
        None,
        description="Earliest made_up_date (inclusive). If omitted, no lower bound.",
    ),
    end: Optional[date] = Query(
        None,
        description="Latest made_up_date (inclusive). If omitted, no upper bound.",
    ),
    prayer_name: Optional[PrayerName] = Query(
        None,
        description="Filter to a single prayer. If omitted, all 5 prayers are returned.",
    ),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List the user's saved qada makeup entries (one row per action).

    Each entry records one ``POST /qada/adjust`` mark-complete the user
    performed via the Qada tile, stored independently of the lifetime
    ``prayer_qada`` counters and the ``prayer_qada_event`` audit log.
    Undo deletes the matching entry so the list reflects the user's
    current intent.
    """
    q = db.query(PrayerQadaEntry).filter(PrayerQadaEntry.user_id == current_user.id)
    if start is not None:
        q = q.filter(PrayerQadaEntry.made_up_date >= start)
    if end is not None:
        q = q.filter(PrayerQadaEntry.made_up_date <= end)
    if prayer_name is not None:
        q = q.filter(PrayerQadaEntry.prayer_name == prayer_name.value)
    rows = q.order_by(PrayerQadaEntry.made_up_date.desc(), PrayerQadaEntry.created_at.desc()).all()

    per_prayer: dict[str, int] = {}
    for p in PRAYER_ORDER:
        per_prayer[p.value] = 0
    for r in rows:
        per_prayer[r.prayer_name] = per_prayer.get(r.prayer_name, 0) + 1

    return AllQadaEntriesResponse(
        entries=[PrayerQadaEntryResponse.model_validate(r) for r in rows],
        total=len(rows),
        per_prayer=per_prayer,
    )


@router.get("/qada/stats", response_model=QadaStatsResponse)
def get_qada_stats(
    start: Optional[date] = Query(
        None,
        description=(
            "Earliest tracking_date (inclusive) for range-scoped counters. "
            "Legacy rows without a tracking_date fall back to created_at::date. "
            "If omitted, range-scoped counters collapse to 0 and only the "
            "lifetime ``owed_now`` / ``made_up_now`` values are populated."
        ),
    ),
    end: Optional[date] = Query(
        None,
        description=(
            "Latest tracking_date (inclusive) for range-scoped counters. "
            "Legacy rows without a tracking_date fall back to created_at::date. "
            "If omitted, range-scoped counters collapse to 0 and only the "
            "lifetime ``owed_now`` / ``made_up_now`` values are populated."
        ),
    ),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Per-prayer qada counters scoped to a date range + lifetime state.

    Why this endpoint exists
    ------------------------
    The Stats view needs three numbers per prayer:

    1. **In-range added**   — how many qada the user has currently
       marked as missed in this range (rows in ``prayer_tracking``
       with ``is_completed=false`` for this user, scoped to dates
       in [start, end]).
    2. **In-range made up** — how many qada the user has currently
       caught up in this range (rows in ``prayer_tracking`` with
       ``is_completed=true`` for this user, scoped to dates in
       [start, end]).
    3. **Lifetime outstanding** — the current ``prayer_qada.owed_count``
       and ``made_up_count`` for each prayer (cumulative across all
       time, NOT range-scoped).

    Range counters are read from the ``prayer_qada_event`` audit
    log, filtered by ``reason LIKE 'qada_tile_%'`` so only EXPLICIT
    Qada tile actions (``POST /qada/adjust``) count. This
    distinguishes "I made up a missed prayer" (Qada tile click →
    counted) from "I prayed on time" (Prayer Row toggle → not
    counted), so the user's mental model matches the Stats view.

    A Prayer Row toggle does NOT write a qada event, so toggling
    a prayer on time won't inflate "qada made up". A Qada tile
    "Mark complete" writes an event with
    ``reason="qada_tile_mark_complete"`` (delta = -1); a Qada
    tile "Undo" writes one with ``reason="qada_tile_undo"``
    (delta = +1). Both are filtered in. The Stats view's headline
    numbers use the NET effect per prayer (mark-completes minus
    undos) so a user who marks complete and then undoes sees zero,
    not two clicks.

    All five prayers are always returned (in canonical display order),
    so the Stats view can render a stable table even when the user has
    no recorded qada activity yet.
    """
    # Defensive: if only one bound is provided, anchor the other end so
    # the range is well-defined. An unbounded scan over an unbounded
    # audit log would silently grow with usage; this makes the cost
    # explicit to the caller.
    if start is not None or end is not None:
        anchor_start = start or date(1970, 1, 1)
        anchor_end = end or date.today()
        if anchor_end < anchor_start:
            raise HTTPException(
                status_code=400,
                detail="end must be on or after start",
            )

    # Lifetime state — one row per prayer, defaulting to zero when the
    # user has never recorded any qada for that prayer.
    qada_rows = (
        db.query(PrayerQada)
        .filter(PrayerQada.user_id == current_user.id)
        .all()
    )
    owed_now_by_name: dict[str, tuple[int, int]] = {
        _name(r.prayer_name): (int(r.owed_count or 0), int(r.made_up_count or 0))
        for r in qada_rows
    }

    # Range-scoped counters, derived from the ``PrayerQadaEvent``
    # audit log. Only events with ``reason LIKE 'qada_tile_%'``
    # are counted — those are the explicit Qada tile clicks
    # (``qada_tile_mark_complete`` for mark-complete, delta = -1;
    # ``qada_tile_undo`` for undo, delta = +1). Plain Prayer Row
    # toggles do NOT write any qada event, so a Prayer Row tick
    # contributes 0 to "qada made up" — the user's mental model:
    # only Qada tile clicks count as makeup.
    #
    # ``created_at::date`` is used for range filtering (when the
    # user tapped the button), so back-fills and stale events from
    # prior testing don't leak into the visible window unless the
    # user actually clicked during that window.
    #
    # The headline numbers use the NET effect per prayer (mark-
    # completes minus undos, clamped at 0) so a user who marks
    # complete and then undoes within the range sees 0, not 2.
    gross_added_by_name: dict[str, int] = {}
    gross_made_up_by_name: dict[str, int] = {}
    if start is not None or end is not None:
        ev_q = db.query(PrayerQadaEvent).filter(
            PrayerQadaEvent.user_id == current_user.id,
            PrayerQadaEvent.reason.like("qada_tile_%"),
        )
        if start is not None:
            from sqlalchemy import func
            ev_q = ev_q.filter(func.date(PrayerQadaEvent.created_at) >= start)
        if end is not None:
            from sqlalchemy import func
            ev_q = ev_q.filter(func.date(PrayerQadaEvent.created_at) <= end)
        for ev in ev_q.all():
            name = _name(ev.prayer_name)
            delta = int(ev.delta or 0)
            if delta > 0:
                gross_added_by_name[name] = gross_added_by_name.get(name, 0) + delta
            elif delta < 0:
                gross_made_up_by_name[name] = gross_made_up_by_name.get(name, 0) + (-delta)

    # Build one stable row per prayer in canonical display order so the
    # UI always renders five lines (even when all counters are zero).
    items: list[QadaPrayerStats] = []
    total_added = 0
    total_made_up = 0
    total_net = 0
    total_owed_now = 0
    total_made_up_now = 0
    for prayer in PRAYER_ORDER:
        name = _name(prayer)
        gross_added = gross_added_by_name.get(name, 0)
        gross_made_up = gross_made_up_by_name.get(name, 0)
        net_made_up = max(0, gross_made_up - gross_added)
        net_added = max(0, gross_added - gross_made_up)
        owed_now, made_up_now = owed_now_by_name.get(name, (0, 0))
        items.append(
            QadaPrayerStats(
                prayer_name=prayer,
                added_in_range=net_added,
                made_up_in_range=net_made_up,
                net_in_range=net_added - net_made_up,
                owed_now=owed_now,
                made_up_now=made_up_now,
            )
        )
        total_added += net_added
        total_made_up += net_made_up
        total_net += net_added - net_made_up
        total_owed_now += owed_now
        total_made_up_now += made_up_now

    return QadaStatsResponse(
        start=start,
        end=end,
        items=items,
        total_added_in_range=total_added,
        total_made_up_in_range=total_made_up,
        total_net_in_range=total_net,
        total_owed_now=total_owed_now,
        total_made_up_now=total_made_up_now,
    )


# ---------------------------------------------------------------------------
# Settings
# ---------------------------------------------------------------------------


@router.get("/settings", response_model=PrayerSettingsResponse)
def get_settings(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    s = _get_or_create_settings(db, current_user.id)
    db.commit()
    db.refresh(s)
    return s


@router.put("/settings", response_model=PrayerSettingsResponse)
def update_settings(
    payload: PrayerSettingsUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    s = _get_or_create_settings(db, current_user.id)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(s, field, value)
    db.commit()
    db.refresh(s)
    return s


# ---------------------------------------------------------------------------
# Statistics
# ---------------------------------------------------------------------------


@router.get("/statistics", response_model=PrayerStatisticsResponse)
def get_statistics(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Cached aggregates for the dashboard.

    Triggers a recompute if the row is missing (first call after signup).
    """
    stats = (
        db.query(PrayerStatistics)
        .filter(PrayerStatistics.user_id == current_user.id)
        .first()
    )
    if stats is None:
        stats = recompute_statistics(db, current_user.id)
        db.commit()
        db.refresh(stats)

    # Inline convenience: include streaks + qada so the dashboard doesn't
    # have to make a second round-trip.
    streak_rows = (
        db.query(PrayerStreak)
        .filter(PrayerStreak.user_id == current_user.id)
        .all()
    )
    streaks = [_streak_response(r) for r in streak_rows]

    qada_rows = (
        db.query(PrayerQada)
        .filter(PrayerQada.user_id == current_user.id)
        .all()
    )
    qada = [
        PrayerQadaResponse(
            prayer_name=r.prayer_name,
            owed_count=r.owed_count,
            made_up_count=r.made_up_count,
        )
        for r in qada_rows
    ]

    return PrayerStatisticsResponse(
        total_tracked=stats.total_tracked,
        total_completed=stats.total_completed,
        overall_completion_rate=stats.overall_completion_rate,
        best_prayer_name=stats.best_prayer_name,
        worst_prayer_name=stats.worst_prayer_name,
        last_30_days_rate=stats.last_30_days_rate,
        streaks=streaks,
        qada=qada,
    )


# ---------------------------------------------------------------------------
# CSV export
# ---------------------------------------------------------------------------


@router.get("/export.csv")
def export_csv(
    start: Optional[date] = Query(None, description="Earliest date (inclusive)."),
    end: Optional[date] = Query(None, description="Latest date (inclusive)."),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Stream a CSV of all prayer-tracking rows for the user."""
    q = db.query(PrayerTracking).filter(PrayerTracking.user_id == current_user.id)
    if start:
        q = q.filter(PrayerTracking.tracking_date >= start)
    if end:
        q = q.filter(PrayerTracking.tracking_date <= end)
    rows = q.order_by(PrayerTracking.tracking_date, PrayerTracking.prayer_name).all()

    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(
        ["date", "prayer_name", "is_completed", "completed_at", "is_jamaaah", "notes"]
    )
    for r in rows:
        writer.writerow(
            [
                r.tracking_date.isoformat(),
                _name(r.prayer_name),
                "1" if r.is_completed else "0",
                r.completed_at.isoformat() if r.completed_at else "",
                "1" if r.is_jamaaah else "0",
                (r.notes or "").replace("\n", " "),
            ]
        )

    buf.seek(0)
    return StreamingResponse(
        iter([buf.getvalue()]),
        media_type="text/csv",
        headers={
            "Content-Disposition": 'attachment; filename="prayer-tracking.csv"',
        },
    )
