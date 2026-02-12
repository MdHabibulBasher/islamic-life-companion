from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from datetime import date, datetime
from typing import Optional
import requests
from app.core.database import get_db
from app.api.deps import get_current_user
from app.models.user import User

router = APIRouter()

# Aladhan API endpoint
ALADHAN_API_BASE = "https://api.aladhan.com/v1"


@router.get("/today")
def get_today_prayer_times(
    city: Optional[str] = None,
    country: Optional[str] = None,
    latitude: Optional[float] = None,
    longitude: Optional[float] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get today's prayer times for a location"""
    try:
        today = date.today()
        
        # Use provided coordinates or default to Cairo, Egypt
        if latitude and longitude:
            # Use coordinates-based prayer times
            url = f"{ALADHAN_API_BASE}/timings/{today.isoformat()}"
            params = {
                "latitude": latitude,
                "longitude": longitude,
                "method": 2  # Islamic Society of North America
            }
        else:
            # Use city-based prayer times
            city_name = city or "Cairo"
            country_name = country or "Egypt"
            url = f"{ALADHAN_API_BASE}/timingsByCity/{today.isoformat()}"
            params = {
                "city": city_name,
                "country": country_name,
                "method": 2
            }
        
        response = requests.get(url, params=params, timeout=10)
        response.raise_for_status()
        
        data = response.json()
        
        if data.get("code") != 200:
            raise HTTPException(status_code=500, detail="Failed to fetch prayer times")
        
        timings = data.get("data", {}).get("timings", {})
        date_info = data.get("data", {}).get("date", {})
        
        return {
            "date": today.isoformat(),
            "hijri_date": date_info.get("hijri", {}).get("date", ""),
            "prayers": {
                "fajr": timings.get("Fajr", ""),
                "sunrise": timings.get("Sunrise", ""),
                "dhuhr": timings.get("Dhuhr", ""),
                "asr": timings.get("Asr", ""),
                "sunset": timings.get("Sunset", ""),
                "maghrib": timings.get("Maghrib", ""),
                "isha": timings.get("Isha", ""),
                "imsak": timings.get("Imsak", "")
            },
            "location": f"{city or 'Cairo'}, {country or 'Egypt'}"
        }
    
    except requests.exceptions.RequestException as e:
        print(f"Error fetching prayer times from Aladhan: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail="Failed to fetch prayer times from prayer service"
        )
    except Exception as e:
        print(f"Error processing prayer times: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/monthly")
def get_monthly_prayer_times(
    month: int,
    year: int,
    city: Optional[str] = None,
    country: Optional[str] = None,
    latitude: Optional[float] = None,
    longitude: Optional[float] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get monthly prayer times for a location"""
    try:
        # Get first day of month
        first_day = date(year, month, 1)
        
        if latitude and longitude:
            url = f"{ALADHAN_API_BASE}/timings/{first_day.isoformat()}"
            params = {
                "latitude": latitude,
                "longitude": longitude,
                "method": 2
            }
        else:
            city_name = city or "Cairo"
            country_name = country or "Egypt"
            url = f"{ALADHAN_API_BASE}/timingsByCity/{first_day.isoformat()}"
            params = {
                "city": city_name,
                "country": country_name,
                "method": 2
            }
        
        response = requests.get(url, params=params, timeout=10)
        response.raise_for_status()
        
        data = response.json()
        
        if data.get("code") != 200:
            raise HTTPException(status_code=500, detail="Failed to fetch prayer times")
        
        # Return sample monthly data (in production, you'd fetch all days)
        return {
            "month": month,
            "year": year,
            "city": city or "Cairo",
            "country": country or "Egypt",
            "prayer_times_available": True,
            "note": "Use individual day endpoints for complete monthly data"
        }
    
    except requests.exceptions.RequestException as e:
        print(f"Error fetching monthly prayer times: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail="Failed to fetch prayer times from prayer service"
        )
    except Exception as e:
        print(f"Error processing monthly prayer times: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/next")
def get_next_prayer(
    city: Optional[str] = None,
    country: Optional[str] = None,
    latitude: Optional[float] = None,
    longitude: Optional[float] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get next upcoming prayer time"""
    try:
        today = date.today()
        now = datetime.now()
        
        if latitude and longitude:
            url = f"{ALADHAN_API_BASE}/timings/{today.isoformat()}"
            params = {
                "latitude": latitude,
                "longitude": longitude,
                "method": 2
            }
        else:
            city_name = city or "Cairo"
            country_name = country or "Egypt"
            url = f"{ALADHAN_API_BASE}/timingsByCity/{today.isoformat()}"
            params = {
                "city": city_name,
                "country": country_name,
                "method": 2
            }
        
        response = requests.get(url, params=params, timeout=10)
        response.raise_for_status()
        
        data = response.json()
        
        if data.get("code") != 200:
            raise HTTPException(status_code=500, detail="Failed to fetch prayer times")
        
        timings = data.get("data", {}).get("timings", {})
        
        # Parse prayer times
        prayers = [
            ("Fajr", timings.get("Fajr", "")),
            ("Sunrise", timings.get("Sunrise", "")),
            ("Dhuhr", timings.get("Dhuhr", "")),
            ("Asr", timings.get("Asr", "")),
            ("Sunset", timings.get("Sunset", "")),
            ("Maghrib", timings.get("Maghrib", "")),
            ("Isha", timings.get("Isha", ""))
        ]
        
        # Find next prayer time
        next_prayer = None
        for prayer_name, prayer_time in prayers:
            try:
                prayer_datetime = datetime.strptime(prayer_time, "%H:%M")
                prayer_datetime = prayer_datetime.replace(year=now.year, month=now.month, day=now.day)
                
                if prayer_datetime > now:
                    next_prayer = {
                        "name": prayer_name,
                        "time": prayer_time,
                        "minutes_remaining": int((prayer_datetime - now).total_seconds() / 60)
                    }
                    break
            except ValueError:
                continue
        
        if not next_prayer:
            # If no prayer found today, return Fajr tomorrow
            next_prayer = {
                "name": "Fajr",
                "time": timings.get("Fajr", "05:30"),
                "minutes_remaining": -1,
                "note": "Next prayer is tomorrow"
            }
        
        return next_prayer
    
    except requests.exceptions.RequestException as e:
        print(f"Error fetching next prayer time: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail="Failed to fetch prayer times from prayer service"
        )
    except Exception as e:
        print(f"Error processing next prayer time: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/islamic-date")
def get_islamic_date(
    target_date: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get Islamic (Hijri) date for a given date"""
    try:
        date_to_convert = target_date or date.today().isoformat()
        
        url = f"{ALADHAN_API_BASE}/gToH?date={date_to_convert}"
        response = requests.get(url, timeout=10)
        response.raise_for_status()
        
        data = response.json()
        
        if data.get("code") != 200:
            raise HTTPException(status_code=500, detail="Failed to convert date")
        
        hijri = data.get("data", {})
        
        return {
            "gregorian_date": date_to_convert,
            "hijri_date": f"{hijri.get('day')} {hijri.get('month', {}).get('en')} {hijri.get('year')} AH",
            "hijri_day": hijri.get("day"),
            "hijri_month": hijri.get("month", {}).get("en"),
            "hijri_month_number": hijri.get("month", {}).get("number"),
            "hijri_year": hijri.get("year"),
            "islamic_month_name": hijri.get("month", {}).get("en")
        }
    
    except requests.exceptions.RequestException as e:
        print(f"Error converting Islamic date: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail="Failed to convert date from prayer service"
        )
    except Exception as e:
        print(f"Error processing Islamic date conversion: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/date/{target_date}")
def get_prayer_times_by_date(
    target_date: str,
    city: Optional[str] = None,
    country: Optional[str] = None,
    latitude: Optional[float] = None,
    longitude: Optional[float] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get prayer times for a specific date"""
    try:
        if latitude and longitude:
            url = f"{ALADHAN_API_BASE}/timings/{target_date}"
            params = {
                "latitude": latitude,
                "longitude": longitude,
                "method": 2
            }
        else:
            city_name = city or "Cairo"
            country_name = country or "Egypt"
            url = f"{ALADHAN_API_BASE}/timingsByCity/{target_date}"
            params = {
                "city": city_name,
                "country": country_name,
                "method": 2
            }
        
        response = requests.get(url, params=params, timeout=10)
        response.raise_for_status()
        
        data = response.json()
        
        if data.get("code") != 200:
            raise HTTPException(status_code=500, detail="Failed to fetch prayer times")
        
        timings = data.get("data", {}).get("timings", {})
        date_info = data.get("data", {}).get("date", {})
        
        return {
            "date": target_date,
            "hijri_date": date_info.get("hijri", {}).get("date", ""),
            "prayers": {
                "fajr": timings.get("Fajr", ""),
                "sunrise": timings.get("Sunrise", ""),
                "dhuhr": timings.get("Dhuhr", ""),
                "asr": timings.get("Asr", ""),
                "sunset": timings.get("Sunset", ""),
                "maghrib": timings.get("Maghrib", ""),
                "isha": timings.get("Isha", ""),
                "imsak": timings.get("Imsak", "")
            },
            "location": f"{city or 'Cairo'}, {country or 'Egypt'}"
        }
    
    except requests.exceptions.RequestException as e:
        print(f"Error fetching prayer times: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to fetch prayer times")
    except Exception as e:
        print(f"Error processing prayer times: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/location")
def get_prayer_times_by_location(
    latitude: float,
    longitude: float,
    date_str: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get prayer times by coordinates (latitude, longitude)"""
    try:
        prayer_date = date_str or date.today().isoformat()
        
        url = f"{ALADHAN_API_BASE}/timings/{prayer_date}"
        params = {
            "latitude": latitude,
            "longitude": longitude,
            "method": 2
        }
        
        response = requests.get(url, params=params, timeout=10)
        response.raise_for_status()
        
        data = response.json()
        
        if data.get("code") != 200:
            raise HTTPException(status_code=500, detail="Failed to fetch prayer times")
        
        timings = data.get("data", {}).get("timings", {})
        date_info = data.get("data", {}).get("date", {})
        
        return {
            "date": prayer_date,
            "hijri_date": date_info.get("hijri", {}).get("date", ""),
            "prayers": {
                "fajr": timings.get("Fajr", ""),
                "sunrise": timings.get("Sunrise", ""),
                "dhuhr": timings.get("Dhuhr", ""),
                "asr": timings.get("Asr", ""),
                "sunset": timings.get("Sunset", ""),
                "maghrib": timings.get("Maghrib", ""),
                "isha": timings.get("Isha", ""),
                "imsak": timings.get("Imsak", "")
            },
            "latitude": latitude,
            "longitude": longitude
        }
    
    except requests.exceptions.RequestException as e:
        print(f"Error fetching prayer times: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to fetch prayer times")
    except Exception as e:
        print(f"Error processing prayer times: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/city")
def get_prayer_times_by_city(
    city: str,
    country: str,
    date_str: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get prayer times by city name"""
    try:
        prayer_date = date_str or date.today().isoformat()
        
        url = f"{ALADHAN_API_BASE}/timingsByCity/{prayer_date}"
        params = {
            "city": city,
            "country": country,
            "method": 2
        }
        
        response = requests.get(url, params=params, timeout=10)
        response.raise_for_status()
        
        data = response.json()
        
        if data.get("code") != 200:
            raise HTTPException(status_code=500, detail="Failed to fetch prayer times")
        
        timings = data.get("data", {}).get("timings", {})
        date_info = data.get("data", {}).get("date", {})
        
        return {
            "date": prayer_date,
            "hijri_date": date_info.get("hijri", {}).get("date", ""),
            "prayers": {
                "fajr": timings.get("Fajr", ""),
                "sunrise": timings.get("Sunrise", ""),
                "dhuhr": timings.get("Dhuhr", ""),
                "asr": timings.get("Asr", ""),
                "sunset": timings.get("Sunset", ""),
                "maghrib": timings.get("Maghrib", ""),
                "isha": timings.get("Isha", ""),
                "imsak": timings.get("Imsak", "")
            },
            "location": f"{city}, {country}"
        }
    
    except requests.exceptions.RequestException as e:
        print(f"Error fetching prayer times: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to fetch prayer times")
    except Exception as e:
        print(f"Error processing prayer times: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
