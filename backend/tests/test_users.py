"""Tests for user management routes: registration, list, update, delete."""
import pytest
from unittest.mock import patch, AsyncMock

from app.models.user import User
from app.core.security import hash_password


@pytest.fixture()
def user(db):
    u = User(username="alice", email="alice@test.com", hashed_password=hash_password("pw"))
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

def test_list_users_returns_all(client, user):
    res = client.get("/users/")
    assert res.status_code == 200
    usernames = [u["username"] for u in res.json()]
    assert "alice" in usernames


def test_list_users_empty(client):
    res = client.get("/users/")
    assert res.status_code == 200
    assert res.json() == []


# ── update (PUT /users/{id}) ──────────────────────────────────────────────────

def test_update_username(client, user):
    res = client.put(f"/users/{user.id}", json={"username": "alice2"})
    assert res.status_code == 200
    assert res.json()["username"] == "alice2"


def test_update_email(client, user):
    res = client.put(f"/users/{user.id}", json={"email": "newalice@test.com"})
    assert res.status_code == 200
    assert res.json()["email"] == "newalice@test.com"


def test_update_password_allows_new_login(client, user):
    client.put(f"/users/{user.id}", json={"password": "newpassword"})
    res = client.post("/auth/login", json={"username": "alice", "password": "newpassword"})
    assert res.status_code == 200


def test_update_duplicate_username_rejected(client, db, user):
    other = User(username="bob", email="bob@test.com", hashed_password=hash_password("pw"))
    db.add(other)
    db.flush()

    res = client.put(f"/users/{user.id}", json={"username": "bob"})
    assert res.status_code == 400


def test_update_duplicate_email_rejected(client, db, user):
    other = User(username="bob", email="bob@test.com", hashed_password=hash_password("pw"))
    db.add(other)
    db.flush()

    res = client.put(f"/users/{user.id}", json={"email": "bob@test.com"})
    assert res.status_code == 400


def test_update_same_username_is_fine(client, user):
    res = client.put(f"/users/{user.id}", json={"username": "alice"})
    assert res.status_code == 200


def test_update_not_found(client):
    res = client.put("/users/9999", json={"username": "ghost"})
    assert res.status_code == 404


def test_update_admin_flag(client, user):
    res = client.put(f"/users/{user.id}", json={"is_admin": True})
    assert res.status_code == 200
    assert res.json()["is_admin"] is True


# ── delete (DELETE /users/{id}) ───────────────────────────────────────────────

def test_delete_user(client, db, user):
    res = client.delete(f"/users/{user.id}")
    assert res.status_code == 200
    assert db.query(User).filter(User.id == user.id).first() is None


def test_delete_not_found(client):
    res = client.delete("/users/9999")
    assert res.status_code == 404
