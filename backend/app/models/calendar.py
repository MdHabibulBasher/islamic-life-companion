from sqlalchemy import Column, Integer, String, Text, Date, DateTime, Enum, ForeignKey, Boolean, JSON
from sqlalchemy.sql import func
from app.core.database import Base
import enum

class EventCategory(str, enum.Enum):
    HOLIDAY = "holiday"
    BATTLE = "battle"
    REVELATION = "revelation"
    PROPHETIC = "prophetic"
    COMPANION = "companion"
    TREATY = "treaty"
    SPECIAL = "special"

class DatePrecision(str, enum.Enum):
    EXACT = "exact"             # Day + month + year all known (e.g. 17 Ramadan 2 AH)
    MONTH_YEAR = "month_year"   # Only Hijri month + year known
    YEAR_ONLY = "year_only"     # Only the Hijri year is known
    APPROXIMATE = "approximate" # Day is approximate (e.g. "around 10th of Muharram")

class Authenticity(str, enum.Enum):
    STRONG = "strong"           # Multiple strong sources, scholarly consensus
    MODERATE = "moderate"       # Some sources, mixed scholarly opinion
    DISPUTED = "disputed"       # Sources differ on key details
    WEAK = "weak"               # Few or weak sources (e.g. Mawlid date)

class IslamicEvent(Base):
    __tablename__ = "islamic_events"

    id = Column(Integer, primary_key=True, index=True)
    title_en = Column(String, nullable=False)
    title_bn = Column(String)
    hijri_month = Column(Integer, nullable=False)
    hijri_day = Column(Integer, nullable=False)
    hijri_year = Column(Integer, nullable=True)
    category = Column(Enum(EventCategory), nullable=False)
    description_en = Column(Text)
    description_bn = Column(Text)
    full_story_en = Column(Text)
    full_story_bn = Column(Text)
    sources = Column(Text)
    color_code = Column(String, default="#2C5F2D")
    is_recurring = Column(Boolean, default=True)
    # ----- v2 metadata fields -----
    location = Column(String, nullable=True)
    date_gregorian = Column(String, nullable=True)
    date_precision = Column(Enum(DatePrecision), default=DatePrecision.EXACT, nullable=False)
    primary_sources = Column(JSON, nullable=True)
    historical_sources = Column(JSON, nullable=True)
    scholarly_consensus = Column(Boolean, default=False)
    authenticity = Column(Enum(Authenticity), default=Authenticity.MODERATE, nullable=False)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

class LocationSettings(Base):
    __tablename__ = "location_settings"
    
    id = Column(Integer, primary_key=True, index=True)
    location_name = Column(String, unique=True, nullable=False)
    country = Column(String)
    adjustment_days = Column(Integer, default=0)
    method_description = Column(String)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
