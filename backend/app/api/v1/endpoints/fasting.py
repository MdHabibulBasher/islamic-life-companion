"""Fasting endpoint — list / create / update / delete a user's daily fasting rows.

Supports:
  GET    /fasting/?start_date=&end_date=            list rows in a window
  GET    /fasting/month?hijri_year=&hijri_month=    rows for a Hijri month
  GET    /fasting/summary?hijri_year=&hijri_month=  month stats (donations etc.)
  POST   /fasting/                                 create / upsert a row
  PATCH  /fasting/{id}                             partial update
  DELETE /fasting/{id}                             remove a row

Hijri parts on each row are computed at write time via the user's saved
preferences (basis + offset) so the calendar can group by Hijri month
without re-converting.
"""
from __future__ import annotations

from datetime import date, datetime, timedelta
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import and_
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models.fasting import FastingEntry
from app.models.user import User, UserPreferences
from app.schemas.fasting import (
    FastingEntryCreate,
    FastingEntryResponse,
    FastingEntryUpdate,
    FastingMonthSummary,
)
from app.services.hijri_converter import gregorian_to_hijri
from app.services.hijri_dates import hijri_for_date

router = APIRouter()


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def _is_monday_or_thursday(d: date) -> bool:
    return d.weekday() in (0, 3)  # Monday=0, Thursday=3


def _compute_hijri_parts(target: date, basis: str, offset: int) -> dict:
    """Compute the Hijri date parts using the user's saved preferences.

    Falls back to ``hijri_converter`` (offline, no network) if the
    Aladhan-based helper ever raises.
    """
    try:
        hd = hijri_for_date(target, basis=basis, offset=offset)
        return {
            "hijri_date": hd.compact,
            "hijri_day": hd.day,
            "hijri_month": hd.month_number,
            "hijri_year": hd.year,
            "hijri_month_name": hd.month_name_en,
        }
    except Exception:
        # Offline fallback — uses the local hijri_converter package.
        info = gregorian_to_hijri(target)
        return {
            "hijri_date": f"{info['day']:02d}-{info['month']:02d}-{info['year']}",
            "hijri_day": info["day"],
            "hijri_month": info["month"],
            "hijri_year": info["year"],
            "hijri_month_name": info["month_name"],
        }


def _derive_flags(target: date, hijri_month: Optional[int], hijri_day: Optional[int]) -> dict:
    return {
        "is_monday_thursday": _is_monday_or_thursday(target),
        "is_ramadan": (hijri_month == 9),
        "is_white_day": (hijri_day is not None and 13 <= hijri_day <= 15),
    }


def _get_user_prefs(db: Session, user_id: int) -> tuple[str, int]:
    """Return (hijri_basis, hijri_offset) for a user, with sane defaults."""
    prefs = (
        db.query(UserPreferences)
        .filter(UserPreferences.user_id == user_id)
        .first()
    )
    if not prefs:
        return "global", 0
    return (prefs.hijri_basis or "global", getattr(prefs, "hijri_offset", 0) or 0)


def _user_owns(entry: FastingEntry, user_id: int) -> bool:
    return entry.user_id == user_id


