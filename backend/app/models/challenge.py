from sqlalchemy import Column, Integer, String, DateTime, Boolean, ForeignKey, Text, Date
from sqlalchemy.sql import func
from app.core.database import Base

class Challenge(Base):
    __tablename__ = "challenges"
    
    id = Column(String, primary_key=True, index=True)
    name_en = Column(String, nullable=False)
    description = Column(Text)
    category = Column(String, default="General")  # Spiritual, Health, Character, Learning, etc.
    duration_days = Column(Integer, default=30)
    difficulty = Column(String, default="Medium")  # Easy, Medium, Hard
    required_difficulty = Column(String, nullable=True)  # Unlock after completing this difficulty
    icon = Column(String)
    reward = Column(String)
    is_active = Column(Boolean, default=True)
    notification_time = Column(String, nullable=True)  # HH:MM format, e.g., "08:00"
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class UserChallengeProgress(Base):
    __tablename__ = "user_challenge_progress"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    challenge_id = Column(String, ForeignKey("challenges.id"), nullable=False, index=True)
    accepted_date = Column(Date, nullable=False)
    is_completed = Column(Boolean, default=False)
    current_streak = Column(Integer, default=0)  # Consecutive days completed
    last_completion_date = Column(Date, nullable=True)  # Track last completed date for streak detection
    max_streak = Column(Integer, default=0)  # Best streak achieved
    is_unlocked = Column(Boolean, default=True)  # For progression system
    notification_enabled = Column(Boolean, default=True)  # User can disable notifications
    grace_day_used = Column(Boolean, default=False)  # Can use once per challenge to catch up
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

class ChallengeCompletion(Base):
    __tablename__ = "challenge_completions"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    challenge_id = Column(String, ForeignKey("challenges.id"), nullable=False, index=True)
    completion_date = Column(Date, nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
