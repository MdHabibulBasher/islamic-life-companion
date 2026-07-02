"""Pydantic schemas for the Prayer Tracker (Module 3 of the PRD).

These schemas are deliberately read/write split:

* ``*Response`` — what the API returns, with ``id``/timestamps.
* ``*Update``   — what the client sends on a partial update.
* ``*Create``   — what the client sends to create a new row.

The schemas never include unrelated user fields; the router joins user data
explicitly when the UI needs it.
"""
from __future__ import annotations

from datetime import date, datetime
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field

from app.models.prayer import (
    CalculationMethod,
    JamaahStatus,
    JuristicMethod,
    PrayerName,
)


# ---------------------------------------------------------------------------
# Shared config
# ---------------------------------------------------------------------------

# Pydantic v2: tell the models to read attributes off ORM rows directly.
model_config = ConfigDict(from_attributes=True)


# ---------------------------------------------------------------------------
# PrayerTracking — daily check-off state
# ---------------------------------------------------------------------------


class PrayerTrackingBase(BaseModel):
    prayer_name: PrayerName
    tracking_date: date
    is_completed: bool = False
    is_jamaaah: bool = False
    notes: Optional[str] = None


class PrayerTrackingCreate(PrayerTrackingBase):
    """Payload for ``POST /prayer-tracking/track``."""

    pass


class PrayerTrackingUpdate(BaseModel):
    """Payload for ``PATCH /prayer-tracking/track``."""

    is_completed: Optional[bool] = None
    is_jamaaah: Optional[bool] = None
    notes: Optional[str] = None


class PrayerTrackingResponse(PrayerTrackingBase):
    id: int
    user_id: int
    completed_at: Optional[datetime] = None
    created_at: datetime
    updated_at: Optional[datetime] = None


# ---------------------------------------------------------------------------
# Composite day view (returned by ``GET /prayer-tracking/today``)
# ---------------------------------------------------------------------------


class DayPrayerStatus(BaseModel):
    """Per-prayer summary for one day."""

    prayer_name: PrayerName
    scheduled_time: Optional[str] = None  # "HH:MM" from Aladhan, if known
    is_completed: bool = False
    completed_at: Optional[datetime] = None
    is_jamaaah: bool = False
    notes: Optional[str] = None


class DayTrackingResponse(BaseModel):
    """A day of 5 prayer statuses + aggregates for the UI."""

    date: date
    prayers: List[DayPrayerStatus]
    completed_count: int
    is_full_day: bool  # 5/5
    sunrise: Optional[str] = None   # "HH:MM" — bounds end of Fajr window
    midnight: Optional[str] = None  # "HH:MM" — bounds end of Isha window
    # The user's signup date (the earliest day they can have a prayer
    # recorded). Frontend uses this to grey out / hide pre-signup days
    # in the week and month views.
    signup_date: Optional[date] = None


# ---------------------------------------------------------------------------
# Streaks
# ---------------------------------------------------------------------------


class PrayerStreakResponse(BaseModel):
    prayer_name: str  # "all" or one of PrayerName values
    current_streak: int
    longest_streak: int
    last_completed_date: Optional[date] = None
    badges: List[str] = Field(default_factory=list)


class AllStreaksResponse(BaseModel):
    """One row per prayer plus the aggregate 'all' streak."""

    streaks: List[PrayerStreakResponse]


# ---------------------------------------------------------------------------
# Qada
# ---------------------------------------------------------------------------


class PrayerQadaResponse(BaseModel):
    prayer_name: PrayerName
    owed_count: int
    made_up_count: int


class AllQadaResponse(BaseModel):
    """Per-prayer outstanding qada + totals."""

    qada: List[PrayerQadaResponse]
    total_owed: int
    total_made_up: int


class QadaUpdateRequest(BaseModel):
    """Payload for ``POST /prayer-tracking/qada/adjust``.

    ``delta`` may be positive (adds to owed) or negative (subtracts).

    ``tracking_date`` is the calendar date the qada adjustment is *for*
    — typically the date of the missed/made-up prayer, e.g. "I marked
    Fajr as made up today (Jul 2) but the prayer I missed was on
    Jun 24" → ``tracking_date=2026-06-24``. Defaults to today when the
    caller (the Qada tile on the daily view) doesn't pass it. The
    audit log stores both ``tracking_date`` (for range filters on the
    Stats view) and ``created_at`` (the wall-clock time the user
    tapped the button).
    """

    prayer_name: PrayerName
    delta: int = Field(..., description="Signed change to owed_count.")
    tracking_date: Optional[date] = Field(
        None,
        description=(
            "Calendar date the adjustment is FOR (e.g. the date of the "
            "missed prayer). Defaults to today when omitted."
        ),
    )


