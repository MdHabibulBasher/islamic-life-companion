import httpx
from datetime import date, datetime
from typing import Dict, Optional
from app.core.config import settings

async def fetch_prayer_times(
    latitude: str,
    longitude: str,
    prayer_date: date,
    method: str = "ISNA"
) -> Optional[Dict]:
    # Use current date format that Aladhan expects: DD-MM-YYYY
    url = f"{settings.ALADHAN_API_BASE_URL}/timings/{prayer_date.strftime('%d-%m-%Y')}"
    
    # Map method names to Aladhan API method numbers
    method_map = {
        "ISNA": "2",
        "MWL": "3",
        "EGYPT": "5",
        "MAKKAH": "4",
        "KARACHI": "1",
        "TEHRAN": "7",
        "JAFARI": "0"
    }
    
    method_number = method_map.get(method, "2")  # Default to ISNA (2)
    
    params = {
        "latitude": str(latitude),
        "longitude": str(longitude),
        "method": method_number
    }
    
    try:
        # Use ASCII-safe log prefixes — Windows consoles (cp1252) choke on emoji.
        print(f"[prayer-times] fetching: {url}")
        print(f"[prayer-times] params: {params}")
        
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(url, params=params)
            print(f"[prayer-times] response: {response.status_code}")

            response.raise_for_status()
            data = response.json()

            if data.get("code") == 200:
                timings = data["data"]["timings"]
                print(f"[prayer-times] timings: {timings}")

                # Return times as strings (format: HH:MM)
                result = {
                    "fajr": timings["Fajr"],
                    "sunrise": timings["Sunrise"],
                    "dhuhr": timings["Dhuhr"],
                    "asr": timings["Asr"],
                    "maghrib": timings["Maghrib"],
                    "isha": timings["Isha"]
                }
                print(f"[prayer-times] ok: {result}")
                return result
            else:
                print(f"[prayer-times] non-200 code: {data.get('code')}")
                return None
    except httpx.HTTPError as e:
        print(f"[prayer-times] HTTP error: {e}")
        return None
    except Exception as e:
        print(f"[prayer-times] error: {e}")
        import traceback
        traceback.print_exc()
        return None


async def fetch_prayer_times_by_city(
    city: str,
    country: str,
    prayer_date: date,
    method: str = "ISNA",
) -> Optional[Dict]:
    """Fetch prayer times from Aladhan using the /timingsByAddress endpoint.

    Used when we only know the user's city and country (no coordinates).
    Same return shape as :func:`fetch_prayer_times`.
    """
    # Map method names to Aladhan API method numbers
    method_map = {
        "ISNA": "2",
        "MWL": "3",
        "EGYPT": "5",
        "MAKKAH": "4",
        "KARACHI": "1",
        "TEHRAN": "7",
        "JAFARI": "0",
    }
    method_number = method_map.get(method, "2")

    url = f"{settings.ALADHAN_API_BASE_URL}/timingsByAddress/{prayer_date.strftime('%d-%m-%Y')}"
    params = {"address": f"{city}, {country}", "method": method_number}

    try:
        # Use ASCII-safe log prefixes — Windows consoles (cp1252) choke on emoji.
        print(f"[prayer-times] fetching by city: {url}")
        print(f"[prayer-times] params: {params}")
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(url, params=params)
            print(f"[prayer-times] response: {response.status_code}")
            response.raise_for_status()
            data = response.json()
            if data.get("code") == 200:
                timings = data["data"]["timings"]
                result = {
                    "fajr": timings["Fajr"],
                    "sunrise": timings.get("Sunrise", ""),
                    "dhuhr": timings["Dhuhr"],
                    "asr": timings["Asr"],
                    "maghrib": timings["Maghrib"],
                    "isha": timings["Isha"],
                    # End-of-Isha bounds: midpoint of the night (al-Mughni /
                    # Shafi'i preferred end of Isha). Falls back to the
                    # last-third start if Aladhan omits Midnight.
                    "midnight": timings.get("Midnight") or timings.get("Firstthird", ""),
                }
                print(f"[prayer-times] ok: {result}")
                return result
            print(f"[prayer-times] non-200 code: {data.get('code')}")
            return None
    except Exception as e:
        print(f"[prayer-times] error: {e}")
        return None
