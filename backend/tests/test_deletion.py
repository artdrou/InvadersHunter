"""
Tests for cascading deletion of invaders and users (deletion_service).
Key invariants:
- deleting an invader removes its flashes, requests, admin requests, comments and
  reactions, writes a tombstone, and leaves other invaders untouched
- deleting a user removes their flashes, requests, comments, reactions and tokens,
  re-aggregates (or drops) the pending admin requests they voted on, keeps approved
  history, and fixes like/dislike tallies on other people's comments
- DELETE /invaders/{id} is admin-only; DELETE /users/{id} is owner-or-admin
"""
from datetime import datetime, timedelta

import pytest
from sqlalchemy import text

from app.core.security import hash_password
from app.models.admin_request import AdminRequest
from app.models.comment_reaction import CommentReaction
from app.models.invader_comment import InvaderComment
from app.models.push_token import PushToken
from app.models.refresh_token import RefreshToken
from app.models.space_invader import Invader
from app.models.user import User
from app.models.user_progress import UserProgress
from app.models.user_request import UserRequest
from app.services import deletion_service
from app.services.user_request_service import aggregate_request
from tests.conftest import auth_headers


@pytest.fixture()
def world(db):
    """Two invaders, three users, and every kind of row pointing at them."""
    alice = User(username="alice", email="a@test.com", hashed_password=hash_password("pw"))
    bob = User(username="bob", email="b@test.com", hashed_password=hash_password("pw"))
    admin = User(username="admin", email="admin@test.com", hashed_password=hash_password("pw"), is_admin=True)
    target = Invader(name="PA_1", city="PA", number=1, state="Good", latitude=48.8, longitude=2.3)
    other = Invader(name="PA_2", city="PA", number=2, state="Good", latitude=48.9, longitude=2.4)
    db.add_all([alice, bob, admin, target, other])
    db.flush()

    db.add_all([
        UserProgress(user_id=alice.id, invader_id=target.id),
        UserProgress(user_id=bob.id, invader_id=target.id),
        UserProgress(user_id=alice.id, invader_id=other.id),
    ])
    # Pending report on `target` voted by alice AND bob -> one shared admin request
    shared = []
    for u in (alice, bob):
        r = UserRequest(user_id=u.id, invader_id=target.id, request_type="modify", status="pending",
                        proposed_state="Destroyed")
        db.add(r)
        db.flush()
        aggregate_request(db, r)
        shared.append(r)
    # Pending report on `other` voted by alice only
    solo = UserRequest(user_id=alice.id, invader_id=other.id, request_type="modify", status="pending",
                       proposed_state="Degraded")
    db.add(solo)
    db.flush()
    aggregate_request(db, solo)
    # Approved history on `other`, reviewed by admin, proposed by alice
    approved = AdminRequest(invader_id=other.id, request_type="modify", status="approved", source="community",
                            proposed_state="Good", reviewed_by=admin.id, reviewed_at=datetime.utcnow())
    db.add(approved)
    db.flush()
    db.add(UserRequest(user_id=alice.id, invader_id=other.id, request_type="modify", status="processed",
                       proposed_state="Good", admin_request_id=approved.id))

    # Comments: alice on target, bob on other; alice likes bob's comment, bob likes alice's
    c_alice = InvaderComment(invader_id=target.id, user_id=alice.id, body="nice", likes=1)
    c_bob = InvaderComment(invader_id=other.id, user_id=bob.id, body="cool", likes=1, dislikes=0)
    db.add_all([c_alice, c_bob])
    db.flush()
    db.add_all([
        CommentReaction(comment_id=c_bob.id, user_id=alice.id, value=1),
        CommentReaction(comment_id=c_alice.id, user_id=bob.id, value=1),
    ])
    db.add_all([
        PushToken(user_id=alice.id, token="ExponentPushToken[alice]"),
        RefreshToken(user_id=alice.id, token="refresh-alice", expires_at=datetime.utcnow() + timedelta(days=1)),
    ])
    db.commit()
    return dict(alice=alice, bob=bob, admin=admin, target=target, other=other,
                shared_admin_id=shared[0].admin_request_id, solo_admin_id=solo.admin_request_id,
                approved_id=approved.id, c_alice=c_alice.id, c_bob=c_bob.id)


# ── invader ───────────────────────────────────────────────────────────────────

