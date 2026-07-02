"""Tests for the /tasks, /notifications, /islamic-calendar endpoints."""


def test_tasks_crud(client, auth_headers):
    # Create
    r = client.post(
        "/api/v1/tasks",
        headers=auth_headers,
        json={"title": "Test task", "description": "Hello"},
    )
    assert r.status_code == 201
    task = r.json()
    task_id = task["id"]
    assert task["title"] == "Test task"
    assert task["is_completed"] is False

    # List
    r = client.get("/api/v1/tasks", headers=auth_headers)
    assert r.status_code == 200
    assert len(r.json()) == 1

    # Update (complete)
    r = client.put(
        f"/api/v1/tasks/{task_id}",
        headers=auth_headers,
        json={"is_completed": True},
    )
    assert r.status_code == 200
    assert r.json()["is_completed"] is True

    # Filter
    r = client.get("/api/v1/tasks?completed=true", headers=auth_headers)
    assert r.status_code == 200
    assert all(t["is_completed"] for t in r.json())

    # Delete
    r = client.delete(f"/api/v1/tasks/{task_id}", headers=auth_headers)
    assert r.status_code == 204

    r = client.get("/api/v1/tasks", headers=auth_headers)
    assert r.status_code == 200
    assert r.json() == []


def test_tasks_user_isolation(client, auth_headers):
    """Task created by user A must not appear in user B's list."""
    # Sign up a second user
    client.post(
        "/api/v1/auth/signup",
        json={"email": "other@example.com", "password": "Other1234", "full_name": "Other"},
    )
    other_login = client.post(
        "/api/v1/auth/login",
        json={"email": "other@example.com", "password": "Other1234"},
    )
    other_token = other_login.json()["access_token"]
    other_headers = {"Authorization": f"Bearer {other_token}"}

    # User 1 creates a task
    client.post(
        "/api/v1/tasks",
        headers=auth_headers,
        json={"title": "Mine"},
    )

    # User 2 lists their tasks — should be empty
    r = client.get("/api/v1/tasks", headers=other_headers)
    assert r.status_code == 200
    assert r.json() == []


def test_notifications_crud(client, auth_headers):
    r = client.post(
        "/api/v1/notifications",
        headers=auth_headers,
        json={"title": "Hi", "message": "World", "notification_type": "system"},
    )
    assert r.status_code == 201
    nid = r.json()["id"]

    # List
    r = client.get("/api/v1/notifications", headers=auth_headers)
    assert r.status_code == 200
    assert len(r.json()) == 1
    assert r.json()[0]["is_read"] is False

    # Mark as read
    r = client.put(f"/api/v1/notifications/{nid}/read", headers=auth_headers)
    assert r.status_code == 200
    assert r.json()["is_read"] is True

    # Mark all as read
    client.post(
        "/api/v1/notifications",
        headers=auth_headers,
        json={"title": "Hi2", "message": "World2", "notification_type": "system"},
    )
    r = client.put("/api/v1/notifications/read-all", headers=auth_headers)
    assert r.status_code == 200

    r = client.get("/api/v1/notifications?unread_only=true", headers=auth_headers)
    assert r.status_code == 200
    assert r.json() == []

    # Delete
    r = client.delete(f"/api/v1/notifications/{nid}", headers=auth_headers)
    assert r.status_code == 204


def test_islamic_calendar_seeds_defaults(client, auth_headers):
    """First call should auto-seed the default Hijri events."""
    r = client.get("/api/v1/islamic-calendar/events", headers=auth_headers)
    assert r.status_code == 200
    events = r.json()
    assert len(events) >= 5  # at least a handful of defaults

    titles = {e["title_en"] for e in events}
    assert "Eid al-Fitr" in titles
    assert "Ramadan" in " ".join(titles)


def test_islamic_calendar_filter_by_month(client, auth_headers):
    client.get("/api/v1/islamic-calendar/events", headers=auth_headers)  # seed
    r = client.get("/api/v1/islamic-calendar/events?month=9", headers=auth_headers)
    assert r.status_code == 200
    assert all(e["hijri_month"] == 9 for e in r.json())


def test_dashboard_returns_combined_payload(client, auth_headers):
    r = client.get("/api/v1/dashboard", headers=auth_headers)
    assert r.status_code == 200
    data = r.json()
    assert "user" in data
    assert "habits" in data
    assert "challenges" in data
    assert "quran" in data
    assert "achievements" in data
    assert data["habits"]["total_habits"] == 0  # fresh user