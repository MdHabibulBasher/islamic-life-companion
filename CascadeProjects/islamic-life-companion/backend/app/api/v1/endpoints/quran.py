from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from datetime import datetime
from typing import List, Optional
import json
from app.core.database import get_db
from app.api.deps import get_current_user
from app.models.user import User
from app.models.quran import Quran

router = APIRouter()

# Sample Quran data (in production, you'd have this in a database or external API)
SURAHS = [
    {'number': 1, 'name': 'Al-Fatiha', 'englishName': 'The Opening', 'numberOfAyahs': 7, 'revelationType': 'Meccan'},
    {'number': 2, 'name': 'Al-Baqarah', 'englishName': 'The Cow', 'numberOfAyahs': 286, 'revelationType': 'Madinan'},
    {'number': 3, 'name': 'Ali Imran', 'englishName': 'The Family of Imran', 'numberOfAyahs': 200, 'revelationType': 'Madinan'},
    {'number': 4, 'name': 'An-Nisa', 'englishName': 'The Women', 'numberOfAyahs': 176, 'revelationType': 'Madinan'},
    {'number': 5, 'name': 'Al-Ma\'idah', 'englishName': 'The Table Spread', 'numberOfAyahs': 120, 'revelationType': 'Madinan'},
    {'number': 6, 'name': 'Al-An\'am', 'englishName': 'The Cattle', 'numberOfAyahs': 165, 'revelationType': 'Meccan'},
    {'number': 7, 'name': 'Al-A\'raf', 'englishName': 'The Heights', 'numberOfAyahs': 206, 'revelationType': 'Meccan'},
    {'number': 8, 'name': 'Al-Anfal', 'englishName': 'The Spoils of War', 'numberOfAyahs': 75, 'revelationType': 'Madinan'},
    {'number': 9, 'name': 'At-Taubah', 'englishName': 'The Repentance', 'numberOfAyahs': 129, 'revelationType': 'Madinan'},
    {'number': 10, 'name': 'Yunus', 'englishName': 'Jonah', 'numberOfAyahs': 109, 'revelationType': 'Meccan'},
]