# ---------------------------------------------------------------------------
# LIST — window-bounded
# ---------------------------------------------------------------------------
@router.get("/", response_model=List[FastingEntryResponse])
def list_fasting_entries(
    start_date: Optional[date] = Query(None, description="ISO date (inclusive)"),
    end_date: Optional[date] = Query(None, description="ISO date (inclusive)"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List the current user's fasting entries in an optional date window.

    Defaults to the past 90 days through today when no window is given.
    """
    if start_date is None:
        start_date = date.today() - timedelta(days=90)
    if end_date is None:
        end_date = date.today()
    if end_date < start_date:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="end_date must be on or after start_date",
        )

    rows = (
        db.query(FastingEntry)
        .filter(
            and_(
                FastingEntry.user_id == current_user.id,
                FastingEntry.date >= start_date,
                FastingEntry.date <= end_date,
            )
        )
        .order_by(FastingEntry.date.asc())
        .all()
    )
    return rows


# ---------------------------------------------------------------------------
# LIST — by Hijri month
# ---------------------------------------------------------------------------
@router.get("/month", response_model=List[FastingEntryResponse])
def list_fasting_entries_by_hijri_month(
    hijri_year: int = Query(..., ge=1, le=2100),
    hijri_month: int = Query(..., ge=1, le=12),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Return all rows whose denormalised hijri_year/hijri_month match.

    The denormalisation is done at write time, so this filter is a simple
    indexed lookup — no per-row Hijri conversion needed at read time.
    """
    rows = (
        db.query(FastingEntry)
        .filter(
            and_(
                FastingEntry.user_id == current_user.id,
                FastingEntry.hijri_year == hijri_year,
                FastingEntry.hijri_month == hijri_month,
            )
        )
        .order_by(FastingEntry.date.asc())
        .all()
    )
    return rows


# ---------------------------------------------------------------------------
# SUMMARY — month stats
# ---------------------------------------------------------------------------
@router.get("/summary", response_model=FastingMonthSummary)
def fasting_month_summary(
    hijri_year: int = Query(..., ge=1, le=2100),
    hijri_month: int = Query(..., ge=1, le=12),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Roll-up stats for a Hijri month — used by the calendar page header."""
    rows = (
        db.query(FastingEntry)
        .filter(
            and_(
                FastingEntry.user_id == current_user.id,
                FastingEntry.hijri_year == hijri_year,
                FastingEntry.hijri_month == hijri_month,
            )
        )
        .all()
    )
    if not rows:
        # No rows yet — still return a zeroed summary so the UI can render.
        return FastingMonthSummary(
            hijri_year=hijri_year,
            hijri_month=hijri_month,
            hijri_month_name="",
            gregorian_start=date.today(),
            gregorian_end=date.today(),
            total_days=0,
            fasted_days=0,
            ramadan_days=0,
            sunnah_days=0,
            white_days=0,
            total_donations=0.0,
            good_deeds_done=0,
        )

    fasted = [r for r in rows if r.fasted]
    donations = sum((r.donation_amount or 0.0) for r in rows)
    good_deeds = sum(1 for r in rows if r.good_deed_done)
    month_name = rows[0].hijri_month_name or ""

    return FastingMonthSummary(
        hijri_year=hijri_year,
        hijri_month=hijri_month,
        hijri_month_name=month_name,
        gregorian_start=min(r.date for r in rows),
        gregorian_end=max(r.date for r in rows),
        total_days=len(rows),
        fasted_days=len(fasted),
        ramadan_days=sum(1 for r in rows if r.is_ramadan),
        sunnah_days=sum(1 for r in rows if r.is_monday_thursday),
        white_days=sum(1 for r in rows if r.is_white_day),
        total_donations=round(donations, 2),
        good_deeds_done=good_deeds,
    )


# ---------------------------------------------------------------------------
# CREATE — upsert by (user, date)
# ---------------------------------------------------------------------------
@router.post("/", response_model=FastingEntryResponse, status_code=status.HTTP_201_CREATED)
def create_fasting_entry(
    payload: FastingEntryCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Create or update today's fasting row (idempotent on user+date)."""
    basis, offset = _get_user_prefs(db, current_user.id)
    hijri = _compute_hijri_parts(payload.tracking_date, basis, offset)
    flags = _derive_flags(
        payload.tracking_date, hijri["hijri_month"], hijri["hijri_day"]
    )

    existing = (
        db.query(FastingEntry)
        .filter(
            and_(
                FastingEntry.user_id == current_user.id,
                FastingEntry.date == payload.tracking_date,
            )
        )
        .first()
    )
    if existing:
        # Update — only the user-facing fields. Hijri bits and flags are
        # re-derived so they stay in sync.
        for field in (
            "fasted",
            "notes",
            "donation_amount",
            "donation_currency",
            "donation_note",
            "good_deed",
            "good_deed_done",
        ):
            value = getattr(payload, field)
            if value is not None:
                setattr(existing, field, value)
        existing.hijri_date = hijri["hijri_date"]
        existing.hijri_day = hijri["hijri_day"]
        existing.hijri_month = hijri["hijri_month"]
        existing.hijri_year = hijri["hijri_year"]
        existing.hijri_month_name = hijri["hijri_month_name"]
        existing.is_ramadan = flags["is_ramadan"]
        existing.is_monday_thursday = flags["is_monday_thursday"]
        existing.is_white_day = flags["is_white_day"]
        db.commit()
        db.refresh(existing)
        return existing

    entry = FastingEntry(
        user_id=current_user.id,
        date=payload.tracking_date,
        fasted=payload.fasted,
        notes=payload.notes,
        donation_amount=payload.donation_amount,
        donation_currency=(
            (payload.donation_currency or "USD").upper()
            if payload.donation_currency
            else "USD"
        ),
        donation_note=payload.donation_note,
        good_deed=payload.good_deed,
        good_deed_done=payload.good_deed_done,
        **hijri,
        **flags,
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return entry


# ---------------------------------------------------------------------------
# PATCH
# ---------------------------------------------------------------------------
@router.patch("/{entry_id}", response_model=FastingEntryResponse)
def update_fasting_entry(
    entry_id: int,
    payload: FastingEntryUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    entry = db.query(FastingEntry).filter(FastingEntry.id == entry_id).first()
    if not entry:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Entry not found")
    if not _user_owns(entry, current_user.id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Not your entry"
        )

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(entry, field, value)
    db.commit()
    db.refresh(entry)
    return entry


# ---------------------------------------------------------------------------
# DELETE
# ---------------------------------------------------------------------------
@router.delete("/{entry_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_fasting_entry(
    entry_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    entry = db.query(FastingEntry).filter(FastingEntry.id == entry_id).first()
    if not entry:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Entry not found")
    if not _user_owns(entry, current_user.id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Not your entry"
        )
    db.delete(entry)
    db.commit()
    return None
