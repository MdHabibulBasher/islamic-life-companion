#!/usr/bin/env python
"""Test the statistics endpoints"""
import requests
import json

BASE_URL = "http://localhost:8000/api/v1"

# First, try to register/login to get a token
email = "testapi@example.com"
password = "testpass123"

# Try to register
register_response = requests.post(f"{BASE_URL}/auth/register", json={
    "email": email,
    "username": "testapi_user",
    "password": password,
    "full_name": "Test API User"
})

print(f"Register Status: {register_response.status_code}")
if register_response.status_code != 200:
    print(f"Register Response: {register_response.text}")

# Now try to login
login_response = requests.post(f"{BASE_URL}/auth/login", json={
    "email": email,
    "password": password
})

print(f"\nLogin Status: {login_response.status_code}")
if login_response.status_code == 200:
    token = login_response.json().get("access_token")
    print(f"Access Token: {token[:20]}...")
    
    # Now test the statistics endpoints
    headers = {"Authorization": f"Bearer {token}"}
    
    # Test challenges statistics
    print("\n=== Testing /challenges/statistics ===")
    response = requests.get(f"{BASE_URL}/challenges/statistics", headers=headers)
    print(f"Status: {response.status_code}")
    print(f"Response: {json.dumps(response.json(), indent=2)}")
    
    # Test habits statistics
    print("\n=== Testing /habits/statistics ===")
    response = requests.get(f"{BASE_URL}/habits/statistics", headers=headers)
    print(f"Status: {response.status_code}")
    try:
        print(f"Response: {json.dumps(response.json(), indent=2)}")
    except Exception as e:
        print(f"Response Text: {response.text}")
        print(f"Parse Error: {e}")
else:
    print(f"Login Error: {login_response.text}")
