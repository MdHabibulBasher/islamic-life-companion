"""Tests for the Prayer Tracker module (Module 3 of the PRD).

Covers the headlining features:
- Daily check-off upsert (idempotent on the unique triple)
- Streak computation: per-prayer, all-5-aggregate, badges
- Qada adjustments (signed delta, clamp at zero)
- Settings round-trip
- Statistics aggregation (overall rate, best/worst, 30-day rate)
- CSV export
- Auth required (401 without bearer token)
"""
from datetime import date, timedelta

from sqlalchemy import and_

from app.models.prayer import (
    CalculationMethod,
    JuristicMethod,
    PrayerName,
    PrayerQada,
    PrayerStreak,
    PrayerTracking,
)
from app.services.prayer_tracker import (
    PRAYER_ORDER,
    STREAK_MILESTONES,
    recompute_all_streaks,
    recompute_statistics,
    recompute_streak,
)


# ---------------------------------------------------------------------------
# Auth
# ---------------------------------------------------------------------------


def test_endpoints_require_auth(client):
    """Every prayer-tracking endpoint must demand a Bearer token."""
    for method, path in [
        ("GET", "/api/v1/prayer-tracking/today"),
        ("GET", "/api/v1/prayer-tracking/week"),
        ("GET", "/api/v1/prayer-tracking/month/2026/6"),
        ("GET", "/api/v1/prayer-tracking/streaks"),
        ("GET", "/api/v1/prayer-tracking/qada"),
        ("GET", "/api/v1/prayer-tracking/settings"),
        ("GET", "/api/v1/prayer-tracking/statistics"),
        ("GET", "/api/v1/prayer-tracking/export.csv"),
        ("GET", "/api/v1/prayer-tracking/day/2026-06-20"),
        ("GET", "/api/v1/prayer-tracking/summary?start=2026-06-01&end=2026-06-30"),
        ("GET", "/api/v1/prayer-tracking/qada/history"),
        ("GET", "/api/v1/prayer-tracking/streaks"),
        ("POST", "/api/v1/prayer-tracking/track"),
        ("POST", "/api/v1/prayer-tracking/qada/adjust"),
        ("POST", "/api/v1/prayer-tracking/streaks/recompute"),
    ]:
        r = client.request(method, path)
        assert r.status_code == 401, f"{method} {path} should require auth, got {r.status_code}"


# ---------------------------------------------------------------------------
# Tracking (POST /track)
# ---------------------------------------------------------------------------


def test_track_creates_row_and_updates_streaks(client, auth_headers, db_session, test_user):
    today = date.today()
    r = client.post(
        "/api/v1/prayer-tracking/track",
        headers=auth_headers,
        json={
            "prayer_name": PrayerName.FAJR.value,
            "tracking_date": today.isoformat(),
            "is_completed": True,
        },
    )
    assert r.status_code == 201, r.text
    data = r.json()
    assert data["is_completed"] is True
    assert data["prayer_name"] == PrayerName.FAJR.value

    # Streak row was created with current_streak=1
    streak = (
        db_session.query(PrayerStreak)
        .filter(
            PrayerStreak.user_id == test_user.id,
            PrayerStreak.prayer_name == PrayerName.FAJR.value,
        )
        .first()
    )
    assert streak is not None
    assert streak.current_streak == 1
    assert streak.longest_streak == 1


def test_track_idempotent_on_same_triple(client, auth_headers, db_session, test_user):
    today = date.today()
    payload = {
        "prayer_name": PrayerName.DHUHR.value,
        "tracking_date": today.isoformat(),
        "is_completed": True,
    }
    r1 = client.post("/api/v1/prayer-tracking/track", headers=auth_headers, json=payload)
    r2 = client.post("/api/v1/prayer-tracking/track", headers=auth_headers, json=payload)
    assert r1.status_code == 201
    assert r2.status_code == 201

    # Only one row exists.
    count = (
        db_session.query(PrayerTracking)
        .filter(
            PrayerTracking.user_id == test_user.id,
            PrayerTracking.tracking_date == today,
            PrayerTracking.prayer_name == PrayerName.DHUHR.value,
        )
        .count()
    )
    assert count == 1


