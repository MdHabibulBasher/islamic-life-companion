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
