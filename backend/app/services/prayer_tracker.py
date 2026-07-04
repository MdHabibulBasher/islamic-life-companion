"""Pure-function helpers for the prayer tracker.

These are kept out of the FastAPI router so they can be unit-tested without
a database session and reused by future bulk-import jobs / schedulers.

Public surface:

* ``PRAYER_ORDER`` — canonical display order (Fajr .. Isha).
* ``STREAK_MILESTONES`` — (days_required, badge_name) pairs.
* ``recompute_streaks_after_change(db, user_id, prayer_name, on_date)``
* ``recompute_statistics(db, user_id)``

Streak semantics
----------------

The "all" streak increments when a day ends with 5/5 completions.
Per-prayer streaks increment when a day ends with that prayer completed.

If a user back-fills a missed day, the streak is recomputed from scratch
over the recent window to avoid stale counters. We keep the recomputation
window to the last ``RECOMPUTE_WINDOW_DAYS`` for performance.
"""
from __future__ import annotations

from datetime import date, timedelta
from typing import Iterable, Optional

from sqlalchemy import and_
from sqlalchemy.orm import Session

from app.models.prayer import (
    PrayerName,
    PrayerQada,
    PrayerQadaEntry,
    PrayerStatistics,
    PrayerStreak,
    PrayerTracking,
)
from app.models.user import User


# Ordered list used by every day view (Fajr first because it's earliest).
PRAYER_ORDER: list[PrayerName] = [
    PrayerName.FAJR,
    PrayerName.DHUHR,
    PrayerName.ASR,
    PrayerName.MAGHRIB,
    PrayerName.ISHA,
]


# (threshold, badge) pairs. Ordered ascending — first match wins.
STREAK_MILESTONES: list[tuple[int, str]] = [
    (7, "bronze"),
    (30, "silver"),
    (90, "gold"),
    (365, "diamond"),
]


# How far back the streak recomputation looks. Long enough that all
# realistic streaks are captured (1 year covers Diamond + buffer).
RECOMPUTE_WINDOW_DAYS = 400


# ---------------------------------------------------------------------------
# Signup-date helpers
# ---------------------------------------------------------------------------
# The day a user signs up is the first day they can possibly have a prayer
# recorded. We use that as the floor for every date-based query (streak
# recomputation, weekly/monthly views, statistics totals) so a brand-new
# user doesn't suddenly have a "5-year average completion" because the
# query was counting zeros from before they existed.
def get_user_signup_date(db: Session, user_id: int) -> date:
    """Return the date portion of ``User.created_at`` for ``user_id``.

    Falls back to today if the row is missing (defensive — shouldn't
    happen because the JWT-guarded route always carries a real user).
    """
    row = db.query(User.created_at).filter(User.id == user_id).first()
    if row is None or row[0] is None:
        return date.today()
    return row[0].date()


def get_recompute_since(db: Session, user_id: int, today: Optional[date] = None) -> date:
    """Return the earliest date the streak/stats recomputation should look at.

    Picks the LATER of the user's signup date and the rolling window so we
    never scan (or count zeros for) days before the user existed.
    """
    today = today or date.today()
    window_floor = today - timedelta(days=RECOMPUTE_WINDOW_DAYS)
    signup = get_user_signup_date(db, user_id)
    return max(window_floor, signup)


# ---------------------------------------------------------------------------
# Streak recomputation
# ---------------------------------------------------------------------------


def _get_or_create_streak(
    db: Session, user_id: int, prayer_name: str
) -> PrayerStreak:
    """Fetch the streak row, creating it on first access."""
    streak = (
        db.query(PrayerStreak)
        .filter(PrayerStreak.user_id == user_id, PrayerStreak.prayer_name == prayer_name)
        .first()
    )
    if streak is None:
        streak = PrayerStreak(user_id=user_id, prayer_name=prayer_name)
        db.add(streak)
        db.flush()
    return streak


