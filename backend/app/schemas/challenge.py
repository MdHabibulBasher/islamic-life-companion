from pydantic import BaseModel, Field, field_validator
from datetime import date
from typing import Optional

class ChallengeBase(BaseModel):
    name_en: str
    description: Optional[str] = None
    category: str = "General"
    duration_days: int = 30
    difficulty: str = "Medium"
    required_difficulty: Optional[str] = None
    icon: Optional[str] = None
    reward: Optional[str] = None
    notification_time: Optional[str] = None
    level: int = 1
    prerequisite_challenge_id: Optional[str] = None
    challenge_type: str = "streak"
    position: int = 1
    streak_target: Optional[int] = None
    reward_tier: Optional[str] = None
    dua_reminder: Optional[str] = None

class ChallengeCreate(ChallengeBase):
    id: str

class ChallengeResponse(ChallengeBase):
    id: str
    is_active: bool
    
    class Config:
        from_attributes = True

class UserChallengeProgressCreate(BaseModel):
    challenge_id: str
    accepted_date: date

class UserChallengeProgressUpdate(BaseModel):
    is_completed: Optional[bool] = None

class UserChallengeProgressResponse(BaseModel):
    id: int
    challenge_id: str
    accepted_date: date
    is_completed: bool
    current_streak: int = 0
    max_streak: int = 0
    last_completion_date: Optional[date] = None
    is_unlocked: bool = True
    notification_enabled: bool = True
    grace_day_used: bool = False
    
    class Config:
        from_attributes = True
        json_encoders = {
            date: lambda v: v.isoformat() if v else None
        }
    
    @field_validator('current_streak', mode='before')
    @classmethod
    def default_streak(cls, v):
        # Convert None to 0
        return v if v is not None else 0
    
    @field_validator('max_streak', mode='before')
    @classmethod
    def default_max_streak(cls, v):
        # Convert None to 0
        return v if v is not None else 0

class ChallengeCompletionCreate(BaseModel):
    challenge_id: str
    completion_date: date

class ChallengeCompletionResponse(BaseModel):
    id: int
    challenge_id: str
    completion_date: date
    
    class Config:
        from_attributes = True

class UserChallengeDetailedResponse(BaseModel):
    challenge: ChallengeResponse
    progress: UserChallengeProgressResponse
    completions: list[ChallengeCompletionResponse]

    class Config:
        from_attributes = True


# ── Hadith library ────────────────────────────────────────────────────────

class HadithBase(BaseModel):
    text_en: str
    source: Optional[str] = None
    context: Optional[str] = None
    level: Optional[int] = None


class HadithResponse(HadithBase):
    id: int

    class Config:
        from_attributes = True


# ── Reward system ────────────────────────────────────────────────────────

class RewardBase(BaseModel):
    id: str
    name_en: str
    description: Optional[str] = None
    icon: Optional[str] = None
    tier: str
    reward_kind: str  # badge / frame / title / theme
    challenge_id: Optional[str] = None
    level: Optional[int] = None


class RewardResponse(RewardBase):
    is_active: bool

    class Config:
        from_attributes = True


class UserRewardResponse(BaseModel):
    id: int
    reward_id: str
    unlocked_at: Optional[str] = None

    class Config:
        from_attributes = True
