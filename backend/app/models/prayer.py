"""Prayer tracker models.

Layered design (smallest to largest):

1. ``Prayer`` — the legacy row written by the daily cron (cached Aladhan
   timings). Kept for backward compatibility with the original ``prayers``
   table; the tracker does not read from it directly.

2. ``PrayerTracking`` — one row per ``(user, date, prayer_name)``. The actual
   check-off state used by the UI. Unique constraint on the triple so
   repeated PUTs are idempotent.

3. ``PrayerStreak`` — one row per ``(user, prayer_name)`` with
   current / longest streak. A separate row with ``prayer_name = "all"``
   tracks the "all 5 completed" daily streak.

4. ``PrayerQada`` — one row per ``(user, prayer_name)`` counting makeup
   prayers owed (positive) or made up (negative or zero). Increments on a
   missed prayer, decrements when the user logs a qada.

5. ``PrayerSettings`` — one row per user: calculation method, juristic
   method, notifications, jamaa'ah tracking, etc.

6. ``PrayerStatistics`` — one row per user: cached aggregates for the
   dashboard (overall completion rate, best / worst prayer, etc.).

These six tables together implement Module 3 of the PRD (Prayer Tracker).
"""
from __future__ import annotations

import enum
from datetime import date, datetime

from sqlalchemy import (
    Boolean,
    Column,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.sql import func

from app.core.database import Base


# ---------------------------------------------------------------------------
# Enums
# ---------------------------------------------------------------------------


class PrayerName(str, enum.Enum):
    """The five daily prayers."""

    FAJR = "fajr"
    DHUHR = "dhuhr"
    ASR = "asr"
    MAGHRIB = "maghrib"
    ISHA = "isha"


class CalculationMethod(str, enum.Enum):
    """Aladhan calculation methods we expose to the user.

    Numbers map to Aladhan's `method` query param.
    """

    ISNA = "isna"          # Islamic Society of North America (default for USA)
    MWL = "mwl"            # Muslim World League
    EGYPT = "egypt"        # Egyptian General Authority of Survey
    KARACHI = "karachi"    # Univ. of Islamic Sciences, Karachi
    MAKKAH = "makkah"      # Umm al-Qura University, Makkah
    CUSTOM = "custom"      # User-specified advanced parameters


class JuristicMethod(str, enum.Enum):
    """For Asr: shadow length = factor * object length."""

    SHAFI = "shafi"   # Shadow = 1x (default; earlier Asr)
    HANAFI = "hanafi" # Shadow = 2x (later Asr)


class JamaahStatus(str, enum.Enum):
    NOT_TRACKED = "not_tracked"
    ALONE = "alone"
    JAMAAAH = "jamaa'ah"


# ---------------------------------------------------------------------------
# 1. Legacy Prayer — kept for the cached-timings cron. Not actively used by
#    the tracker UI; the tracker reads timings from Aladhan directly via
#    /prayer-times/* endpoints.
# ---------------------------------------------------------------------------


class Prayer(Base):
    __tablename__ = "prayers"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    prayer_name = Column(String, nullable=False)
    prayer_time = Column(String, nullable=False)
    is_completed = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


# ---------------------------------------------------------------------------
# 2. PrayerTracking — daily check-off state, the core of the tracker.
# ---------------------------------------------------------------------------


class PrayerTracking(Base):
    """One row per ``(user_id, tracking_date, prayer_name)``.

    A PUT/POST upsert is idempotent on the unique triple, so the front-end
    can safely call toggle endpoints without first reading.
    """

    __tablename__ = "prayer_tracking"
    __table_args__ = (
        UniqueConstraint(
            "user_id", "tracking_date", "prayer_name",
            name="uq_prayer_tracking_user_date_name",
        ),
    )

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    tracking_date = Column(Date, nullable=False, index=True)
    # Stored as String (not Enum) for cross-DB portability. The Python
    # PrayerName enum + Pydantic validation still enforce the legal values.
    prayer_name = Column(String(16), nullable=False)

    is_completed = Column(Boolean, default=False, nullable=False)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    is_jamaaah = Column(Boolean, default=False, nullable=False)
    notes = Column(Text, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


# ---------------------------------------------------------------------------
# 3. PrayerStreak — current / longest streak per prayer (+ an "all" row).
# ---------------------------------------------------------------------------


class PrayerStreak(Base):
    """Streak counters. ``prayer_name = "all"`` is the aggregate daily streak.

    A daily streak increments when all 5 prayers for a day are completed;
    it resets to 0 the first time a day ends with fewer than 5 completions.
    Individual streaks work the same per-prayer.
    """

    __tablename__ = "prayer_streaks"
    __table_args__ = (
        UniqueConstraint("user_id", "prayer_name", name="uq_prayer_streaks_user_name"),
    )

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    # "all" or one of PrayerName values. We use String instead of Enum so the
    # "all" sentinel works alongside the enum without an extra enum value.
    prayer_name = Column(String, nullable=False)

    current_streak = Column(Integer, default=0, nullable=False)
    longest_streak = Column(Integer, default=0, nullable=False)
    last_completed_date = Column(Date, nullable=True)

    # Milestone badges unlocked (csv of bronze/silver/gold/diamond).
    badges = Column(String, default="", nullable=False)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


# ---------------------------------------------------------------------------
# 4. PrayerQada — makeup-prayer counter per prayer type.
# ---------------------------------------------------------------------------


class PrayerQada(Base):
    """Outstanding qada (makeup) prayers per type.

    ``owed_count`` grows when the user marks a past prayer as missed;
    ``made_up_count`` grows when the user logs a qada (separate field on
    PrayerTracking in a future enhancement; for now we just track owed).
    """

    __tablename__ = "prayer_qada"
    __table_args__ = (
        UniqueConstraint("user_id", "prayer_name", name="uq_prayer_qada_user_name"),
    )

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    prayer_name = Column(String(16), nullable=False)

    owed_count = Column(Integer, default=0, nullable=False)
    made_up_count = Column(Integer, default=0, nullable=False)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


class PrayerQadaEvent(Base):
    """Append-only audit log of every qada adjustment.

    Each row records one ``POST /qada/adjust`` call so we can answer
    "how many qada did the user make up between date X and date Y?" —
    a question the lifetime ``prayer_qada.made_up_count`` cannot answer
    on its own. Negative ``delta`` values mean a qada was made up;
    positive values mean a missed prayer was added to the owed pile.

    ``tracking_date`` is the calendar date the qada adjustment is
    *for* (i.e. the date of the missed/made-up prayer), distinct from
    ``created_at`` which is when the user tapped the button. The two
    diverge when the user back-fills: on Jul 2 they may tap
    "Mark complete" for a Fajr they missed on Jun 24 — the makeup is
    for Jun 24, not Jul 2, so the Stats view's range filter has to
    look at ``tracking_date``. Nullable for legacy rows pre-migration;
    those fall back to ``created_at::date`` at query time so old data
    still appears under sensible ranges.
    """

    __tablename__ = "prayer_qada_event"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    prayer_name = Column(String(16), nullable=False, index=True)
    delta = Column(Integer, nullable=False)
    reason = Column(String(64), nullable=True)  # e.g. "manual_adjust", "track_uncheck_compensation"
    tracking_date = Column(Date, nullable=True, index=True)  # nullable for legacy rows
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)


# ---------------------------------------------------------------------------
# 4b. PrayerQadaEntry — one row per qada makeup action (saved separately).
# ---------------------------------------------------------------------------


class PrayerQadaEntry(Base):
    """One row per qada makeup the user actually performed.

    Distinct from ``prayer_qada`` (lifetime aggregate counters) and
    ``prayer_qada_event`` (append-only audit log of every delta). This
    table stores a **queryable, per-action record** so the app can answer
    "what qada did I do on July 3?" or list a user's makeup history.

    Written by ``POST /qada/adjust`` when ``delta < 0`` (mark complete).
    Deleted (most-recent-match) when ``delta > 0`` (undo) so the list
    stays clean; the ``prayer_qada_event`` audit log still retains the
    undo record for audit purposes.

    ``made_up_date`` is the calendar date the makeup is *for* (the
    ``tracking_date`` passed by the front-end's Qada tile).
    ``missed_date`` is the original date the prayer was missed —
    nullable because we don't always know it (auto-aging doesn't
    tell us).
    """

    __tablename__ = "prayer_qada_entry"
    __table_args__ = (
        UniqueConstraint("user_id", "prayer_name", "made_up_date", name="uq_prayer_qada_entry_user_name_date"),
    )

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    prayer_name = Column(String(16), nullable=False, index=True)

    made_up_date = Column(Date, nullable=False, index=True)
    missed_date = Column(Date, nullable=True)
    is_jamaaah = Column(Boolean, default=False, nullable=False)
    notes = Column(Text, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


# ---------------------------------------------------------------------------
# 5. PrayerSettings — one row per user.
# ---------------------------------------------------------------------------


class PrayerSettings(Base):
    """User preferences for the prayer tracker."""

    __tablename__ = "prayer_settings"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
        index=True,
    )

    calculation_method = Column(String(16), default=CalculationMethod.ISNA.value, nullable=False)
    juristic_method = Column(String(16), default=JuristicMethod.SHAFI.value, nullable=False)

    notifications_enabled = Column(Boolean, default=True, nullable=False)
    reminder_minutes_before = Column(Integer, default=10, nullable=False)

    track_jamaaah = Column(Boolean, default=False, nullable=False)
    track_qada = Column(Boolean, default=True, nullable=False)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


# ---------------------------------------------------------------------------
# 6. PrayerStatistics — cached dashboard aggregates.
# ---------------------------------------------------------------------------


class PrayerStatistics(Base):
    """Pre-computed per-user statistics for the dashboard."""

    __tablename__ = "prayer_statistics"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False, index=True)

    total_tracked = Column(Integer, default=0, nullable=False)
    total_completed = Column(Integer, default=0, nullable=False)
    overall_completion_rate = Column(Integer, default=0, nullable=False)

    best_prayer_name = Column(String, nullable=True)
    worst_prayer_name = Column(String, nullable=True)

    last_30_days_rate = Column(Integer, default=0, nullable=False)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
