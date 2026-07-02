from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from sqlalchemy import and_
from typing import List, Optional
from datetime import date, timedelta
from app.core.database import get_db
from app.api.deps import get_current_user
from app.models.user import User
from app.models.challenge import (
    Challenge,
    UserChallengeProgress,
    ChallengeCompletion,
    Hadith,
    Reward,
    UserReward,
)
from app.models.prayer import PrayerTracking
from app.schemas.challenge import (
    ChallengeResponse, UserChallengeProgressCreate, UserChallengeProgressResponse,
    ChallengeCompletionCreate, ChallengeCompletionResponse, UserChallengeDetailedResponse
)
from app.services.prayer_tracker import PRAYER_ORDER

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
                name_en="Read One Page of Quran",
                description="Read just one page of Quran today. A gentle start to building a daily habit.",
                category="Spiritual",
                duration_days=7,
                difficulty="Easy",
                level=1,
                icon="📖",
                reward="🌱 Quran Seed",
                notification_time="19:00",
                is_active=True
            ),
            Challenge(
                id="2",
                name_en="Pray One Day",
                description="Complete all 5 daily prayers for one day. The smallest complete unit of worship.",
                category="Spiritual",
                duration_days=7,
                difficulty="Easy",
                level=1,
                icon="🕌",
                reward="🌱 Prayer Seed",
                notification_time="04:30",
                is_active=True
            ),
            Challenge(
                id="3",
                name_en="Say One Day of Dhikr",
                description="Remember Allah with simple morning and evening adhkar for one day.",
                category="Spiritual",
                duration_days=7,
                difficulty="Easy",
                level=1,
                icon="📿",
                reward="🌱 Dhikr Seed",
                notification_time="21:00",
                is_active=True
            ),
            # Character Challenges
            Challenge(
                id="4",
                name_en="Quran Reading — 30 Days",
                description="Build a daily habit: read at least one page of Quran for 30 consecutive days.",
                category="Spiritual",
                duration_days=30,
                difficulty="Medium",
                level=2,
                icon="📖",
                reward="🏆 Quran Master Badge",
                notification_time="19:00",
                is_active=True
            ),
            Challenge(
                id="5",
                name_en="Prayer Consistency — 30 Days",
                description="Pray all 5 daily prayers consistently for 30 days straight.",
                category="Spiritual",
                duration_days=30,
                difficulty="Medium",
                level=2,
                icon="🕌",
                reward="🕌 Prayer Warrior",
                notification_time="04:30",
                is_active=True
            ),
            Challenge(
                id="6",
                name_en="Dhikr Practice — 30 Days",
                description="Maintain daily morning and evening adhkar for 30 days.",
                category="Spiritual",
                duration_days=30,
                difficulty="Medium",
                level=2,
                icon="📿",
                reward="📿 Dhikr Master",
                notification_time="21:00",
                is_active=True
            ),
            Challenge(
                id="7",
                name_en="40-Day Ibadah Challenge",
                description="40 days of deeper worship — combine Quran, prayer, and dhikr every day.",
                category="Spiritual",
                duration_days=40,
                difficulty="Hard",
                level=3,
                required_difficulty="Medium",
                icon="🎯",
                reward="👑 Ibadah Master",
                notification_time="05:00",
                is_active=True
            ),
            Challenge(
                id="8",
                name_en="Complete Transformation — 60 Days",
                description="Master all aspects of faith for 60 consecutive days. The ultimate journey.",
                category="Spiritual",
                duration_days=60,
                difficulty="Hard",
                level=3,
                required_difficulty="Hard",
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


@router.get("/available", response_model=List[ChallengeResponse])
def get_available_challenges(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Return only challenges the user is allowed to see right now.

    Progression rule (per-challenge prerequisite chain):
      • A challenge with NO prerequisite is always visible.
      • A challenge with a prerequisite is visible only after the user
        completes that prerequisite (the previous challenge in the level,
        or the BOSS challenge of the previous level for level-openers).
    Inactive / archived challenges are hidden.
    """
    init_default_challenges(db)

    all_active = (
        db.query(Challenge)
        .filter(Challenge.is_active.is_(True))
        .order_by(Challenge.level.asc(), Challenge.position.asc(), Challenge.id.asc())
        .all()
    )

    progresses = (
        db.query(UserChallengeProgress)
        .filter(UserChallengeProgress.user_id == current_user.id)
        .all()
    )
    completed_ids = {p.challenge_id for p in progresses if p.is_completed}

    # Index by id for fast prerequisite lookup
    by_id = {c.id: c for c in all_active}

    def is_unlocked(c: Challenge) -> bool:
        if not c.prerequisite_challenge_id:
            return True
        # Visible only if the prerequisite exists AND has been completed
        prereq = by_id.get(c.prerequisite_challenge_id)
        if not prereq:
            # Stale prerequisite pointing at an inactive/removed challenge — treat as unlocked
            return True
        return prereq.id in completed_ids

    return [c for c in all_active if is_unlocked(c)]


@router.get("/current")
def get_current_challenge(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Return the user's *current* challenge — the one they should be working on.

    Logic:
      1. Prefer an already-joined challenge that isn't done.
      2. Otherwise pick the earliest unlocked + not-completed challenge.
      3. Attach a contextual hadith (same level as the current challenge).
    """
    init_default_challenges(db)

    all_active = (
        db.query(Challenge)
        .filter(Challenge.is_active.is_(True))
        .order_by(Challenge.level.asc(), Challenge.position.asc(), Challenge.id.asc())
        .all()
    )

    progresses = (
        db.query(UserChallengeProgress)
        .filter(UserChallengeProgress.user_id == current_user.id)
        .all()
    )
    completed_ids = {p.challenge_id for p in progresses if p.is_completed}
    in_progress_ids = {p.challenge_id for p in progresses if not p.is_completed}

    by_id = {c.id: c for c in all_active}

    def is_unlocked(c: Challenge) -> bool:
        if not c.prerequisite_challenge_id:
            return True
        return (by_id.get(c.prerequisite_challenge_id) is None) or (
            c.prerequisite_challenge_id in completed_ids
        )

    # 1. Prefer an already-joined challenge that isn't done
    for cid in in_progress_ids:
        c = by_id.get(cid)
        if c and is_unlocked(c):
            return _serialize_current(c, db)

    # 2. Otherwise pick the earliest unlocked + not-completed challenge
    for c in all_active:
        if c.id in completed_ids:
            continue
        if not is_unlocked(c):
            continue
        return _serialize_current(c, db)

    # 3. Everything visible is complete
    return {"current": None, "hadith": None}


def _serialize_current(c: Challenge, db: Session) -> dict:
    hadith = (
        db.query(Hadith)
        .filter(Hadith.is_active.is_(True))
        .filter((Hadith.level == c.level) | (Hadith.level.is_(None)))
        .order_by(Hadith.level.is_(None), Hadith.id.asc())
        .first()
    )
    return {
        "current": {
            "id": c.id,
            "name_en": c.name_en,
            "description": c.description,
            "category": c.category,
            "duration_days": c.duration_days,
            "difficulty": c.difficulty,
            "icon": c.icon,
            "reward": c.reward,
            "level": c.level,
            "position": c.position,
            "challenge_type": getattr(c, "challenge_type", None) or "streak",
            "streak_target": getattr(c, "streak_target", None),
            "reward_tier": getattr(c, "reward_tier", None),
            "dua_reminder": getattr(c, "dua_reminder", None),
            "prerequisite_challenge_id": getattr(c, "prerequisite_challenge_id", None),
            "is_active": c.is_active,
        },
        "hadith": (
            {
                "text_en": hadith.text_en,
                "source": hadith.source,
                "context": hadith.context,
            }
            if hadith
            else None
        ),
    }


@router.get("/hadiths")
def list_hadiths(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Return the curated hadith library."""
    rows = (
        db.query(Hadith)
        .filter(Hadith.is_active.is_(True))
        .order_by(Hadith.level.asc().nullslast(), Hadith.id.asc())
        .all()
    )
    return [
        {
            "id": h.id,
            "text_en": h.text_en,
            "source": h.source,
            "context": h.context,
            "level": h.level,
        }
        for h in rows
    ]


@router.get("/rewards")
def list_rewards(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Return the reward catalog + which ones this user has unlocked."""
    rewards = (
        db.query(Reward)
        .filter(Reward.is_active.is_(True))
        .order_by(Reward.tier.asc(), Reward.id.asc())
        .all()
    )
    unlocked = {
        ur.reward_id
        for ur in db.query(UserReward).filter(UserReward.user_id == current_user.id).all()
    }
    return [
        {
            "id": r.id,
            "name_en": r.name_en,
            "description": r.description,
            "icon": r.icon,
            "tier": r.tier,
            "reward_kind": r.reward_kind,
            "challenge_id": r.challenge_id,
            "level": r.level,
            "is_unlocked": r.id in unlocked,
        }
        for r in rewards
    ]


# ---------------------------------------------------------------------------
# Prayer-tracker auto-population helpers
# ---------------------------------------------------------------------------


def _is_prayer_related(challenge: Challenge) -> bool:
    """True when this challenge is linked to the Prayer Tracker and should
    auto-populate from prayer tracking data.

    Only the **Prayer Journey** challenges (IDs prefixed with ``L``) are
    linked to the Prayer Tracker. The default challenges (IDs 1–8) may
    share the ``streak`` / ``daily`` type but are completed manually via
    the "Mark Today Done" button — they are NOT prayer-linked.

    Prayer-linked types:
      • daily  → completes when all 5 prayers are checked off today
      • streak → completes when N consecutive full-prayer days are reached
      • boss   → same as streak, but it's the level-final challenge
    """
    ctype = (challenge.challenge_type or "").lower()
    if ctype not in {"daily", "streak", "boss"}:
        return False
    return (challenge.id or "").upper().startswith("L")


def _todays_prayer_count(db: Session, user_id: int) -> int:
    """How many of the 5 prayers has the user checked off today?"""
    today = date.today()
    rows = (
        db.query(PrayerTracking)
        .filter(
            PrayerTracking.user_id == user_id,
            PrayerTracking.tracking_date == today,
            PrayerTracking.is_completed.is_(True),
        )
        .all()
    )
    return len({(r.prayer_name or "").lower() for r in rows})


def _consecutive_days_with_full_prayers(
    db: Session, user_id: int, upto_day: date, earliest: Optional[date] = None
) -> int:
    """Count consecutive days ending at `upto_day` (inclusive) where the
    user completed all 5 prayers. Used to derive the streak for streak-type
    challenges so the challenge data mirrors the prayer tracker.

    ``earliest`` (optional) caps how far back the walk goes — typically the
    challenge's ``accepted_date`` so that prayer data logged *before* the
    user joined the challenge is NOT counted toward the challenge streak.
    """
    streak = 0
    cursor = upto_day
    while True:
        # Don't count days before the user accepted the challenge — a
        # pre-existing prayer streak must not auto-complete a challenge
        # the user only just started.
        if earliest is not None and cursor < earliest:
            break
        rows = (
            db.query(PrayerTracking)
            .filter(
                PrayerTracking.user_id == user_id,
                PrayerTracking.tracking_date == cursor,
                PrayerTracking.is_completed.is_(True),
            )
            .all()
        )
        names = {(r.prayer_name or "").lower() for r in rows}
        if len(names) < len(PRAYER_ORDER):
            break
        streak += 1
        cursor = cursor - timedelta(days=1)
    return streak


def auto_populate_from_prayers(
    db: Session,
    current_user: User,
    challenge: Challenge,
    progress: UserChallengeProgress,
) -> dict:
    """Sync a prayer-related challenge from the Prayer Tracker.

    Behaviour by challenge_type:
      • daily    → mark today's ChallengeCompletion if all 5 prayers done
      • streak   → derive the consecutive-day count, set current_streak,
                    update last_completion_date, and (if the challenge has
                    a streak_target and we've reached it) mark is_completed
      • other    → no-op (caller must manually mark complete)

    Returns a dict with the keys that changed, so the caller can decide
    whether to surface a "auto-completed" message to the frontend.
    """
    if not _is_prayer_related(challenge):
        return {"changed": False, "reason": "not prayer-related"}

    today = date.today()
    # Prayer data logged BEFORE the user accepted this challenge must not
    # count toward its completion — otherwise a long-running prayer streak
    # auto-completes a freshly-joined challenge the instant it's accepted.
    accepted = progress.accepted_date or today

    # Only consider prayer data on/after the accepted_date. For the daily
    # path today is always >= accepted_date, so this is a no-op there, but
    # the streak path uses it as the floor for the backwards walk.
    completed_today = (
        _todays_prayer_count(db, current_user.id) if today >= accepted else 0
    )
    all_done = completed_today >= len(PRAYER_ORDER)

    changed = {"changed": False}

    # ── daily challenge ────────────────────────────────────────────────
    if (challenge.challenge_type or "").lower() == "daily":
        existing = (
            db.query(ChallengeCompletion)
            .filter(
                ChallengeCompletion.user_id == current_user.id,
                ChallengeCompletion.challenge_id == challenge.id,
                ChallengeCompletion.completion_date == today,
            )
            .first()
        )
        if all_done:
            # Record today's completion if not already recorded.
            if not existing:
                db.add(
                    ChallengeCompletion(
                        user_id=current_user.id,
                        challenge_id=challenge.id,
                        completion_date=today,
                    )
                )
            # Always update the progress to reflect the completed day.
            progress.current_streak = 1
            progress.last_completion_date = today
            target = challenge.streak_target
            if target and 1 >= target and not progress.is_completed:
                progress.is_completed = True
            changed.update(
                changed=True,
                action="marked_complete",
                completions_today=completed_today,
            )
        else:
            # Prayers are NOT all done today — reverse today's completion
            # so the challenge doesn't stay "done" when the user unchecks
            # a prayer. This keeps the challenge in lockstep with the
            # Prayer Tracker.
            if existing:
                db.delete(existing)
                changed.update(changed=True, action="completion_removed")
            progress.current_streak = 0
            progress.last_completion_date = None
            # Only un-complete if this was a single-day (target=1) challenge
            # that was completed today. Multi-day streak challenges are
            # handled by the streak path below.
            target = challenge.streak_target
            if target and 1 >= target and progress.is_completed:
                progress.is_completed = False
                changed.update(changed=True, action="unmarked_complete")
    else:
        # ── streak / boss challenge ───────────────────────────────────
        new_streak = _consecutive_days_with_full_prayers(
            db, current_user.id, today, earliest=accepted
        )
        if new_streak != (progress.current_streak or 0):
            progress.current_streak = new_streak
            progress.last_completion_date = today if new_streak > 0 else None
            if new_streak > (progress.max_streak or 0):
                progress.max_streak = new_streak
            changed.update(changed=True, action="streak_synced", streak=new_streak)
        # Auto-mark is_completed once the user reaches the streak_target
        target = challenge.streak_target
        if target and new_streak >= target and not progress.is_completed:
            progress.is_completed = True
            changed.update(changed=True, action="boss_defeated", streak=new_streak)
            # Unlock any matching rewards
            for r in (
                db.query(Reward)
                .filter(Reward.is_active.is_(True))
                .filter(
                    (Reward.challenge_id == challenge.id)
                    | (Reward.level == challenge.level)
                )
                .all()
            ):
                already = (
                    db.query(UserReward)
                    .filter(
                        UserReward.user_id == current_user.id,
                        UserReward.reward_id == r.id,
                    )
                    .first()
                )
                if already:
                    continue
                db.add(UserReward(user_id=current_user.id, reward_id=r.id))
        elif target and new_streak < target and progress.is_completed:
            # Streak dropped below the target — un-complete the challenge.
            # Also remove today's ChallengeCompletion if it exists (the
            # streak broke because today isn't a full-prayer day).
            progress.is_completed = False
            today_completion = (
                db.query(ChallengeCompletion)
                .filter(
                    ChallengeCompletion.user_id == current_user.id,
                    ChallengeCompletion.challenge_id == challenge.id,
                    ChallengeCompletion.completion_date == today,
                )
                .first()
            )
            if today_completion:
                db.delete(today_completion)
            changed.update(changed=True, action="streak_broken", streak=new_streak)

    return changed


@router.post("/sync-from-prayers/{challenge_id}")
def sync_from_prayers(
    challenge_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Legacy endpoint — challenges are now fully manual. Kept for
    backward-compatibility with older frontends that still call it on
    join. Returns the current progress state without auto-filling.
    """
    init_default_challenges(db)

    challenge = (
        db.query(Challenge)
        .filter(Challenge.id == challenge_id)
        .first()
    )
    if not challenge:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Challenge not found",
        )

    progress = (
        db.query(UserChallengeProgress)
        .filter(
            UserChallengeProgress.user_id == current_user.id,
            UserChallengeProgress.challenge_id == challenge_id,
        )
        .first()
    )
    if not progress:
        progress = UserChallengeProgress(
            user_id=current_user.id,
            challenge_id=challenge_id,
            accepted_date=date.today(),
        )
        db.add(progress)
        db.commit()
        db.flush()

    return {
        "challenge_id": challenge_id,
        "joined": True,
        "changed": False,
        "current_streak": progress.current_streak or 0,
        "is_completed": bool(progress.is_completed),
    }


@router.post("/join", response_model=UserChallengeProgressResponse, status_code=status.HTTP_201_CREATED)
def join_challenge(
    data: UserChallengeProgressCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    init_default_challenges(db)  # ensure defaults exist before lookup
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
    db.flush()

    # All challenges are manual — no auto-populate from the Prayer Tracker.

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
    
    # All challenges are now manually completed via the "Mark Today Done"
    # button. The Prayer Tracker no longer auto-fills any challenge.
    
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

        # Capture the completion's id BEFORE deleting — once we call
        # db.delete() + db.commit() the instance is no longer persistent
        # and db.refresh(existing) below would raise InvalidRequestError.
        existing_snapshot = {
            "id": existing.id,
            "challenge_id": existing.challenge_id,
            "completion_date": existing.completion_date,
        }

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
        # Return the snapshot we captured before the delete, not the
        # now-detached ORM instance.
        return existing_snapshot
    
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

    # ── Auto-unlock rewards when the challenge hits its streak_target ───
    challenge = db.query(Challenge).filter(Challenge.id == challenge_id).first()
    if challenge:
        target = getattr(challenge, "streak_target", None)
        if target and progress.current_streak >= target:
            # Mark this challenge's progress.is_completed = True (boss-defeated)
            progress.is_completed = True
            # Unlock every reward tied to this challenge OR tied to its level
            reward_rows = (
                db.query(Reward)
                .filter(Reward.is_active.is_(True))
                .filter(
                    (Reward.challenge_id == challenge_id)
                    | (Reward.level == challenge.level)
                )
                .all()
            )
            for r in reward_rows:
                already = (
                    db.query(UserReward)
                    .filter(
                        UserReward.user_id == current_user.id,
                        UserReward.reward_id == r.id,
                    )
                    .first()
                )
                if already:
                    continue
                db.add(UserReward(user_id=current_user.id, reward_id=r.id))
            db.commit()

    print(f"[CHALLENGE_COMPLETE] Created new completion for {challenge_id} on {data.completion_date}, new streak: {progress.current_streak}")
    return completion
@router.delete("/leave/{challenge_id}", status_code=status.HTTP_200_OK)
def leave_challenge(
    challenge_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Allow user to leave a challenge they previously joined.

    Deletes the user's progress record and all related completion entries.
    """
    progress = db.query(UserChallengeProgress).filter(
        and_(
            UserChallengeProgress.user_id == current_user.id,
            UserChallengeProgress.challenge_id == challenge_id
        )
    ).first()

    if not progress:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="You have not joined this challenge"
        )

    # Delete all completion records for this user/challenge
    db.query(ChallengeCompletion).filter(
        and_(
            ChallengeCompletion.user_id == current_user.id,
            ChallengeCompletion.challenge_id == challenge_id
        )
    ).delete(synchronize_session=False)

    db.delete(progress)
    db.commit()

    return {"message": "You have left the challenge", "challenge_id": challenge_id}


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