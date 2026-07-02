"""Quran endpoints backed by the public AlQuran.cloud API (see app.services.quran_api).

All endpoints require a valid JWT. The user-specific bits (sessions, bookmarks,
reading progress) live in the local `quran` table; the actual Quran *content*
is fetched (and cached) from AlQuran.cloud.
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models.user import User
from app.models.quran import Quran
from app.services import quran_api

router = APIRouter()


@router.get("/surahs")
async def get_surahs(
    current_user: User = Depends(get_current_user),
):
    """List all 114 Surahs (metadata only)."""
    try:
        return await quran_api.get_surahs()
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Failed to fetch Surahs: {e}")


@router.get("/surahs/{surah_number}/ayahs")
async def get_surah_ayahs(
    surah_number: int,
    current_user: User = Depends(get_current_user),
):
    """Return one full Surah (Arabic + EN + BN) with all Ayahs."""
    if surah_number < 1 or surah_number > 114:
        raise HTTPException(status_code=404, detail="Surah not found")
    try:
        return await quran_api.get_surah_with_ayahs(surah_number)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Failed to fetch Ayahs: {e}")


@router.get("/surahs/{surah_number}/ayahs/{ayah_number}")
async def get_ayah(
    surah_number: int,
    ayah_number: int,
    current_user: User = Depends(get_current_user),
):
    """Return one Ayah (Arabic + EN + BN)."""
    if surah_number < 1 or surah_number > 114 or ayah_number < 1:
        raise HTTPException(status_code=404, detail="Ayah not found")
    try:
        return await quran_api.get_ayah(surah_number, ayah_number)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Failed to fetch Ayah: {e}")


@router.get("/search")
async def search_quran(
    q: str,
    current_user: User = Depends(get_current_user),
):
    """Keyword search across the Quran (English edition)."""
    try:
        return await quran_api.search(q)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Search failed: {e}")


# ------------------------------------------------------------------
# User-specific data (sessions, bookmarks, reading progress)
# ------------------------------------------------------------------


@router.post("/sessions", status_code=status.HTTP_201_CREATED)
def log_reading_session(
    payload: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Log a Quran reading session."""
    surah_number = payload.get("surahNumber")
    ayah_number = payload.get("ayahNumber")
    if not surah_number or not ayah_number:
        raise HTTPException(status_code=400, detail="surahNumber and ayahNumber are required")

    duration = payload.get("duration", 0)
    record = Quran(
        user_id=current_user.id,
        surah=surah_number,
        ayah=ayah_number,
        notes=f"Session — {duration} min" if duration else "Session",
    )
    db.add(record)
    db.commit()
    db.refresh(record)

    return {
        "id": record.id,
        "surahNumber": record.surah,
        "ayahNumber": record.ayah,
        "timestamp": record.created_at.isoformat(),
        "duration": duration,
    }


@router.get("/bookmarks")
def get_bookmarks(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    rows = (
        db.query(Quran)
        .filter(Quran.user_id == current_user.id, Quran.notes.ilike("bookmark%"))
        .order_by(Quran.created_at.desc())
        .all()
    )
    return [
        {
            "id": r.id,
            "surahNumber": r.surah,
            "ayahNumber": r.ayah,
            "createdAt": r.created_at.isoformat(),
            "notes": r.notes,
        }
        for r in rows
    ]


@router.post("/bookmarks", status_code=status.HTTP_201_CREATED)
def add_bookmark(
    payload: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    surah_number = payload.get("surahNumber")
    ayah_number = payload.get("ayahNumber")
    if not surah_number or not ayah_number:
        raise HTTPException(status_code=400, detail="surahNumber and ayahNumber are required")

    record = Quran(
        user_id=current_user.id,
        surah=surah_number,
        ayah=ayah_number,
        notes="Bookmarked",
    )
    db.add(record)
    db.commit()
    db.refresh(record)

    return {
        "id": record.id,
        "surahNumber": record.surah,
        "ayahNumber": record.ayah,
        "createdAt": record.created_at.isoformat(),
    }


@router.delete("/bookmarks/{bookmark_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_bookmark(
    bookmark_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    row = (
        db.query(Quran)
        .filter(
            Quran.id == bookmark_id,
            Quran.user_id == current_user.id,
            Quran.notes.ilike("bookmark%"),
        )
        .first()
    )
    if not row:
        raise HTTPException(status_code=404, detail="Bookmark not found")
    db.delete(row)
    db.commit()


@router.get("/progress")
def get_reading_progress(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Aggregated reading progress for the current user."""
    rows = db.query(Quran).filter(Quran.user_id == current_user.id).all()
    if not rows:
        return {
            "totalSurahsRead": 0,
            "totalAyahsRead": 0,
            "currentSurah": 1,
            "currentAyah": 1,
            "lastReadDate": None,
            "readingStreak": 0,
        }

    unique_surahs = len({r.surah for r in rows})
    total_ayahs = len(rows)
    last = max(rows, key=lambda r: r.created_at)
    return {
        "totalSurahsRead": unique_surahs,
        "totalAyahsRead": total_ayahs,
        "currentSurah": last.surah,
        "currentAyah": last.ayah,
        "lastReadDate": last.created_at.isoformat(),
        "readingStreak": 0,  # TODO: compute from unique reading days
    }