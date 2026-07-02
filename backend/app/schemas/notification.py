"""Pydantic schemas for /notifications/*."""
from datetime import datetime
from typing import List, Literal, Optional

from pydantic import BaseModel, Field

NotificationType = Literal["habit", "challenge", "prayer", "achievement", "system"]


class NotificationResponse(BaseModel):
    id: int
    title: str
    message: str
    notification_type: str
    is_read: bool
    action_url: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class NotificationCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    message: str = Field(..., min_length=1, max_length=2000)
    notification_type: str = "system"
    action_url: Optional[str] = Field(None, max_length=500)