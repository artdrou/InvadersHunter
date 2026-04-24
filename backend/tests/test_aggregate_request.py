"""
Tests for request_service.aggregate_request — the aggregation engine that groups
user requests into admin requests.
"""
import pytest
from app.models.user import User
from app.models.space_invader import Invader
from app.models.user_request import UserRequest
from app.models.admin_request import AdminRequest
from app.core.security import hash_password
from app.core.name_utils import normalize_name
from app.services.request_service import aggregate_request


# ── helpers ──────────────────────────────────────────────────────────────────

def make_user(db, username="u1"):
    u = User(username=username, email=f"{username}@test.com", hashed_password=hash_password("pw"))
    db.add(u)
    db.flush()
    return u


def make_invader(db, name="PA_10", lat=48.8566, lon=2.3522, state="pristine"):
    inv = Invader(name=name, latitude=lat, longitude=lon, state=state, points=10)
    db.add(inv)
    db.flush()
    return inv


def make_named_request(db, user_id, invader_id, name="PA_10", state=None, lat=None, lon=None, req_type="modify"):
    norm = normalize_name(name)
    req = UserRequest(
        user_id=user_id, invader_id=invader_id, request_type=req_type, status="pending",
        proposed_name=name, normalized_name=norm,
        proposed_state=state, proposed_latitude=lat, proposed_longitude=lon,
    )
    db.add(req)
    db.flush()
    return req


def make_unnamed_request(db, user_id, invader_id, state=None, lat=None, lon=None):
    req = UserRequest(
        user_id=user_id, invader_id=invader_id, request_type="modify", status="pending",
        proposed_name=None, normalized_name=None,
        proposed_state=state, proposed_latitude=lat, proposed_longitude=lon,
    )
    db.add(req)
    db.flush()
    return req


# ── named modify ──────────────────────────────────────────────────────────────

def test_single_named_modify_creates_admin_request(db):
    user = make_user(db)
    inv = make_invader(db)
    req = make_named_request(db, user.id, inv.id, state="degraded", lat=48.85, lon=2.35)

    aggregate_request(db, req)
    db.flush()

    admin_req = db.query(AdminRequest).one()
    assert admin_req.proposed_name == "PA_10"
    assert admin_req.proposed_state == "degraded"
    assert admin_req.proposed_latitude == pytest.approx(48.85)
    assert admin_req.request_count == 1
    assert req.admin_request_id == admin_req.id


def test_two_named_requests_update_existing_admin_request(db):
    u1, u2 = make_user(db, "u1"), make_user(db, "u2")
    inv = make_invader(db)

    # Points ~222 m apart — both within the 300 m outlier threshold
    r1 = make_named_request(db, u1.id, inv.id, state="degraded", lat=48.8500, lon=2.3500)
    aggregate_request(db, r1)

    r2 = make_named_request(db, u2.id, inv.id, state="degraded", lat=48.8520, lon=2.3520)
    aggregate_request(db, r2)
    db.flush()

    admin_reqs = db.query(AdminRequest).all()
    assert len(admin_reqs) == 1

    ar = admin_reqs[0]
    assert ar.request_count == 2
    assert ar.proposed_latitude == pytest.approx(48.851, abs=0.001)  # midpoint
    assert r1.admin_request_id == ar.id
    assert r2.admin_request_id == ar.id


def test_most_common_name_wins(db):
    users = [make_user(db, f"u{i}") for i in range(3)]
    inv = make_invader(db)

    make_named_request(db, users[0].id, inv.id, name="PA_10", lat=48.85, lon=2.35)
    r1 = db.query(UserRequest).first()
    aggregate_request(db, r1)

    make_named_request(db, users[1].id, inv.id, name="PA_10", lat=48.85, lon=2.35)
    r2 = db.query(UserRequest).filter(UserRequest.id != r1.id).first()
    aggregate_request(db, r2)

    make_named_request(db, users[2].id, inv.id, name="pa_10", lat=48.85, lon=2.35)
    r3 = db.query(UserRequest).order_by(UserRequest.id.desc()).first()
    aggregate_request(db, r3)
    db.flush()

    ar = db.query(AdminRequest).one()
    assert ar.proposed_name == "PA_10"


# ── unnamed modify (location / state only) ────────────────────────────────────

def test_single_unnamed_modify_creates_admin_request(db):
    user = make_user(db)
    inv = make_invader(db)
    req = make_unnamed_request(db, user.id, inv.id, state="destroyed", lat=48.85, lon=2.35)

    aggregate_request(db, req)
    db.flush()

    ar = db.query(AdminRequest).one()
    assert ar.invader_id == inv.id
    assert ar.normalized_name is None
    assert ar.proposed_state == "destroyed"
    assert ar.proposed_latitude == pytest.approx(48.85)
    assert req.admin_request_id == ar.id


def test_two_unnamed_same_invader_update_same_admin_request(db):
    u1, u2 = make_user(db, "u1"), make_user(db, "u2")
    inv = make_invader(db)

    r1 = make_unnamed_request(db, u1.id, inv.id, state="degraded", lat=48.8500, lon=2.3500)
    aggregate_request(db, r1)

    r2 = make_unnamed_request(db, u2.id, inv.id, state="degraded", lat=48.8520, lon=2.3520)
    aggregate_request(db, r2)
    db.flush()

    admin_reqs = db.query(AdminRequest).all()
    assert len(admin_reqs) == 1
    assert admin_reqs[0].request_count == 2


def test_unnamed_different_invaders_create_separate_admin_requests(db):
    user = make_user(db)
    inv1 = make_invader(db, name="PA_10")
    inv2 = make_invader(db, name="PA_11")

    r1 = make_unnamed_request(db, user.id, inv1.id, state="degraded", lat=48.85, lon=2.35)
    aggregate_request(db, r1)

    r2 = make_unnamed_request(db, user.id, inv2.id, state="destroyed", lat=48.90, lon=2.40)
    aggregate_request(db, r2)
    db.flush()

    admin_reqs = db.query(AdminRequest).all()
    assert len(admin_reqs) == 2
    assert {ar.invader_id for ar in admin_reqs} == {inv1.id, inv2.id}


def test_most_common_state_wins(db):
    users = [make_user(db, f"u{i}") for i in range(3)]
    inv = make_invader(db)

    for i, state in enumerate(["degraded", "degraded", "destroyed"]):
        r = make_unnamed_request(db, users[i].id, inv.id, state=state, lat=48.85, lon=2.35)
        aggregate_request(db, r)
    db.flush()

    ar = db.query(AdminRequest).one()
    assert ar.proposed_state == "degraded"


# ── create request ────────────────────────────────────────────────────────────

def test_create_request_propagates_all_fields(db):
    user = make_user(db)
    req = UserRequest(
        user_id=user.id, invader_id=None, request_type="create", status="pending",
        proposed_name="NY_42", normalized_name=normalize_name("NY_42"),
        proposed_description="Cool mosaic", proposed_latitude=40.71, proposed_longitude=-74.00,
        proposed_points=100, proposed_state="pristine",
        proposed_image_url="https://img.example.com/ny42.jpg",
    )
    db.add(req)
    db.flush()

    aggregate_request(db, req)
    db.flush()

    ar = db.query(AdminRequest).one()
    assert ar.proposed_description == "Cool mosaic"
    assert ar.proposed_points == 100
    assert ar.proposed_image_url == "https://img.example.com/ny42.jpg"
    assert ar.proposed_latitude == pytest.approx(40.71)
    assert ar.proposed_state == "pristine"
