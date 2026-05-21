"""
Tests for admin API features added with the admin validation feature:
- GET /admin-requests/  with status / request_type filters
- GET /admin-requests/{id}/submissions
- POST /admin-requests/{id}/approve  with coordinate override
- compute_confidence() scoring function
- GET /invaders/{id}
"""
import pytest
from app.core.security import hash_password
from app.core.name_utils import normalize_name
from app.models.user import User
from app.models.space_invader import Invader
from app.models.user_request import UserRequest
from app.models.admin_request import AdminRequest
from app.services.user_request_service import aggregate_request, compute_confidence
from tests.conftest import auth_headers


# ── shared fixtures ───────────────────────────────────────────────────────────

@pytest.fixture()
def users(db):
    regular = User(username="u1", email="u1@test.com", hashed_password=hash_password("pw"))
    admin   = User(username="adm", email="adm@test.com", hashed_password=hash_password("pw"), is_admin=True)
    db.add_all([regular, admin])
    db.flush()
    return regular, admin


@pytest.fixture()
def invader(db):
    inv = Invader(name="PA_10", latitude=48.8566, longitude=2.3522, state="Good", points=10)
    db.add(inv)
    db.flush()
    return inv


def make_modify_admin_request(db, user_id, invader_id, state="Degraded", lat=48.857, lon=2.353):
    """Submit a UserRequest and trigger aggregation; return the resulting AdminRequest."""
    req = UserRequest(
        user_id=user_id, invader_id=invader_id, request_type="modify", status="pending",
        proposed_name=None, normalized_name=None,
        proposed_state=state, proposed_latitude=lat, proposed_longitude=lon,
    )
    db.add(req)
    db.flush()
    aggregate_request(db, req)
    db.commit()
    return db.query(AdminRequest).filter(AdminRequest.invader_id == invader_id).one()


# ── GET /admin-requests/ filters ─────────────────────────────────────────────

def test_list_filter_by_status_pending(db, client, users, invader):
    regular, admin = users
    ar = make_modify_admin_request(db, regular.id, invader.id)

    res = client.get("/admin-requests/?status=pending", headers=auth_headers(admin))
    assert res.status_code == 200
    ids = [r["id"] for r in res.json()]
    assert ar.id in ids


def test_list_filter_by_status_approved_excludes_pending(db, client, users, invader):
    regular, admin = users
    make_modify_admin_request(db, regular.id, invader.id)

    res = client.get("/admin-requests/?status=approved", headers=auth_headers(admin))
    assert res.status_code == 200
    assert res.json() == []


def test_list_filter_by_request_type_modify(db, client, users, invader):
    regular, admin = users
    ar = make_modify_admin_request(db, regular.id, invader.id)

    res = client.get("/admin-requests/?request_type=modify", headers=auth_headers(admin))
    assert res.status_code == 200
    assert any(r["id"] == ar.id for r in res.json())


def test_list_filter_by_request_type_create_excludes_modify(db, client, users, invader):
    regular, admin = users
    make_modify_admin_request(db, regular.id, invader.id)

    res = client.get("/admin-requests/?request_type=create", headers=auth_headers(admin))
    assert res.status_code == 200
    assert res.json() == []


def test_list_combined_status_and_type_filter(db, client, users, invader):
    regular, admin = users
    ar = make_modify_admin_request(db, regular.id, invader.id)

    res = client.get("/admin-requests/?status=pending&request_type=modify", headers=auth_headers(admin))
    assert res.status_code == 200
    assert any(r["id"] == ar.id for r in res.json())


# ── GET /admin-requests/{id}/submissions ─────────────────────────────────────

def test_submissions_returns_linked_user_requests(db, client, users, invader):
    regular, admin = users
    req = UserRequest(
        user_id=regular.id, invader_id=invader.id, request_type="modify", status="pending",
        proposed_name=None, normalized_name=None,
        proposed_state="Degraded", proposed_latitude=48.857, proposed_longitude=2.353,
    )
    db.add(req)
    db.flush()
    aggregate_request(db, req)
    db.commit()

    ar = db.query(AdminRequest).filter(AdminRequest.invader_id == invader.id).one()

    res = client.get(f"/admin-requests/{ar.id}/submissions", headers=auth_headers(admin))
    assert res.status_code == 200
    data = res.json()
    assert len(data) == 1
    assert data[0]["id"] == req.id


def test_submissions_returns_all_linked_user_requests(db, client, users, invader):
    regular, admin = users
    for i in range(3):
        r = UserRequest(
            user_id=regular.id, invader_id=invader.id, request_type="modify", status="pending",
            proposed_name=None, normalized_name=None,
            proposed_state="Degraded",
            proposed_latitude=48.8500 + i * 0.001,
            proposed_longitude=2.3500 + i * 0.001,
        )
        db.add(r)
        db.flush()
        aggregate_request(db, r)
        db.commit()

    ar = db.query(AdminRequest).filter(AdminRequest.invader_id == invader.id).one()

    res = client.get(f"/admin-requests/{ar.id}/submissions", headers=auth_headers(admin))
    assert res.status_code == 200
    assert len(res.json()) == 3


