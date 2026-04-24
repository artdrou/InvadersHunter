"""Tests for progress/capture routes: flash, unflash, list, delta sync."""
import pytest
from datetime import datetime, timedelta, timezone

from app.models.user import User
from app.models.space_invader import Invader
from app.models.user_progress import UserProgress
from app.core.security import hash_password


@pytest.fixture()
def user(db):
    u = User(username="alice", email="alice@test.com", hashed_password=hash_password("pw"))
    db.add(u)
    db.flush()
    return u


@pytest.fixture()
def other_user(db):
    u = User(username="bob", email="bob@test.com", hashed_password=hash_password("pw"))
    db.add(u)
    db.flush()
    return u


@pytest.fixture()
def invader(db):
    inv = Invader(name="PA_10", latitude=48.85, longitude=2.35)
    db.add(inv)
    db.flush()
    return inv


@pytest.fixture()
def invader2(db):
    inv = Invader(name="PA_11", latitude=48.86, longitude=2.36)
    db.add(inv)
    db.flush()
    return inv


# ── flash (POST /progress/) ───────────────────────────────────────────────────

def test_flash_invader(client, user, invader):
    res = client.post("/progress/", json={"user_id": user.id, "invader_id": invader.id})
    assert res.status_code == 200
    body = res.json()
    assert body["user_id"] == user.id
    assert body["invader_id"] == invader.id
    assert body["id"] is not None


def test_flash_duplicate_returns_409(client, user, invader):
    client.post("/progress/", json={"user_id": user.id, "invader_id": invader.id})
    res = client.post("/progress/", json={"user_id": user.id, "invader_id": invader.id})
    assert res.status_code == 409


def test_flash_same_invader_different_users_ok(client, user, other_user, invader):
    r1 = client.post("/progress/", json={"user_id": user.id, "invader_id": invader.id})
    r2 = client.post("/progress/", json={"user_id": other_user.id, "invader_id": invader.id})
    assert r1.status_code == 200
    assert r2.status_code == 200


def test_flash_unknown_user_returns_404(client, invader):
    res = client.post("/progress/", json={"user_id": 9999, "invader_id": invader.id})
    assert res.status_code == 404


def test_flash_unknown_invader_returns_404(client, user):
    res = client.post("/progress/", json={"user_id": user.id, "invader_id": 9999})
    assert res.status_code == 404


# ── list all captures (GET /progress/) ───────────────────────────────────────

def test_list_all_captures(client, db, user, invader, invader2):
    db.add(UserProgress(user_id=user.id, invader_id=invader.id))
    db.add(UserProgress(user_id=user.id, invader_id=invader2.id))
    db.flush()

    res = client.get("/progress/")
    assert res.status_code == 200
    assert len(res.json()) == 2


# ── list by user with delta sync (GET /progress/user/{id}) ────────────────────

def test_list_user_captures(client, db, user, invader):
    db.add(UserProgress(user_id=user.id, invader_id=invader.id))
    db.flush()

    res = client.get(f"/progress/user/{user.id}")
    assert res.status_code == 200
    data = res.json()
    assert len(data) == 1
    assert data[0]["invader_id"] == invader.id


def test_list_user_captures_only_own(client, db, user, other_user, invader, invader2):
    db.add(UserProgress(user_id=user.id, invader_id=invader.id))
    db.add(UserProgress(user_id=other_user.id, invader_id=invader2.id))
    db.flush()

    res = client.get(f"/progress/user/{user.id}")
    assert len(res.json()) == 1
    assert res.json()[0]["user_id"] == user.id


def test_list_user_captures_delta_sync(client, db, user, invader, invader2):
    old = datetime.now(timezone.utc) - timedelta(hours=2)
    recent = datetime.now(timezone.utc)

    db.add(UserProgress(user_id=user.id, invader_id=invader.id, updated_at=old))
    db.add(UserProgress(user_id=user.id, invader_id=invader2.id, updated_at=recent))
    db.flush()

    cutoff = (datetime.utcnow() - timedelta(hours=1)).strftime('%Y-%m-%dT%H:%M:%S')
    res = client.get(f"/progress/user/{user.id}?updated_since={cutoff}")
    assert res.status_code == 200
    results = res.json()
    assert len(results) == 1
    assert results[0]["invader_id"] == invader2.id


def test_list_user_captures_empty_user(client, db, user):
    res = client.get(f"/progress/user/{user.id}")
    assert res.status_code == 200
    assert res.json() == []


# ── unflash (DELETE /progress/{id}) ──────────────────────────────────────────

def test_unflash_invader(client, db, user, invader):
    progress = UserProgress(user_id=user.id, invader_id=invader.id)
    db.add(progress)
    db.flush()

    res = client.delete(f"/progress/{progress.id}")
    assert res.status_code == 200
    assert db.query(UserProgress).filter(UserProgress.id == progress.id).first() is None


def test_unflash_not_found(client):
    res = client.delete("/progress/9999")
    assert res.status_code == 404


def test_unflash_then_reflash_works(client, db, user, invader):
    progress = UserProgress(user_id=user.id, invader_id=invader.id)
    db.add(progress)
    db.flush()

    client.delete(f"/progress/{progress.id}")
    res = client.post("/progress/", json={"user_id": user.id, "invader_id": invader.id})
    assert res.status_code == 200


# ── update capture (PUT /progress/{id}) ──────────────────────────────────────

def test_update_capture_found_at(client, db, user, invader):
    progress = UserProgress(user_id=user.id, invader_id=invader.id)
    db.add(progress)
    db.flush()

    res = client.put(f"/progress/{progress.id}", json={"found_at": "2024-01-15T12:00:00"})
    assert res.status_code == 200
    assert "2024-01-15" in res.json()["found_at"]


def test_update_capture_not_found(client):
    res = client.put("/progress/9999", json={"found_at": "2024-01-15T12:00:00"})
    assert res.status_code == 404
