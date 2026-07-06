"""
Tests for user request routes: submit (modify & create), list (access control
+ delta sync), get single, and cancel.
"""
import pytest
from datetime import datetime, timedelta, timezone

from app.models.user import User
from app.models.space_invader import Invader
from app.models.user_request import UserRequest
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
    a = User(username="admin", email="admin@test.com", hashed_password=hash_password("pw"), is_admin=True)
    db.add(a)
    db.flush()
    return a


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


# ── submit modify request ─────────────────────────────────────────────────────

def test_submit_modify_success(client, user, invader):
    res = client.post(
        "/requests/",
        json={"request_type": "modify", "invader_id": invader.id, "proposed_state": "Degraded"},
        headers=auth_headers(user),
    )
    assert res.status_code == 200
    body = res.json()
    assert body["request_type"] == "modify"
    assert body["user_id"] == user.id
    assert body["status"] == "pending"


def test_submit_modify_with_location(client, user, invader):
    res = client.post(
        "/requests/",
        json={
            "request_type": "modify",
            "invader_id": invader.id,
            "proposed_latitude": 48.86,
            "proposed_longitude": 2.36,
        },
        headers=auth_headers(user),
    )
    assert res.status_code == 200


def test_submit_modify_requires_invader_id(client, user):
    res = client.post(
        "/requests/",
        json={"request_type": "modify", "proposed_state": "Degraded"},
        headers=auth_headers(user),
    )
    assert res.status_code == 400


def test_submit_duplicate_modify_pending_rejected(client, user, invader):
    client.post(
        "/requests/",
        json={"request_type": "modify", "invader_id": invader.id, "proposed_state": "Degraded"},
        headers=auth_headers(user),
    )
    res = client.post(
        "/requests/",
        json={"request_type": "modify", "invader_id": invader.id, "proposed_state": "Destroyed"},
        headers=auth_headers(user),
    )
    assert res.status_code == 409


# ── submit create request ─────────────────────────────────────────────────────

def test_submit_create_success(client, user):
    res = client.post(
        "/requests/",
        json={"request_type": "create", "proposed_name": "PA_99", "proposed_latitude": 48.85, "proposed_longitude": 2.35},
        headers=auth_headers(user),
    )
    assert res.status_code == 200
    body = res.json()
    assert body["request_type"] == "create"
    assert body["normalized_name"] == "PA_99"


def test_submit_create_normalizes_name(client, user):
    res = client.post(
        "/requests/",
        json={"request_type": "create", "proposed_name": "pa 99"},
        headers=auth_headers(user),
    )
    assert res.status_code == 200
    assert res.json()["normalized_name"] == "PA_99"


def test_submit_create_requires_name(client, user):
    res = client.post(
        "/requests/",
        json={"request_type": "create"},
        headers=auth_headers(user),
    )
    assert res.status_code == 400


def test_submit_create_with_invader_id_rejected(client, user, invader):
    res = client.post(
        "/requests/",
        json={"request_type": "create", "invader_id": invader.id, "proposed_name": "PA_99"},
        headers=auth_headers(user),
    )
    assert res.status_code == 400


# ── authentication guard ──────────────────────────────────────────────────────

def test_submit_without_auth_returns_401(client, invader):
    res = client.post(
        "/requests/",
        json={"request_type": "modify", "invader_id": invader.id},
    )
    assert res.status_code == 401


def test_list_without_auth_returns_401(client):
    res = client.get("/requests/")
    assert res.status_code == 401


# ── list requests (GET /requests/) ────────────────────────────────────────────

def test_list_user_sees_only_own_requests(client, db, user, other_user, invader):
    r1 = UserRequest(user_id=user.id, invader_id=invader.id, request_type="modify", status="pending")
    r2 = UserRequest(user_id=other_user.id, invader_id=invader.id, request_type="modify", status="pending")
    db.add_all([r1, r2])
    db.flush()

    res = client.get("/requests/", headers=auth_headers(user))
    assert res.status_code == 200
    ids = [r["id"] for r in res.json()]
    assert r1.id in ids
    assert r2.id not in ids