@router.get("/surahs")
def get_surahs(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get list of all Surahs"""
    try:
        return SURAHS
    except Exception as e:
        print(f"Error fetching Surahs: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/surahs/{surah_number}/ayahs")
def get_surah_ayahs(
    surah_number: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get Ayahs for a specific Surah"""
    try:
        surah = next((s for s in SURAHS if s['number'] == surah_number), None)
        if not surah:
            raise HTTPException(status_code=404, detail="Surah not found")
        
        # Return sample Ayahs (in production, fetch from database or API)
        return {
            "surah_number": surah_number,
            "surah_name": surah['name'],
            "ayahs": [
                {
                    "number": i + 1,
                    "text": f"بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ (Ayah {i + 1})",
                    "numberInSurah": i + 1,
                    "juz": 1,
                    "manzil": 1,
                    "page": 1,
                    "ruku": 1,
                    "hizbQuar": 1,
                    "sajda": False
                }
                for i in range(min(7, surah['numberOfAyahs']))
            ]
        }
    except Exception as e:
        print(f"Error fetching Surah Ayahs: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/surahs/{surah_number}/ayahs/{ayah_number}")
def get_ayah(
    surah_number: int,
    ayah_number: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get a specific Ayah"""
    try:
        surah = next((s for s in SURAHS if s['number'] == surah_number), None)
        if not surah:
            raise HTTPException(status_code=404, detail="Surah not found")
        
        if ayah_number > surah['numberOfAyahs'] or ayah_number < 1:
            raise HTTPException(status_code=404, detail="Ayah not found")
        
        return {
            "number": ayah_number,
            "surah": surah_number,
            "text": f"بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ (Surah {surah_number}, Ayah {ayah_number})",
            "numberInSurah": ayah_number,
            "translation": "In the name of Allah, the Most Gracious, the Most Merciful",
            "transliteration": "Bismillah ar-Rahman ar-Rahim"
        }
    except Exception as e:
        print(f"Error fetching Ayah: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/progress")
def get_reading_progress(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get user's Quran reading progress"""
    try:
        # Get user's Quran readings
        readings = db.query(Quran).filter(
            Quran.user_id == current_user.id
        ).all()
        
        if not readings:
            return {
                "totalSurahsRead": 0,
                "totalAyahsRead": 0,
                "currentSurah": 1,
                "currentAyah": 1,
                "lastReadDate": None,
                "readingStreak": 0
            }
        
        # Calculate statistics
        unique_surahs = len(set(r.surah for r in readings))
        total_ayahs = len(readings)
        
        # Get most recent reading
        last_reading = max(readings, key=lambda r: r.created_at)
        
        return {
            "totalSurahsRead": unique_surahs,
            "totalAyahsRead": total_ayahs,
            "currentSurah": last_reading.surah,
            "currentAyah": last_reading.ayah,
            "lastReadDate": last_reading.created_at.isoformat(),
            "readingStreak": 0  # Calculate based on consecutive days
        }
    except Exception as e:
        print(f"Error fetching reading progress: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/sessions")
def log_reading_session(
    session_data: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Log a Quran reading session"""
    try:
        surah_number = session_data.get("surahNumber")
        ayah_number = session_data.get("ayahNumber")
        duration = session_data.get("duration", 0)
        
        # Create a new Quran record
        quran_record = Quran(
            user_id=current_user.id,
            surah=surah_number,
            ayah=ayah_number,
            notes=f"Reading session - Duration: {duration} minutes"
        )
        
        db.add(quran_record)
        db.commit()
        db.refresh(quran_record)
        
        return {
            "id": quran_record.id,
            "surahNumber": quran_record.surah,
            "ayahNumber": quran_record.ayah,
            "timestamp": quran_record.created_at.isoformat(),
            "duration": duration
        }
    except Exception as e:
        db.rollback()
        print(f"Error logging reading session: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/bookmarks")
def get_bookmarks(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get user's Quran bookmarks"""
    try:
        bookmarks = db.query(Quran).filter(
            Quran.user_id == current_user.id
        ).all()
        
        return [
            {
                "id": b.id,
                "surahNumber": b.surah,
                "ayahNumber": b.ayah,
                "createdAt": b.created_at.isoformat(),
                "notes": b.notes
            }
            for b in bookmarks
        ]
    except Exception as e:
        print(f"Error fetching bookmarks: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/bookmarks")
def add_bookmark(
    bookmark_data: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Add a Quran bookmark"""
    try:
        surah_number = bookmark_data.get("surahNumber")
        ayah_number = bookmark_data.get("ayahNumber")
        
        bookmark = Quran(
            user_id=current_user.id,
            surah=surah_number,
            ayah=ayah_number,
            notes="Bookmarked"
        )
        
        db.add(bookmark)
        db.commit()
        db.refresh(bookmark)
        
        return {
            "id": bookmark.id,
            "surahNumber": bookmark.surah,
            "ayahNumber": bookmark.ayah,
            "createdAt": bookmark.created_at.isoformat()
        }
    except Exception as e:
        db.rollback()
        print(f"Error adding bookmark: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/bookmarks/{bookmark_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_bookmark(
    bookmark_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Remove a bookmark"""
    try:
        bookmark = db.query(Quran).filter(
            Quran.id == bookmark_id,
            Quran.user_id == current_user.id
        ).first()
        
        if not bookmark:
            raise HTTPException(status_code=404, detail="Bookmark not found")
        
        db.delete(bookmark)
        db.commit()
    except Exception as e:
        db.rollback()
        print(f"Error removing bookmark: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/search")
def search_quran(
    q: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Search Quran (limited implementation)"""
    try:
        # In production, you would search actual Quran text
        # This is a placeholder
        return {
            "query": q,
            "results": [
                {
                    "surah": 1,
                    "ayah": 1,
                    "text": "بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ",
                    "relevance": 0.95
                }
            ],
            "total": 1
        }
    except Exception as e:
        print(f"Error searching Quran: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
