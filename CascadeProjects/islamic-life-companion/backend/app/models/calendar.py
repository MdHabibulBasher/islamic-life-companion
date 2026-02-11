from sqlalchemy import Column, Integer, String, Text, Date, DateTime, Enum, ForeignKey, Boolean
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

class IslamicEvent(Base):
    __tablename__ = "islamic_events"
    
    id = Column(Integer, primary_key=True, index=True)
    title_en = Column(String, nullable=False)
    title_bn = Column(String)
    hijri_month = Column(Integer, nullable=False)
    hijri_day = Column(Integer, nullable=False)
    category = Column(Enum(EventCategory), nullable=False)
    description_en = Column(Text)
    description_bn = Column(Text)
    full_story_en = Column(Text)
    full_story_bn = Column(Text)
    sources = Column(Text)
    color_code = Column(String, default="#2C5F2D")
    is_recurring = Column(Boolean, default=True)
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
