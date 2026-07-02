"""Tests for habits endpoints (categories, CRUD, tracking, statistics)."""


def test_categories_seeded(client, auth_headers):
    r = client.get("/api/v1/habits/categories", headers=auth_headers)
    assert r.status_code == 200
    cats = r.json()
    assert len(cats) >= 4
    names = {c["name_en"] for c in cats}
    assert "Worship" in names


def test_create_and_list_habits(client, auth_headers):
    # Need a category first
    cat_id = client.get("/api/v1/habits/categories", headers=auth_headers).json()[0]["id"]

    r = client.post(
        "/api/v1/habits/",
        headers=auth_headers,
        json={"category_id": cat_id, "name": "Read Quran", "tracking_type": "checkbox"},
    )
    assert r.status_code == 201
    hid = r.json()["id"]

    r = client.get("/api/v1/habits/", headers=auth_headers)
    assert r.status_code == 200
    assert any(h["habit"]["id"] == hid for h in r.json())


def test_update_and_delete_habit(client, auth_headers):
    cat_id = client.get("/api/v1/habits/categories", headers=auth_headers).json()[0]["id"]
    habit = client.post(
        "/api/v1/habits/",
        headers=auth_headers,
        json={"category_id": cat_id, "name": "Run", "tracking_type": "checkbox"},
    ).json()

    # Update
    r = client.put(
        f"/api/v1/habits/{habit['id']}",
        headers=auth_headers,
        json={"name": "Run 5k"},
    )
    assert r.status_code == 200
    assert r.json()["name"] == "Run 5k"

    # Delete (soft)
    r = client.delete(f"/api/v1/habits/{habit['id']}", headers=auth_headers)
    assert r.status_code == 204

    # Should no longer appear in default list (active only)
    r = client.get("/api/v1/habits/", headers=auth_headers)
    assert r.status_code == 200
    assert all(h["habit"]["id"] != habit["id"] for h in r.json())


def test_habit_statistics(client, auth_headers):
    r = client.get("/api/v1/habits/statistics", headers=auth_headers)
    assert r.status_code == 200
    data = r.json()
    assert "active_habits" in data
    assert "completion_rate" in data