def test_track_toggle_updates_completed_at(client, auth_headers, db_session, test_user):
    today = date.today()
    payload = {
        "prayer_name": PrayerName.ASR.value,
        "tracking_date": today.isoformat(),
        "is_completed": True,
    }
    r = client.post("/api/v1/prayer-tracking/track", headers=auth_headers, json=payload)
    assert r.status_code == 201
    row = (
        db_session.query(PrayerTracking)
        .filter(
            PrayerTracking.user_id == test_user.id,
            PrayerTracking.prayer_name == PrayerName.ASR.value,
        )
        .first()
    )
    assert row is not None
    assert row.completed_at is not None


# ---------------------------------------------------------------------------
# Today view
# ---------------------------------------------------------------------------


def test_today_view_returns_all_five_with_completion_flags(
    client, auth_headers, db_session, test_user
):
    today = date.today()
    for prayer in PRAYER_ORDER:
        client.post(
            "/api/v1/prayer-tracking/track",
            headers=auth_headers,
            json={
                "prayer_name": prayer.value,
                "tracking_date": today.isoformat(),
                "is_completed": True,
            },
        )
    r = client.get("/api/v1/prayer-tracking/today", headers=auth_headers)
    assert r.status_code == 200
    data = r.json()
    assert len(data["prayers"]) == 5
    assert data["completed_count"] == 5
    assert data["is_full_day"] is True


def test_today_view_when_no_tracking(client, auth_headers):
    r = client.get("/api/v1/prayer-tracking/today", headers=auth_headers)
    assert r.status_code == 200
    data = r.json()
    assert data["completed_count"] == 0
    assert data["is_full_day"] is False
    assert {p["prayer_name"] for p in data["prayers"]} == {p.value for p in PRAYER_ORDER}


# ---------------------------------------------------------------------------
# Streak recomputation
# ---------------------------------------------------------------------------


def test_streak_breaks_when_a_day_is_skipped(client, auth_headers, db_session, test_user):
    """Day1: fajr done. Day2: nothing. Day3: fajr done. Streak should be 1, not 3."""
    today = date.today()
    for offset in (2, 0):  # 2 days ago + today (gap of one day in between)
        client.post(
            "/api/v1/prayer-tracking/track",
            headers=auth_headers,
            json={
                "prayer_name": PrayerName.FAJR.value,
                "tracking_date": (today - timedelta(days=offset)).isoformat(),
                "is_completed": True,
            },
        )

    r = client.get("/api/v1/prayer-tracking/streaks", headers=auth_headers)
    assert r.status_code == 200
    fajr = next(s for s in r.json()["streaks"] if s["prayer_name"] == PrayerName.FAJR.value)
    assert fajr["current_streak"] == 1
    assert fajr["longest_streak"] == 1


def test_streak_all_increments_only_when_full_day(client, auth_headers, db_session, test_user):
    today = date.today()
    yesterday = today - timedelta(days=1)

    # Yesterday: complete 4 of 5. Should NOT count as full day.
    for prayer in PRAYER_ORDER[:4]:
        client.post(
            "/api/v1/prayer-tracking/track",
            headers=auth_headers,
            json={
                "prayer_name": prayer.value,
                "tracking_date": yesterday.isoformat(),
                "is_completed": True,
            },
        )
    # Today: complete all 5.
    for prayer in PRAYER_ORDER:
        client.post(
            "/api/v1/prayer-tracking/track",
            headers=auth_headers,
            json={
                "prayer_name": prayer.value,
                "tracking_date": today.isoformat(),
                "is_completed": True,
            },
        )

    r = client.get("/api/v1/prayer-tracking/streaks", headers=auth_headers)
    assert r.status_code == 200
    all_row = next(s for s in r.json()["streaks"] if s["prayer_name"] == "all")
    assert all_row["current_streak"] == 1  # Only today counts; yesterday was 4/5


