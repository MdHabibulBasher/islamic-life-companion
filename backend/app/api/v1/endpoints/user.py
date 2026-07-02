"""User profile, preferences, statistics, and password endpoints.

All endpoints here require a valid Bearer token (handled by `get_current_user`).
"""
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from passlib.context import CryptContext
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models.challenge import ChallengeCompletion, UserChallengeProgress
from app.models.habit import (
    DailyHabitSummary,
    HabitStatistics,
    HabitStreak,
    HabitTracking,
    UserAchievement,
    UserHabit,
)
from app.models.user import User, UserLocationSetting, UserPreferences
from app.schemas.user import (
    PasswordChange,
    UserPreferences as UserPreferencesSchema,
    UserPreferencesUpdate,
    UserProfileResponse,
    UserProfileUpdate,
    UserStatistics,
)
from app.services.auth import verify_password

router = APIRouter(prefix="/user", tags=["user"])

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def _user_to_profile(user: User) -> UserProfileResponse:
    return UserProfileResponse(
        id=user.id,
        email=user.email,
        username=user.username,
        full_name=user.full_name,
        avatar_url=user.avatar_url,
        bio=user.bio,
        location=user.location,
        timezone=user.timezone,
        language=user.language,
        is_active=user.is_active,
        created_at=user.created_at,
        updated_at=user.updated_at,
    )


