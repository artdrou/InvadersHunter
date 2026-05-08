"""
End-to-end lifecycle sequence: create → validate → delete → clean.

Walks a Space Invader through the full workflow:
  1. CREATE   — user submits a "create" request (UserRequest + aggregated AdminRequest)
  2. VALIDATE — admin approves the AdminRequest (Invader is created)
  3. DELETE   — invader is removed via DELETE /invaders/{id} (added to deleted_invaders)
  4. CLEAN    — a fresh request that's then cancelled also drops its orphaned AdminRequest
"""
import pytest
from sqlalchemy import text

from app.models.user import User
from app.models.space_invader import Invader
from app.models.user_request import UserRequest
from app.models.admin_request import AdminRequest
from app.core.security import hash_password
from tests.conftest import auth_headers


@pytest.fixture()
def users(db):
    regular = User(username="alice", email="a@t.com", hashed_password=hash_password("pw"))
    admin = User(username="root", email="r@t.com", hashed_password=hash_password("pw"), is_admin=True)
    db.add_all([regular, admin])
    db.flush()
    return regular, admin


def test_full_create_validate_delete_clean_sequence(db, client, users):
    regular, admin = users

    # ── 1. CREATE ────────────────────────────────────────────────────────────
    res = client.post(
        "/requests/",
        json={
            "request_type": "create",
            "proposed_name": "MAR_42",
            "proposed_latitude": 43.30,
            "proposed_longitude": 5.40,
            "proposed_points": 30,
            "proposed_state": "pristine",
        },
        headers=auth_headers(regular),
    )
    assert res.status_code == 200
    user_req_id = res.json()["id"]

    db.expire_all()
    user_req = db.query(UserRequest).filter(UserRequest.id == user_req_id).one()
    assert user_req.status == "pending"
    assert user_req.admin_request_id is not None

    admin_req_id = user_req.admin_request_id
    admin_req = db.query(AdminRequest).filter(AdminRequest.id == admin_req_id).one()
    assert admin_req.proposed_name == "MAR_42"
    assert admin_req.status == "pending"
    assert admin_req.request_type == "create"

    # ── 2. VALIDATE ──────────────────────────────────────────────────────────
    res = client.post(f"/admin-requests/{admin_req_id}/approve", headers=auth_headers(admin))
    assert res.status_code == 200

    db.expire_all()
    inv = db.query(Invader).filter(Invader.name == "MAR_42").one()
    invader_id = inv.id
    assert inv.latitude == pytest.approx(43.30)
    assert inv.longitude == pytest.approx(5.40)
    assert inv.points == 30
    assert inv.state == "pristine"

    user_req = db.query(UserRequest).filter(UserRequest.id == user_req_id).one()
    admin_req = db.query(AdminRequest).filter(AdminRequest.id == admin_req_id).one()
    assert user_req.status == "processed"
    assert admin_req.status == "approved"
    assert admin_req.invader_id == invader_id

    # ── 3. DELETE ────────────────────────────────────────────────────────────
    res = client.delete(f"/invaders/{invader_id}")
    assert res.status_code == 200

    db.expire_all()
    assert db.query(Invader).filter(Invader.id == invader_id).first() is None

    row = db.execute(
        text("SELECT invader_id FROM deleted_invaders WHERE invader_id = :id"),
        {"id": invader_id},
    ).fetchone()
    assert row is not None and row[0] == invader_id

    # ── 4. CLEAN ─────────────────────────────────────────────────────────────
    # New request → cancelled before validation → orphaned AdminRequest must also be gone
    res = client.post(
        "/requests/",
        json={
            "request_type": "create",
            "proposed_name": "LYO_7",
            "proposed_latitude": 45.76,
            "proposed_longitude": 4.83,
        },
        headers=auth_headers(regular),
    )
    assert res.status_code == 200
    new_req_id = res.json()["id"]

    db.expire_all()
    new_req = db.query(UserRequest).filter(UserRequest.id == new_req_id).one()
    new_admin_req_id = new_req.admin_request_id
    assert new_admin_req_id is not None
    assert db.query(AdminRequest).filter(AdminRequest.id == new_admin_req_id).count() == 1

    res = client.delete(f"/requests/{new_req_id}", headers=auth_headers(regular))
    assert res.status_code == 200

    db.expire_all()
    assert db.query(UserRequest).filter(UserRequest.id == new_req_id).count() == 0
    assert db.query(AdminRequest).filter(AdminRequest.id == new_admin_req_id).count() == 0


def test_clean_keeps_admin_request_when_other_user_requests_remain(db, client, users):
    """If two users submit the same create request, cancelling one must NOT delete the AdminRequest."""
    regular, admin = users
    bob = User(username="bob", email="b@t.com", hashed_password=hash_password("pw"))
    db.add(bob)
    db.flush()

    payload = {
        "request_type": "create",
        "proposed_name": "NAN_3",
        "proposed_latitude": 47.21,
        "proposed_longitude": -1.55,
    }
    r1 = client.post("/requests/", json=payload, headers=auth_headers(regular))
    r2 = client.post("/requests/", json=payload, headers=auth_headers(bob))
    assert r1.status_code == 200 and r2.status_code == 200

    req1_id, req2_id = r1.json()["id"], r2.json()["id"]
    db.expire_all()
    admin_req_id = db.query(UserRequest).filter(UserRequest.id == req1_id).one().admin_request_id
    assert admin_req_id == db.query(UserRequest).filter(UserRequest.id == req2_id).one().admin_request_id

    # Alice cancels — Bob's request still feeds the AdminRequest, so it must survive
    res = client.delete(f"/requests/{req1_id}", headers=auth_headers(regular))
    assert res.status_code == 200

    db.expire_all()
    assert db.query(UserRequest).filter(UserRequest.id == req1_id).count() == 0
    assert db.query(UserRequest).filter(UserRequest.id == req2_id).count() == 1
    assert db.query(AdminRequest).filter(AdminRequest.id == admin_req_id).count() == 1
