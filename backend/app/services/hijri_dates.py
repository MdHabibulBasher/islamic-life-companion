"""Helpers for working with Hijri dates using the user's local basis setting.

The user stores two fields on `UserPreferences`:
- `hijri_basis`: which Aladhan calculation method to use
- `hijri_offset`: a small day offset (-1 / 0 / +1) to apply on top of the
  basis so users whose local moon-sighting committee differs from Umm al-Qura
  by one day get the right answer.
"""
from __future__ import annotations

import re
from dataclasses import dataclass
from datetime import date, timedelta
from typing import Optional

import requests

from app.services.hijri import HIJRI_BASIS_ALADHAN_METHOD, resolve_method


@dataclass
class HijriDate:
    """A friendly Hijri date with the three parts the UI needs."""
    day: int
    month_number: int
    month_name_en: str
    year: int
    basis: str
    offset_applied: int = 0

    @property
    def friendly(self) -> str:
        return f"{self.day} {self.month_name_en} {self.year} AH"

    @property
    def compact(self) -> str:
        return f"{self.day:02d}-{self.month_number:02d}-{self.year}"


def _parse_compact(compact: str) -> Optional[tuple[int, int, int]]:
    """Parse `DD-MM-YYYY` into (day, month, year) ints or return None."""
    m = re.match(r"^(\d{2})-(\d{2})-(\d{4})$", compact.strip())
    if not m:
        return None
    return int(m.group(1)), int(m.group(2)), int(m.group(3))


def _hijri_request(
    target_date: date,
    basis: str = "global",
    offset: int = 0,
    aladhan_method: Optional[int] = None,
) -> HijriDate:
    """Convert a Gregorian date to a HijriDate using Aladhan, then apply offset.

    The offset is implemented at the Gregorian level (add `offset` days and
    re-query) because Aladhan does not let us specify a Hijri calendar manually.
    This is the only correct way to get an Aladhan-formatted Hijri string with
    a local-committee offset baked in.
    """
    method = aladhan_method if aladhan_method is not None else resolve_method(basis)
    shifted = target_date + timedelta(days=offset)

    # Aladhan expects DD-MM-YYYY in the path.
    url = f"https://api.aladhan.com/v1/gToH/{shifted.strftime('%d-%m-%Y')}"
    r = requests.get(url, params={"method": method}, timeout=10)
    r.raise_for_status()
    payload = r.json()
    if payload.get("code") != 200:
        raise RuntimeError(f"Aladhan returned non-200 for {shifted}: {payload}")

    hijri = payload.get("data", {}).get("hijri", {})
    day = int(hijri.get("day") or 0)
    month_obj = hijri.get("month") or {}
    month_number = int(month_obj.get("number") or 0)
    month_name = month_obj.get("en") or ""
    year = int(hijri.get("year") or 0)

    return HijriDate(
        day=day,
        month_number=month_number,
        month_name_en=month_name,
        year=year,
        basis=basis,
        offset_applied=offset,
    )


def hijri_today(basis: str = "global", offset: int = 0) -> HijriDate:
    return _hijri_request(date.today(), basis=basis, offset=offset)


def hijri_for_date(target: date, basis: str = "global", offset: int = 0) -> HijriDate:
    """Convert a Gregorian date to a HijriDate.

    Tries the Aladhan API first (with one retry on transient SSL/network
    errors). If Aladhan is unreachable, falls back to a local arithmetic
    Hijri calculation so the UI keeps working offline. The local fallback
    matches the approximation used by the frontend Calendar/Fasting pages
    (`approximateGregorianDate` inverse), so the two stay consistent.
    """
    import time

    last_err: Exception | None = None
    for _attempt in range(2):
        try:
            return _hijri_request(target, basis=basis, offset=offset)
        except Exception as e:  # noqa: BLE001 â€” we retry on any error
            last_err = e
            time.sleep(0.4)

    # All retries failed â€” use the local arithmetic fallback.
    return _hijri_local_fallback(target, basis=basis, offset=offset)


# ---------------------------------------------------------------------------
# Local Hijri fallback (no network)
# ---------------------------------------------------------------------------
# Uses the same 354-day lunation approximation as the frontend
# `approximateGregorianDate` / `daysSinceAnchorHijri` helpers, so the two
# stay consistent. Good enough for the UI when Aladhan is unreachable; the
# user is always free to correct their offset in Settings.
_HIJRI_MONTH_NAMES = [
    "Muharram", "Safar", "Rabi' al-awwal", "Rabi' al-thani",
    "Jumada al-awwal", "Jumada al-thani", "Rajab", "Sha'ban",
    "Ramadan", "Shawwal", "Dhu al-Qi'dah", "Dhu al-Hijjah",
]
# Per-month lengths for a generic 30/29 lunation cycle.
_HIJRI_MONTH_LENGTHS = [30, 29, 30, 29, 30, 29, 30, 29, 30, 29, 30, 29]


def _hijri_local_fallback(
    target: date,
    basis: str = "global",
    offset: int = 0,
) -> HijriDate:
    shifted = target + timedelta(days=offset)
    # Anchor: 1447-01-01 AH == 2025-07-07 (matches the frontend).
    anchor_dt = date(2025, 7, 7)
    delta_days = (shifted - anchor_dt).days

    # Walk through years.
    y = 1447
    remaining = delta_days
    while True:
        year_len = 354 + (1 if (y % 30 == 0) else 0)
        if remaining >= year_len:
            remaining -= year_len
            y += 1
        elif remaining < 0:
            remaining += 354
            y -= 1
        else:
            break

    # Walk through months.
    m = 1
    for month_len in _HIJRI_MONTH_LENGTHS:
        if remaining < month_len:
            break
        remaining -= month_len
        m += 1
    d = remaining + 1
    if d < 1:
        d = 1
    if m > 12:
        m = 12
    month_name = _HIJRI_MONTH_NAMES[m - 1] if 1 <= m <= 12 else "Muharram"

    return HijriDate(
        day=d,
        month_number=m,
        month_name_en=month_name,
        year=y,
        basis=basis,
        offset_applied=offset,
    )
