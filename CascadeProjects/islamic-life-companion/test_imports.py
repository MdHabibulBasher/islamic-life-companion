#!/usr/bin/env python
"""Test if the backend imports work"""
import sys
import os

# Add backend to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'backend'))

try:
    print("Attempting to import main...")
    from main import app
    print("✓ Successfully imported app from main.py")
    
    print("Checking if app is a FastAPI instance...")
    from fastapi import FastAPI
    if isinstance(app, FastAPI):
        print("✓ app is a FastAPI instance")
    
    print("\nAttempting to import habits endpoint...")
    from app.api.v1.endpoints.habits import router
    print("✓ Successfully imported habits router")
    
    print("\nAll imports successful!")
    
except Exception as e:
    print(f"✗ Import error: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)