def test_submissions_404_for_missing_admin_request(db, client, users):
    _, admin = users
    res = client.get("/admin-requests/99999/submissions", headers=auth_headers(admin))
    assert res.status_code == 404


def test_submissions_403_for_non_admin(db, client, users, invader):
    regular, admin = users
    ar = make_modify_admin_request(db, regular.id, invader.id)

    res = client.get(f"/admin-requests/{ar.id}/submissions", headers=auth_headers(regular))
    assert res.status_code == 403


# ── approve with coordinate override ─────────────────────────────────────────

def test_approve_with_override_coords_updates_invader_location(db, client, users, invader):
    regular, admin = users
    ar = make_modify_admin_request(db, regular.id, invader.id, lat=48.857, lon=2.353)

    override = {"override_latitude": 48.9999, "override_longitude": 2.1111}
    res = client.post(f"/admin-requests/{ar.id}/approve", json=override, headers=auth_headers(admin))
    assert res.status_code == 200

    db.expire_all()
    updated = db.query(Invader).filter(Invader.id == invader.id).one()
    assert updated.latitude == pytest.approx(48.9999)
    assert updated.longitude == pytest.approx(2.1111)


def test_approve_without_override_uses_barycenter(db, client, users, invader):
    regular, admin = users
    ar = make_modify_admin_request(db, regular.id, invader.id, lat=48.8500, lon=2.3500)

    res = client.post(f"/admin-requests/{ar.id}/approve", headers=auth_headers(admin))
    assert res.status_code == 200

    db.expire_all()
    updated = db.query(Invader).filter(Invader.id == invader.id).one()
    assert updated.latitude == pytest.approx(48.8500)
    assert updated.longitude == pytest.approx(2.3500)


def test_approve_override_differs_from_barycenter(db, client, users, invader):
    """Override should win over the aggregated barycenter."""
    regular, admin = users
    ar = make_modify_admin_request(db, regular.id, invader.id, lat=48.857, lon=2.353)
    barycenter_lat = ar.proposed_latitude

    override_lat = barycenter_lat + 0.1
    res = client.post(
        f"/admin-requests/{ar.id}/approve",
        json={"override_latitude": override_lat, "override_longitude": 2.353},
        headers=auth_headers(admin),
    )
    assert res.status_code == 200

    db.expire_all()
    updated = db.query(Invader).filter(Invader.id == invader.id).one()
    assert updated.latitude == pytest.approx(override_lat)
    assert updated.latitude != pytest.approx(barycenter_lat)


# ── compute_confidence ────────────────────────────────────────────────────────

class _FakeSub:
    """Minimal stand-in for UserRequest with only the fields compute_confidence reads."""
    def __init__(self, state=None, lat=None, lon=None):
        self.proposed_state     = state
        self.proposed_latitude  = lat
        self.proposed_longitude = lon


def test_confidence_zero_for_empty():
    assert compute_confidence([]) == 0


def test_confidence_single_vote_no_state_no_location():
    subs = [_FakeSub()]
    c = compute_confidence(subs)
    assert 0 <= c <= 100


def test_confidence_grows_with_votes():
    few  = [_FakeSub(state="Degraded") for _ in range(2)]
    many = [_FakeSub(state="Degraded") for _ in range(5)]
    assert compute_confidence(many) >= compute_confidence(few)


def test_confidence_high_when_all_agree_on_state():
    subs = [_FakeSub(state="Degraded") for _ in range(5)]
    assert compute_confidence(subs) >= 75


def test_confidence_lower_when_states_disagree():
    agree    = [_FakeSub(state="Degraded") for _ in range(5)]
    disagree = [_FakeSub(state="Degraded" if i < 3 else "Good") for i in range(5)]
    assert compute_confidence(agree) > compute_confidence(disagree)


def test_confidence_high_for_tight_cluster():
    # Points within ~20 m of each other
    subs = [_FakeSub(lat=48.8500 + i * 0.00001, lon=2.3500) for i in range(5)]
    assert compute_confidence(subs) >= 75


def test_confidence_lower_for_spread_out_locations():
    tight = [_FakeSub(lat=48.8500 + i * 0.00001, lon=2.3500) for i in range(5)]
    # Points ~500 m apart — exceeds the 300 m threshold
    spread = [_FakeSub(lat=48.8500 + i * 0.002, lon=2.3500) for i in range(5)]
    assert compute_confidence(tight) > compute_confidence(spread)


def test_confidence_capped_at_100():
    subs = [_FakeSub(state="Degraded", lat=48.8500 + i * 0.00001, lon=2.3500) for i in range(10)]
    assert compute_confidence(subs) <= 100


def test_confidence_is_integer():
    subs = [_FakeSub(state="active") for _ in range(3)]
    assert isinstance(compute_confidence(subs), int)


# ── GET /invaders/{id} ───────────────────────────────────────────────────────

def test_get_invader_by_id_returns_correct_invader(db, client, invader):
    res = client.get(f"/invaders/{invader.id}")
    assert res.status_code == 200
    data = res.json()
    assert data["id"] == invader.id
    assert data["name"] == "PA_10"


def test_get_invader_by_id_404_for_missing(db, client):
    res = client.get("/invaders/99999")
    assert res.status_code == 404
