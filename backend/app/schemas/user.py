"""Pydantic schemas for /user/* profile, preferences, statistics, password."""
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, EmailStr, Field, field_validator

from app.services.hijri import HIJRI_OFFSET_MAX, HIJRI_OFFSET_MIN, VALID_HIJRI_BASIS


class UserProfileUpdate(BaseModel):
    full_name: Optional[str] = Field(None, min_length=2, max_length=120)
    username: Optional[str] = Field(None, min_length=2, max_length=64)
    avatar_url: Optional[str] = Field(None, max_length=500)
    bio: Optional[str] = Field(None, max_length=1000)
    location: Optional[str] = Field(None, max_length=120)
    timezone: Optional[str] = Field(None, max_length=64)
    language: Optional[str] = Field(None, max_length=8)


class UserProfileResponse(BaseModel):
    id: int
    email: EmailStr
    username: Optional[str] = None
    full_name: Optional[str] = None
    avatar_url: Optional[str] = None
    bio: Optional[str] = None
    location: Optional[str] = None
    timezone: Optional[str] = None
    language: Optional[str] = None
    is_active: bool
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class UserPreferences(BaseModel):
    dark_mode: bool = False
    arabic_text: bool = True
    default_view: str = "daily"
    email_notifications: bool = True
    habit_reminders: bool = True
    challenge_updates: bool = True
    prayer_reminders: bool = True
    hijri_basis: str = "global"
    hijri_offset: int = 0

    @field_validator("hijri_basis")
    @classmethod
    def _check_basis(cls, v: str) -> str:
        if v not in VALID_HIJRI_BASIS:
            raise ValueError(
                f"hijri_basis must be one of {sorted(VALID_HIJRI_BASIS)}"
            )
        return v

    @field_validator("hijri_offset")
    @classmethod
    def _check_offset(cls, v: int) -> int:
        if v < HIJRI_OFFSET_MIN or v > HIJRI_OFFSET_MAX:
            raise ValueError(
                f"hijri_offset must be between {HIJRI_OFFSET_MIN} and {HIJRI_OFFSET_MAX}"
            )
        return v


class UserPreferencesUpdate(BaseModel):
    dark_mode: Optional[bool] = None
    arabic_text: Optional[bool] = None
    default_view: Optional[str] = Field(None, max_length=32)
    email_notifications: Optional[bool] = None
    habit_reminders: Optional[bool] = None
    challenge_updates: Optional[bool] = None
    prayer_reminders: Optional[bool] = None
    hijri_basis: Optional[str] = None
    hijri_offset: Optional[int] = None

    @field_validator("hijri_basis")
    @classmethod
    def _check_basis(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        if v not in VALID_HIJRI_BASIS:
            raise ValueError(
                f"hijri_basis must be one of {sorted(VALID_HIJRI_BASIS)}"
            )
        return v

    @field_validator("hijri_offset")
    @classmethod
    def _check_offset(cls, v: Optional[int]) -> Optional[int]:
        if v is None:
            return v
        if v < HIJRI_OFFSET_MIN or v > HIJRI_OFFSET_MAX:
            raise ValueError(
                f"hijri_offset must be between {HIJRI_OFFSET_MIN} and {HIJRI_OFFSET_MAX}"
            )
        return v


class PasswordChange(BaseModel):
    current_password: str = Field(..., min_length=1)
    new_password: str = Field(..., min_length=8)

    @field_validator("new_password")
    @classmethod
    def _validate_new_password(cls, v: str) -> str:
        if not any(c.isupper() for c in v):
            raise ValueError("Password must contain at least one uppercase letter")
        if not any(c.isdigit() for c in v):
            raise ValueError("Password must contain at least one digit")
        return v


class UserStatistics(BaseModel):
    total_habits: int
    active_habits: int
    completed_today: int
    total_completed: int
    current_streak: int
    longest_streak: int
    total_challenges: int
    challenges_completed: int
    achievements_earned: int
    completion_rate: int