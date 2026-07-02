"""Fasting model — daily fasting tracker with donation & good-deed notes.

One row per (user, gregorian_date). Mirrors the pattern used by
``HabitTracking`` and ``PrayerTracking`` so it slots into the existing
auth/ownership model cleanly.

In addition to the simple ``fasted`` boolean, the row stores:
  * is_ramadan           — convenience flag (the row's hijri month is 9)
  * is_monday_thursday   — Sunnah fasting day flag
  * is_white_day         — 13/14/15 of any Hijri month
  * donation_amount      — sadaqah/fitrah amount in user's currency
  * donation_note        — free-text description of who/why
  * good_deed            — text of a good deed performed
  * good_deed_done       — checkbox whether it was done that day
  * notes                — free-form notes

The Hijri date parts are denormalised onto the row for cheap month-level
filtering (so the calendar view doesn't have to re-derive them).
"""
from sqlalchemy import (
    Column,
    Integer,
    String,
    Date,
    Boolean,
    Float,
    Text,
    DateTime,
    ForeignKey,
    UniqueConstraint,
    Index,
)
from sqlalchemy.sql import func

from app.core.database import Base


class FastingEntry(Base):
    __tablename__ = "fasting_entries"

    __table_args__ = (
        # One row per (user, date) — uniqueness is the basis for upsert.
        UniqueConstraint("user_id", "date", name="uq_fasting_entries_user_date"),
        Index("ix_fasting_entries_user_hijri", "user_id", "hijri_year", "hijri_month"),
    )

    id = Column(Integer, primary_key=True, index=True)

    user_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Gregorian date — the canonical key the UI clicks on.
    date = Column(Date, nullable=False, index=True)

    # Hijri date parts — denormalised for fast month-level filtering.
    hijri_date = Column(String(32), nullable=True)        # e.g. "17-09-1447"
    hijri_day = Column(Integer, nullable=True)
    hijri_month = Column(Integer, nullable=True)          # 1..12
    hijri_year = Column(Integer, nullable=True)
    hijri_month_name = Column(String(32), nullable=True)   # e.g. "Ramadan"

    # What the user actually did.
    fasted = Column(Boolean, nullable=False, default=False)

    # Auto-derived flags (computed at write time so the UI can filter on them).
    is_ramadan = Column(Boolean, nullable=False, default=False)
    is_monday_thursday = Column(Boolean, nullable=False, default=False)
    is_white_day = Column(Boolean, nullable=False, default=False)

    # Charitable giving & good deeds.
    donation_amount = Column(Float, nullable=True)
    donation_currency = Column(String(8), nullable=True, default="USD")
    donation_note = Column(Text, nullable=True)

    good_deed = Column(Text, nullable=True)
    good_deed_done = Column(Boolean, nullable=True, default=False)

    notes = Column(Text, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    def __repr__(self) -> str:  # pragma: no cover
        return (
            f"<FastingEntry id={self.id} user={self.user_id} "
            f"date={self.date} fasted={self.fasted}>"
        )
