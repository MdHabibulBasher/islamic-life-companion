"""User and UserPreferences models.

The `users` table mirrors the initial Alembic migration (`4df3f35aa0ce`),
plus a few profile/preferences columns that the Settings page needs. New
columns here are also added in a follow-up Alembic migration so production
DBs stay in sync.
"""
from sqlalchemy import Boolean, Column, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.core.database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    username = Column(String, unique=True, index=True, nullable=True)
    full_name = Column(String, nullable=True)
    hashed_password = Column(String, nullable=False)
    role = Column(String, default="USER", nullable=True)
    is_active = Column(Boolean, default=True)
    is_deleted = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # ---- Profile fields added for the Settings page ----
    avatar_url = Column(String, nullable=True)
    bio = Column(Text, nullable=True)
    location = Column(String, nullable=True)
    timezone = Column(String, nullable=True)
    language = Column(String, nullable=True)

    # ---- Relations ----
    preferences = relationship(
        "UserPreferences",
        back_populates="user",
        uselist=False,
        cascade="all, delete-orphan",
    )
    location_setting = relationship(
        "UserLocationSetting",
        back_populates="user",
        uselist=False,
        cascade="all, delete-orphan",
    )


class UserPreferences(Base):
    __tablename__ = "user_preferences"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
        index=True,
    )

    dark_mode = Column(Boolean, default=False, nullable=False)
    arabic_text = Column(Boolean, default=True, nullable=False)
    default_view = Column(String, default="daily", nullable=False)

    email_notifications = Column(Boolean, default=True, nullable=False)
    habit_reminders = Column(Boolean, default=True, nullable=False)
    challenge_updates = Column(Boolean, default=True, nullable=False)
    prayer_reminders = Column(Boolean, default=True, nullable=False)

    # ---- Hijri calendar configuration ----
    # basis: which Hijri-calculation convention to use for all date-derived
    #   app features (prayer times, Ramadan start, Eid, etc.). One of:
    #     "global"           -> Aladhan method 2 (Umm al-Qura / ISNA-derived, the
    #                           most widely-used international default)
    #     "umm_al_qura"      -> Saudi Arabia Umm al-Qura (Aladhan method 4)
    #     "isna"             -> Islamic Society of North America (Aladhan method 2)
    #     "mwl"              -> Muslim World League (Aladhan method 3)
    #     "egyptian"         -> Egyptian General Authority (Aladhan method 5)
    #     "karachi"          -> Univ. of Islamic Sciences, Karachi (Aladhan method 1)
    #     "tehran"           -> Institute of Geophysics, Tehran (Aladhan method 7)
    #     "jafari"           -> Shia Ithna Ashari (Aladhan method 0)
    #     "local_sighting"   -> Same as `global` but applies user_sighting_offset
    hijri_basis = Column(String, default="global", nullable=False)
    # user_sighting_offset: integer day offset to apply on top of the basis.
    #   -1 means the user follows a local moon-sighting committee that
    #   typically declares the new moon one day earlier; +1 means one day
    #   later. Most users should leave this at 0.
    hijri_offset = Column(Integer, default=0, nullable=False)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    user = relationship("User", back_populates="preferences")


class UserLocationSetting(Base):
    """One row per user — last known location used for prayer-time calculations."""

    __tablename__ = "user_location_settings"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
        index=True,
    )
    city = Column(String, nullable=False, default="Cairo")
    country = Column(String, nullable=False, default="Egypt")
    latitude = Column(Float, nullable=False, default=30.0444)
    longitude = Column(Float, nullable=False, default=31.2357)
    timezone = Column(String, nullable=False, default="Africa/Cairo")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    user = relationship("User", back_populates="location_setting")