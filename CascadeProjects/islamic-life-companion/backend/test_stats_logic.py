#!/usr/bin/env python
"""Quick test of the statistics endpoint logic directly"""
import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from app.core.database import SessionLocal
from app.models.habit import UserHabit, HabitTracking
from app.models.user import User
from datetime import date, timedelta

db = SessionLocal()

try:
    # Get the user
    user = db.query(User).filter(User.id == 2).first()
    print(f"User: {user.email} (ID: {user.id})")
    
    # Simulate the endpoint logic
    today = date.today()
    week_ago = today - timedelta(days=7)
    month_ago = today - timedelta(days=30)
    
    # Count total habits
    total_habits = db.query(UserHabit).filter(
        UserHabit.user_id == user.id,
        UserHabit.is_deleted == False
    ).count()
    
    # Count completed today
    completed_today = db.query(HabitTracking).filter(
        HabitTracking.user_id == user.id,
        HabitTracking.tracking_date == today,
        HabitTracking.is_completed == True
    ).count()
    
    # Calculate completion percentage
    completion_percentage = 0.0
    if total_habits > 0:
        completion_percentage = float((completed_today / total_habits) * 100)
    
    # Get best streak
    best_streak = 0
    try:
        streaks = db.query(HabitStreak).all()
        if streaks:
            best_streak = max([int(s.longest_streak or 0) for s in streaks]) if streaks else 0
    except:
        best_streak = 0
    
    # Count completed this week  
    completed_this_week = db.query(HabitTracking).filter(
        HabitTracking.user_id == user.id,
        HabitTracking.tracking_date >= week_ago,
        HabitTracking.tracking_date <= today,
        HabitTracking.is_completed == True
    ).count()
    
    # Count completed this month
    completed_this_month = db.query(HabitTracking).filter(
        HabitTracking.user_id == user.id,
        HabitTracking.tracking_date >= month_ago,
        HabitTracking.tracking_date <= today,
        HabitTracking.is_completed == True
    ).count()
    
    print(f"\n=== Statistics for User {user.id} ===")
    print(f"Total Habits: {total_habits}")
    print(f"Completed Today: {completed_today} / {total_habits}")
    print(f"Completion %: {completion_percentage:.1f}%")
    print(f"Best Streak: {best_streak}")
    print(f"This Week: {completed_this_week}")
    print(f"This Month: {completed_this_month}")
    print(f"\nToday's Date: {today}")
    
finally:
    db.close()
