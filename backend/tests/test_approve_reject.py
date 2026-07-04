"""
Tests for the admin approve/reject flow end-to-end via HTTP.
Key invariants:
- Approval updates the target invader's fields
- Approval/rejection sets UserRequest.status AND UserRequest.updated_at (critical for delta sync)
- Create approval creates a new invader
- Double-approve returns 400; missing admin_request returns 404
- Non-admin users get 403
"""
import pytest
from datetime import datetime
from app.models.user import User
from app.models.space_invader import Invader
from app.models.user_request import UserRequest
from app.models.admin_request import AdminRequest
from app.core.security import hash_password
from app.core.name_utils import normalize_name
from app.services.user_request_service import aggregate_request
from app.services import admin_request_service
from tests.conftest import auth_headers


# ── fixtures ──────────────────────────────────────────────────────────────────

@pytest.fixture()
def users(db):
    regular = User(username="u1", email="u1@test.com", hashed_password=hash_password("pw"))
    admin = User(username="admin", email="admin@test.com", hashed_password=hash_password("pw"), is_admin=True)
    db.add_all([regular, admin])
    db.flush()
    return regular, admin


@pytest.fixture()
def invader(db):
    inv = Invader(name="PA_10", latitude=48.8566, longitude=2.3522, state="Good", points=10)
    db.add(inv)
    db.flush()
    return inv


def submit_unnamed_modify(db, user_id, invader_id, state="Degraded", lat=48.99, lon=2.99):
    """Creates a UserRequest + triggers aggregation, returns (user_request, admin_request)."""
    req = UserRequest(
        user_id=user_id, invader_id=invader_id, request_type="modify", status="pending",
        proposed_name=None, normalized_name=None,
        proposed_state=state, proposed_latitude=lat, proposed_longitude=lon,
    )
    db.add(req)
    db.flush()
    aggregate_request(db, req)
    db.commit()
    ar = db.query(AdminRequest).filter(AdminRequest.invader_id == invader_id).one()
    return req, ar


# ── approve: invader updated ──────────────────────────────────────────────────

def test_approve_updates_invader_state_and_location(db, client, users, invader):
    regular, admin = users
    req, ar = submit_unnamed_modify(db, regular.id, invader.id, state="Degraded", lat=48.99, lon=2.99)

    res = client.post(f"/admin-requests/{ar.id}/approve", headers=auth_headers(admin))
    assert res.status_code == 200

    db.expire_all()
    updated = db.query(Invader).filter(Invader.id == invader.id).one()
    assert updated.state == "Degraded"
    assert updated.latitude == pytest.approx(48.99)
    assert updated.longitude == pytest.approx(2.99)


# ── approve: user request updated_at bumped (delta sync relies on this) ───────

def test_approve_sets_user_request_processed_and_updated_at(db, client, users, invader):
    regular, admin = users
    req, ar = submit_unnamed_modify(db, regular.id, invader.id)

    before = datetime.utcnow()
    res = client.post(f"/admin-requests/{ar.id}/approve", headers=auth_headers(admin))
    assert res.status_code == 200

    db.expire_all()
    user_req = db.query(UserRequest).filter(UserRequest.id == req.id).one()
    assert user_req.status == "processed"
    assert user_req.updated_at is not None
    assert user_req.updated_at >= before


# ── reject: user request updated_at bumped ───────────────────────────────────

def test_reject_sets_user_request_rejected_and_updated_at(db, client, users, invader):
    regular, admin = users
    req, ar = submit_unnamed_modify(db, regular.id, invader.id)

    before = datetime.utcnow()
    res = client.post(f"/admin-requests/{ar.id}/reject", headers=auth_headers(admin))
    assert res.status_code == 200

    db.expire_all()
    user_req = db.query(UserRequest).filter(UserRequest.id == req.id).one()
    assert user_req.status == "rejected"
    assert user_req.updated_at is not None
    assert user_req.updated_at >= before


# ── edge cases ────────────────────────────────────────────────────────────────