def test_streak_badges_promotion(client, auth_headers, db_session, test_user):
    """Bronze (7d) badge should appear once longest_streak reaches 7."""
    today = date.today()
    for offset in range(8):  # 8 consecutive days of fajr
        client.post(
            "/api/v1/prayer-tracking/track",
            headers=auth_headers,
            json={
                "prayer_name": PrayerName.FAJR.value,
                "tracking_date": (today - timedelta(days=offset)).isoformat(),
                "is_completed": True,
            },
        )

    r = client.get("/api/v1/prayer-tracking/streaks", headers=auth_headers)
    fajr = next(s for s in r.json()["streaks"] if s["prayer_name"] == PrayerName.FAJR.value)
    assert fajr["longest_streak"] >= 7
    assert "bronze" in fajr["badges"]


def test_streaks_recompute_endpoint(client, auth_headers, db_session, test_user):
    today = date.today()
    for prayer in PRAYER_ORDER:
        client.post(
            "/api/v1/prayer-tracking/track",
            headers=auth_headers,
            json={
                "prayer_name": prayer.value,
                "tracking_date": today.isoformat(),
                "is_completed": True,
            },
        )
    r = client.post("/api/v1/prayer-tracking/streaks/recompute", headers=auth_headers)
    assert r.status_code == 200
    data = r.json()
    assert "streaks" in data
    all_row = next(s for s in data["streaks"] if s["prayer_name"] == "all")
    assert all_row["current_streak"] == 1


# ---------------------------------------------------------------------------
# Qada
# ---------------------------------------------------------------------------


def test_qada_adjust_positive_then_negative(client, auth_headers, db_session, test_user):
    r = client.post(
        "/api/v1/prayer-tracking/qada/adjust",
        headers=auth_headers,
        json={"prayer_name": PrayerName.FAJR.value, "delta": 2},
    )
    assert r.status_code == 200
    assert r.json()["owed_count"] == 2

    r = client.post(
        "/api/v1/prayer-tracking/qada/adjust",
        headers=auth_headers,
        json={"prayer_name": PrayerName.FAJR.value, "delta": -1},
    )
    assert r.status_code == 200
    assert r.json()["owed_count"] == 1


def test_qada_clamps_at_zero(client, auth_headers, db_session, test_user):
    """Going below zero should be clamped, not negative."""
    r = client.post(
        "/api/v1/prayer-tracking/qada/adjust",
        headers=auth_headers,
        json={"prayer_name": PrayerName.ISHA.value, "delta": -5},
    )
    assert r.status_code == 200
    assert r.json()["owed_count"] == 0


def test_qada_get_returns_totals(client, auth_headers, db_session, test_user):
    for prayer in (PrayerName.FAJR, PrayerName.DHUHR, PrayerName.ASR):
        client.post(
            "/api/v1/prayer-tracking/qada/adjust",
            headers=auth_headers,
            json={"prayer_name": prayer.value, "delta": 1},
        )
    r = client.get("/api/v1/prayer-tracking/qada", headers=auth_headers)
    assert r.status_code == 200
    data = r.json()
    assert data["total_owed"] == 3
    assert len(data["qada"]) == 5  # one row per prayer


# ---------------------------------------------------------------------------
# Settings
# ---------------------------------------------------------------------------


def test_settings_default_on_first_get(client, auth_headers, db_session, test_user):
    r = client.get("/api/v1/prayer-tracking/settings", headers=auth_headers)
    assert r.status_code == 200
    data = r.json()
    assert data["calculation_method"] == CalculationMethod.ISNA.value
    assert data["juristic_method"] == JuristicMethod.SHAFI.value
    assert data["notifications_enabled"] is True
    assert data["track_qada"] is True
    assert data["track_jamaaah"] is False


def test_settings_partial_update(client, auth_headers, db_session, test_user):
    r = client.put(
        "/api/v1/prayer-tracking/settings",
        headers=auth_headers,
        json={"calculation_method": CalculationMethod.MWL.value, "track_jamaaah": True},
    )
    assert r.status_code == 200
    data = r.json()
    assert data["calculation_method"] == CalculationMethod.MWL.value
    assert data["track_jamaaah"] is True
    # Other fields unchanged.
    assert data["juristic_method"] == JuristicMethod.SHAFI.value


