"""
Tests for authentication routes: login, refresh, logout, forgot-password,
verify-reset-code, reset-password.
"""
import pytest
from unittest.mock import patch, AsyncMock
from datetime import datetime, timedelta, timezone

from app.models.user import User
from app.models.refresh_token import RefreshToken
from app.core.security import hash_password


@pytest.fixture()
def user(db):
    u = User(username="alice", email="alice@test.com", hashed_password=hash_password("secret"))
    db.add(u)
    db.flush()
    return u


# ── login ──────────────────────────────────────────────────────────────────────

def test_login_success(client, user):
    res = client.post("/auth/login", json={"username": "alice", "password": "secret"})
    assert res.status_code == 200
    body = res.json()
    assert "access_token" in body
    assert "refresh_token" in body
    assert body["token_type"] == "bearer"


def test_login_wrong_password(client, user):
    res = client.post("/auth/login", json={"username": "alice", "password": "wrong"})
    assert res.status_code == 401


def test_login_unknown_user(client):
    res = client.post("/auth/login", json={"username": "ghost", "password": "pw"})
    assert res.status_code == 401


def test_login_stores_refresh_token(client, db, user):
    res = client.post("/auth/login", json={"username": "alice", "password": "secret"})
    token = res.json()["refresh_token"]
    db.expire_all()
    entry = db.query(RefreshToken).filter(RefreshToken.token == token).first()
    assert entry is not None
    assert entry.user_id == user.id
    assert not entry.revoked


# ── refresh ────────────────────────────────────────────────────────────────────

def test_refresh_returns_new_tokens(client, user):
    login = client.post("/auth/login", json={"username": "alice", "password": "secret"})
    old_refresh = login.json()["refresh_token"]

    res = client.post("/auth/refresh", json={"refresh_token": old_refresh})
    assert res.status_code == 200
    body = res.json()
    assert "access_token" in body
    assert body["refresh_token"] != old_refresh  # token was rotated


def test_refresh_revokes_old_token(client, db, user):
    login = client.post("/auth/login", json={"username": "alice", "password": "secret"})
    old_refresh = login.json()["refresh_token"]

    client.post("/auth/refresh", json={"refresh_token": old_refresh})

    db.expire_all()
    entry = db.query(RefreshToken).filter(RefreshToken.token == old_refresh).first()
    assert entry.revoked is True


def test_refresh_invalid_token_returns_401(client):
    res = client.post("/auth/refresh", json={"refresh_token": "not-a-real-token"})
    assert res.status_code == 401


def test_refresh_revoked_token_returns_401(client, db, user):
    login = client.post("/auth/login", json={"username": "alice", "password": "secret"})
    old_refresh = login.json()["refresh_token"]

    client.post("/auth/refresh", json={"refresh_token": old_refresh})  # rotates it
    res = client.post("/auth/refresh", json={"refresh_token": old_refresh})  # reuse old
    assert res.status_code == 401


def test_refresh_expired_token_returns_401(client, db, user):
    entry = RefreshToken(
        token="expired-xyz",
        user_id=user.id,
        expires_at=datetime.now(timezone.utc) - timedelta(days=1),
    )
    db.add(entry)
    db.flush()

    res = client.post("/auth/refresh", json={"refresh_token": "expired-xyz"})
    assert res.status_code == 401


# ── logout ────────────────────────────────────────────────────────────────────

def test_logout_revokes_refresh_token(client, db, user):
    login = client.post("/auth/login", json={"username": "alice", "password": "secret"})
    refresh_token = login.json()["refresh_token"]

    res = client.post("/auth/logout", json={"refresh_token": refresh_token})
    assert res.status_code == 200

    db.expire_all()
    entry = db.query(RefreshToken).filter(RefreshToken.token == refresh_token).first()
    assert entry.revoked is True


def test_logout_after_revocation_refresh_fails(client, user):
    login = client.post("/auth/login", json={"username": "alice", "password": "secret"})
    refresh_token = login.json()["refresh_token"]

    client.post("/auth/logout", json={"refresh_token": refresh_token})
    res = client.post("/auth/refresh", json={"refresh_token": refresh_token})
    assert res.status_code == 401


