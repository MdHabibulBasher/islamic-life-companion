#!/usr/bin/env python
"""Test the habit statistics endpoint"""
import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from app.core.database import SessionLocal, engine
from app.models.user import User
from app.models.habit import UserHabit, HabitTracking, HabitCategory, HabitStreak
from datetime import date, datetime
from sqlalchemy import text
import json

# Create a test session
db = SessionLocal()

try:
    # Get or create a test user
    test_user = db.query(User).filter(User.email == "test@example.com").first()
    if not test_user:
        test_user = User(
            email="test@example.com",
            username="testuser",
            full_name="Test User",
            hashed_password="dummy_hash"
        )
        db.add(test_user)
        db.commit()
        db.refresh(test_user)
    
    print(f"Test User ID: {test_user.id}")
    
    # Test the statistics query logic
    today = date.today()
    from datetime import timedelta
    week_ago = today - timedelta(days=7)
    month_ago = today - timedelta(days=30)
    
    # Count total habits
    total_habits = db.query(UserHabit).filter(
        UserHabit.user_id == test_user.id,
        UserHabit.is_deleted == False
    ).count()
    print(f"Total habits: {total_habits}")
    
    # Count completed today
    completed_today = db.query(HabitTracking).filter(
        HabitTracking.user_id == test_user.id,
        HabitTracking.tracking_date == today,
        HabitTracking.is_completed == True
    ).count()
    print(f"Completed today: {completed_today}")
    
    # Calculate completion percentage
    completion_percentage = 0.0
    if total_habits > 0:
        completion_percentage = float((completed_today / total_habits) * 100)
    print(f"Completion percentage: {completion_percentage}")
    
    # Get best streak
    best_streak = 0
    try:
        streaks = db.query(HabitStreak).filter(
            HabitStreak.user_id == test_user.id
        ).all()
        if streaks:
            best_streak = max([int(s.longest_streak or 0) for s in streaks])
    except Exception as e:
        print(f"Error getting streaks: {e}")
        best_streak = 0
    print(f"Best streak: {best_streak}")
    
    # Count completed this week
    completed_this_week = db.query(HabitTracking).filter(
        HabitTracking.user_id == test_user.id,
        HabitTracking.tracking_date >= week_ago,
        HabitTracking.tracking_date <= today,
        HabitTracking.is_completed == True
    ).count()
    print(f"Completed this week: {completed_this_week}")
    
    # Count completed this month
    completed_this_month = db.query(HabitTracking).filter(
        HabitTracking.user_id == test_user.id,
        HabitTracking.tracking_date >= month_ago,
        HabitTracking.tracking_date <= today,
        HabitTracking.is_completed == True
    ).count()
    print(f"Completed this month: {completed_this_month}")
    
    # Build response
    response_data = {
        "total_habits": int(total_habits),
        "completed_today": int(completed_today),
        "completion_percentage": round(completion_percentage, 1),
        "best_streak": int(best_streak),
        "this_week": int(completed_this_week),
        "this_month": int(completed_this_month)
    }
    
    print("\n=== Response Data ===")
    print(json.dumps(response_data, indent=2, default=str))
    
finally:
    db.close()
