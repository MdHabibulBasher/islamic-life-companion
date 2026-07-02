"""Pydantic schemas for the fasting tracker.

The shape mirrors the model: gregorian date is the canonical key, and
every other field is optional / nullable so the UI can build a row up
incrementally as the user fills it in.

Note: this file uses PEP-604 (``X | None``) syntax and avoids
``typing.Optional`` because Pydantic 2.12's annotation evaluator
struggles with ``Optional[...]`` combined with ``Field(default=None)``.
"""
from datetime import date, datetime

from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# CREATE — used by POST /fasting
# ---------------------------------------------------------------------------
class FastingEntryCreate(BaseModel):
    """Payload for creating a new fasting entry. The date is required."""

    # NOTE: field is named `tracking_date` to avoid a name clash with the
    # ``datetime.date`` type that Pydantic 2.12's annotation evaluator
    # stumbles on. The frontend refers to it as `date` and we expose it
    # as `date` in the response too (see model_validate below).
    tracking_date: date = Field(..., description="Gregorian date (YYYY-MM-DD)")

    fasted: bool = False
    notes: str | None = None

    donation_amount: float | None = Field(
        default=None, ge=0, description="Sadaqah / fitrah amount in donation_currency"
    )
    donation_currency: str | None = Field(
        default=None, max_length=8, description="ISO 4217 currency code (e.g. USD, BDT)"
    )
    donation_note: str | None = None

    good_deed: str | None = None
    good_deed_done: bool | None = None

    def to_model_dict(self) -> dict:
        """Map our input fields onto the SQLAlchemy model's column names."""
        d = self.model_dump()
        d["date"] = d.pop("tracking_date")
        return d


# ---------------------------------------------------------------------------
# UPDATE — every field optional so the UI can patch in any subset
# ---------------------------------------------------------------------------
class FastingEntryUpdate(BaseModel):
    fasted: bool | None = None
    notes: str | None = None

    donation_amount: float | None = Field(default=None, ge=0)
    donation_currency: str | None = Field(default=None, max_length=8)
    donation_note: str | None = None

    good_deed: str | None = None
    good_deed_done: bool | None = None


# ---------------------------------------------------------------------------
# RESPONSE — full row including the server-computed Hijri bits
# ---------------------------------------------------------------------------
class FastingEntryResponse(BaseModel):
    id: int
    user_id: int
    date: date

    hijri_date: str | None = None
    hijri_day: int | None = None
    hijri_month: int | None = None
    hijri_year: int | None = None
    hijri_month_name: str | None = None

    fasted: bool = False
    is_ramadan: bool = False
    is_monday_thursday: bool = False
    is_white_day: bool = False

    donation_amount: float | None = None
    donation_currency: str | None = "USD"
    donation_note: str | None = None

    good_deed: str | None = None
    good_deed_done: bool | None = None

    notes: str | None = None

    created_at: datetime
    updated_at: datetime | None = None

    class Config:
        from_attributes = True
        json_encoders = {date: lambda v: v.isoformat() if v else None}


# ---------------------------------------------------------------------------
# MONTH SUMMARY — light-weight stats for the calendar view header
# ---------------------------------------------------------------------------
class FastingMonthSummary(BaseModel):
    hijri_year: int
    hijri_month: int
    hijri_month_name: str
    gregorian_start: date
    gregorian_end: date
    total_days: int
    fasted_days: int
    ramadan_days: int
    sunnah_days: int          # Monday/Thursday
    white_days: int           # 13/14/15
    total_donations: float
    good_deeds_done: int