def _completed_dates(
    db: Session, user_id: int, prayer_name: Optional[PrayerName], since: date
) -> set[date]:
    """Return the set of dates on which ``prayer_name`` is marked complete.

    ``prayer_name=None`` returns dates where ALL 5 prayers are complete
    (used for the aggregate "all" streak).
    """
    q = db.query(PrayerTracking.tracking_date).filter(
        PrayerTracking.user_id == user_id,
        PrayerTracking.tracking_date >= since,
        PrayerTracking.is_completed.is_(True),
    )
    if prayer_name is not None:
        q = q.filter(PrayerTracking.prayer_name == prayer_name)
    rows = q.all()
    return {r[0] for r in rows}


def _all_complete_dates(db: Session, user_id: int, since: date) -> set[date]:
    """Return the set of dates where all 5 prayers are complete.

    Computed in SQL: group by date, count distinct prayer_names, keep
    dates with the full 5.
    """
    from sqlalchemy import func

    rows = (
        db.query(PrayerTracking.tracking_date)
        .filter(
            PrayerTracking.user_id == user_id,
            PrayerTracking.tracking_date >= since,
            PrayerTracking.is_completed.is_(True),
        )
        .group_by(PrayerTracking.tracking_date)
        .having(func.count(PrayerTracking.prayer_name) == len(PRAYER_ORDER))
        .all()
    )
    return {r[0] for r in rows}


def _compute_streak_from_dates(completed: set[date], as_of: date) -> tuple[int, int, Optional[date]]:
    """Given a set of completed dates and a reference day, return
    ``(current_streak, longest_streak, last_completed_date)``.

    The current streak is the run of consecutive completed days ending at
    ``as_of`` (or one day before, if ``as_of`` itself is not in the set).
    The longest streak is the largest run anywhere in the set.
    """
    if not completed:
        return 0, 0, None

    last = max(completed)
    longest = 0
    run = 0
    prev: Optional[date] = None
    for d in sorted(completed):
        if prev is None or (d - prev).days != 1:
            run = 1
        else:
            run += 1
        if run > longest:
            longest = run
        prev = d

    # Current streak: walk back from last_completed_date one day at a time.
    current = 0
    cursor = last
    while cursor in completed:
        current += 1
        cursor = cursor - timedelta(days=1)
    # If the user hasn't completed today yet, the streak still stands from
    # yesterday. Don't reset until they miss an entire day.
    return current, longest, last


def _apply_milestones(streak: PrayerStreak) -> None:
    """Promote the streak's badge set based on ``longest_streak``."""
    earned = [badge for threshold, badge in STREAK_MILESTONES if streak.longest_streak >= threshold]
    streak.badges = ",".join(earned)


def recompute_streak(
    db: Session,
    user_id: int,
    prayer_name: str,
    *,
    today: Optional[date] = None,
) -> PrayerStreak:
    """Recompute the streak row for ``prayer_name`` ("all" or a PrayerName).

    Reads all completed dates in the recent window and rewrites
    current/longest/last_completed_date. Safe to call after every check-off
    mutation; cheap (one indexed range scan).
    """
    today = today or date.today()
    since = get_recompute_since(db, user_id, today)

    if prayer_name == "all":
        completed = _all_complete_dates(db, user_id, since)
    else:
        completed = _completed_dates(db, user_id, PrayerName(prayer_name), since)

    current, longest, last = _compute_streak_from_dates(completed, today)

    streak = _get_or_create_streak(db, user_id, prayer_name)
    streak.current_streak = current
    streak.longest_streak = max(longest, streak.longest_streak or 0)
    streak.last_completed_date = last
    _apply_milestones(streak)
    db.flush()
    return streak


def recompute_all_streaks(
    db: Session, user_id: int, *, today: Optional[date] = None
) -> list[PrayerStreak]:
    """Recompute every streak row (5 prayers + the 'all' aggregate)."""
    rows: list[PrayerStreak] = []
    rows.append(recompute_streak(db, user_id, "all", today=today))
    for prayer in PRAYER_ORDER:
        rows.append(recompute_streak(db, user_id, prayer.value, today=today))
    return rows


# ---------------------------------------------------------------------------
# Statistics recomputation
# ---------------------------------------------------------------------------