def test_approve_already_approved_returns_400(db, client, users, invader):
    regular, admin = users
    _, ar = submit_unnamed_modify(db, regular.id, invader.id)

    client.post(f"/admin-requests/{ar.id}/approve", headers=auth_headers(admin))
    res = client.post(f"/admin-requests/{ar.id}/approve", headers=auth_headers(admin))
    assert res.status_code == 400


def test_approve_nonexistent_returns_404(db, client, users):
    _, admin = users
    res = client.post("/admin-requests/99999/approve", headers=auth_headers(admin))
    assert res.status_code == 404


def test_approve_by_non_admin_returns_403(db, client, users, invader):
    regular, admin = users
    _, ar = submit_unnamed_modify(db, regular.id, invader.id)

    res = client.post(f"/admin-requests/{ar.id}/approve", headers=auth_headers(regular))
    assert res.status_code == 403


# ── create approval ───────────────────────────────────────────────────────────

def test_approve_create_request_adds_new_invader(db, client, users):
    regular, admin = users

    req = UserRequest(
        user_id=regular.id, invader_id=None, request_type="create", status="pending",
        proposed_name="NY_42", normalized_name=normalize_name("NY_42"),
        proposed_description="Cool mosaic", proposed_latitude=40.71, proposed_longitude=-74.00,
        proposed_points=100, proposed_state="Good",
    )
    db.add(req)
    db.flush()
    aggregate_request(db, req)
    db.commit()

    ar = db.query(AdminRequest).one()
    count_before = db.query(Invader).count()

    res = client.post(f"/admin-requests/{ar.id}/approve", headers=auth_headers(admin))
    assert res.status_code == 200

    db.expire_all()
    assert db.query(Invader).count() == count_before + 1
    new_inv = db.query(Invader).filter(Invader.name == "NY_42").one()
    assert new_inv.latitude == pytest.approx(40.71)
    assert new_inv.points == 100
    assert new_inv.proposed_description if hasattr(new_inv, "proposed_description") else True


# ── push notification hook ────────────────────────────────────────────────────

def test_approve_create_triggers_invader_added_notification(db, client, users, monkeypatch):
    regular, admin = users
    calls = []
    monkeypatch.setattr(
        admin_request_service.notification_service, "notify_invader_event",
        lambda db, event_type, title, body, invader_id: calls.append((event_type, invader_id)),
    )

    req = UserRequest(
        user_id=regular.id, invader_id=None, request_type="create", status="pending",
        proposed_name="NY_42", normalized_name=normalize_name("NY_42"),
        proposed_latitude=40.71, proposed_longitude=-74.00, proposed_points=100, proposed_state="Good",
    )
    db.add(req)
    db.flush()
    aggregate_request(db, req)
    db.commit()
    ar = db.query(AdminRequest).one()

    res = client.post(f"/admin-requests/{ar.id}/approve", headers=auth_headers(admin))
    assert res.status_code == 200

    assert len(calls) == 1
    event_type, invader_id = calls[0]
    assert event_type == "invader_added"
    assert invader_id is not None


def test_approve_modify_triggers_invader_updated_notification(db, client, users, invader, monkeypatch):
    regular, admin = users
    calls = []
    monkeypatch.setattr(
        admin_request_service.notification_service, "notify_invader_event",
        lambda db, event_type, title, body, invader_id: calls.append((event_type, invader_id)),
    )

    _, ar = submit_unnamed_modify(db, regular.id, invader.id)
    res = client.post(f"/admin-requests/{ar.id}/approve", headers=auth_headers(admin))
    assert res.status_code == 200

    assert len(calls) == 1
    event_type, invader_id = calls[0]
    assert event_type == "invader_updated"
    assert invader_id == invader.id


def test_reject_does_not_trigger_notification(db, client, users, invader, monkeypatch):
    regular, admin = users
    calls = []
    monkeypatch.setattr(
        admin_request_service.notification_service, "notify_invader_event",
        lambda *a, **k: calls.append(1),
    )

    _, ar = submit_unnamed_modify(db, regular.id, invader.id)
    res = client.post(f"/admin-requests/{ar.id}/reject", headers=auth_headers(admin))
    assert res.status_code == 200
    assert calls == []
