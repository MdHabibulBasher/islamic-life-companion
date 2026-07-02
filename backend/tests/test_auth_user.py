"""Tests for the auth and user endpoints."""
from fastapi.testclient import TestClient


def test_signup_creates_user_and_returns_tokens(client: TestClient):
    response = client.post(
        "/api/v1/auth/signup",
        json={
            "email": "new@example.com",
            "password": "Newpass1",
            "full_name": "New User",
        },
    )
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert "refresh_token" in data
    assert data["user"]["email"] == "new@example.com"


def test_signup_rejects_weak_password(client: TestClient):
    response = client.post(
        "/api/v1/auth/signup",
        json={"email": "x@x.com", "password": "short", "full_name": "X"},
    )
    assert response.status_code == 422


def test_login_success(client: TestClient, test_user):
    response = client.post(
        "/api/v1/auth/login",
        json={"email": "test@example.com", "password": "Test1234"},
    )
    assert response.status_code == 200
    assert "access_token" in response.json()


def test_login_wrong_password(client: TestClient, test_user):
    response = client.post(
        "/api/v1/auth/login",
        json={"email": "test@example.com", "password": "WrongPass1"},
    )
    assert response.status_code == 401


def test_protected_endpoint_without_token_returns_401(client: TestClient):
    """Regression test for the JWT-bypass bug we fixed in deps.py."""
    response = client.get("/api/v1/user/profile")
    assert response.status_code == 401


def test_protected_endpoint_with_token_returns_user(client: TestClient, auth_headers):
    response = client.get("/api/v1/user/profile", headers=auth_headers)
    assert response.status_code == 200
    assert response.json()["email"] == "test@example.com"


def test_profile_update(client: TestClient, auth_headers):
    response = client.put(
        "/api/v1/user/profile",
        headers=auth_headers,
        json={"full_name": "Updated Name", "location": "Cairo, Egypt"},
    )
    assert response.status_code == 200
    assert response.json()["full_name"] == "Updated Name"
    assert response.json()["location"] == "Cairo, Egypt"


def test_user_statistics(client: TestClient, auth_headers):
    response = client.get("/api/v1/user/statistics", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert "total_habits" in data
    assert "completion_rate" in data


def test_user_preferences_round_trip(client: TestClient, auth_headers):
    # Get creates the row with defaults
    r1 = client.get("/api/v1/user/preferences", headers=auth_headers)
    assert r1.status_code == 200
    # Update a single preference
    r2 = client.put(
        "/api/v1/user/preferences",
        headers=auth_headers,
        json={"dark_mode": True, "default_view": "weekly"},
    )
    assert r2.status_code == 200
    assert r2.json()["dark_mode"] is True
    assert r2.json()["default_view"] == "weekly"


def test_user_location_round_trip(client: TestClient, auth_headers):
    r1 = client.get("/api/v1/user/location", headers=auth_headers)
    assert r1.status_code == 200
    r2 = client.post(
        "/api/v1/user/location",
        headers=auth_headers,
        json={
            "city": "Dhaka",
            "country": "Bangladesh",
            "latitude": 23.81,
            "longitude": 90.41,
            "timezone": "Asia/Dhaka",
        },
    )
    assert r2.status_code == 200
    assert r2.json()["city"] == "Dhaka"
    assert r2.json()["latitude"] == 23.81