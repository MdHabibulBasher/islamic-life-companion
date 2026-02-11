from pydantic import BaseModel, Field, field_validator
from datetime import date, datetime
from typing import Optional, List
from enum import Enum


class TrackingType(str, Enum):
    CHECKBOX = "checkbox"
    COUNTER = "counter"
    TIMER = "timer"


class HabitCategoryResponse(BaseModel):
    id: int
    name_en: str
    name_bn: Optional[str] = None
    icon: Optional[str] = None
    color: str = "#2C5F2D"
    is_default: bool = True
    
    class Config:
        from_attributes = True


class UserHabitCreate(BaseModel):
    category_id: int
    name: str
    description: Optional[str] = None
    tracking_type: TrackingType = TrackingType.CHECKBOX
    target_value: Optional[int] = None
    unit: Optional[str] = None


class UserHabitUpdate(BaseModel):
    category_id: Optional[int] = None
    name: Optional[str] = None
    description: Optional[str] = None
    tracking_type: Optional[TrackingType] = None
    target_value: Optional[int] = None
    unit: Optional[str] = None
    is_active: Optional[bool] = None


class UserHabitResponse(BaseModel):
    id: int
    user_id: int
    category_id: int
    name: str
    description: Optional[str] = None
    tracking_type: TrackingType = TrackingType.CHECKBOX
    target_value: Optional[int] = None
    unit: Optional[str] = None
    is_active: bool = True
    is_deleted: bool = False
    created_at: datetime
    updated_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True


class HabitTrackingCreate(BaseModel):
    habit_id: int
    tracking_date: date
    is_completed: bool = False
    counter_value: int = 0
    timer_seconds: int = 0
    notes: Optional[str] = None


class HabitTrackingUpdate(BaseModel):
    is_completed: Optional[bool] = None
    counter_value: Optional[int] = None
    timer_seconds: Optional[int] = None
    notes: Optional[str] = None


class HabitTrackingResponse(BaseModel):
    id: int
    user_id: int
    habit_id: int
    tracking_date: date
    is_completed: bool = False
    counter_value: int = 0
    timer_seconds: int = 0
    notes: Optional[str] = None
    created_at: datetime
    updated_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True
        json_encoders = {
            date: lambda v: v.isoformat() if v else None
        }


class HabitStreakResponse(BaseModel):
    id: int
    user_id: int
    habit_id: int
    current_streak: int = 0
    longest_streak: int = 0
    last_completed_date: Optional[date] = None
    created_at: datetime
    updated_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True
        json_encoders = {
            date: lambda v: v.isoformat() if v else None
        }


class DailyHabitSummaryResponse(BaseModel):
    id: int
    user_id: int
    summary_date: date
    total_habits: int = 0
    completed_habits: int = 0
    completion_rate: int = 0
    created_at: datetime
    
    class Config:
        from_attributes = True
        json_encoders = {
            date: lambda v: v.isoformat() if v else None
        }


class HabitStatisticsResponse(BaseModel):
    habit_id: int
    habit_name: str
    total_completions: int = 0
    completion_rate: float = 0.0
    current_streak: int = 0
    longest_streak: int = 0
    average_completion_time: Optional[float] = None
    
    class Config:
        from_attributes = True


class HabitWithTracking(BaseModel):
    habit: UserHabitResponse
    today_tracking: Optional[HabitTrackingResponse] = None
    streak: Optional[HabitStreakResponse] = None
    
    class Config:
        from_attributes = True
