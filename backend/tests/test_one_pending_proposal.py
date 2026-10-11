"""
One pending proposal per user and target, so nobody can stack votes:
- a modification: one per invader and detail (location, state…), whatever name it
  carries; different details from one user merge into one AdminRequest
- a creation: one per invader name, whatever its spelling (padding, case, separator)
- the votes / confidence count distinct users, even if a duplicate slips through
"""
from datetime import datetime, timedelta

import pytest

from app.core.security import hash_password
from app.models.admin_request import AdminRequest
from app.models.space_invader import Invader
from app.models.user import User
from app.models.user_request import UserRequest
from app.services.user_request_service import aggregate_request, canonical_name
from tests.conftest import auth_headers


@pytest.fixture()
def users(db):
    rows = [User(username=f"u{i}", email=f"u{i}@t.com", hashed_password=hash_password("pw")) for i in range(2)]
    db.add_all(rows)
    db.commit()
    return rows


@pytest.fixture()
def invader(db):
    inv = Invader(name="PA_10", city="PA", number=10, state="Good")
    db.add(inv)
    db.commit()
    return inv


def _post(client, user, body):
    return client.post("/requests/", json=body, headers=auth_headers(user)).status_code


@pytest.mark.parametrize("raw, canon", [("pa 0099", "PA_99"), ("PA_099", "PA_99"), ("NY_42", "NY_42"), ("SPACE2ISS", "SPACE2ISS")])
def test_canonical_name_ignores_padding_case_and_separator(raw, canon):
    assert canonical_name(raw) == canon


def test_one_pending_modification_per_invader_whatever_the_name(client, db, users, invader):
    u = users[0]
    assert _post(client, u, {"request_type": "modify", "invader_id": invader.id, "proposed_state": "Destroyed"}) == 200
    for name in ("PA_10", "PA_0010", "pa 010"):
        assert _post(client, u, {"request_type": "modify", "invader_id": invader.id,
                                 "proposed_name": name, "proposed_state": "Destroyed"}) == 409
    assert db.query(AdminRequest).count() == 1


def test_same_user_can_propose_other_details_merged_into_one_admin_request(client, db, users, invader):
    u = users[0]
    assert _post(client, u, {"request_type": "modify", "invader_id": invader.id,
                             "proposed_latitude": 48.86, "proposed_longitude": 2.35}) == 200
    # the form sends the current state with it: not a proposal, no conflict
    assert _post(client, u, {"request_type": "modify", "invader_id": invader.id,
                             "proposed_state": "Good", "proposed_points": 30}) == 200
    assert _post(client, u, {"request_type": "modify", "invader_id": invader.id, "proposed_state": "Destroyed"}) == 200
    # a detail already pending: refused
    assert _post(client, u, {"request_type": "modify", "invader_id": invader.id,
                             "proposed_latitude": 48.9, "proposed_longitude": 2.4}) == 409
    assert _post(client, u, {"request_type": "modify", "invader_id": invader.id, "proposed_state": "Hidden"}) == 409
    ar = db.query(AdminRequest).one()
    assert (ar.proposed_latitude, ar.proposed_points, ar.proposed_state) == (48.86, 30, "Destroyed")
    assert ar.request_count == 1          # one person


def test_votes_add_up_per_detail_across_users(client, db, users, invader):
    assert _post(client, users[0], {"request_type": "modify", "invader_id": invader.id, "proposed_state": "Destroyed"}) == 200
    assert _post(client, users[1], {"request_type": "modify", "invader_id": invader.id, "proposed_state": "Destroyed",
                                    "proposed_latitude": 48.86, "proposed_longitude": 2.35}) == 200
    ar = db.query(AdminRequest).one()
    assert (ar.request_count, ar.proposed_state, ar.proposed_latitude) == (2, "Destroyed", 48.86)


def test_one_pending_creation_per_name_whatever_the_spelling(client, db, users):
    u = users[0]
    assert _post(client, u, {"request_type": "create", "proposed_name": "PA_99"}) == 200
    for name in ("PA_099", "pa 0099"):
        assert _post(client, u, {"request_type": "create", "proposed_name": name}) == 409


def test_spelling_variants_from_different_users_are_one_proposal(client, db, users):
    assert _post(client, users[0], {"request_type": "create", "proposed_name": "PA_99"}) == 200
    assert _post(client, users[1], {"request_type": "create", "proposed_name": "PA_099"}) == 200
    ar = db.query(AdminRequest).one()
    assert (ar.normalized_name, ar.request_count) == ("PA_99", 2)


def test_votes_count_people_not_requests(db, users, invader):
    """A duplicate that slipped past the API check (e.g. two simultaneous sends)."""
    now = datetime.utcnow()
    for i in range(10):
        db.add(UserRequest(user_id=users[0].id, invader_id=invader.id, request_type="modify", status="pending",
                           proposed_state="Destroyed", created_at=now + timedelta(seconds=i)))
    last = UserRequest(user_id=users[0].id, invader_id=invader.id, request_type="modify", status="pending",
                       proposed_state="Destroyed", created_at=now + timedelta(seconds=11))
    db.add(last)
    db.flush()
    aggregate_request(db, last)
    db.commit()
    ar = db.query(AdminRequest).one()
    assert ar.request_count == 1                      # one person, not 11 requests
    assert db.query(UserRequest).filter(UserRequest.admin_request_id == ar.id).count() == 11
