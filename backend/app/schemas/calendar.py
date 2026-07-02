"""Pydantic schemas for /islamic-calendar/* and /user/location endpoints."""
from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, Field

from app.models.calendar import EventCategory, DatePrecision, Authenticity


class IslamicEventResponse(BaseModel):
    id: int
    title_en: str
    title_bn: Optional[str] = None
    hijri_month: int
    hijri_day: int
    hijri_year: Optional[int] = None
    category: EventCategory
    description_en: Optional[str] = None
    description_bn: Optional[str] = None
    full_story_en: Optional[str] = None
    full_story_bn: Optional[str] = None
    sources: Optional[str] = None
    color_code: str = "#2C5F2D"
    is_recurring: bool = True
    # v2 metadata
    location: Optional[str] = None
    date_gregorian: Optional[str] = None
    date_precision: DatePrecision = DatePrecision.EXACT
    primary_sources: Optional[List[str]] = None
    historical_sources: Optional[List[str]] = None
    scholarly_consensus: bool = False
    authenticity: Authenticity = Authenticity.MODERATE
    notes: Optional[str] = None

    class Config:
        from_attributes = True


class IslamicEventCreate(BaseModel):
    title_en: str = Field(..., min_length=1, max_length=200)
    title_bn: Optional[str] = Field(None, max_length=200)
    hijri_month: int = Field(..., ge=1, le=12)
    hijri_day: int = Field(..., ge=1, le=30)
    hijri_year: Optional[int] = Field(None, ge=-100, le=2000)
    category: EventCategory
    description_en: Optional[str] = None
    description_bn: Optional[str] = None
    full_story_en: Optional[str] = None
    full_story_bn: Optional[str] = None
    sources: Optional[str] = None
    color_code: str = "#2C5F2D"
    is_recurring: bool = True
    # v2 metadata
    location: Optional[str] = None
    date_gregorian: Optional[str] = None
    date_precision: DatePrecision = DatePrecision.EXACT
    primary_sources: Optional[List[str]] = None
    historical_sources: Optional[List[str]] = None
    scholarly_consensus: bool = False
    authenticity: Authenticity = Authenticity.MODERATE
    notes: Optional[str] = None


class IslamicEventUpdate(BaseModel):
    """Partial-update schema. All fields optional so admins can patch one
    field at a time without sending the full record."""

    title_en: Optional[str] = Field(None, min_length=1, max_length=200)
    title_bn: Optional[str] = Field(None, max_length=200)
    hijri_month: Optional[int] = Field(None, ge=1, le=12)
    hijri_day: Optional[int] = Field(None, ge=1, le=30)
    hijri_year: Optional[int] = Field(None, ge=-100, le=2000)
    category: Optional[EventCategory] = None
    description_en: Optional[str] = None
    description_bn: Optional[str] = None
    full_story_en: Optional[str] = None
    full_story_bn: Optional[str] = None
    sources: Optional[str] = None
    color_code: Optional[str] = None
    is_recurring: Optional[bool] = None
    # v2 metadata
    location: Optional[str] = None
    date_gregorian: Optional[str] = None
    date_precision: Optional[DatePrecision] = None
    primary_sources: Optional[List[str]] = None
    historical_sources: Optional[List[str]] = None
    scholarly_consensus: Optional[bool] = None
    authenticity: Optional[Authenticity] = None
    notes: Optional[str] = None


class UserLocation(BaseModel):
    city: str = Field(..., min_length=1, max_length=100)
    country: str = Field(..., min_length=1, max_length=100)
    latitude: float = Field(..., ge=-90, le=90)
    longitude: float = Field(..., ge=-180, le=180)
    timezone: str = Field("UTC", max_length=64)


class UserLocationResponse(UserLocation):
    id: int
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True