"""Shared pytest fixtures for the backend test suite."""
import os
import sys

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

# Make /backend importable regardless of where pytest is run from.
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Force the app to use SQLite in-memory for tests BEFORE importing modules.
os.environ.setdefault("DATABASE_URL", "sqlite:///:memory:")
os.environ.setdefault("SECRET_KEY", "test-secret-key-for-pytest-only")
os.environ.setdefault("ENV", "development")

from app.core.config import settings  # noqa: E402
from app.core.database import Base, get_db  # noqa: E402
from main import app  # noqa: E402
from app.models.user import User  # noqa: E402
from app.services.auth import hash_password  # noqa: E402


@pytest.fixture(scope="function")
def engine_fixture():
    """Fresh in-memory SQLite engine per test."""
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    # Import all models so metadata knows about them
    from app import models  # noqa: F401

    Base.metadata.create_all(bind=engine)
    yield engine
    Base.metadata.drop_all(bind=engine)
    engine.dispose()


@pytest.fixture(scope="function")
def db_session(engine_fixture):
    SessionLocal = sessionmaker(bind=engine_fixture)
    session = SessionLocal()
    yield session
    session.close()


@pytest.fixture(scope="function")
def client(engine_fixture):
    """TestClient bound to a fresh in-memory DB."""
    SessionLocal = sessionmaker(bind=engine_fixture)

    def override_get_db():
        db = SessionLocal()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


@pytest.fixture
def test_user(db_session):
    """Create a test user and return it."""
    user = User(
        email="test@example.com",
        full_name="Test User",
        username="testuser",
        hashed_password=hash_password("Test1234"),
        is_active=True,
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


@pytest.fixture
def auth_headers(client, test_user):
    """Sign in and return Authorization headers."""
    response = client.post(
        "/api/v1/auth/login",
        json={"email": "test@example.com", "password": "Test1234"},
    )
    assert response.status_code == 200, response.text
    token = response.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}