@router.get("/profile", response_model=UserProfileResponse)
def get_profile(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return _user_to_profile(current_user)


@router.put("/profile", response_model=UserProfileResponse)
def update_profile(
    payload: UserProfileUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    data = payload.model_dump(exclude_unset=True)

    # Username uniqueness check
    if "username" in data and data["username"] != current_user.username:
        existing = db.query(User).filter(User.username == data["username"]).first()
        if existing and existing.id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Username is already taken",
            )

    for field, value in data.items():
        setattr(current_user, field, value)

    db.commit()
    db.refresh(current_user)
    return _user_to_profile(current_user)


def _get_or_create_preferences(user: User, db: Session) -> UserPreferences:
    prefs = db.query(UserPreferences).filter(UserPreferences.user_id == user.id).first()
    if not prefs:
        prefs = UserPreferences(user_id=user.id)
        db.add(prefs)
        db.commit()
        db.refresh(prefs)
    return prefs


@router.get("/preferences", response_model=UserPreferencesSchema)
def get_preferences(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return _get_or_create_preferences(current_user, db)


@router.put("/preferences", response_model=UserPreferencesSchema)
def update_preferences(
    payload: UserPreferencesUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    prefs = _get_or_create_preferences(current_user, db)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(prefs, field, value)
    db.commit()
    db.refresh(prefs)
    return prefs


@router.put("/password", status_code=status.HTTP_200_OK)
def change_password(
    payload: PasswordChange,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not verify_password(payload.current_password, current_user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect",
        )
    current_user.hashed_password = pwd_context.hash(payload.new_password)
    db.commit()
    return {"message": "Password updated successfully"}


@router.get("/statistics", response_model=UserStatistics)
def get_statistics(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Aggregate stats across habits + challenges for the Settings page."""
    today = datetime.utcnow().date()

    total_habits = (
        db.query(UserHabit)
        .filter(UserHabit.user_id == current_user.id, UserHabit.is_deleted == False)
        .count()
    )
    active_habits = (
        db.query(UserHabit)
        .filter(
            UserHabit.user_id == current_user.id,
            UserHabit.is_active == True,
            UserHabit.is_deleted == False,
        )
        .count()
    )
    completed_today = (
        db.query(HabitTracking)
        .filter(
            HabitTracking.user_id == current_user.id,
            HabitTracking.tracking_date == today,
            HabitTracking.is_completed == True,
        )
        .count()
    )
    total_completed = (
        db.query(HabitTracking)
        .filter(
            HabitTracking.user_id == current_user.id,
            HabitTracking.is_completed == True,
        )
        .count()
    )

    longest_streak = 0
    current_streak = 0
    streaks = (
        db.query(HabitStreak).filter(HabitStreak.user_id == current_user.id).all()
    )
    for s in streaks:
        longest_streak = max(longest_streak, s.longest_streak or 0)
        current_streak = max(current_streak, s.current_streak or 0)

    # Aggregate today's completion rate
    if active_habits > 0:
        completion_rate = int(round((completed_today / active_habits) * 100))
    else:
        completion_rate = 0

    total_challenges = (
        db.query(UserChallengeProgress)
        .filter(UserChallengeProgress.user_id == current_user.id)
        .count()
    )
    challenges_completed = (
        db.query(UserChallengeProgress)
        .filter(
            UserChallengeProgress.user_id == current_user.id,
            UserChallengeProgress.is_completed == True,
        )
        .count()
    )

    achievements_earned = (
        db.query(UserAchievement)
        .filter(UserAchievement.user_id == current_user.id)
        .count()
    )

    return UserStatistics(
        total_habits=total_habits,
        active_habits=active_habits,
        completed_today=completed_today,
        total_completed=total_completed,
        current_streak=current_streak,
        longest_streak=longest_streak,
        total_challenges=total_challenges,
        challenges_completed=challenges_completed,
        achievements_earned=achievements_earned,
        completion_rate=completion_rate,
    )


# ---- User location (used by the Prayer Times page) ----
from app.schemas.calendar import UserLocation, UserLocationResponse  # noqa: E402


def _get_or_create_location(user: User, db: Session) -> UserLocationSetting:
    loc = (
        db.query(UserLocationSetting)
        .filter(UserLocationSetting.user_id == user.id)
        .first()
    )
    if not loc:
        loc = UserLocationSetting(user_id=user.id)
        db.add(loc)
        db.commit()
        db.refresh(loc)
    return loc


@router.get("/location", response_model=UserLocationResponse)
def get_location(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return _get_or_create_location(current_user, db)


@router.post("/location", response_model=UserLocationResponse)
def upsert_location(
    payload: UserLocation,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    # Detect whether the location row was just created in this request so we
    # can auto-seed the Hijri offset exactly once — on the very first city
    # pick. After that the user owns the offset value via Settings.
    existing_loc = (
        db.query(UserLocationSetting)
        .filter(UserLocationSetting.user_id == current_user.id)
        .first()
    )
    is_first_location = existing_loc is None
    # Track whether the country changed since the last save — if so we
    # re-apply the country-based Hijri offset heuristic so the user gets
    # the right date without having to manually edit Settings.
    country_changed = (
        existing_loc is not None and existing_loc.country != payload.country
    )

    loc = _get_or_create_location(current_user, db)
    loc.city = payload.city
    loc.country = payload.country
    loc.latitude = payload.latitude
    loc.longitude = payload.longitude
    loc.timezone = payload.timezone
    db.commit()
    db.refresh(loc)

    # Auto-seed / re-seed the Hijri offset on the first location pick OR
    # when the country changes. The user can always override in Settings.
    # We also re-apply if the user's offset is still 0 but the country has
    # a known non-zero suggestion — this catches users who set their location
    # before the auto-seed was added.
    if is_first_location or country_changed:
        from app.services.hijri import suggest_hijri_offset_for
        prefs = _get_or_create_preferences(current_user, db)
        suggested = suggest_hijri_offset_for(payload.country)
        if suggested != prefs.hijri_offset:
            prefs.hijri_offset = suggested
            db.commit()
            db.refresh(prefs)
    else:
        # Same country as before. If the user's offset is still the default
        # 0 but the country has a known non-zero suggestion, apply it now —
        # this catches users who saved a location before the auto-seed
        # existed, or whose offset was reset.
        from app.services.hijri import suggest_hijri_offset_for
        prefs = _get_or_create_preferences(current_user, db)
        suggested = suggest_hijri_offset_for(payload.country)
        if suggested != 0 and prefs.hijri_offset == 0:
            prefs.hijri_offset = suggested
            db.commit()
            db.refresh(prefs)
    return loc


# ---- Hijri offset suggestion (used by the Settings page when a city is picked) ----
from app.services.hijri import suggest_hijri_offset_for  # noqa: E402


@router.get("/hijri-offset-suggestion")
def hijri_offset_suggestion(
    country: str,
    current_user: User = Depends(get_current_user),
):
    """Return the recommended Hijri offset for a country.

    The Settings / Prayer Times UI calls this when the user picks a new city.
    We only *suggest* a value; we never persist it without an explicit user
    save in Settings — the user is the source of truth for religious matters.
    """
    from app.services.hijri import HIJRI_DEFAULT_OFFSET_BY_COUNTRY
    suggested = suggest_hijri_offset_for(country)
    return {
        "country": country,
        "suggested_offset": suggested,
        "is_known_country": country.strip() in HIJRI_DEFAULT_OFFSET_BY_COUNTRY,
    }