class QadaPrayerStats(BaseModel):
    """Per-prayer qada breakdown for a single date range.

    Splitting the numbers this way lets the Stats view show a coherent
    story for the selected month without having to mix data from two
    different sources (the live ``prayer_qada`` row + the audit log
    ``prayer_qada_event``). All counts are integers; all deltas are
    server-side computed from the audit log when an inclusive
    ``start``/``end`` is provided.

    Fields:

    * ``prayer_name``         — one of the 5 daily prayers
    * ``added_in_range``      — ``delta > 0`` events within the range
                                (missed prayers that became qada)
    * ``made_up_in_range``    — ``delta < 0`` events within the range
                                (qada prayers the user marked complete)
    * ``net_in_range``        — ``added_in_range - made_up_in_range``
                                (range-scoped change to the owed pile)
    * ``owed_now``            — current ``prayer_qada.owed_count``
                                (lifetime outstanding after makeup)
    * ``made_up_now``         — current ``prayer_qada.made_up_count``
                                (lifetime qada the user has cleared)
    """

    prayer_name: PrayerName
    added_in_range: int = 0
    made_up_in_range: int = 0
    net_in_range: int = 0
    owed_now: int = 0
    made_up_now: int = 0


class QadaStatsResponse(BaseModel):
    """Range-scoped qada summary for the Stats view.

    The frontend Stats view previously had to combine two unrelated
    sources (the lifetime ``prayer_qada`` table for "owed" + the audit
    log ``prayer_qada_event`` for "made up") which produced confusing
    numbers — e.g. "13 qada owed" appearing on prayers with no missed
    days in the selected month, because those owed counts were
    lifetime aggregates from days outside the visible range.

    This endpoint returns everything the Stats view needs in one
    consistent payload, scoped to the requested ``[start, end]``
    window when one is provided.

    Fields:

    * ``start`` / ``end``                  — echoed ISO dates
    * ``items``                           — one :class:`QadaPrayerStats`
                                             per prayer in display order
                                             (always 5 rows even if all
                                             zeros, so the UI can render
                                             a stable table)
    * ``total_added_in_range``             — sum of ``added_in_range``
    * ``total_made_up_in_range``           — sum of ``made_up_in_range``
    * ``total_net_in_range``               — sum of ``net_in_range``
    * ``total_owed_now``                   — sum of ``owed_now``
                                             (lifetime outstanding)
    * ``total_made_up_now``                — sum of ``made_up_now``
                                             (lifetime cleared)
    """

    start: Optional[date] = None
    end: Optional[date] = None
    items: List[QadaPrayerStats]
    total_added_in_range: int = 0
    total_made_up_in_range: int = 0
    total_net_in_range: int = 0
    total_owed_now: int = 0
    total_made_up_now: int = 0


# ---------------------------------------------------------------------------
# Settings
# ---------------------------------------------------------------------------


class PrayerSettingsBase(BaseModel):
    calculation_method: CalculationMethod = CalculationMethod.ISNA
    juristic_method: JuristicMethod = JuristicMethod.SHAFI
    notifications_enabled: bool = True
    reminder_minutes_before: int = Field(10, ge=0, le=60)
    track_jamaaah: bool = False
    track_qada: bool = True


class PrayerSettingsUpdate(BaseModel):
    """Partial update; only the fields the client sends are touched."""

    calculation_method: Optional[CalculationMethod] = None
    juristic_method: Optional[JuristicMethod] = None
    notifications_enabled: Optional[bool] = None
    reminder_minutes_before: Optional[int] = Field(None, ge=0, le=60)
    track_jamaaah: Optional[bool] = None
    track_qada: Optional[bool] = None


class PrayerSettingsResponse(PrayerSettingsBase):
    id: int
    user_id: int
    created_at: datetime
    updated_at: Optional[datetime] = None


# ---------------------------------------------------------------------------
# Statistics
# ---------------------------------------------------------------------------


class PrayerStatisticsResponse(BaseModel):
    total_tracked: int
    total_completed: int
    overall_completion_rate: int  # 0..100

    best_prayer_name: Optional[str] = None
    worst_prayer_name: Optional[str] = None

    last_30_days_rate: int  # 0..100

    # Per-prayer breakdown (5 rows; one per PrayerName)
    by_prayer: List[DayPrayerStatus] = Field(default_factory=list)
    # Convenience duplicates so the dashboard can show streaks inline.
    streaks: List[PrayerStreakResponse] = Field(default_factory=list)
    qada: List[PrayerQadaResponse] = Field(default_factory=list)


# ---------------------------------------------------------------------------
# CSV export
# ---------------------------------------------------------------------------


class CsvExportResponse(BaseModel):
    csv: str
    row_count: int
