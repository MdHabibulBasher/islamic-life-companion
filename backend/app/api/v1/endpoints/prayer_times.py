from datetime import date, datetime
from typing import Optional

import requests
from fastapi import APIRouter, Depends, HTTPException

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models.user import User
from app.services.hijri import get_hijri_settings_for_user
from sqlalchemy.orm import Session

router = APIRouter()

# Aladhan API base.
ALADHAN_API_BASE = "https://api.aladhan.com/v1"


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _aladhan_date(d: date) -> str:
    """Aladhan expects dates as DD-MM-YYYY in the path; YYYY-MM-DD is misinterpreted
    as a 2-digit year and Aladhan returns a 5-year-old date (e.g. 2020 instead of 2026).
    """
    return d.strftime("%d-%m-%Y")


def _normalize_date_string(s: str) -> str:
    """Convert a YYYY-MM-DD (ISO) date string to DD-MM-YYYY for Aladhan.
    Pass-through if the input is already in DD-MM-YYYY form or can't be parsed.
    """
    import re
    if not s:
        return s
    m = re.match(r"^(\d{4})-(\d{1,2})-(\d{1,2})$", s.strip())
    if m:
        yyyy, mm, dd = m.groups()
        return f"{int(dd):02d}-{int(mm):02d}-{int(yyyy):04d}"
    return s


def _hijri_friendly(date_info: dict) -> Optional[str]:
    """Build a friendly "5 Muharram 1448 AH" string from Aladhan's nested hijri object.

    `day` can be a string ("05") or an int; we strip a leading zero so we always
    emit "5" rather than "05".
    """
    hijri = (date_info or {}).get("hijri") or {}
    day = hijri.get("day")
    month_en = (hijri.get("month") or {}).get("en")
    year = hijri.get("year")
    if day and month_en and year:
        try:
            day_str = str(int(day))  # "05" -> 5 -> "5"
        except (TypeError, ValueError):
            day_str = str(day).lstrip("0") or str(day)
        return f"{day_str} {month_en} {year} AH"
    return None


def _hijri_compact(date_info: dict) -> str:
    return (date_info or {}).get("hijri", {}).get("date", "")


