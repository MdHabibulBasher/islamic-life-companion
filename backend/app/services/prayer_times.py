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
        print(f"🕌 Fetching prayer times from: {url}")
        print(f"📍 Params: {params}")
        
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(url, params=params)
            print(f"✅ Response status: {response.status_code}")
            
            response.raise_for_status()
            data = response.json()
            
            if data.get("code") == 200:
                timings = data["data"]["timings"]
                print(f"🕐 Prayer times received: {timings}")
                
                # Return times as strings (format: HH:MM)
                result = {
                    "fajr": timings["Fajr"],
                    "sunrise": timings["Sunrise"],
                    "dhuhr": timings["Dhuhr"],
                    "asr": timings["Asr"],
                    "maghrib": timings["Maghrib"],
                    "isha": timings["Isha"]
                }
                print(f"✅ Returning prayer times: {result}")
                return result
            else:
                print(f"❌ API returned non-200 code: {data.get('code')}")
                return None
    except httpx.HTTPError as e:
        print(f"❌ HTTP Error fetching prayer times: {e}")
        return None
    except Exception as e:
        print(f"❌ Error fetching prayer times: {e}")
        import traceback
        traceback.print_exc()
        return None
