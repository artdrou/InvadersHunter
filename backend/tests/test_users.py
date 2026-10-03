"""Tests for user management routes: registration, list, update, delete, auth."""
import pytest
from unittest.mock import patch, AsyncMock

from app.models.user import User
from app.core.security import hash_password

from tests.conftest import auth_headers


@pytest.fixture()
def user(db):
    u = User(username="alice", email="alice@test.com", hashed_password=hash_password("pw"))
    db.add(u)
    db.flush()
    return u


@pytest.fixture()
def admin(db):
    u = User(username="root", email="root@test.com", hashed_password=hash_password("pw"), is_admin=True)
    db.add(u)
    db.flush()
    return u


# ── registration (POST /users/) ───────────────────────────────────────────────

def test_register_creates_user(client):
    with patch("app.services.user_service.send_account_created_email", new_callable=AsyncMock):
        res = client.post("/users/", json={"username": "bob", "email": "bob@test.com", "password": "pass1234"})
    assert res.status_code == 200
    body = res.json()
    assert body["username"] == "bob"
    assert body["email"] == "bob@test.com"
    assert "hashed_password" not in body
    assert body["is_admin"] is False


def test_register_stays_public(client):
    # Registration must NOT require a token — guests create accounts with it
    with patch("app.services.user_service.send_account_created_email", new_callable=AsyncMock):
        res = client.post("/users/", json={"username": "guest1", "email": "g1@test.com", "password": "pass1234"})
    assert res.status_code == 200


def test_register_duplicate_username(client, user):
    with patch("app.services.user_service.send_account_created_email", new_callable=AsyncMock):
        res = client.post("/users/", json={"username": "alice", "email": "other@test.com", "password": "pass1234"})
    assert res.status_code == 400
    assert "Username" in res.json()["detail"]


def test_register_duplicate_email(client, user):
    with patch("app.services.user_service.send_account_created_email", new_callable=AsyncMock):
        res = client.post("/users/", json={"username": "newguy", "email": "alice@test.com", "password": "pass1234"})
    assert res.status_code == 400
    assert "Email" in res.json()["detail"]


# ── list (GET /users/) ────────────────────────────────────────────────────────

def test_list_users_requires_admin(client, user):
    res = client.get("/users/", headers=auth_headers(user))
    assert res.status_code == 403


def test_list_users_requires_auth(client):
    res = client.get("/users/")
    assert res.status_code == 401


def test_list_users_as_admin(client, admin, user):
    res = client.get("/users/", headers=auth_headers(admin))
    assert res.status_code == 200
    usernames = [u["username"] for u in res.json()]
    assert "alice" in usernames


# ── update (PUT /users/{id}) ──────────────────────────────────────────────────

def test_update_username(client, user):
    res = client.put(f"/users/{user.id}", json={"username": "alice2"}, headers=auth_headers(user))
    assert res.status_code == 200
    assert res.json()["username"] == "alice2"


def test_update_requires_auth(client, user):
    res = client.put(f"/users/{user.id}", json={"username": "alice2"})
    assert res.status_code == 401


def test_update_other_user_forbidden(client, db, user):
    other = User(username="bob", email="bob@test.com", hashed_password=hash_password("pw"))
    db.add(other)
    db.flush()

    res = client.put(f"/users/{other.id}", json={"username": "hacked"}, headers=auth_headers(user))
    assert res.status_code == 403


def test_update_email(client, user):
    res = client.put(f"/users/{user.id}", json={"email": "newalice@test.com"}, headers=auth_headers(user))
    assert res.status_code == 200
    assert res.json()["email"] == "newalice@test.com"


def test_update_password_allows_new_login(client, user):
    client.put(f"/users/{user.id}", json={"password": "newpassword"}, headers=auth_headers(user))
    res = client.post("/auth/login", json={"username": "alice", "password": "newpassword"})
    assert res.status_code == 200


def test_update_duplicate_username_rejected(client, db, user):
    other = User(username="bob", email="bob@test.com", hashed_password=hash_password("pw"))
    db.add(other)
    db.flush()

    res = client.put(f"/users/{user.id}", json={"username": "bob"}, headers=auth_headers(user))
    assert res.status_code == 400


def test_update_duplicate_email_rejected(client, db, user):
    other = User(username="bob", email="bob@test.com", hashed_password=hash_password("pw"))
    db.add(other)
    db.flush()

    res = client.put(f"/users/{user.id}", json={"email": "bob@test.com"}, headers=auth_headers(user))
    assert res.status_code == 400


def test_update_same_username_is_fine(client, user):
    res = client.put(f"/users/{user.id}", json={"username": "alice"}, headers=auth_headers(user))
    assert res.status_code == 200


def test_update_not_found(client, admin):
    res = client.put("/users/9999", json={"username": "ghost"}, headers=auth_headers(admin))
    assert res.status_code == 404


def test_update_admin_flag_self_escalation_forbidden(client, user):
    # A regular user must NOT be able to grant themselves admin
    res = client.put(f"/users/{user.id}", json={"is_admin": True}, headers=auth_headers(user))
    assert res.status_code == 403


