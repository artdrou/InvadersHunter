"""
Tests for the duplicate-invader guard (invader_service.find_existing / ensure_new).
Key invariants:
- one invader whatever the zero padding / case / separator of its name
- matched on city/number columns or on the name (legacy rows without columns)
- every creation path refuses a duplicate: community submit, admin approve, admin POST
"""
import pytest

from app.core.security import hash_password
from app.models.admin_request import AdminRequest
from app.models.space_invader import Invader
from app.models.user import User
from app.services import invader_service
from tests.conftest import auth_headers


@pytest.fixture()
def users(db):
    regular = User(username="u1", email="u1@test.com", hashed_password=hash_password("pw"))
    admin = User(username="admin", email="admin@test.com", hashed_password=hash_password("pw"), is_admin=True)
    db.add_all([regular, admin])
    db.flush()
    return regular, admin


@pytest.fixture()
def existing(db):
    inv = Invader(name="PA_0010", city="PA", number=10, state="Good")
    legacy = Invader(name="LYO_3", state="Good")   # created before city/number were filled
    db.add_all([inv, legacy])
    db.commit()
    return inv, legacy


@pytest.mark.parametrize("name", ["PA_10", "PA_010", "PA_0010", "pa 10", "pa-10"])
def test_find_existing_ignores_padding_and_case(db, existing, name):
    assert invader_service.find_existing(db, name).id == existing[0].id


def test_find_existing_matches_legacy_rows_by_name(db, existing):
    assert invader_service.find_existing(db, "LYO_03").id == existing[1].id


def test_find_existing_none_for_another_invader(db, existing):
    assert invader_service.find_existing(db, "PA_100") is None
    assert invader_service.find_existing(db, "PAR_10") is None


def test_community_create_of_existing_invader_is_refused(client, users, existing):
    regular, _ = users
    res = client.post("/requests/", json={"request_type": "create", "proposed_name": "pa 10"},
                      headers=auth_headers(regular))
    assert res.status_code == 409
    assert "PA_0010" in res.json()["detail"]


def test_approving_a_create_for_an_existing_invader_is_refused(db, client, users, existing):
    """e.g. a create request that was pending when the invader got added by a sync."""
    _, admin = users
    ar = AdminRequest(request_type="create", status="pending", proposed_name="PA_10",
                      request_count=1, confidence=50, source="community")
    db.add(ar)
    db.commit()
    res = client.post(f"/admin-requests/{ar.id}/approve", headers=auth_headers(admin))
    assert res.status_code == 409
    db.expire_all()
    assert db.get(AdminRequest, ar.id).status == "pending"
    assert db.query(Invader).count() == 2


def test_admin_post_of_existing_invader_is_refused(client, users, existing):
    _, admin = users
    res = client.post("/invaders/", json={"name": "PA_10"}, headers=auth_headers(admin))
    assert res.status_code == 409
