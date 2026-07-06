"""
Tests for the /notifications/* endpoints:
- push token register/unregister (any authenticated user)
- /notifications/me: per-user opt-out prefs
- /notifications/settings: admin-only global switches
"""
import pytest
from app.models.user import User
from app.models.push_token import PushToken
from app.core.security import hash_password
from tests.conftest import auth_headers


@pytest.fixture()
def users(db):
    regular = User(username="u1", email="u1@test.com", hashed_password=hash_password("pw"))
    admin = User(username="admin", email="admin@test.com", hashed_password=hash_password("pw"), is_admin=True)
    db.add_all([regular, admin])
    db.flush()
    return regular, admin


# ── push token registration ───────────────────────────────────────────────────

def test_register_push_token(db, client, users):
    regular, _ = users
    res = client.post(
        "/notifications/push-token",
        json={"token": "ExponentPushToken[abc]", "platform": "ios"},
        headers=auth_headers(regular),
    )
    assert res.status_code == 200

    db.expire_all()
    row = db.query(PushToken).filter(PushToken.token == "ExponentPushToken[abc]").one()
    assert row.user_id == regular.id
    assert row.platform == "ios"


def test_register_push_token_upserts_existing_token(db, client, users):
    regular, admin = users
    client.post(
        "/notifications/push-token",
        json={"token": "ExponentPushToken[shared]", "platform": "ios"},
        headers=auth_headers(regular),
    )
    # Same token re-registers under a different user (device changed hands / reinstall).
    client.post(
        "/notifications/push-token",
        json={"token": "ExponentPushToken[shared]", "platform": "android"},
        headers=auth_headers(admin),
    )

    db.expire_all()
    rows = db.query(PushToken).filter(PushToken.token == "ExponentPushToken[shared]").all()
    assert len(rows) == 1
    assert rows[0].user_id == admin.id
    assert rows[0].platform == "android"


def test_register_push_token_requires_auth(client):
    res = client.post("/notifications/push-token", json={"token": "x", "platform": "ios"})
    assert res.status_code == 401


def test_unregister_push_token(db, client, users):
    regular, _ = users
    client.post(
        "/notifications/push-token",
        json={"token": "ExponentPushToken[gone]", "platform": "ios"},
        headers=auth_headers(regular),
    )
    res = client.delete("/notifications/push-token/ExponentPushToken[gone]", headers=auth_headers(regular))
    assert res.status_code == 200

    db.expire_all()
    assert db.query(PushToken).filter(PushToken.token == "ExponentPushToken[gone]").first() is None


# ── per-user prefs ────────────────────────────────────────────────────────────

def test_get_my_notification_prefs_defaults_enabled(client, users):
    regular, _ = users
    res = client.get("/notifications/me", headers=auth_headers(regular))
    assert res.status_code == 200
    assert res.json() == {"notifications_enabled": True, "language": "fr"}


def test_update_my_notification_prefs(db, client, users):
    regular, _ = users
    res = client.patch("/notifications/me", json={"notifications_enabled": False}, headers=auth_headers(regular))
    assert res.status_code == 200
    assert res.json() == {"notifications_enabled": False, "language": "fr"}

    db.expire_all()
    assert db.query(User).filter(User.id == regular.id).one().notifications_enabled is False


def test_update_my_language(db, client, users):
    regular, _ = users
    res = client.patch("/notifications/me", json={"language": "en"}, headers=auth_headers(regular))
    assert res.status_code == 200
    assert res.json() == {"notifications_enabled": True, "language": "en"}

    db.expire_all()
    assert db.query(User).filter(User.id == regular.id).one().language == "en"


def test_update_my_language_rejects_unsupported_code(client, users):
    regular, _ = users
    res = client.patch("/notifications/me", json={"language": "de"}, headers=auth_headers(regular))
    assert res.status_code == 422


# ── global admin settings ─────────────────────────────────────────────────────

def test_get_global_settings_creates_default_singleton(client, users):
    _, admin = users
    res = client.get("/notifications/settings", headers=auth_headers(admin))
    assert res.status_code == 200
    body = res.json()
    assert body["enabled"] is True
    assert body["notify_on_create"] is True
    assert body["notify_on_update"] is True


def test_update_global_settings(client, users):
    _, admin = users
    res = client.patch(
        "/notifications/settings",
        json={"enabled": False},
        headers=auth_headers(admin),
    )
    assert res.status_code == 200
    assert res.json()["enabled"] is False
    # Untouched fields keep their previous value.
    assert res.json()["notify_on_create"] is True


def test_global_settings_requires_admin(client, users):
    regular, _ = users
    res = client.get("/notifications/settings", headers=auth_headers(regular))
    assert res.status_code == 403
    res = client.patch("/notifications/settings", json={"enabled": False}, headers=auth_headers(regular))
    assert res.status_code == 403
