"""Tests for challenges endpoints."""
from datetime import date


def test_challenges_are_seeded(client, auth_headers):
    r = client.get("/api/v1/challenges", headers=auth_headers)
    assert r.status_code == 200
    challenges = r.json()
    assert len(challenges) >= 5
    ids = {c["id"] for c in challenges}
    assert "1" in ids  # Quran Reading


def test_join_and_complete_challenge(client, auth_headers):
    today = date.today().isoformat()

    # Join
    r = client.post(
        "/api/v1/challenges/join",
        headers=auth_headers,
        json={"challenge_id": "1", "accepted_date": today},
    )
    assert r.status_code == 201

    # Complete for today
    r = client.post(
        "/api/v1/challenges/complete/1",
        headers=auth_headers,
        json={"challenge_id": "1", "completion_date": today},
    )
    assert r.status_code == 201

    # Progress shows it
    r = client.get("/api/v1/challenges/progress", headers=auth_headers)
    assert r.status_code == 200
    progress = r.json()
    assert any(p["challenge"]["id"] == "1" for p in progress)
    assert progress[0]["progress"]["current_streak"] >= 1


def test_cannot_complete_challenge_for_other_day(client, auth_headers):
    today = date.today().isoformat()
    yesterday = date.fromisoformat(today).replace(day=1).isoformat()  # any non-today date

    # Try to complete for an arbitrary non-today date
    r = client.post(
        "/api/v1/challenges/complete/1",
        headers=auth_headers,
        json={"challenge_id": "1", "completion_date": yesterday},
    )
    assert r.status_code == 400