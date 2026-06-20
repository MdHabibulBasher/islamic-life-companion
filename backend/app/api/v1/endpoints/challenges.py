from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from sqlalchemy import and_
from typing import List
from datetime import date, timedelta
from app.core.database import get_db
from app.api.deps import get_current_user
from app.models.user import User
from app.models.challenge import Challenge, UserChallengeProgress, ChallengeCompletion
from app.schemas.challenge import (
    ChallengeResponse, UserChallengeProgressCreate, UserChallengeProgressResponse,
    ChallengeCompletionCreate, ChallengeCompletionResponse, UserChallengeDetailedResponse
)

router = APIRouter()

# Initialize default challenges
def init_default_challenges(db: Session):
    try:
        existing = db.query(Challenge).first()
        if existing:
            return
        
        default_challenges = [
            # Spiritual Challenges
            Challenge(
                id="1",
                name_en="Daily Quran Reading",
                description="Read Quran daily for 30 consecutive days",
                category="Spiritual",
                duration_days=30,
                difficulty="Easy",
                icon="📖",
                reward="🏆 Quran Master Badge",
                notification_time="19:00",
                is_active=True
            ),
            Challenge(
                id="2",
                name_en="Prayer Consistency",
                description="Complete all 5 daily prayers consistently",
                category="Spiritual",
                duration_days=30,
                difficulty="Easy",
                icon="🕌",
                reward="🕌 Prayer Warrior",
                notification_time="04:30",
                is_active=True
            ),
            Challenge(
                id="3",
                name_en="Dhikr Practice",
                description="Remember Allah with daily dhikr",
                category="Spiritual",
                duration_days=21,
                difficulty="Easy",
                icon="📿",
                reward="📿 Dhikr Master",
                notification_time="21:00",
                is_active=True
            ),
            # Character Challenges
            Challenge(
                id="4",
                name_en="Morning Routine",
                description="Build consistent morning habits",
                category="Character",
                duration_days=30,
                difficulty="Medium",
                icon="🌅",
                reward="🌅 Early Bird",
                notification_time="06:00",
                is_active=True
            ),
            Challenge(
                id="5",
                name_en="Character Development",
                description="Practice good deeds and kindness daily",
                category="Character",
                duration_days=30,
                difficulty="Easy",
                icon="💝",
                reward="🌟 Character Hero",
                notification_time="18:00",
                is_active=True
            ),
            # Health Challenges
            Challenge(
                id="6",
                name_en="Health & Wellness",
                description="Maintain healthy habits for body and soul",
                category="Health",
                duration_days=30,
                difficulty="Medium",
                icon="💪",
                reward="💪 Health Champion",
                notification_time="07:00",
                is_active=True
            ),
            # Hard challenges (unlocks after Easy completion)
            Challenge(
                id="7",
                name_en="40-Day Ibadah Challenge",
                description="40 days of intense worship and remembrance",
                category="Spiritual",
                duration_days=40,
                difficulty="Hard",
                required_difficulty="Easy",
                icon="🎯",
                reward="👑 Ibadah Master",
                notification_time="05:00",
                is_active=True
            ),
            Challenge(
                id="8",
                name_en="Complete Transformation",
                description="Master all aspects of life for 60 days",
                category="Character",
                duration_days=60,
                difficulty="Hard",
                required_difficulty="Medium",
                icon="⭐",
                reward="✨ Life Master",
                notification_time="17:00",
                is_active=True
            )
        ]
        
        db.add_all(default_challenges)
        db.commit()
    except Exception as e:
        db.rollback()
        print(f"Error initializing challenges: {e}")
        raise

@router.get("", response_model=List[ChallengeResponse])
def get_challenges(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    init_default_challenges(db)
    challenges = db.query(Challenge).all()
    return challenges

@router.post("/join", response_model=UserChallengeProgressResponse, status_code=status.HTTP_201_CREATED)
def join_challenge(
    data: UserChallengeProgressCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    challenge = db.query(Challenge).filter(Challenge.id == data.challenge_id).first()
    if not challenge:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Challenge not found"
        )
    
    existing = db.query(UserChallengeProgress).filter(
        and_(
            UserChallengeProgress.user_id == current_user.id,
            UserChallengeProgress.challenge_id == data.challenge_id
        )
    ).first()
    
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User has already joined this challenge"
        )
    
    progress = UserChallengeProgress(
        user_id=current_user.id,
        challenge_id=data.challenge_id,
        accepted_date=data.accepted_date
    )
    
    db.add(progress)
    db.commit()
    db.refresh(progress)
    
    return progress