def test_settings_update_rejects_invalid_method(client, auth_headers):
    r = client.put(
        "/api/v1/prayer-tracking/settings",
        headers=auth_headers,
        json={"calculation_method": "definitely_not_valid"},
    )
    assert r.status_code == 422


# ---------------------------------------------------------------------------
# Statistics
# ---------------------------------------------------------------------------


def test_statistics_aggregates_correctly(client, auth_headers, db_session, test_user):
    today = date.today()
    # Mark 3 of 5 today as completed.
    for prayer in PRAYER_ORDER[:3]:
        client.post(
            "/api/v1/prayer-tracking/track",
            headers=auth_headers,
            json={
                "prayer_name": prayer.value,
                "tracking_date": today.isoformat(),
                "is_completed": True,
            },
        )
    r = client.get("/api/v1/prayer-tracking/statistics", headers=auth_headers)
    assert r.status_code == 200
    data = r.json()
    assert data["total_tracked"] == 3
    assert data["total_completed"] == 3
    assert data["overall_completion_rate"] == 100
    assert data["last_30_days_rate"] == 100
    # Best prayer should be among the 3 completed ones.
    assert data["best_prayer_name"] in {p.value for p in PRAYER_ORDER[:3]}


def test_statistics_marks_zero_when_nothing_done(client, auth_headers):
    r = client.get("/api/v1/prayer-tracking/statistics", headers=auth_headers)
    assert r.status_code == 200
    data = r.json()
    assert data["total_tracked"] == 0
    assert data["overall_completion_rate"] == 0


# ---------------------------------------------------------------------------
# CSV export
# ---------------------------------------------------------------------------


def test_csv_export_streams_csv(client, auth_headers, db_session, test_user):
    today = date.today()
    for prayer in PRAYER_ORDER[:2]:
        client.post(
            "/api/v1/prayer-tracking/track",
            headers=auth_headers,
            json={
                "prayer_name": prayer.value,
                "tracking_date": today.isoformat(),
                "is_completed": True,
            },
        )

    r = client.get("/api/v1/prayer-tracking/export.csv", headers=auth_headers)
    assert r.status_code == 200
    assert r.headers["content-type"].startswith("text/csv")
    body = r.text
    assert "date,prayer_name,is_completed" in body
    assert today.isoformat() in body
    assert PrayerName.FAJR.value in body


# ---------------------------------------------------------------------------
# Service-layer unit tests (pure logic, no HTTP)
# ---------------------------------------------------------------------------


def test_recompute_streak_with_no_data(client, auth_headers, db_session, test_user):
    """Calling recompute_streak on an empty user should write 0/0/None."""
    row = recompute_streak(db_session, test_user.id, PrayerName.FAJR.value)
    db_session.commit()
    assert row.current_streak == 0
    assert row.longest_streak == 0
    assert row.last_completed_date is None


def test_recompute_all_streaks_creates_six_rows(client, auth_headers, db_session, test_user):
    today = date.today()
    for prayer in PRAYER_ORDER:
        client.post(
            "/api/v1/prayer-tracking/track",
            headers=auth_headers,
            json={
                "prayer_name": prayer.value,
                "tracking_date": today.isoformat(),
                "is_completed": True,
            },
        )
    rows = recompute_all_streaks(db_session, test_user.id)
    db_session.commit()
    assert len(rows) == 6  # 5 prayers + "all"
    by_name = {r.prayer_name: r for r in rows}
    assert "all" in by_name
    assert by_name["all"].current_streak == 1


def test_recompute_statistics_zero_when_no_data(client, auth_headers, db_session, test_user):
    stats = recompute_statistics(db_session, test_user.id)
    db_session.commit()
    assert stats.total_tracked == 0
    assert stats.total_completed == 0
    assert stats.overall_completion_rate == 0
    assert stats.last_30_days_rate == 0


def test_milestones_thresholds_are_sorted_ascending():
    """Sanity: STREAK_MILESTONES must be in ascending threshold order."""
    thresholds = [t for t, _ in STREAK_MILESTONES]
    assert thresholds == sorted(thresholds)


# ---------------------------------------------------------------------------
# Week + month views
# ---------------------------------------------------------------------------


