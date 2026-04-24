import os

# Must be set before any app import — database.py and security.py raise at module level otherwise
os.environ.setdefault("DATABASE_URL", "postgresql://fake:fake@localhost/fake")
os.environ.setdefault("SECRET_KEY", "test-secret-key-for-tests-only")

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from fastapi.testclient import TestClient

import app.database as _db
from app.database import Base

# Register all models with Base before any test creates tables
import app.models.user           # noqa: F401
import app.models.space_invader  # noqa: F401
import app.models.user_request   # noqa: F401
import app.models.admin_request  # noqa: F401
import app.models.user_progress  # noqa: F401
import app.models.refresh_token  # noqa: F401

from app.main import app
from app.dependencies import get_db
from app.models.user import User
from app.models.space_invader import Invader
from app.core.security import hash_password, create_access_token

# Swap out the real Postgres engine for an in-memory SQLite one.
# We do this once at import time so every session uses it.
_test_engine = create_engine(
    "sqlite:///:memory:",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,  # one shared connection — all threads see the same in-memory DB
)
_TestSession = sessionmaker(autocommit=False, autoflush=False, bind=_test_engine)
_db.engine = _test_engine
_db.SessionLocal = _TestSession


@pytest.fixture()
def db():
    """Fresh schema per test, rolled back on teardown."""
    Base.metadata.create_all(_test_engine)
    session = _TestSession()
    yield session
    session.close()
    Base.metadata.drop_all(_test_engine)


@pytest.fixture()
def client(db):
    """TestClient wired to the test DB session via dependency override."""
    def override_get_db():
        yield db

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


def make_token(user: User) -> str:
    return create_access_token({"sub": str(user.id), "is_admin": user.is_admin})


def auth_headers(user: User) -> dict:
    return {"Authorization": f"Bearer {make_token(user)}"}