def test_logout_unknown_token_is_silent(client):
    res = client.post("/auth/logout", json={"refresh_token": "no-such-token"})
    assert res.status_code == 200


# ── forgot-password ────────────────────────────────────────────────────────────

def test_forgot_password_sets_reset_code(client, db, user):
    with patch("app.api.routers.auth.send_reset_password_email", new_callable=AsyncMock):
        res = client.post("/auth/forgot-password", json={"username": "alice", "email": "alice@test.com"})
    assert res.status_code == 200

    db.expire_all()
    db.refresh(user)
    assert user.reset_code is not None
    assert len(user.reset_code) == 6
    assert user.reset_code_expires > datetime.utcnow()


def test_forgot_password_unknown_user_still_200(client):
    with patch("app.api.routers.auth.send_reset_password_email", new_callable=AsyncMock):
        res = client.post("/auth/forgot-password", json={"username": "ghost", "email": "ghost@test.com"})
    assert res.status_code == 200  # no account enumeration


# ── verify-reset-code ─────────────────────────────────────────────────────────

def test_verify_reset_code_valid(client, db, user):
    user.reset_code = "123456"
    user.reset_code_expires = datetime.now(timezone.utc) + timedelta(minutes=10)
    db.flush()

    res = client.post("/auth/verify-reset-code", json={"email": "alice@test.com", "token": "123456"})
    assert res.status_code == 200


def test_verify_reset_code_wrong_code(client, db, user):
    user.reset_code = "123456"
    user.reset_code_expires = datetime.now(timezone.utc) + timedelta(minutes=10)
    db.flush()

    res = client.post("/auth/verify-reset-code", json={"email": "alice@test.com", "token": "999999"})
    assert res.status_code == 400


def test_verify_reset_code_expired(client, db, user):
    user.reset_code = "123456"
    user.reset_code_expires = datetime.now(timezone.utc) - timedelta(minutes=1)
    db.flush()

    res = client.post("/auth/verify-reset-code", json={"email": "alice@test.com", "token": "123456"})
    assert res.status_code == 400


# ── reset-password ────────────────────────────────────────────────────────────

def test_reset_password_allows_login_with_new_password(client, db, user):
    user.reset_code = "654321"
    user.reset_code_expires = datetime.now(timezone.utc) + timedelta(minutes=10)
    db.flush()

    res = client.post("/auth/reset-password", json={
        "email": "alice@test.com", "token": "654321", "new_password": "newpass123",
    })
    assert res.status_code == 200

    login = client.post("/auth/login", json={"username": "alice", "password": "newpass123"})
    assert login.status_code == 200


def test_reset_password_clears_reset_code(client, db, user):
    user.reset_code = "654321"
    user.reset_code_expires = datetime.now(timezone.utc) + timedelta(minutes=10)
    db.flush()

    client.post("/auth/reset-password", json={
        "email": "alice@test.com", "token": "654321", "new_password": "newpass123",
    })

    db.expire_all()
    db.refresh(user)
    assert user.reset_code is None
    assert user.reset_code_expires is None


def test_reset_password_wrong_token(client, db, user):
    user.reset_code = "654321"
    user.reset_code_expires = datetime.now(timezone.utc) + timedelta(minutes=10)
    db.flush()

    res = client.post("/auth/reset-password", json={
        "email": "alice@test.com", "token": "000000", "new_password": "newpass123",
    })
    assert res.status_code == 400


def test_reset_password_old_password_no_longer_works(client, db, user):
    user.reset_code = "654321"
    user.reset_code_expires = datetime.now(timezone.utc) + timedelta(minutes=10)
    db.flush()

    client.post("/auth/reset-password", json={
        "email": "alice@test.com", "token": "654321", "new_password": "newpass123",
    })

    old_login = client.post("/auth/login", json={"username": "alice", "password": "secret"})
    assert old_login.status_code == 401