def test_week_view_returns_seven_days(client, auth_headers):
    r = client.get("/api/v1/prayer-tracking/week", headers=auth_headers)
    assert r.status_code == 200
    days = r.json()
    assert len(days) == 7
    # Days are in ascending date order.
    dates = [d["date"] for d in days]
    assert dates == sorted(dates)


def test_month_view_returns_correct_day_count(client, auth_headers):
    # June has 30 days.
    r = client.get("/api/v1/prayer-tracking/month/2026/6", headers=auth_headers)
    assert r.status_code == 200
    days = r.json()
    assert len(days) == 30

    # February 2026 is not a leap year (2026 is not divisible by 4).
    r = client.get("/api/v1/prayer-tracking/month/2026/2", headers=auth_headers)
    assert r.status_code == 200
    assert len(r.json()) == 28

    # February 2024 (leap year).
    r = client.get("/api/v1/prayer-tracking/month/2024/2", headers=auth_headers)
    assert r.status_code == 200
    assert len(r.json()) == 29


def test_month_view_rejects_invalid_month(client, auth_headers):
    r = client.get("/api/v1/prayer-tracking/month/2026/13", headers=auth_headers)
    assert r.status_code == 400


# ---------------------------------------------------------------------------
# Delete
# ---------------------------------------------------------------------------


def test_delete_tracking_returns_204(client, auth_headers, db_session, test_user):
    today = date.today()
    r = client.post(
        "/api/v1/prayer-tracking/track",
        headers=auth_headers,
        json={
            "prayer_name": PrayerName.MAGHRIB.value,
            "tracking_date": today.isoformat(),
            "is_completed": True,
        },
    )
    tid = r.json()["id"]
    r = client.delete(f"/api/v1/prayer-tracking/track/{tid}", headers=auth_headers)
    assert r.status_code == 204
    assert (
        db_session.query(PrayerTracking).filter(PrayerTracking.id == tid).first() is None
    )


def test_delete_other_users_row_is_404(client, auth_headers, db_session):
    """A user cannot delete another user's tracking row."""
    # No row exists at all -> 404.
    r = client.delete("/api/v1/prayer-tracking/track/99999", headers=auth_headers)
    assert r.status_code == 404


# ---------------------------------------------------------------------------
# Range summary (GET /summary)
# ---------------------------------------------------------------------------


def test_summary_aggregates_prayed_and_missed(client, auth_headers, db_session, test_user):
    """Range summary should reflect only what the user actually logged."""
    today = date.today()
    # The test user is created on today's date, so we can't backdate.
    # Use today for both "days" and assert the counts add up correctly.
    r1 = client.post(
        "/api/v1/prayer-tracking/track",
        headers=auth_headers,
        json={
            "prayer_name": PrayerName.FAJR.value,
            "tracking_date": today.isoformat(),
            "is_completed": True,
        },
    )
    assert r1.status_code == 201, r1.text
    client.post(
        "/api/v1/prayer-tracking/track",
        headers=auth_headers,
        json={
            "prayer_name": PrayerName.ASR.value,
            "tracking_date": today.isoformat(),
            "is_completed": False,
        },
    )
    # Complete the other 3 prayers today.
    for prayer in (PrayerName.DHUHR, PrayerName.MAGHRIB, PrayerName.ISHA):
        client.post(
            "/api/v1/prayer-tracking/track",
            headers=auth_headers,
            json={
                "prayer_name": prayer.value,
                "tracking_date": today.isoformat(),
                "is_completed": True,
            },
        )

    start = today.isoformat()
    end = today.isoformat()
    r = client.get(
        f"/api/v1/prayer-tracking/summary?start={start}&end={end}",
        headers=auth_headers,
    )
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["prayed"] == 4      # Fajr + Dhuhr + Maghrib + Isha
    assert data["missed"] == 1      # Asr unchecked
    assert data["full_days"] == 0   # 4/5 today
    # Per-prayer breakdown
    fajr = next(p for p in data["per_prayer"] if p["prayer_name"] == PrayerName.FAJR.value)
    asr = next(p for p in data["per_prayer"] if p["prayer_name"] == PrayerName.ASR.value)
    assert fajr["prayed"] == 1
    assert asr["prayed"] == 0
    assert asr["missed"] == 1


