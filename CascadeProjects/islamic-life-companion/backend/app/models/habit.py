from sqlalchemy import Column, Integer, String, DateTime, Boolean, ForeignKey, Text, Time, JSON, Enum, Date
from sqlalchemy.sql import func
from app.core.database import Base
import enum

class TrackingType(str, enum.Enum):
    CHECKBOX = "checkbox"
    COUNTER = "counter"
    TIMER = "timer"

class HabitCategory(Base):
    __tablename__ = "habit_categories"
    
    id = Column(Integer, primary_key=True, index=True)
    name_en = Column(String, nullable=False)
    name_bn = Column(String)
    icon = Column(String)
    color = Column(String, default="#2C5F2D")
    is_default = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class UserHabit(Base):
    __tablename__ = "user_habits"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    category_id = Column(Integer, ForeignKey("habit_categories.id"), nullable=False)
    name = Column(String, nullable=False)
    description = Column(Text)
    tracking_type = Column(Enum(TrackingType), default=TrackingType.CHECKBOX)
    target_value = Column(Integer)
    unit = Column(String)
    is_active = Column(Boolean, default=True)
    is_deleted = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

class HabitTracking(Base):
    __tablename__ = "habit_tracking"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    habit_id = Column(Integer, ForeignKey("user_habits.id", ondelete="CASCADE"), nullable=False, index=True)
    tracking_date = Column(Date, nullable=False, index=True)
    is_completed = Column(Boolean, default=False)
    counter_value = Column(Integer, default=0)
    timer_seconds = Column(Integer, default=0)
    notes = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

class WeeklyPlan(Base):
    __tablename__ = "weekly_plans"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    week_start_date = Column(Date, nullable=False, index=True)
    week_end_date = Column(Date, nullable=False)
    goals = Column(Text)
    reflection = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

class HabitStreak(Base):
    __tablename__ = "habit_streaks"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    habit_id = Column(Integer, ForeignKey("user_habits.id", ondelete="CASCADE"), nullable=False, index=True)
    current_streak = Column(Integer, default=0)
    longest_streak = Column(Integer, default=0)
    last_completed_date = Column(Date)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

class DailyHabitSummary(Base):
    __tablename__ = "daily_habit_summary"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    summary_date = Column(Date, nullable=False, index=True)
    total_habits = Column(Integer, default=0)
    completed_habits = Column(Integer, default=0)
    completion_rate = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class HabitAchievement(Base):
    __tablename__ = "habit_achievements"
    
    id = Column(Integer, primary_key=True, index=True)
    name_en = Column(String, nullable=False)
    name_bn = Column(String)
    description_en = Column(Text)
    description_bn = Column(Text)
    badge_icon = Column(String)
    requirement_type = Column(String)
    requirement_value = Column(Integer)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class UserAchievement(Base):
    __tablename__ = "user_achievements"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    achievement_id = Column(Integer, ForeignKey("habit_achievements.id"), nullable=False)
    unlocked_at = Column(DateTime(timezone=True), server_default=func.now())

class HabitStatistics(Base):
    __tablename__ = "habit_statistics"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, unique=True, index=True)
    total_habits_created = Column(Integer, default=0)
    active_habits = Column(Integer, default=0)
    overall_completion_rate = Column(Integer, default=0)
    best_habit_id = Column(Integer)
    total_achievements = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

