from sqlalchemy import Column, Integer, String, DateTime, Boolean, ForeignKey, Text, Date, Enum as SAEnum
from sqlalchemy.sql import func
from app.core.database import Base
import enum


class ChallengeType(str, enum.Enum):
    """How the challenge is completed."""

    DAILY = "daily"        # ✅ auto-completes when user logs the linked action (e.g. prayers)
    STREAK = "streak"      # 🔥 auto-completes when N-day consecutive streak is reached
    LEARNING = "learning"  # 📚 user marks complete after studying the topic
    SPIRITUAL = "spiritual"  # ❤️ user marks complete (dua, reflection, gratitude)
    SUNNAH = "sunnah"      # 🕌 auto-completes when linked Sunnah prayer logged
    BOSS = "boss"          # 👑 final challenge in a level — completing it unlocks next level


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
    # Progression system — challenges form a 5-level chain (1=Build Habit → 5=Excellence).
    # Users must complete the BOSS challenge of the previous level before the next level unlocks.
    level = Column(Integer, default=1, nullable=False, index=True)
    prerequisite_challenge_id = Column(
        String,
        ForeignKey("challenges.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    # ── Challenge-type metadata ────────────────────────────────────────────
    # Stored as a plain VARCHAR so SQLAlchemy doesn't try to coerce the value
    # through Python's enum (the values match the enum members, but Pydantic
    # + SQLAlchemy enum interaction caused 'streak' is not among DAILY/STREAK
    # errors during ORM hydration). Validation is done in the schema layer.
    challenge_type = Column(
        String(32),
        nullable=False,
        default="streak",
    )
    # Position inside its level (1 = first shown, 10 = boss). Smaller = earlier.
    position = Column(Integer, default=1, nullable=False)
    # For STREAK challenges: how many consecutive days required to auto-complete.
    streak_target = Column(Integer, nullable=True)
    # Reward tier (matches the roadmap badges): bronze / silver / gold / platinum / diamond.
    reward_tier = Column(String, nullable=True)
    # Short Arabic/English dua or reminder shown when the challenge is joined.
    dua_reminder = Column(Text, nullable=True)
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

class Hadith(Base):
    """Curated hadith library shown to motivate users at challenge boundaries."""
    __tablename__ = "hadiths"

    id = Column(Integer, primary_key=True, index=True)
    text_en = Column(Text, nullable=False)
    source = Column(String, nullable=True)  # e.g. "Sahih al-Bukhari 528"
    context = Column(String, nullable=True)  # e.g. "On the reward of prayer"
    level = Column(Integer, nullable=True, index=True)  # Which journey-level this hadith is tied to (optional)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class Reward(Base):
    """Cosmetic / motivational reward unlocked by completing a challenge or level."""
    __tablename__ = "rewards"

    id = Column(String, primary_key=True, index=True)  # e.g. "prayer_beginner"
    name_en = Column(String, nullable=False)  # e.g. "Prayer Beginner"
    description = Column(Text, nullable=True)
    icon = Column(String, nullable=True)  # emoji or icon key
    tier = Column(String, nullable=False, index=True)  # bronze / silver / gold / platinum / diamond
    reward_kind = Column(String, nullable=False)  # badge / frame / title / theme
    # Which challenge or level this reward is unlocked by (one of these will be set)
    challenge_id = Column(String, ForeignKey("challenges.id", ondelete="CASCADE"), nullable=True, index=True)
    level = Column(Integer, nullable=True, index=True)  # for level-level rewards
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class UserReward(Base):
    """Records that a user has unlocked a specific reward."""
    __tablename__ = "user_rewards"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    reward_id = Column(String, ForeignKey("rewards.id", ondelete="CASCADE"), nullable=False, index=True)
    unlocked_at = Column(DateTime(timezone=True), server_default=func.now())