def test_list_admin_sees_all_requests(client, db, user, admin, invader):
    r1 = UserRequest(user_id=user.id, invader_id=invader.id, request_type="modify", status="pending")
    db.add(r1)
    db.flush()

    res = client.get("/requests/", headers=auth_headers(admin))
    assert res.status_code == 200
    assert any(r["id"] == r1.id for r in res.json())


def test_list_delta_sync_filters_old_requests(client, db, user, invader):
    old = datetime.now(timezone.utc) - timedelta(hours=2)
    recent = datetime.now(timezone.utc)

    r1 = UserRequest(user_id=user.id, invader_id=invader.id, request_type="modify", status="pending", updated_at=old)
    r2 = UserRequest(user_id=user.id, invader_id=invader.id, request_type="modify", status="processed", updated_at=recent)
    db.add_all([r1, r2])
    db.flush()

    cutoff = (datetime.utcnow() - timedelta(hours=1)).strftime('%Y-%m-%dT%H:%M:%S')
    res = client.get(f"/requests/?updated_since={cutoff}", headers=auth_headers(user))
    assert res.status_code == 200
    ids = [r["id"] for r in res.json()]
    assert r2.id in ids
    assert r1.id not in ids


# ── get single request (GET /requests/{id}) ───────────────────────────────────

def test_get_own_request(client, db, user, invader):
    req = UserRequest(user_id=user.id, invader_id=invader.id, request_type="modify", status="pending")
    db.add(req)
    db.flush()

    res = client.get(f"/requests/{req.id}", headers=auth_headers(user))
    assert res.status_code == 200
    assert res.json()["id"] == req.id


def test_get_other_user_request_returns_403(client, db, user, other_user, invader):
    req = UserRequest(user_id=other_user.id, invader_id=invader.id, request_type="modify", status="pending")
    db.add(req)
    db.flush()

    res = client.get(f"/requests/{req.id}", headers=auth_headers(user))
    assert res.status_code == 403


def test_get_admin_can_access_any_request(client, db, admin, user, invader):
    req = UserRequest(user_id=user.id, invader_id=invader.id, request_type="modify", status="pending")
    db.add(req)
    db.flush()

    res = client.get(f"/requests/{req.id}", headers=auth_headers(admin))
    assert res.status_code == 200


def test_get_request_not_found(client, user):
    res = client.get("/requests/9999", headers=auth_headers(user))
    assert res.status_code == 404


# ── cancel request (DELETE /requests/{id}) ────────────────────────────────────

def test_cancel_pending_request(client, db, user, invader):
    req = UserRequest(user_id=user.id, invader_id=invader.id, request_type="modify", status="pending")
    db.add(req)
    db.flush()

    res = client.delete(f"/requests/{req.id}", headers=auth_headers(user))
    assert res.status_code == 200
    assert db.query(UserRequest).filter(UserRequest.id == req.id).first() is None


def test_cancel_processed_request_rejected(client, db, user, invader):
    req = UserRequest(user_id=user.id, invader_id=invader.id, request_type="modify", status="processed")
    db.add(req)
    db.flush()

    res = client.delete(f"/requests/{req.id}", headers=auth_headers(user))
    assert res.status_code == 400


def test_cancel_other_user_request_returns_403(client, db, user, other_user, invader):
    req = UserRequest(user_id=other_user.id, invader_id=invader.id, request_type="modify", status="pending")
    db.add(req)
    db.flush()

    res = client.delete(f"/requests/{req.id}", headers=auth_headers(user))
    assert res.status_code == 403


def test_cancel_not_found(client, user):
    res = client.delete("/requests/9999", headers=auth_headers(user))
    assert res.status_code == 404


def test_cancel_then_resubmit_works(client, db, user, invader):
    req = UserRequest(user_id=user.id, invader_id=invader.id, request_type="modify", status="pending")
    db.add(req)
    db.flush()

    client.delete(f"/requests/{req.id}", headers=auth_headers(user))

    res = client.post(
        "/requests/",
        json={"request_type": "modify", "invader_id": invader.id, "proposed_state": "Degraded"},
        headers=auth_headers(user),
    )
    assert res.status_code == 200
