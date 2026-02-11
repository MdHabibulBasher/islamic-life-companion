from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func, and_
from typing import List
from datetime import date, datetime, timedelta
from fastapi.responses import JSONResponse
from app.core.database import get_db
from app.api.deps import get_current_user
from app.models.user import User
from app.models.habit import (
    HabitCategory, UserHabit, HabitTracking, HabitStreak,
    DailyHabitSummary, HabitStatistics, TrackingType
)
from app.schemas.habit import (
    HabitCategoryResponse, UserHabitCreate, UserHabitUpdate, UserHabitResponse,
    HabitTrackingCreate, HabitTrackingUpdate, HabitTrackingResponse,
    HabitStreakResponse, DailyHabitSummaryResponse, HabitStatisticsResponse,
    HabitWithTracking
)

router = APIRouter()

# Habit Categories
@router.get("/categories", response_model=List[HabitCategoryResponse])
def get_habit_categories(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    categories = db.query(HabitCategory).all()
    
    # If no categories exist, create default ones
    if not categories:
        default_categories = [
            HabitCategory(name_en="Worship", name_bn="ইবাদত", icon="book-open", color="#2C5F2D", is_default=True),
            HabitCategory(name_en="Character", name_bn="চরিত্র", icon="heart", color="#D97706", is_default=True),
            HabitCategory(name_en="Knowledge", name_bn="জ্ঞান", icon="moon", color="#7C3AED", is_default=True),
            HabitCategory(name_en="Health", name_bn="স্বাস্থ্য", icon="star", color="#DC2626", is_default=True),
        ]
        db.add_all(default_categories)
        db.commit()
        categories = db.query(HabitCategory).all()
    
    return categories

# User Habits
@router.post("/", response_model=UserHabitResponse, status_code=status.HTTP_201_CREATED)
def create_habit(
    habit_data: UserHabitCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Verify category exists
    category = db.query(HabitCategory).filter(
        HabitCategory.id == habit_data.category_id
    ).first()
    
    if not category:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Category with id {habit_data.category_id} not found"
        )
    
    try:
        new_habit = UserHabit(
            user_id=current_user.id,
            **habit_data.model_dump()
        )
        
        db.add(new_habit)
        db.commit()
        db.refresh(new_habit)
        
        # Create initial streak record
        streak = HabitStreak(
            user_id=current_user.id,
            habit_id=new_habit.id
        )
        db.add(streak)
        db.commit()
        
        return new_habit
    except Exception as e:
        db.rollback()
        print(f"Error creating habit: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create habit: {str(e)}"
        )

@router.get("/", response_model=List[HabitWithTracking])
def get_user_habits(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    include_inactive: bool = False,
    tracking_date: date = None
):
    query = db.query(UserHabit).filter(
        UserHabit.user_id == current_user.id,
        UserHabit.is_deleted == False
    )
    
    if not include_inactive:
        query = query.filter(UserHabit.is_active == True)
    
    habits = query.all()
    # Use provided date or default to today
    target_date = tracking_date if tracking_date else date.today()
    
    result = []
    for habit in habits:
        # Get tracking for the specified date
        tracking = db.query(HabitTracking).filter(
            HabitTracking.habit_id == habit.id,
            HabitTracking.tracking_date == target_date
        ).first()
        
        # Get streak and check if it needs reset
        streak = db.query(HabitStreak).filter(
            HabitStreak.habit_id == habit.id
        ).first()
        
        # Check if streak should be reset (day missed)
        if streak and streak.last_completed_date:
            today = date.today()
            days_since_last = (today - streak.last_completed_date).days
            if days_since_last > 1:  # Missed more than 1 day
                streak.current_streak = 0
                db.commit()
        
        result.append(HabitWithTracking(
            habit=habit,
            today_tracking=tracking,
            streak=streak
        ))
    
    return result


@router.get("/statistics")
def get_comprehensive_habit_statistics(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get comprehensive habit statistics for the user"""
    try:
        # Get today's date
        today = date.today()
        week_ago = today - timedelta(days=7)
        month_ago = today - timedelta(days=30)
        
        print(f"[DEBUG] Getting statistics for user ID: {current_user.id}")
        
        # Count total habits
        total_habits = db.query(UserHabit).filter(
            UserHabit.user_id == current_user.id,
            UserHabit.is_deleted == False
        ).count()
        print(f"[DEBUG] Total habits for user {current_user.id}: {total_habits}")
        
        # Count active habits
        active_habits = db.query(UserHabit).filter(
            UserHabit.user_id == current_user.id,
            UserHabit.is_active == True,
            UserHabit.is_deleted == False
        ).count()
        print(f"[DEBUG] Active habits for user {current_user.id}: {active_habits}")
        
        # Count completions today
        completions_today = db.query(HabitTracking).filter(
            HabitTracking.user_id == current_user.id,
            HabitTracking.tracking_date == today,
            HabitTracking.is_completed == True
        ).count()
        print(f"[DEBUG] Completions today: {completions_today}")
        
        # Count completions this week
        completions_week = db.query(HabitTracking).filter(
            HabitTracking.user_id == current_user.id,
            HabitTracking.tracking_date >= week_ago,
            HabitTracking.is_completed == True
        ).count()
        
        # Count completions this month
        completions_month = db.query(HabitTracking).filter(
            HabitTracking.user_id == current_user.id,
            HabitTracking.tracking_date >= month_ago,
            HabitTracking.is_completed == True
        ).count()
        
        # Calculate completion rate
        completion_rate = 0
        if total_habits > 0:
            completion_rate = int(round((completions_today / total_habits) * 100))
        else:
            completion_rate = 0
        
        print(f"[DEBUG] Final completion_rate: {completion_rate}")
        
        return {
            "active_habits": active_habits,
            "total_habits": total_habits,
            "completed_today": completions_today,
            "completion_rate": completion_rate,
            "this_week": completions_week,
            "this_month": completions_month,
            "best_streak": 0
        }
        
    except Exception as e:
        print(f"[ERROR] Error calculating statistics: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/summary/{summary_date}", response_model=DailyHabitSummaryResponse)
def get_daily_summary(
    summary_date: date,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get daily summary for a specific date"""
    # Always recalculate current summary
    total_habits = db.query(UserHabit).filter(
        UserHabit.user_id == current_user.id,
        UserHabit.is_active == True,
        UserHabit.is_deleted == False
    ).count()
    
    # Only count completed habits that belong to active, non-deleted habits
    completed_habits = db.query(HabitTracking).join(
        UserHabit,
        and_(
            HabitTracking.habit_id == UserHabit.id,
            UserHabit.is_active == True,
            UserHabit.is_deleted == False
        )
    ).filter(
        HabitTracking.user_id == current_user.id,
        HabitTracking.tracking_date == summary_date,
        HabitTracking.is_completed == True
    ).count()
    
    completion_rate = 0
    if total_habits > 0:
        completion_rate = int(round((completed_habits / total_habits) * 100))
    else:
        completion_rate = 0
    
    # Get or create summary record
    summary = db.query(DailyHabitSummary).filter(
        DailyHabitSummary.user_id == current_user.id,
        DailyHabitSummary.summary_date == summary_date
    ).first()
    
    if not summary:
        summary = DailyHabitSummary(
            user_id=current_user.id,
            summary_date=summary_date,
            total_habits=total_habits,
            completed_habits=completed_habits,
            completion_rate=completion_rate
        )
        db.add(summary)
        db.commit()
        db.refresh(summary)
    else:
        # Update with current values
        summary.total_habits = total_habits
        summary.completed_habits = completed_habits
        summary.completion_rate = completion_rate
        db.commit()
    
    return summary



def get_habit(
    habit_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    habit = db.query(UserHabit).filter(
        UserHabit.id == habit_id,
        UserHabit.user_id == current_user.id,
        UserHabit.is_deleted == False
    ).first()
    
    if not habit:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Habit not found"
        )
    
    return habit

@router.put("/{habit_id}", response_model=UserHabitResponse)
def update_habit(
    habit_id: int,
    update_data: UserHabitUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    habit = db.query(UserHabit).filter(
        UserHabit.id == habit_id,
        UserHabit.user_id == current_user.id,
        UserHabit.is_deleted == False
    ).first()
    
    if not habit:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Habit not found"
        )
    
    update_dict = update_data.model_dump(exclude_unset=True)
    for field, value in update_dict.items():
        setattr(habit, field, value)
    
    db.commit()
    db.refresh(habit)
    
    return habit

@router.delete("/{habit_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_habit(
    habit_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    habit = db.query(UserHabit).filter(
        UserHabit.id == habit_id,
        UserHabit.user_id == current_user.id
    ).first()
    
    if not habit:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Habit not found"
        )
    
    habit.is_deleted = True
    db.commit()

# Habit Tracking
@router.post("/tracking", response_model=HabitTrackingResponse, status_code=status.HTTP_201_CREATED)
def create_habit_tracking(
    tracking_data: HabitTrackingCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Verify habit belongs to user
    habit = db.query(UserHabit).filter(
        UserHabit.id == tracking_data.habit_id,
        UserHabit.user_id == current_user.id
    ).first()
    
    if not habit:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Habit not found"
        )
    
    # Check if tracking already exists for this date
    existing = db.query(HabitTracking).filter(
        HabitTracking.habit_id == tracking_data.habit_id,
        HabitTracking.tracking_date == tracking_data.tracking_date
    ).first()
    
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Tracking already exists for this date"
        )
    
    new_tracking = HabitTracking(
        user_id=current_user.id,
        **tracking_data.model_dump()
    )
    
    db.add(new_tracking)
    db.commit()
    db.refresh(new_tracking)
    
    # Update streak if completed
    if new_tracking.is_completed:
        update_habit_streak(habit.id, current_user.id, db)
    
    return new_tracking

# Track habit completion - simplified endpoint
@router.post("/{habit_id}/track")
def track_habit(
    habit_id: int,
    tracking_data: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Track habit completion for a specific date"""
    # Verify habit belongs to user
    habit = db.query(UserHabit).filter(
        UserHabit.id == habit_id,
        UserHabit.user_id == current_user.id
    ).first()
    
    if not habit:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Habit not found"
        )
    
    tracking_date = tracking_data.get('tracking_date', date.today().isoformat())
    is_completed = tracking_data.get('is_completed', False)
    counter_value = tracking_data.get('counter_value', 0)
    timer_seconds = tracking_data.get('timer_seconds', 0)
    notes = tracking_data.get('notes', '')
    
    # Check if tracking already exists for this date
    existing = db.query(HabitTracking).filter(
        HabitTracking.habit_id == habit_id,
        HabitTracking.tracking_date == tracking_date
    ).first()
    
    if existing:
        # Update existing tracking
        existing.is_completed = is_completed
        existing.counter_value = counter_value
        existing.timer_seconds = timer_seconds
        existing.notes = notes
        db.commit()
        db.refresh(existing)
        tracking = existing
    else:
        # Create new tracking
        new_tracking = HabitTracking(
            user_id=current_user.id,
            habit_id=habit_id,
            tracking_date=tracking_date,
            is_completed=is_completed,
            counter_value=counter_value,
            timer_seconds=timer_seconds,
            notes=notes
        )
        db.add(new_tracking)
        db.commit()
        db.refresh(new_tracking)
        tracking = new_tracking
    
    # Update streak if completed
    if is_completed:
        update_habit_streak(habit_id, current_user.id, db)
    
    return tracking

@router.put("/tracking/{habit_id}/{tracking_date}", response_model=HabitTrackingResponse)
def update_habit_tracking(
    habit_id: int,
    tracking_date: date,
    update_data: HabitTrackingUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    tracking = db.query(HabitTracking).filter(
        HabitTracking.habit_id == habit_id,
        HabitTracking.tracking_date == tracking_date,
        HabitTracking.user_id == current_user.id
    ).first()
    
    if not tracking:
        # Create new tracking if it doesn't exist
        tracking = HabitTracking(
            user_id=current_user.id,
            habit_id=habit_id,
            tracking_date=tracking_date
        )
        db.add(tracking)
    
    update_dict = update_data.model_dump(exclude_unset=True)
    for field, value in update_dict.items():
        setattr(tracking, field, value)
    
    db.commit()
    db.refresh(tracking)
    
    # Update streak if completed
    if tracking.is_completed:
        update_habit_streak(habit_id, current_user.id, db)
    
    return tracking

@router.get("/tracking/{habit_id}/history", response_model=List[HabitTrackingResponse])
def get_habit_tracking_history(
    habit_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    days: int = 30
):
    end_date = date.today()
    start_date = end_date - timedelta(days=days)
    
    tracking = db.query(HabitTracking).filter(
        HabitTracking.habit_id == habit_id,
        HabitTracking.user_id == current_user.id,
        HabitTracking.tracking_date >= start_date,
        HabitTracking.tracking_date <= end_date
    ).order_by(HabitTracking.tracking_date.desc()).all()
    
    return tracking

# Statistics
@router.get("/stats/summary", response_model=HabitStatisticsResponse)
def get_habit_statistics(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Always recalculate current stats
    total_habits = db.query(UserHabit).filter(
        UserHabit.user_id == current_user.id,
        UserHabit.is_deleted == False
    ).count()
    
    active_habits = db.query(UserHabit).filter(
        UserHabit.user_id == current_user.id,
        UserHabit.is_active == True,
        UserHabit.is_deleted == False
    ).count()
    
    # Get or create stats record
    stats = db.query(HabitStatistics).filter(
        HabitStatistics.user_id == current_user.id
    ).first()
    
    if not stats:
        stats = HabitStatistics(
            user_id=current_user.id,
            total_habits_created=total_habits,
            active_habits=active_habits,
            overall_completion_rate=0,
            total_achievements=0
        )
        db.add(stats)
        db.commit()
        db.refresh(stats)
    else:
        # Update with current values
        stats.total_habits_created = total_habits
        stats.active_habits = active_habits
        db.commit()
    
    return stats

# Helper function to update streak
def update_habit_streak(habit_id: int, user_id: int, db: Session):
    streak = db.query(HabitStreak).filter(
        HabitStreak.habit_id == habit_id,
        HabitStreak.user_id == user_id
    ).first()
    
    if not streak:
        streak = HabitStreak(
            user_id=user_id,
            habit_id=habit_id
        )
        db.add(streak)
    
    today = date.today()
    yesterday = today - timedelta(days=1)
    
    # Check if completed today
    today_tracking = db.query(HabitTracking).filter(
        HabitTracking.habit_id == habit_id,
        HabitTracking.tracking_date == today,
        HabitTracking.is_completed == True
    ).first()
    
    if today_tracking:
        # Check if completed yesterday
        yesterday_tracking = db.query(HabitTracking).filter(
            HabitTracking.habit_id == habit_id,
            HabitTracking.tracking_date == yesterday,
            HabitTracking.is_completed == True
        ).first()
        
        if yesterday_tracking or streak.last_completed_date == yesterday:
            streak.current_streak += 1
        else:
            streak.current_streak = 1
        
        streak.last_completed_date = today
        
        if streak.current_streak > streak.longest_streak:
            streak.longest_streak = streak.current_streak
    else:
        # Check if streak should be reset (day missed)
        if streak.last_completed_date:
            days_since_last = (today - streak.last_completed_date).days
            if days_since_last > 1:  # Missed more than 1 day
                streak.current_streak = 0
    
    db.commit()