def test_summary_rejects_inverted_range(client, auth_headers):
    r = client.get(
        "/api/v1/prayer-tracking/summary?start=2026-06-30&end=2026-06-01",
        headers=auth_headers,
    )
    assert r.status_code == 400


def test_summary_handles_empty_range(client, auth_headers):
    today = date.today()
    r = client.get(
        f"/api/v1/prayer-tracking/summary?start={today.isoformat()}&end={today.isoformat()}",
        headers=auth_headers,
    )
    assert r.status_code == 200
    data = r.json()
    assert data["prayed"] == 0
    assert data["missed"] == 0
    assert data["full_days"] == 0


# ---------------------------------------------------------------------------
# Qada history (GET /qada/history)
# ---------------------------------------------------------------------------


def test_qada_history_records_each_adjustment(client, auth_headers, db_session, test_user):
    """Each POST /qada/adjust should leave a row in prayer_qada_event."""
    client.post(
        "/api/v1/prayer-tracking/qada/adjust",
        headers=auth_headers,
        json={"prayer_name": PrayerName.FAJR.value, "delta": 1},
    )
    client.post(
        "/api/v1/prayer-tracking/qada/adjust",
        headers=auth_headers,
        json={"prayer_name": PrayerName.FAJR.value, "delta": -1},
    )

    r = client.get("/api/v1/prayer-tracking/qada/history", headers=auth_headers)
    assert r.status_code == 200
    data = r.json()
    fajr = next((i for i in data["items"] if i["prayer_name"] == PrayerName.FAJR.value), None)
    assert fajr is not None
    assert fajr["net_delta"] == 0
    assert fajr["added"] == 1
    assert fajr["made_up"] == 1
    assert data["total_made_up"] == 1
    assert data["total_added"] == 1


def test_qada_history_filters_by_date_range(client, auth_headers, db_session, test_user):
    """Adjustments outside the range should not be counted."""
    from datetime import datetime, timezone
    from app.models.prayer import PrayerQadaEvent

    # One event "yesterday" (in range), one event 60 days ago (out of range).
    today = date.today()
    in_range = datetime.combine(today - timedelta(days=2), datetime.min.time())
    out_of_range = datetime.combine(today - timedelta(days=60), datetime.min.time())
    db_session.add_all(
        [
            PrayerQadaEvent(
                user_id=test_user.id,
                prayer_name=PrayerName.DHUHR.value,
                delta=-1,
                reason="manual_adjust",
                created_at=in_range,
            ),
            PrayerQadaEvent(
                user_id=test_user.id,
                prayer_name=PrayerName.DHUHR.value,
                delta=-1,
                reason="manual_adjust",
                created_at=out_of_range,
            ),
        ]
    )
    db_session.commit()

    start = (today - timedelta(days=7)).isoformat()
    end = today.isoformat()
    r = client.get(
        f"/api/v1/prayer-tracking/qada/history?start={start}&end={end}",
        headers=auth_headers,
    )
    assert r.status_code == 200
    data = r.json()
    dhuhr = next(i for i in data["items"] if i["prayer_name"] == PrayerName.DHUHR.value)
    assert dhuhr["made_up"] == 1  # only the in-range one
    assert data["total_made_up"] == 1


# ---------------------------------------------------------------------------
# Qada entries (prayer_qada_entry — saved per-action makeup records)
# ---------------------------------------------------------------------------


def test_qada_adjust_creates_entry(client, auth_headers, db_session, test_user):
    """POST /qada/adjust with delta=-1 creates a prayer_qada_entry row."""
    from app.models.prayer import PrayerQadaEntry

    today = date.today()
    r = client.post(
        "/api/v1/prayer-tracking/qada/adjust",
        headers=auth_headers,
        json={
            "prayer_name": PrayerName.FAJR.value,
            "delta": -1,
            "tracking_date": today.isoformat(),
        },
    )
    assert r.status_code == 200, r.text

    entry = (
        db_session.query(PrayerQadaEntry)
        .filter(
            PrayerQadaEntry.user_id == test_user.id,
            PrayerQadaEntry.prayer_name == PrayerName.FAJR.value,
            PrayerQadaEntry.made_up_date == today,
        )
        .first()
    )
    assert entry is not None
    assert entry.made_up_date == today