@router.get("/progress")
def get_user_challenges(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    try:
        progresses = db.query(UserChallengeProgress).filter(
            UserChallengeProgress.user_id == current_user.id
        ).all()
        
        result = []
        for progress in progresses:
            challenge = db.query(Challenge).filter(Challenge.id == progress.challenge_id).first()
            if not challenge:
                continue
                
            completions = db.query(ChallengeCompletion).filter(
                and_(
                    ChallengeCompletion.user_id == current_user.id,
                    ChallengeCompletion.challenge_id == progress.challenge_id
                )
            ).all()
            
            # Build response manually as dictionaries
            challenge_dict = {
                "id": challenge.id,
                "name_en": challenge.name_en,
                "description": challenge.description,
                "category": challenge.category,
                "duration_days": challenge.duration_days,
                "difficulty": challenge.difficulty,
                "required_difficulty": challenge.required_difficulty,
                "icon": challenge.icon,
                "reward": challenge.reward,
                "notification_time": challenge.notification_time,
                "is_active": challenge.is_active
            }
            
            progress_dict = {
                "id": progress.id,
                "challenge_id": progress.challenge_id,
                "accepted_date": progress.accepted_date.isoformat() if progress.accepted_date else None,
                "is_completed": progress.is_completed,
                "current_streak": progress.current_streak or 0,
                "max_streak": progress.max_streak or 0,
                "last_completion_date": progress.last_completion_date.isoformat() if progress.last_completion_date else None,
                "is_unlocked": progress.is_unlocked,
                "notification_enabled": progress.notification_enabled,
                "grace_day_used": progress.grace_day_used
            }
            
            completion_dicts = [
                {
                    "id": c.id,
                    "challenge_id": c.challenge_id,
                    "completion_date": c.completion_date.isoformat() if c.completion_date else None
                }
                for c in completions
            ]
            
            result.append({
                "challenge": challenge_dict,
                "progress": progress_dict,
                "completions": completion_dicts
            })
        
        return result
    except Exception as e:
        print(f"Error in get_user_challenges: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error fetching challenges: {str(e)}"
        )

@router.post("/complete/{challenge_id}", response_model=ChallengeCompletionResponse, status_code=status.HTTP_201_CREATED)
def mark_challenge_complete(
    challenge_id: str,
    data: ChallengeCompletionCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    print(f"[CHALLENGE_COMPLETE] User {current_user.id} completing challenge {challenge_id} on {data.completion_date}")
    
    # Validate that completion_date is today
    today = date.today()
    today_str = str(today)
    
    # Convert date object to string if needed
    completion_date_str = str(data.completion_date) if isinstance(data.completion_date, date) else data.completion_date
    
    if completion_date_str != today_str:
        print(f"[CHALLENGE_COMPLETE] ERROR: Date mismatch - Expected {today_str}, got {completion_date_str}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"You can only complete challenges for today ({today_str})"
        )
    
    progress = db.query(UserChallengeProgress).filter(
        and_(
            UserChallengeProgress.user_id == current_user.id,
            UserChallengeProgress.challenge_id == challenge_id
        )
    ).first()
    
    if not progress:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User has not joined this challenge"
        )
    
    existing = db.query(ChallengeCompletion).filter(
        and_(
            ChallengeCompletion.user_id == current_user.id,
            ChallengeCompletion.challenge_id == challenge_id,
            ChallengeCompletion.completion_date == data.completion_date
        )
    ).first()
    
    if existing:
        # User is unchecking - delete the completion
        print(f"[CHALLENGE_COMPLETE] Deleting existing completion for {challenge_id} on {data.completion_date}")
        db.delete(existing)
        
        # Recalculate streak by checking consecutive days backwards
        yesterday = today - timedelta(days=1)
        new_streak = 0
        current_check_date = yesterday
        
        while current_check_date >= progress.accepted_date:
            completion = db.query(ChallengeCompletion).filter(
                and_(
                    ChallengeCompletion.user_id == current_user.id,
                    ChallengeCompletion.challenge_id == challenge_id,
                    ChallengeCompletion.completion_date == current_check_date
                )
            ).first()
            
            if completion:
                new_streak += 1
                current_check_date -= timedelta(days=1)
            else:
                break
        
        progress.current_streak = new_streak
        progress.last_completion_date = yesterday if new_streak > 0 else None
        
        db.commit()
        print(f"[CHALLENGE_COMPLETE] Deleted completion, new streak: {new_streak}")
        db.refresh(existing)
        return existing
    
    # User is checking - add a new completion
    # Check if they completed yesterday to maintain/reset streak
    yesterday = today - timedelta(days=1)
    yesterday_completion = db.query(ChallengeCompletion).filter(
        and_(
            ChallengeCompletion.user_id == current_user.id,
            ChallengeCompletion.challenge_id == challenge_id,
            ChallengeCompletion.completion_date == yesterday
        )
    ).first()
    
    if yesterday_completion:
        # They completed yesterday, increment the streak
        progress.current_streak = (progress.current_streak or 0) + 1
    else:
        # They missed yesterday, reset streak to 1
        progress.current_streak = 1
    
    # Update max_streak if current streak is higher
    if progress.current_streak > (progress.max_streak or 0):
        progress.max_streak = progress.current_streak
    
    progress.last_completion_date = today
    
    completion = ChallengeCompletion(
        user_id=current_user.id,
        challenge_id=challenge_id,
        completion_date=data.completion_date
    )
    
    db.add(completion)
    db.commit()
    db.refresh(completion)
    
    print(f"[CHALLENGE_COMPLETE] Created new completion for {challenge_id} on {data.completion_date}, new streak: {progress.current_streak}")
    return completion
@router.post("/grace-day/{challenge_id}")
def use_grace_day(
    challenge_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Allow user to complete yesterday's challenge today (catch-up Grace Day)"""
    today = date.today()
    yesterday = today - timedelta(days=1)
    
    progress = db.query(UserChallengeProgress).filter(
        and_(
            UserChallengeProgress.user_id == current_user.id,
            UserChallengeProgress.challenge_id == challenge_id
        )
    ).first()
    
    if not progress:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User has not joined this challenge"
        )
    
    if progress.grace_day_used:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Grace day already used for this challenge"
        )
    
    # Check if they already completed yesterday
    if db.query(ChallengeCompletion).filter(
        and_(
            ChallengeCompletion.user_id == current_user.id,
            ChallengeCompletion.challenge_id == challenge_id,
            ChallengeCompletion.completion_date == yesterday
        )
    ).first():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Already completed yesterday"
        )
    
    # Create completion for yesterday
    completion = ChallengeCompletion(
        user_id=current_user.id,
        challenge_id=challenge_id,
        completion_date=yesterday
    )
    
    # Mark grace day as used and update streak
    progress.grace_day_used = True
    progress.current_streak = (progress.current_streak or 0) + 1
    
    # Update max_streak if current streak is higher
    if progress.current_streak > (progress.max_streak or 0):
        progress.max_streak = progress.current_streak
    
    db.add(completion)
    db.commit()
    
    return {"message": "Grace day used successfully", "streak": progress.current_streak}

