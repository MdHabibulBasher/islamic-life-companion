"""Dashboard aggregation endpoint — composes a single payload for the home page.

Reads from the existing habits / challenges / prayers tables and returns a
single JSON blob the frontend can render without making 5+ separate calls.
"""
from datetime import date, datetime, timedelta
from typing import List

from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models.challenge import ChallengeCompletion, UserChallengeProgress
from app.models.habit import (
    DailyHabitSummary,
    HabitStreak,
    HabitTracking,
    UserAchievement,
    UserHabit,
)
from app.models.quran import Quran
from app.models.user import User

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("")
def get_dashboard(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    today = date.today()
    week_ago = today - timedelta(days=7)
    month_ago = today - timedelta(days=30)

    # ---- Habits ----
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
    completed_week = (
        db.query(HabitTracking)
        .filter(
            HabitTracking.user_id == current_user.id,
            HabitTracking.tracking_date >= week_ago,
            HabitTracking.is_completed == True,
        )
        .count()
    )
    completed_month = (
        db.query(HabitTracking)
        .filter(
            HabitTracking.user_id == current_user.id,
            HabitTracking.tracking_date >= month_ago,
            HabitTracking.is_completed == True,
        )
        .count()
    )

    completion_rate_today = 0
    if active_habits > 0:
        completion_rate_today = int(round((completed_today / active_habits) * 100))

    # Best streak across all habits
    best_streak = 0
    current_streak = 0
    for s in db.query(HabitStreak).filter(HabitStreak.user_id == current_user.id).all():
        best_streak = max(best_streak, s.longest_streak or 0)
        current_streak = max(current_streak, s.current_streak or 0)

    # Last 7 days of daily summaries
    last_week_rows = (
        db.query(DailyHabitSummary)
        .filter(
            DailyHabitSummary.user_id == current_user.id,
            DailyHabitSummary.summary_date >= week_ago,
        )
        .order_by(DailyHabitSummary.summary_date.asc())
        .all()
    )
    last_week: List[dict] = [
        {
            "date": row.summary_date.isoformat(),
            "total_habits": row.total_habits,
            "completed_habits": row.completed_habits,
            "completion_rate": row.completion_rate,
        }
        for row in last_week_rows
    ]

    # ---- Challenges ----
    active_challenges = (
        db.query(UserChallengeProgress)
        .filter(
            UserChallengeProgress.user_id == current_user.id,
            UserChallengeProgress.is_completed == False,
        )
        .count()
    )
    completed_challenges = (
        db.query(UserChallengeProgress)
        .filter(
            UserChallengeProgress.user_id == current_user.id,
            UserChallengeProgress.is_completed == True,
        )
        .count()
    )

    completions_today = (
        db.query(ChallengeCompletion)
        .filter(
            ChallengeCompletion.user_id == current_user.id,
            ChallengeCompletion.completion_date == today,
        )
        .count()
    )

    # ---- Quran ----
    total_quran_sessions = (
        db.query(Quran).filter(Quran.user_id == current_user.id).count()
    )

    # ---- Achievements ----
    achievements_unlocked = (
        db.query(UserAchievement)
        .filter(UserAchievement.user_id == current_user.id)
        .count()
    )

    return {
        "user": {
            "id": current_user.id,
            "full_name": current_user.full_name,
            "email": current_user.email,
        },
        "habits": {
            "total_habits": total_habits,
            "active_habits": active_habits,
            "completed_today": completed_today,
            "completed_this_week": completed_week,
            "completed_this_month": completed_month,
            "completion_rate_today": completion_rate_today,
            "current_streak": current_streak,
            "best_streak": best_streak,
            "last_7_days": last_week,
        },
        "challenges": {
            "active": active_challenges,
            "completed": completed_challenges,
            "completions_today": completions_today,
        },
        "quran": {
            "total_sessions": total_quran_sessions,
        },
        "achievements": {
            "unlocked": achievements_unlocked,
        },
        "generated_at": datetime.utcnow().isoformat() + "Z",
    }