def test_delete_invader_removes_everything_pointing_at_it(db, world):
    target_id, other_id = world["target"].id, world["other"].id
    report = deletion_service.delete_invader(db, target_id)

    assert db.get(Invader, target_id) is None
    assert db.query(UserProgress).filter_by(invader_id=target_id).count() == 0
    assert db.query(UserRequest).filter_by(invader_id=target_id).count() == 0
    assert db.query(AdminRequest).filter_by(invader_id=target_id).count() == 0
    assert db.get(InvaderComment, world["c_alice"]) is None
    assert db.query(CommentReaction).filter_by(comment_id=world["c_alice"]).count() == 0
    tomb = db.execute(text("SELECT invader_id FROM deleted_invaders")).fetchall()
    assert [r[0] for r in tomb] == [target_id]
    assert report.deleted == {"flashes": 2, "user_requests": 2, "admin_requests": 1,
                              "comment_reactions": 1, "comments": 1, "invaders": 1}
    # the other invader is untouched
    assert db.get(Invader, other_id) is not None
    assert db.query(UserProgress).filter_by(invader_id=other_id).count() == 1
    assert db.get(InvaderComment, world["c_bob"]) is not None


def test_delete_invader_reaches_create_requests_through_their_admin_request(db, world):
    """A create request has invader_id NULL: it must still go with the invader it created."""
    created = AdminRequest(invader_id=world["target"].id, request_type="create", status="approved",
                           reviewed_at=datetime.utcnow())
    db.add(created)
    db.flush()
    db.add(UserRequest(user_id=world["bob"].id, invader_id=None, request_type="create", status="processed",
                       proposed_name="PA_1", admin_request_id=created.id))
    db.commit()
    created_id = created.id
    deletion_service.delete_invader(db, world["target"].id)
    assert db.query(UserRequest).filter_by(admin_request_id=created_id).count() == 0


def test_delete_invader_endpoint_is_admin_only(client, world):
    target_id = world["target"].id
    assert client.delete(f"/invaders/{target_id}", headers=auth_headers(world["alice"])).status_code == 403
    res = client.delete(f"/invaders/{target_id}", headers=auth_headers(world["admin"]))
    assert res.status_code == 200
    assert res.json()["deleted"]["flashes"] == 2


# ── user ──────────────────────────────────────────────────────────────────────

def test_delete_user_removes_their_rows_and_keeps_history(db, world):
    alice_id, bob_id = world["alice"].id, world["bob"].id
    report = deletion_service.delete_user(db, alice_id)
    db.expire_all()

    assert db.get(User, alice_id) is None
    for model in (UserProgress, UserRequest, InvaderComment, CommentReaction, PushToken, RefreshToken):
        assert db.query(model).filter_by(user_id=alice_id).count() == 0, model.__name__
    # bob's own data is untouched
    assert db.query(UserProgress).filter_by(user_id=bob_id).count() == 1
    assert db.query(UserRequest).filter_by(user_id=bob_id).count() == 1
    # approved history stays
    assert db.get(AdminRequest, world["approved_id"]).status == "approved"
    assert report.deleted["users"] == 1


def test_delete_user_reaggregates_or_drops_pending_admin_requests(db, world):
    deletion_service.delete_user(db, world["alice"].id)
    db.expire_all()
    shared = db.get(AdminRequest, world["shared_admin_id"])
    assert shared is not None and shared.request_count == 1     # only bob's vote left
    assert db.get(AdminRequest, world["solo_admin_id"]) is None  # nobody left: dropped


def test_delete_user_fixes_reaction_tallies(db, world):
    deletion_service.delete_user(db, world["alice"].id)
    db.expire_all()
    # alice liked bob's comment: its tally goes back down
    assert db.get(InvaderComment, world["c_bob"]).likes == 0
    # alice's own comment (and bob's like on it) are gone
    assert db.get(InvaderComment, world["c_alice"]) is None
    assert db.query(CommentReaction).filter_by(user_id=world["bob"].id).count() == 0


def test_delete_reviewer_clears_reviewed_by(db, world):
    deletion_service.delete_user(db, world["admin"].id)
    db.expire_all()
    approved = db.get(AdminRequest, world["approved_id"])
    assert approved.status == "approved" and approved.reviewed_by is None


def test_delete_user_endpoint_owner_or_admin(client, world):
    alice_id = world["alice"].id
    assert client.delete(f"/users/{alice_id}", headers=auth_headers(world["bob"])).status_code == 403
    res = client.delete(f"/users/{alice_id}", headers=auth_headers(world["alice"]))
    assert res.status_code == 200
    assert res.json()["deleted"]["flashes"] == 2
