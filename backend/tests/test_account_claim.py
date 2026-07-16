"""
Tests for POST /account/claim — guest → account bulk-import of captures.
"""
import pytest
from datetime import datetime

from app.models.user import User
from app.models.space_invader import Invader
from app.models.user_progress import UserProgress
from app.core.security import hash_password

from tests.conftest import auth_headers


@pytest.fixture()
def user(db):
    u = User(username="alice", email="alice@test.com", hashed_password=hash_password("secret"))
    db.add(u)
    db.flush()
    return u


@pytest.fixture()
def invaders(db):
    rows = [
        Invader(id=1, name="PA_0001", points=10, state="Good"),
        Invader(id=2, name="PA_0002", points=20, state="Good"),
        Invader(id=3, name="PA_0003", points=30, state="Degraded"),
    ]
    db.add_all(rows)
    db.flush()
    return rows


# ── auth ───────────────────────────────────────────────────────────────────────

def test_claim_requires_auth(client):
    res = client.post("/account/claim", json={"captures": []})
    assert res.status_code == 401


# ── happy path ─────────────────────────────────────────────────────────────────

def test_claim_imports_captures(client, db, user, invaders):
    res = client.post(
        "/account/claim",
        json={"captures": [
            {"invader_id": 1, "found_at": "2026-07-01T10:00:00"},
            {"invader_id": 2},
        ]},
        headers=auth_headers(user),
    )
    assert res.status_code == 200
    body = res.json()
    assert body["imported"] == 2
    assert body["skipped_duplicates"] == 0
    assert body["skipped_missing"] == 0
    assert {c["invader_id"] for c in body["captures"]} == {1, 2}
    assert all(c["user_id"] == user.id for c in body["captures"])

    db.expire_all()
    assert db.query(UserProgress).filter(UserProgress.user_id == user.id).count() == 2


def test_claim_preserves_found_at(client, db, user, invaders):
    res = client.post(
        "/account/claim",
        json={"captures": [{"invader_id": 1, "found_at": "2026-06-15T08:30:00"}]},
        headers=auth_headers(user),
    )
    assert res.status_code == 200
    db.expire_all()
    row = db.query(UserProgress).filter(
        UserProgress.user_id == user.id, UserProgress.invader_id == 1
    ).first()
    assert row.found_at == datetime(2026, 6, 15, 8, 30)


def test_claim_empty_payload_is_ok(client, user):
    res = client.post("/account/claim", json={"captures": []}, headers=auth_headers(user))
    assert res.status_code == 200
    assert res.json()["imported"] == 0


# ── idempotency / skips ────────────────────────────────────────────────────────

def test_claim_is_idempotent_on_retry(client, user, invaders):
    payload = {"captures": [{"invader_id": 1}, {"invader_id": 2}]}
    first = client.post("/account/claim", json=payload, headers=auth_headers(user))
    assert first.json()["imported"] == 2

    second = client.post("/account/claim", json=payload, headers=auth_headers(user))
    body = second.json()
    assert body["imported"] == 0
    assert body["skipped_duplicates"] == 2


def test_claim_skips_already_flashed(client, db, user, invaders):
    db.add(UserProgress(user_id=user.id, invader_id=1))
    db.flush()

    res = client.post(
        "/account/claim",
        json={"captures": [{"invader_id": 1}, {"invader_id": 2}]},
        headers=auth_headers(user),
    )
    body = res.json()
    assert body["imported"] == 1
    assert body["skipped_duplicates"] == 1
    assert {c["invader_id"] for c in body["captures"]} == {2}


def test_claim_skips_unknown_invaders(client, user, invaders):
    res = client.post(
        "/account/claim",
        json={"captures": [{"invader_id": 1}, {"invader_id": 999}]},
        headers=auth_headers(user),
    )
    body = res.json()
    assert body["imported"] == 1
    assert body["skipped_missing"] == 1


def test_claim_collapses_payload_duplicates(client, user, invaders):
    res = client.post(
        "/account/claim",
        json={"captures": [{"invader_id": 1}, {"invader_id": 1}, {"invader_id": 1}]},
        headers=auth_headers(user),
    )
    body = res.json()
    assert body["imported"] == 1
    assert body["skipped_duplicates"] == 2


# ── isolation ──────────────────────────────────────────────────────────────────

def test_claim_only_touches_token_user(client, db, user, invaders):
    other = User(username="bob", email="bob@test.com", hashed_password=hash_password("pw"))
    db.add(other)
    db.flush()

    client.post(
        "/account/claim",
        json={"captures": [{"invader_id": 1}]},
        headers=auth_headers(user),
    )
    db.expire_all()
    assert db.query(UserProgress).filter(UserProgress.user_id == other.id).count() == 0