def _apply_user_hijri(
    target_gregorian: date,
    fallback_date_info: dict,
    db: Session,
    user_id: int,
    country_hint: Optional[str] = None,
) -> tuple[str, str, str, int]:
    """Return `(hijri_friendly, hijri_compact, basis, offset_applied)` honoring
    the user's Hijri basis + offset. Falls back to the Aladhan-bundled response
    when the user is on the default basis with no offset (i.e. nothing to
    override). The basis/offset are returned even on the default path so the
    UI can show "per Aladhan / Umm al-Qura" consistently.

    `country_hint` is the country from the current request (e.g. from the
    `?country=Bangladesh` query param). When the user has not customized their
    offset, we apply the country-specific default so Dhaka users get the
    Bangladesh-committee date in the very first request — without having to
    wait for `POST /user/location` to persist.
    """
    from app.services.hijri import resolve_effective_hijri_settings
    from app.services.hijri_dates import hijri_for_date

    basis, offset, _country_overrode = resolve_effective_hijri_settings(
        db, user_id, country_hint=country_hint
    )
    # Default path: just unwrap Aladhan's nested fields.
    if basis == "global" and offset == 0:
        return (
            _hijri_friendly(fallback_date_info) or _hijri_compact(fallback_date_info),
            _hijri_compact(fallback_date_info),
            basis,
            offset,
        )

    # Custom path: ask Aladhan again with the right method and apply offset.
    try:
        hd = hijri_for_date(target_gregorian, basis=basis, offset=offset)
        return hd.friendly, hd.compact, hd.basis, hd.offset_applied
    except Exception as e:  # pragma: no cover - network failure
        print(f"User Hijri fetch failed: {e}")
        return (
            _hijri_friendly(fallback_date_info) or _hijri_compact(fallback_date_info),
            _hijri_compact(fallback_date_info),
            basis,
            offset,
        )


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@router.get("/today")
def get_today_prayer_times(
    city: Optional[str] = None,
    country: Optional[str] = None,
    latitude: Optional[float] = None,
    longitude: Optional[float] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get today's prayer times for a location."""
    today = date.today()
    has_coords = latitude is not None and longitude is not None
    city_name = city or "Cairo"
    country_name = country or "Egypt"

    if has_coords:
        url = f"{ALADHAN_API_BASE}/timings/{_aladhan_date(today)}"
        params = {"latitude": latitude, "longitude": longitude, "method": 2}
    else:
        url = f"{ALADHAN_API_BASE}/timingsByCity/{_aladhan_date(today)}"
        params = {"city": city_name, "country": country_name, "method": 2}

    try:
        response = requests.get(url, params=params, timeout=10)
        response.raise_for_status()
        data = response.json()
    except requests.exceptions.RequestException as e:
        raise HTTPException(status_code=502, detail=f"Failed to reach Aladhan: {e}")

    if data.get("code") != 200:
        raise HTTPException(status_code=502, detail="Aladhan returned an error")

    timings = data.get("data", {}).get("timings", {})
    date_info = data.get("data", {}).get("date", {})
    hijri_friendly, hijri_compact, hijri_basis, hijri_offset = _apply_user_hijri(
        today, date_info, db, current_user.id, country_hint=country_name
    )

    return {
        "date": today.isoformat(),
        "hijri_date": hijri_friendly,
        "hijri_date_compact": hijri_compact,
        "hijri_basis": hijri_basis,
        "hijri_offset_applied": hijri_offset,
        "prayers": {
            "fajr": timings.get("Fajr", ""),
            "sunrise": timings.get("Sunrise", ""),
            "dhuhr": timings.get("Dhuhr", ""),
            "asr": timings.get("Asr", ""),
            "sunset": timings.get("Sunset", ""),
            "maghrib": timings.get("Maghrib", ""),
            "isha": timings.get("Isha", ""),
            "imsak": timings.get("Imsak", ""),
        },
        "location": f"{city_name}, {country_name}",
    }


@router.get("/next")
def get_next_prayer(
    city: Optional[str] = None,
    country: Optional[str] = None,
    latitude: Optional[float] = None,
    longitude: Optional[float] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get next upcoming prayer time."""
    today = date.today()
    now = datetime.now()
    has_coords = latitude is not None and longitude is not None
    city_name = city or "Cairo"
    country_name = country or "Egypt"

    if has_coords:
        url = f"{ALADHAN_API_BASE}/timings/{_aladhan_date(today)}"
        params = {"latitude": latitude, "longitude": longitude, "method": 2}
    else:
        url = f"{ALADHAN_API_BASE}/timingsByCity/{_aladhan_date(today)}"
        params = {"city": city_name, "country": country_name, "method": 2}

    try:
        response = requests.get(url, params=params, timeout=10)
        response.raise_for_status()
        data = response.json()
    except requests.exceptions.RequestException as e:
        raise HTTPException(status_code=502, detail=f"Failed to reach Aladhan: {e}")

    if data.get("code") != 200:
        raise HTTPException(status_code=502, detail="Aladhan returned an error")

    timings = data.get("data", {}).get("timings", {})
    prayers = [
        ("Fajr", timings.get("Fajr", "")),
        ("Sunrise", timings.get("Sunrise", "")),
        ("Dhuhr", timings.get("Dhuhr", "")),
        ("Asr", timings.get("Asr", "")),
        ("Sunset", timings.get("Sunset", "")),
        ("Maghrib", timings.get("Maghrib", "")),
        ("Isha", timings.get("Isha", "")),
    ]

    next_prayer = None
    for prayer_name, prayer_time in prayers:
        try:
            pd = datetime.strptime(prayer_time, "%H:%M")
            pd = pd.replace(year=now.year, month=now.month, day=now.day)
            if pd > now:
                next_prayer = {
                    "name": prayer_name,
                    "time": prayer_time,
                    "minutes_remaining": int((pd - now).total_seconds() / 60),
                }
                break
        except ValueError:
            continue

    if not next_prayer:
        next_prayer = {
            "name": "Fajr",
            "time": timings.get("Fajr", "05:30"),
            "minutes_remaining": -1,
            "note": "Next prayer is tomorrow",
        }
    return next_prayer


@router.get("/islamic-date")
def get_islamic_date(
    target_date: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get the Islamic (Hijri) date for a given Gregorian date (defaults to today).

    Honors the user's Hijri basis + offset (so the response is consistent with
    whatever the user configured in Settings).
    """
    raw = target_date or date.today().isoformat()
    try:
        target_gregorian = date.fromisoformat(raw)
    except ValueError:
        target_gregorian = date.today()
        raw = target_gregorian.isoformat()

    from app.services.hijri_dates import hijri_for_date

    basis, offset = get_hijri_settings_for_user(db, current_user.id)
    try:
        hd = hijri_for_date(target_gregorian, basis=basis, offset=offset)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Failed to compute Hijri date: {e}")

    return {
        "gregorian_date": raw,
        "hijri_date": hd.friendly,
        "hijri_date_compact": hd.compact,
        "hijri_day": hd.day,
        "hijri_month": hd.month_name_en,
        "hijri_month_number": hd.month_number,
        "hijri_year": hd.year,
        "islamic_month_name": hd.month_name_en,
        "hijri_basis": hd.basis,
        "hijri_offset_applied": hd.offset_applied,
    }


@router.get("/date/{target_date}")
def get_prayer_times_by_date(
    target_date: str,
    city: Optional[str] = None,
    country: Optional[str] = None,
    latitude: Optional[float] = None,
    longitude: Optional[float] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get prayer times for a specific date."""
    has_coords = latitude is not None and longitude is not None
    city_name = city or "Cairo"
    country_name = country or "Egypt"

    if has_coords:
        url = f"{ALADHAN_API_BASE}/timings/{_normalize_date_string(target_date)}"
        params = {"latitude": latitude, "longitude": longitude, "method": 2}
    else:
        url = f"{ALADHAN_API_BASE}/timingsByCity/{_normalize_date_string(target_date)}"
        params = {"city": city_name, "country": country_name, "method": 2}

    try:
        response = requests.get(url, params=params, timeout=10)
        response.raise_for_status()
        data = response.json()
    except requests.exceptions.RequestException as e:
        raise HTTPException(status_code=502, detail=f"Failed to reach Aladhan: {e}")

    if data.get("code") != 200:
        raise HTTPException(status_code=502, detail="Aladhan returned an error")

    timings = data.get("data", {}).get("timings", {})
    date_info = data.get("data", {}).get("date", {})
    # target_date here is the ISO string the caller passed (YYYY-MM-DD).
    try:
        target_gregorian = date.fromisoformat(target_date)
    except ValueError:
        target_gregorian = date.today()
    hijri_friendly, hijri_compact, hijri_basis, hijri_offset = _apply_user_hijri(
        target_gregorian, date_info, db, current_user.id, country_hint=country_name
    )

    return {
        "date": target_date,
        "hijri_date": hijri_friendly,
        "hijri_date_compact": hijri_compact,
        "hijri_basis": hijri_basis,
        "hijri_offset_applied": hijri_offset,
        "prayers": {
            "fajr": timings.get("Fajr", ""),
            "sunrise": timings.get("Sunrise", ""),
            "dhuhr": timings.get("Dhuhr", ""),
            "asr": timings.get("Asr", ""),
            "sunset": timings.get("Sunset", ""),
            "maghrib": timings.get("Maghrib", ""),
            "isha": timings.get("Isha", ""),
            "imsak": timings.get("Imsak", ""),
        },
        "location": f"{city_name}, {country_name}",
    }


@router.get("/location")
def get_prayer_times_by_location(
    latitude: float,
    longitude: float,
    date_str: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get prayer times for the given coordinates."""
    prayer_date = _normalize_date_string(date_str or date.today().isoformat())

    try:
        response = requests.get(
            f"{ALADHAN_API_BASE}/timings/{prayer_date}",
            params={"latitude": latitude, "longitude": longitude, "method": 2},
            timeout=10,
        )
        response.raise_for_status()
        data = response.json()
    except requests.exceptions.RequestException as e:
        raise HTTPException(status_code=502, detail=f"Failed to reach Aladhan: {e}")

    if data.get("code") != 200:
        raise HTTPException(status_code=502, detail="Aladhan returned an error")

    timings = data.get("data", {}).get("timings", {})
    date_info = data.get("data", {}).get("date", {})
    try:
        target_gregorian = date.fromisoformat(date_str) if date_str else date.today()
    except ValueError:
        target_gregorian = date.today()
    # /location only knows lat/lng, so we look up the country from the user's
    # stored location setting as the best country_hint we have.
    from app.models.user import UserLocationSetting
    loc_country = (
        db.query(UserLocationSetting.country)
        .filter(UserLocationSetting.user_id == current_user.id)
        .scalar()
    )
    hijri_friendly, hijri_compact, hijri_basis, hijri_offset = _apply_user_hijri(
        target_gregorian, date_info, db, current_user.id, country_hint=loc_country
    )

    return {
        "date": prayer_date,
        "hijri_date": hijri_friendly,
        "hijri_date_compact": hijri_compact,
        "hijri_basis": hijri_basis,
        "hijri_offset_applied": hijri_offset,
        "prayers": {
            "fajr": timings.get("Fajr", ""),
            "sunrise": timings.get("Sunrise", ""),
            "dhuhr": timings.get("Dhuhr", ""),
            "asr": timings.get("Asr", ""),
            "sunset": timings.get("Sunset", ""),
            "maghrib": timings.get("Maghrib", ""),
            "isha": timings.get("Isha", ""),
            "imsak": timings.get("Imsak", ""),
        },
        "latitude": latitude,
        "longitude": longitude,
    }


@router.get("/city")
def get_prayer_times_by_city(
    city: str,
    country: str,
    date_str: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get prayer times for a city + country pair."""
    prayer_date = _normalize_date_string(date_str or date.today().isoformat())

    try:
        response = requests.get(
            f"{ALADHAN_API_BASE}/timingsByCity/{prayer_date}",
            params={"city": city, "country": country, "method": 2},
            timeout=10,
        )
        response.raise_for_status()
        data = response.json()
    except requests.exceptions.RequestException as e:
        raise HTTPException(status_code=502, detail=f"Failed to reach Aladhan: {e}")

    if data.get("code") != 200:
        raise HTTPException(status_code=502, detail="Aladhan returned an error")

    timings = data.get("data", {}).get("timings", {})
    date_info = data.get("data", {}).get("date", {})
    try:
        target_gregorian = date.fromisoformat(date_str) if date_str else date.today()
    except ValueError:
        target_gregorian = date.today()
    hijri_friendly, hijri_compact, hijri_basis, hijri_offset = _apply_user_hijri(
        target_gregorian, date_info, db, current_user.id, country_hint=country
    )

    return {
        "date": prayer_date,
        "hijri_date": hijri_friendly,
        "hijri_date_compact": hijri_compact,
        "hijri_basis": hijri_basis,
        "hijri_offset_applied": hijri_offset,
        "prayers": {
            "fajr": timings.get("Fajr", ""),
            "sunrise": timings.get("Sunrise", ""),
            "dhuhr": timings.get("Dhuhr", ""),
            "asr": timings.get("Asr", ""),
            "sunset": timings.get("Sunset", ""),
            "maghrib": timings.get("Maghrib", ""),
            "isha": timings.get("Isha", ""),
            "imsak": timings.get("Imsak", ""),
        },
        "location": f"{city}, {country}",
    }


@router.get("/monthly")
async def get_monthly_prayer_times(
    month: int,
    year: int,
    city: Optional[str] = None,
    country: Optional[str] = None,
    latitude: Optional[float] = None,
    longitude: Optional[float] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get prayer times for every day in a month in one round-trip.

    Uses Aladhan's /calendar endpoint. City/country requests are resolved to
    coordinates via /address-info first (calendar requires lat/long).
    """
    import calendar

    import httpx

    if month < 1 or month > 12 or year < 1900 or year > 2100:
        raise HTTPException(status_code=400, detail="Invalid month or year")

    days_in_month = calendar.monthrange(year, month)[1]

    if latitude is None or longitude is None:
        city_name = city or "Cairo"
        country_name = country or "Egypt"
        try:
            async with httpx.AsyncClient(timeout=20.0) as client:
                geo = await client.get(
                    f"{ALADHAN_API_BASE}/addressInfo",
                    params={"address": f"{city_name}, {country_name}"},
                )
                geo.raise_for_status()
                geo_data = geo.json().get("data", {})
            latitude = geo_data.get("latitude")
            longitude = geo_data.get("longitude")
            if latitude is None or longitude is None:
                raise HTTPException(
                    status_code=400,
                    detail=f"Could not resolve coordinates for {city_name}, {country_name}",
                )
        except httpx.HTTPError as e:
            raise HTTPException(status_code=502, detail=f"Failed to geocode city: {e}")

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            r = await client.get(
                f"{ALADHAN_API_BASE}/calendar/{year}/{month}",
                params={"latitude": latitude, "longitude": longitude, "method": 2},
            )
            r.raise_for_status()
            payload = r.json()
    except httpx.HTTPError as e:
        raise HTTPException(status_code=502, detail=f"Failed to fetch monthly: {e}")

    if payload.get("code") != 200:
        raise HTTPException(status_code=502, detail="Aladhan returned an error")

    days = []
    for day_entry in payload.get("data", []):
        timings = day_entry.get("timings", {})
        meta = day_entry.get("date", {})
        gregorian = meta.get("gregorian", {}) or {}
        hijri = meta.get("hijri", {}) or {}
        date_str = (
            f"{int(gregorian.get('year', year)):04d}-"
            f"{int(gregorian.get('month', {}).get('number', month)):02d}-"
            f"{int(gregorian.get('day', 0)):02d}"
        )

        def _t(k: str) -> str:
            return (timings.get(k) or "").split(" ")[0]

        # Apply the user's Hijri basis + offset. The Aladhan calendar endpoint
        # already returns a hijri object, so use it as the fallback inside the
        # helper.
        try:
            target_gregorian = date.fromisoformat(date_str)
        except ValueError:
            target_gregorian = date(year, month, int(gregorian.get("day", 1)))
        day_hijri_friendly, day_hijri_compact, day_hijri_basis, day_hijri_offset = _apply_user_hijri(
            target_gregorian,
            meta,
            db,
            current_user.id,
            country_hint=country_name,
        )

        days.append(
            {
                "date": date_str,
                "hijri_date": day_hijri_friendly,
                "hijri_date_compact": day_hijri_compact,
                "hijri_basis": day_hijri_basis,
                "hijri_offset_applied": day_hijri_offset,
                "prayers": {
                    "fajr": _t("Fajr"),
                    "sunrise": _t("Sunrise"),
                    "dhuhr": _t("Dhuhr"),
                    "asr": _t("Asr"),
                    "sunset": _t("Sunset"),
                    "maghrib": _t("Maghrib"),
                    "isha": _t("Isha"),
                    "imsak": _t("Imsak"),
                },
            }
        )

    return {
        "month": month,
        "year": year,
        "days_in_month": days_in_month,
        "location": f"{city or 'Cairo'}, {country or 'Egypt'}",
        "latitude": latitude,
        "longitude": longitude,
        "days": days,
    }


@router.get("/reverse-geocode")
def reverse_geocode(
    latitude: float,
    longitude: float,
    current_user: User = Depends(get_current_user),
):
    """Reverse-geocode lat/long to a city/country name.

    Uses OpenStreetMap Nominatim (free, no API key). Returns nulls on failure.
    """
    try:
        # Nominatim rejects default/empty User-Agents, so we send a real one.
        r = requests.get(
            "https://nominatim.openstreetmap.org/reverse",
            params={
                "format": "json",
                "lat": latitude,
                "lon": longitude,
                "zoom": 10,
                "accept-language": "en",
            },
            headers={
                "User-Agent": "Mozilla/5.0 (compatible; IslamicLifeCompanion/1.0; +https://example.com/contact)",
                "Accept": "application/json",
            },
            timeout=10,
        )
        r.raise_for_status()
        data = r.json() or {}
        addr = data.get("address") or {}
        city = (
            addr.get("city")
            or addr.get("town")
            or addr.get("village")
            or addr.get("hamlet")
            or addr.get("county")
            or addr.get("state")
            or addr.get("region")
        )
        country = addr.get("country")
        if city and country:
            return {
                "city": city,
                "country": country,
                "display_name": data.get("display_name"),
            }
    except requests.exceptions.RequestException as e:
        print(f"Nominatim reverse-geocode failed: {e}")

    return {"city": None, "country": None, "display_name": None}