def _get_or_create_stats(db: Session, user_id: int) -> PrayerStatistics:
    stats = (
        db.query(PrayerStatistics)
        .filter(PrayerStatistics.user_id == user_id)
        .first()
    )
    if stats is None:
        stats = PrayerStatistics(user_id=user_id)
        db.add(stats)
        db.flush()
    return stats


def recompute_statistics(db: Session, user_id: int) -> PrayerStatistics:
    """Recompute the cached dashboard aggregates for ``user_id``.

    Only rows on or after the user's signup date count toward the
    lifetime totals — anything older (which shouldn't exist but might
    if the schema is back-filled) is excluded so the averages aren't
    dragged down by guaranteed zeros.
    """
    today = date.today()
    signup = get_user_signup_date(db, user_id)
    last30 = max(today - timedelta(days=30), signup)

    # --- Totals --------------------------------------------------------
    totals = (
        db.query(
            PrayerTracking,
        )
        .filter(
            PrayerTracking.user_id == user_id,
            PrayerTracking.tracking_date >= signup,
        )
        .all()
    )
    total_tracked = len(totals)
    total_completed = sum(1 for t in totals if t.is_completed)
    overall_rate = (
        round(100 * total_completed / total_tracked) if total_tracked else 0
    )

    # --- 30-day rate --------------------------------------------------
    recent = [t for t in totals if t.tracking_date >= last30]
    recent_completed = sum(1 for t in recent if t.is_completed)
    last_30_rate = (
        round(100 * recent_completed / len(recent)) if recent else 0
    )

    # --- Best / worst by completion rate -------------------------------
    by_prayer: dict[str, list[bool]] = {p.value: [] for p in PRAYER_ORDER}
    for t in totals:
        # Column is VARCHAR(16); value may come back as a plain str.
        name = t.prayer_name.value if hasattr(t.prayer_name, "value") else str(t.prayer_name)
        by_prayer[name].append(t.is_completed)

    def rate(items: Iterable[bool]) -> int:
        items = list(items)
        if not items:
            return 0
        return round(100 * sum(items) / len(items))

    rates = {name: rate(vals) for name, vals in by_prayer.items() if vals}
    best = max(rates, key=rates.get) if rates else None
    worst = min(rates, key=rates.get) if rates else None

    stats = _get_or_create_stats(db, user_id)
    stats.total_tracked = total_tracked
    stats.total_completed = total_completed
    stats.overall_completion_rate = overall_rate
    stats.last_30_days_rate = last_30_rate
    stats.best_prayer_name = best
    stats.worst_prayer_name = worst
    db.flush()
    return stats


# ---------------------------------------------------------------------------
# Qada helpers
# ---------------------------------------------------------------------------


def _get_or_create_qada(
    db: Session, user_id: int, prayer_name: PrayerName
) -> PrayerQada:
    row = (
        db.query(PrayerQada)
        .filter(PrayerQada.user_id == user_id, PrayerQada.prayer_name == prayer_name)
        .first()
    )
    if row is None:
        row = PrayerQada(user_id=user_id, prayer_name=prayer_name)
        db.add(row)
        db.flush()
    return row


def adjust_qada(
    db: Session, user_id: int, prayer_name: PrayerName, delta: int
) -> PrayerQada:
    """Apply ``delta`` (signed) to the user's qada counter for ``prayer_name``.

    The Qada tile is the *only* place that should call this. Two cases:

    * ``delta > 0`` ("I missed this"): owed_count grows. The user is
      recording a previously-missed prayer that wasn't auto-aged.
    * ``delta < 0`` ("Mark complete"): owed_count shrinks, AND
      ``made_up_count`` grows by ``abs(delta)`` so the Stats view can
      celebrate the make-up.

    Both counters are clamped at zero. The signed delta is also
    recorded in the ``prayer_qada_event`` audit log so per-range
    "qada made up" totals can be computed.
    """
    row = _get_or_create_qada(db, user_id, prayer_name)
    row.owed_count = max(0, row.owed_count + delta)
    if delta < 0:
        row.made_up_count = (row.made_up_count or 0) + (-delta)
    db.flush()
    return row


