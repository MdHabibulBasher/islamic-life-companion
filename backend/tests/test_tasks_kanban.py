"""Tests for the Kanban fields on the /tasks/* endpoints.

Covers:

  * the new ``status`` / ``position`` / ``priority`` / ``due_date``
    fields round-trip on create / list / update
  * the ``?status=`` query parameter filters as expected
  * ``POST /tasks/reorder`` persists multi-row reorders in one
    transaction, validates ownership, and rejects malformed payloads
  * legacy ``is_completed`` stays in sync with ``status='done'``
"""


def _create(client, headers, **overrides):
    body = {"title": overrides.pop("title", "Test task")}
    body.update(overrides)
    r = client.post("/api/v1/tasks", headers=headers, json=body)
    assert r.status_code == 201, r.text
    return r.json()


def test_create_task_with_kanban_fields(client, auth_headers):
    task = _create(
        client,
        auth_headers,
        title="Read Quran",
        description="Surah Al-Mulk",
        priority="high",
        status="todo",
        due_date="2026-07-01",
    )
    assert task["status"] == "todo"
    assert task["priority"] == "high"
    assert task["due_date"] == "2026-07-01"
    assert task["position"] >= 0
    # Legacy flag should mirror status='todo' (i.e. not done).
    assert task["is_completed"] is False


def test_default_status_is_ideas(client, auth_headers):
    task = _create(client, auth_headers, title="Backlog idea")
    assert task["status"] == "ideas"
    assert task["priority"] == "medium"
    assert task["position"] == 0


def test_position_increments_within_column(client, auth_headers):
    t1 = _create(client, auth_headers, title="A")
    t2 = _create(client, auth_headers, title="B")
    t3 = _create(client, auth_headers, title="C")
    assert t1["position"] == 0
    assert t2["position"] == 1
    assert t3["position"] == 2


def test_list_filters_by_status(client, auth_headers):
    a = _create(client, auth_headers, title="Idea", status="ideas")
    b = _create(client, auth_headers, title="Doing", status="doing")
    c = _create(client, auth_headers, title="Done", status="done")

    r = client.get("/api/v1/tasks?status=ideas", headers=auth_headers)
    assert r.status_code == 200
    ids = [t["id"] for t in r.json()]
    assert ids == [a["id"]]

    r = client.get("/api/v1/tasks?status=doing", headers=auth_headers)
    assert r.status_code == 200
    assert [t["id"] for t in r.json()] == [b["id"]]

    r = client.get("/api/v1/tasks?status=done", headers=auth_headers)
    assert r.status_code == 200
    assert [t["id"] for t in r.json()] == [c["id"]]


def test_list_rejects_invalid_status(client, auth_headers):
    # FastAPI/Pydantic rejects unknown Literal enum values with 422
    # before the handler runs — that's the contract callers should rely on.
    r = client.get("/api/v1/tasks?status=bogus", headers=auth_headers)
    assert r.status_code == 422


def test_update_status_mirrors_is_completed(client, auth_headers):
    t = _create(client, auth_headers, title="Move me")

    r = client.put(
        f"/api/v1/tasks/{t['id']}",
        headers=auth_headers,
        json={"status": "done"},
    )
    assert r.status_code == 200
    assert r.json()["is_completed"] is True

    r = client.put(
        f"/api/v1/tasks/{t['id']}",
        headers=auth_headers,
        json={"status": "doing"},
    )
    assert r.status_code == 200
    assert r.json()["is_completed"] is False