@router.get("/statistics")
def get_challenge_statistics(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get user's challenge completion statistics"""
    try:
        progresses = db.query(UserChallengeProgress).filter(
            UserChallengeProgress.user_id == current_user.id
        ).all()
        
        total_joined = len(progresses)
        total_completed = len([p for p in progresses if p.is_completed])
        best_streak = max([p.max_streak or 0 for p in progresses]) if progresses else 0
        
        # Group by category
        categories = {}
        for progress in progresses:
            challenge = db.query(Challenge).filter(Challenge.id == progress.challenge_id).first()
            if challenge:
                cat = challenge.category
                if cat not in categories:
                    categories[cat] = {"total": 0, "completed": 0}
                categories[cat]["total"] += 1
                if progress.is_completed:
                    categories[cat]["completed"] += 1
        
        response_data = {
            "total_challenges_joined": total_joined,
            "total_challenges_completed": total_completed,
            "completion_rate": float(total_completed / total_joined * 100) if total_joined > 0 else 0.0,
            "best_streak": int(best_streak),
            "by_category": categories
        }
        
        return JSONResponse(content=response_data)
    except Exception as e:
        print(f"[ERROR] Error in get_challenge_statistics: {str(e)}")
        import traceback
        traceback.print_exc()
        return JSONResponse(
            content={
                "total_challenges_joined": 0,
                "total_challenges_completed": 0,
                "completion_rate": 0.0,
                "best_streak": 0,
                "by_category": {}
            }
        )