def increment_qada(
    db: Session, user_id: int, prayer_name: str
) -> PrayerQada:
    """Add 1 to the user's outstanding qada for ``prayer_name``.

    Called when the auto-aging pass in :func:`_age_qada_for_day` sees a
    past day whose scheduled prayer window has closed without a
    check-off. ``made_up_count`` is **not** touched — this is automatic
    aging, not a user action.
    """
    # Accept either a string or a PrayerName enum.
    if isinstance(prayer_name, str):
        prayer_name = PrayerName(prayer_name)
    row = _get_or_create_qada(db, user_id, prayer_name)
    row.owed_count = (row.owed_count or 0) + 1
    db.flush()
    return row


def decrement_qada(
    db: Session, user_id: int, prayer_name: str
) -> PrayerQada:
    """Subtract 1 from the user's outstanding qada for ``prayer_name``.

    Kept for backward compatibility but no longer called from the
    upsert_tracking flow. Qada is now exclusively managed via the
    Qada tile actions (``POST /qada/adjust``).
    """
    if isinstance(prayer_name, str):
        prayer_name = PrayerName(prayer_name)
    row = _get_or_create_qada(db, user_id, prayer_name)
    row.owed_count = max(0, (row.owed_count or 0) - 1)
    db.flush()
    return row


def increment_qada_for_missed_today(
    db: Session, user_id: int, prayer_name: str
) -> PrayerQada:
    """Convenience wrapper used by the daily-aging scheduler.

    Identical to :func:`increment_qada` today; kept as a separate symbol
    so future logic (notifications, streak protection) can hook in here
    without disturbing the per-row check-off path.
    """
    return increment_qada(db, user_id, prayer_name)


# ---------------------------------------------------------------------------
# Qada entry helpers (per-action saved records)
# ---------------------------------------------------------------------------


def create_qada_entry(
    db: Session,
    user_id: int,
    prayer_name: PrayerName,
    made_up_date: date,
    *,
    missed_date: Optional[date] = None,
    is_jamaaah: bool = False,
    notes: Optional[str] = None,
) -> PrayerQadaEntry:
    """Insert a ``prayer_qada_entry`` row recording one qada makeup.

    Called by ``POST /qada/adjust`` when ``delta < 0`` (mark complete).
    Idempotent on the ``(user, prayer_name, made_up_date)`` unique key —
    if a row already exists for that triple we update it in place rather
    than raising, so a repeated tap is a no-op.
    """
    row = (
        db.query(PrayerQadaEntry)
        .filter(
            PrayerQadaEntry.user_id == user_id,
            PrayerQadaEntry.prayer_name == prayer_name,
            PrayerQadaEntry.made_up_date == made_up_date,
        )
        .first()
    )
    if row is None:
        row = PrayerQadaEntry(
            user_id=user_id,
            prayer_name=prayer_name,
            made_up_date=made_up_date,
            missed_date=missed_date,
            is_jamaaah=is_jamaaah,
            notes=notes,
        )
        db.add(row)
    else:
        # Update fields if the user re-taps (keeps the entry fresh).
        row.missed_date = missed_date
        row.is_jamaaah = is_jamaaah
        row.notes = notes
    db.flush()
    return row


def delete_latest_qada_entry(
    db: Session,
    user_id: int,
    prayer_name: PrayerName,
    made_up_date: date,
) -> bool:
    """Delete the most recent qada entry for ``(user, prayer, made_up_date)``.

    Called by ``POST /qada/adjust`` when ``delta > 0`` (undo) so the
    qada entry list stays in sync with the user's intent. Returns
    ``True`` if a row was deleted, ``False`` if none matched.
    """
    row = (
        db.query(PrayerQadaEntry)
        .filter(
            PrayerQadaEntry.user_id == user_id,
            PrayerQadaEntry.prayer_name == prayer_name,
            PrayerQadaEntry.made_up_date == made_up_date,
        )
        .order_by(PrayerQadaEntry.created_at.desc())
        .first()
    )
    if row is None:
        return False
    db.delete(row)
    db.flush()
    return True