def test_reorder_persists_in_one_transaction(client, auth_headers):
    a = _create(client, auth_headers, title="A", status="ideas")
    b = _create(client, auth_headers, title="B", status="ideas")
    c = _create(client, auth_headers, title="C", status="ideas")

    # Move ``c`` into the doing column at position 0, leave a + b in ideas.
    payload = {
        "updates": [
            {"id": c["id"], "status": "doing", "position": 0},
            {"id": a["id"], "status": "ideas", "position": 0},
            {"id": b["id"], "status": "ideas", "position": 1},
        ]
    }
    r = client.post("/api/v1/tasks/reorder", headers=auth_headers, json=payload)
    assert r.status_code == 200, r.text
    refreshed = r.json()["tasks"]
    by_id = {t["id"]: t for t in refreshed}

    assert by_id[c["id"]]["status"] == "doing"
    assert by_id[c["id"]]["position"] == 0
    assert by_id[a["id"]]["status"] == "ideas"
    assert by_id[a["id"]]["position"] == 0
    assert by_id[b["id"]]["status"] == "ideas"
    assert by_id[b["id"]]["position"] == 1
    # Moving into done flips is_completed.
    assert by_id[c["id"]]["is_completed"] is False

    # Persisted — re-list and confirm.
    r = client.get("/api/v1/tasks?status=ideas", headers=auth_headers)
    assert [t["id"] for t in r.json()] == [a["id"], b["id"]]
    r = client.get("/api/v1/tasks?status=doing", headers=auth_headers)
    assert [t["id"] for t in r.json()] == [c["id"]]


def test_reorder_rejects_empty_payload(client, auth_headers):
    r = client.post(
        "/api/v1/tasks/reorder",
        headers=auth_headers,
        json={"updates": []},
    )
    assert r.status_code == 400


def test_reorder_rejects_invalid_status(client, auth_headers):
    a = _create(client, auth_headers, title="A")
    r = client.post(
        "/api/v1/tasks/reorder",
        headers=auth_headers,
        json={"updates": [{"id": a["id"], "status": "nope", "position": 0}]},
    )
    # Pydantic rejects the bad Literal value with 422 before our handler
    # gets a chance to run.
    assert r.status_code == 422


def test_reorder_rejects_duplicate_ids(client, auth_headers):
    a = _create(client, auth_headers, title="A")
    r = client.post(
        "/api/v1/tasks/reorder",
        headers=auth_headers,
        json={
            "updates": [
                {"id": a["id"], "status": "doing", "position": 0},
                {"id": a["id"], "status": "done", "position": 0},
            ]
        },
    )
    assert r.status_code == 400


def test_reorder_isolated_per_user(client, auth_headers):
    """User B cannot move user A's tasks via /reorder."""
    a = _create(client, auth_headers, title="Mine")

    # Sign up a second user.
    client.post(
        "/api/v1/auth/signup",
        json={"email": "other2@example.com", "password": "Other1234", "full_name": "Other"},
    )
    other_login = client.post(
        "/api/v1/auth/login",
        json={"email": "other2@example.com", "password": "Other1234"},
    )
    other_headers = {"Authorization": f"Bearer {other_login.json()['access_token']}"}

    r = client.post(
        "/api/v1/tasks/reorder",
        headers=other_headers,
        json={"updates": [{"id": a["id"], "status": "done", "position": 0}]},
    )
    assert r.status_code == 404

    # Confirm user A's task is unchanged.
    r = client.get(f"/api/v1/tasks/{a['id']}", headers=auth_headers)
    assert r.status_code == 200
    assert r.json()["status"] == "ideas"


def test_reorder_unknown_id_returns_404(client, auth_headers):
    r = client.post(
        "/api/v1/tasks/reorder",
        headers=auth_headers,
        json={"updates": [{"id": 99999, "status": "done", "position": 0}]},
    )
    assert r.status_code == 404


def test_priority_validation(client, auth_headers):
    r = client.post(
        "/api/v1/tasks",
        headers=auth_headers,
        json={"title": "Bad priority", "priority": "urgent"},
    )
    assert r.status_code == 422


def test_update_priority_and_due_date(client, auth_headers):
    t = _create(client, auth_headers, title="Plan")
    r = client.put(
        f"/api/v1/tasks/{t['id']}",
        headers=auth_headers,
        json={"priority": "low", "due_date": "2026-12-31"},
    )
    assert r.status_code == 200
    body = r.json()
    assert body["priority"] == "low"
    assert body["due_date"] == "2026-12-31"