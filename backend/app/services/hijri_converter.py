from hijri_converter import Hijri, Gregorian
from datetime import date
from typing import Dict

def gregorian_to_hijri(gregorian_date: date) -> Dict:
    hijri = Hijri.fromisoformat(gregorian_date.isoformat())
    return {
        "year": hijri.year,
        "month": hijri.month,
        "day": hijri.day,
        "month_name": hijri.month_name()
    }

def hijri_to_gregorian(year: int, month: int, day: int) -> date:
    hijri = Hijri(year, month, day)
    gregorian = hijri.to_gregorian()
    return date(gregorian.year, gregorian.month, gregorian.day)

def get_hijri_month_name(month: int) -> str:
    months = [
        "Muharram", "Safar", "Rabi' al-awwal", "Rabi' al-thani",
        "Jumada al-awwal", "Jumada al-thani", "Rajab", "Sha'ban",
        "Ramadan", "Shawwal", "Dhu al-Qi'dah", "Dhu al-Hijjah"
    ]
    return months[month - 1] if 1 <= month <= 12 else ""
