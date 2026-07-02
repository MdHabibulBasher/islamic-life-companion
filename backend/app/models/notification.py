"""Notification model — in-app notification center."""
from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.sql import func

from app.core.database import Base


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    title = Column(String, nullable=False)
    message = Column(Text, nullable=False)
    # 'habit' | 'challenge' | 'prayer' | 'achievement' | 'system'
    notification_type = Column(String, default="system", nullable=False)
    is_read = Column(Boolean, default=False, nullable=False)
    action_url = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())