def test_qada_entries_endpoint(client, auth_headers, db_session, test_user):
    """GET /qada/entries returns the saved qada entries."""
    from app.models.prayer import PrayerQadaEntry

    today = date.today()
    db_session.add(
        PrayerQadaEntry(
            user_id=test_user.id,
            prayer_name=PrayerName.DHUHR.value,
            made_up_date=today,
        )
    )
    db_session.commit()

    r = client.get("/api/v1/prayer-tracking/qada/entries", headers=auth_headers)
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["total"] == 1
    assert len(data["entries"]) == 1
    assert data["entries"][0]["prayer_name"] == PrayerName.DHUHR.value
    assert data["per_prayer"]["dhuhr"] == 1


def test_qada_entries_date_filter(client, auth_headers, db_session, test_user):
    """GET /qada/entries?start=&end= filters by made_up_date."""
    from app.models.prayer import PrayerQadaEntry

    today = date.today()
    old_date = today - timedelta(days=30)
    db_session.add_all(
        [
            PrayerQadaEntry(
                user_id=test_user.id,
                prayer_name=PrayerName.ASR.value,
                made_up_date=old_date,
            ),
            PrayerQadaEntry(
                user_id=test_user.id,
                prayer_name=PrayerName.MAGHRIB.value,
                made_up_date=today,
            ),
        ]
    )
    db_session.commit()

    start = (today - timedelta(days=7)).isoformat()
    r = client.get(
        f"/api/v1/prayer-tracking/qada/entries?start={start}",
        headers=auth_headers,
    )
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["total"] == 1
    assert data["entries"][0]["prayer_name"] == PrayerName.MAGHRIB.value


def test_qada_undo_removes_entry(client, auth_headers, db_session, test_user):
    """POST /qada/adjust with delta=+1 (undo) removes the qada entry."""
    from app.models.prayer import PrayerQadaEntry

    today = date.today()
    # Mark complete (creates entry)
    r = client.post(
        "/api/v1/prayer-tracking/qada/adjust",
        headers=auth_headers,
        json={
            "prayer_name": PrayerName.ISHA.value,
            "delta": -1,
            "tracking_date": today.isoformat(),
        },
    )
    assert r.status_code == 200
    entry = (
        db_session.query(PrayerQadaEntry)
        .filter(
            PrayerQadaEntry.user_id == test_user.id,
            PrayerQadaEntry.prayer_name == PrayerName.ISHA.value,
        )
        .first()
    )
    assert entry is not None

    # Undo (removes entry)
    r = client.post(
        "/api/v1/prayer-tracking/qada/adjust",
        headers=auth_headers,
        json={
            "prayer_name": PrayerName.ISHA.value,
            "delta": 1,
            "tracking_date": today.isoformat(),
        },
    )
    assert r.status_code == 200
    entry = (
        db_session.query(PrayerQadaEntry)
        .filter(
            PrayerQadaEntry.user_id == test_user.id,
            PrayerQadaEntry.prayer_name == PrayerName.ISHA.value,
        )
        .first()
    )
    assert entry is None


def test_qada_entry_preserves_prayer_row(client, auth_headers, db_session, test_user):
    """Tapping Qada tile "Mark complete" still flips the Prayer Row (unchanged)."""
    today = date.today()
    r = client.post(
        "/api/v1/prayer-tracking/qada/adjust",
        headers=auth_headers,
        json={
            "prayer_name": PrayerName.FAJR.value,
            "delta": -1,
            "tracking_date": today.isoformat(),
        },
    )
    assert r.status_code == 200

    track = (
        db_session.query(PrayerTracking)
        .filter(
            PrayerTracking.user_id == test_user.id,
            PrayerTracking.tracking_date == today,
            PrayerTracking.prayer_name == PrayerName.FAJR.value,
        )
        .first()
    )
    assert track is not None
    assert track.is_completed is True
