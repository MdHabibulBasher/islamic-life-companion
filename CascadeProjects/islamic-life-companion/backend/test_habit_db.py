#!/usr/bin/env python
"""Test database queries for habits"""
import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from app.core.database import SessionLocal
from app.models.habit import UserHabit, HabitTracking
from app.models.user import User

db = SessionLocal()

try:
    # Get the first user
    user = db.query(User).first()
    if not user:
        print("❌ No users in database")
        sys.exit(1)
    
    print(f"✓ Found user: {user.email} (ID: {user.id})")
    
    # Count all habits for this user (including deleted)
    all_habits = db.query(UserHabit).filter(UserHabit.user_id == user.id).all()
    print(f"✓ Total habits (all) for user {user.id}: {len(all_habits)}")
    
    # Count non-deleted habits
    active_habits = db.query(UserHabit).filter(
        UserHabit.user_id == user.id,
        UserHabit.is_deleted == False
    ).count()
    print(f"✓ Non-deleted habits for user {user.id}: {active_habits}")
    
    # List all habits
    for habit in all_habits:
        print(f"  - {habit.name} (id={habit.id}, deleted={habit.is_deleted}, active={habit.is_active})")
    
    # Count today's completions
    from datetime import date
    today = date.today()
    completions = db.query(HabitTracking).filter(
        HabitTracking.user_id == user.id,
        HabitTracking.tracking_date == today,
        HabitTracking.is_completed == True
    ).count()
    print(f"✓ Completed today: {completions}")
    
    # List all tracking records for this user
    all_tracking = db.query(HabitTracking).filter(HabitTracking.user_id == user.id).all()
    print(f"✓ Total tracking records: {len(all_tracking)}")
    for tracking in all_tracking[-5:]:  # Show last 5
        print(f"  - Habit {tracking.habit_id}, Date: {tracking.tracking_date}, Completed: {tracking.is_completed}")
    
finally:
    db.close()