def test_update_admin_flag_as_admin(client, admin, user):
    res = client.put(f"/users/{user.id}", json={"is_admin": True}, headers=auth_headers(admin))
    assert res.status_code == 200
    assert res.json()["is_admin"] is True


# ── delete (DELETE /users/{id}) ───────────────────────────────────────────────

def test_delete_own_account(client, db, user):
    res = client.delete(f"/users/{user.id}", headers=auth_headers(user))
    assert res.status_code == 200
    assert db.query(User).filter(User.id == user.id).first() is None


def test_delete_requires_auth(client, user):
    res = client.delete(f"/users/{user.id}")
    assert res.status_code == 401


def test_delete_other_user_forbidden(client, db, user):
    other = User(username="bob", email="bob@test.com", hashed_password=hash_password("pw"))
    db.add(other)
    db.flush()

    res = client.delete(f"/users/{other.id}", headers=auth_headers(user))
    assert res.status_code == 403
    assert db.query(User).filter(User.id == other.id).first() is not None


def test_delete_other_user_as_admin(client, db, admin, user):
    res = client.delete(f"/users/{user.id}", headers=auth_headers(admin))
    assert res.status_code == 200


def test_delete_not_found(client, admin):
    res = client.delete("/users/9999", headers=auth_headers(admin))
    assert res.status_code == 404


# ── admin user profile (GET /users/{id}/profile) ──────────────────────────────

def test_user_profile_is_admin_only(client, user, admin):
    assert client.get(f"/users/{user.id}/profile").status_code == 401
    assert client.get(f"/users/{user.id}/profile", headers=auth_headers(user)).status_code == 403
    assert client.get("/users/9999/profile", headers=auth_headers(admin)).status_code == 404


def test_user_profile_stats_and_dates(client, db, user, admin):
    from datetime import datetime, timedelta
    from app.models.space_invader import Invader
    from app.models.user_progress import UserProgress
    from app.models.user_request import UserRequest
    from app.models.admin_request import AdminRequest
    from app.models.invader_comment import InvaderComment
    from app.models.refresh_token import RefreshToken

    a, b = Invader(name="PA_1", state="Good"), Invader(name="PA_2", state="Good")
    db.add_all([a, b])
    db.flush()
    t0 = datetime(2026, 1, 10)
    db.add_all([
        UserProgress(user_id=user.id, invader_id=a.id, found_at=t0),
        UserProgress(user_id=user.id, invader_id=b.id, found_at=t0 + timedelta(days=5)),
    ])
    approved = AdminRequest(invader_id=a.id, request_type="modify", status="approved")
    rejected = AdminRequest(invader_id=b.id, request_type="modify", status="rejected")
    db.add_all([approved, rejected])
    db.flush()
    db.add_all([
        UserRequest(user_id=user.id, invader_id=a.id, request_type="modify", status="processed",
                    admin_request_id=approved.id, created_at=t0),
        UserRequest(user_id=user.id, invader_id=b.id, request_type="modify", status="rejected",
                    admin_request_id=rejected.id, created_at=t0 + timedelta(days=1)),
        UserRequest(user_id=user.id, invader_id=b.id, request_type="modify", status="pending",
                    created_at=t0 + timedelta(days=2)),
        InvaderComment(invader_id=a.id, user_id=user.id, body="hi"),
        RefreshToken(user_id=user.id, token="r1", expires_at=t0 + timedelta(days=30), created_at=t0 + timedelta(days=7)),
    ])
    db.commit()

    res = client.get(f"/users/{user.id}/profile", headers=auth_headers(admin))
    assert res.status_code == 200
    p = res.json()
    assert p["email"] == "alice@test.com" and p["username"] == "alice" and p["is_admin"] is False
    assert sorted(p["flashed_invader_ids"]) == sorted([a.id, b.id])
    assert p["first_flash_at"].startswith("2026-01-10") and p["last_flash_at"].startswith("2026-01-15")
    assert p["last_login_at"].startswith("2026-01-17")
    assert p["last_request_at"].startswith("2026-01-12")
    assert (p["requests_sent"], p["requests_accepted"], p["requests_rejected"], p["requests_pending"]) == (3, 1, 1, 1)
    assert p["comments"] == 1


# ── admin role changes (PUT /users/{id} is_admin) ─────────────────────────────

def test_admin_can_promote_and_demote(client, db, user, admin):
    res = client.put(f"/users/{user.id}", json={"is_admin": True}, headers=auth_headers(admin))
    assert res.status_code == 200 and res.json()["is_admin"] is True
    res = client.put(f"/users/{user.id}", json={"is_admin": False}, headers=auth_headers(admin))
    assert res.status_code == 200 and res.json()["is_admin"] is False


def test_admin_cannot_remove_own_admin_role(client, admin):
    res = client.put(f"/users/{admin.id}", json={"is_admin": False}, headers=auth_headers(admin))
    assert res.status_code == 400


def test_user_cannot_promote_self(client, user):
    res = client.put(f"/users/{user.id}", json={"is_admin": True}, headers=auth_headers(user))
    assert res.status_code == 403
