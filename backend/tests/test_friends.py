"""Tests for the friends feature: invites by username, accept / decline / cancel /
unfriend, the Social overview, the friend profile and account-deletion cleanup."""
import pytest
from unittest.mock import patch

from app.models.friendship import Friendship
from app.models.space_invader import Invader
from app.models.user import User
from app.models.user_progress import UserProgress
from app.core.security import hash_password

from tests.conftest import auth_headers


def _user(db, name):
    u = User(username=name, email=f"{name}@test.com", hashed_password=hash_password("pw"))
    db.add(u)
    db.flush()
    return u


@pytest.fixture()
def alice(db):
    return _user(db, "alice")


@pytest.fixture()
def bob(db):
    return _user(db, "Bob")


@pytest.fixture(autouse=True)
def push():
    """Capture the push notifications instead of calling Expo."""
    with patch("app.services.notification_service.notify_user") as mock:
        yield mock


def _invite(client, sender, username):
    return client.post("/friends/requests", json={"username": username}, headers=auth_headers(sender))


def _overview(client, user):
    res = client.get("/friends/", headers=auth_headers(user))
    assert res.status_code == 200
    return res.json()


def _befriend(client, a, b):
    fid = _invite(client, a, b.username).json()["id"]
    client.post(f"/friends/requests/{fid}/accept", headers=auth_headers(b))
    return fid


# ── invites ───────────────────────────────────────────────────────────────────

def test_invite_creates_pending_and_notifies(client, alice, bob, push):
    res = _invite(client, alice, "Bob")
    assert res.status_code == 200
    assert res.json()["status"] == "pending"
    assert res.json()["accepted"] is False

    assert [e["username"] for e in _overview(client, alice)["outgoing"]] == ["Bob"]
    assert [e["username"] for e in _overview(client, bob)["incoming"]] == ["alice"]
    assert _overview(client, bob)["friends"] == []

    push.assert_called_once()
    _, to_user_id, texts, data = push.call_args.args
    assert to_user_id == bob.id
    assert "alice" in texts["en"][1]
    assert data == {"screen": "/social"}


def test_invite_username_is_case_insensitive(client, alice, bob):
    assert _invite(client, alice, "  bob ").status_code == 200


def test_invite_unknown_user(client, alice):
    res = _invite(client, alice, "nobody")
    assert res.status_code == 404
    assert res.json()["detail"] == "user_not_found"


def test_invite_self(client, alice):
    res = _invite(client, alice, "alice")
    assert res.status_code == 400
    assert res.json()["detail"] == "self"


def test_invite_twice(client, alice, bob):
    _invite(client, alice, "Bob")
    res = _invite(client, alice, "Bob")
    assert res.status_code == 409
    assert res.json()["detail"] == "already_sent"


def test_reverse_invite_accepts(client, db, alice, bob, push):
    _invite(client, alice, "Bob")
    res = _invite(client, bob, "alice")
    assert res.status_code == 200
    assert res.json()["accepted"] is True
    assert db.query(Friendship).count() == 1
    assert [e["username"] for e in _overview(client, alice)["friends"]] == ["Bob"]
    # second push goes back to alice: "Bob accepted"
    assert push.call_args.args[1] == alice.id


def test_invite_requires_auth(client, alice):
    assert client.post("/friends/requests", json={"username": "alice"}).status_code == 401


# ── accept / remove ───────────────────────────────────────────────────────────

def test_accept_makes_both_friends(client, alice, bob, push):
    fid = _invite(client, alice, "Bob").json()["id"]
    res = client.post(f"/friends/requests/{fid}/accept", headers=auth_headers(bob))
    assert res.status_code == 200
    assert [e["username"] for e in _overview(client, alice)["friends"]] == ["Bob"]
    assert [e["username"] for e in _overview(client, bob)["friends"]] == ["alice"]
    assert _overview(client, alice)["outgoing"] == []
    assert push.call_args.args[1] == alice.id

    res = _invite(client, alice, "Bob")
    assert res.status_code == 409
    assert res.json()["detail"] == "already_friends"


def test_requester_cannot_accept_own_invite(client, alice, bob):
    fid = _invite(client, alice, "Bob").json()["id"]
    assert client.post(f"/friends/requests/{fid}/accept", headers=auth_headers(alice)).status_code == 404


def test_decline_and_cancel_and_unfriend(client, db, alice, bob):
    fid = _invite(client, alice, "Bob").json()["id"]
    assert client.delete(f"/friends/{fid}", headers=auth_headers(bob)).status_code == 200  # decline
    assert db.query(Friendship).count() == 0

    fid = _invite(client, alice, "Bob").json()["id"]
    assert client.delete(f"/friends/{fid}", headers=auth_headers(alice)).status_code == 200  # cancel

    fid = _befriend(client, alice, bob)
    assert client.delete(f"/friends/{fid}", headers=auth_headers(bob)).status_code == 200  # unfriend
    assert _overview(client, alice)["friends"] == []


def test_outsider_cannot_remove(client, db, alice, bob):
    carol = _user(db, "carol")
    fid = _invite(client, alice, "Bob").json()["id"]
    assert client.delete(f"/friends/{fid}", headers=auth_headers(carol)).status_code == 404


# ── overview / profile ────────────────────────────────────────────────────────

def test_overview_has_flash_counts(client, db, alice, bob):
    inv = Invader(name="PA_01", latitude=48.0, longitude=2.0, points=10, state="Good")
    db.add(inv)
    db.flush()
    db.add(UserProgress(user_id=bob.id, invader_id=inv.id))
    db.flush()
    _befriend(client, alice, bob)
    assert _overview(client, alice)["friends"][0]["flashed_count"] == 1


def test_friend_profile_shows_game_stats_only(client, db, alice, bob):
    inv = Invader(name="PA_01", latitude=48.0, longitude=2.0, points=10, state="Good")
    db.add(inv)
    db.flush()
    db.add(UserProgress(user_id=bob.id, invader_id=inv.id))
    db.flush()
    _befriend(client, alice, bob)

    res = client.get(f"/friends/users/{bob.id}/profile", headers=auth_headers(alice))
    assert res.status_code == 200
    body = res.json()
    assert body["username"] == "Bob"
    assert body["flashed_invader_ids"] == [inv.id]
    for private in ("email", "language", "notifications_enabled", "last_login_at", "is_admin"):
        assert private not in body


def test_profile_refused_when_not_friends(client, alice, bob):
    assert client.get(f"/friends/users/{bob.id}/profile", headers=auth_headers(alice)).status_code == 403
    _invite(client, alice, "Bob")  # pending is not enough
    assert client.get(f"/friends/users/{bob.id}/profile", headers=auth_headers(alice)).status_code == 403


# ── account deletion ──────────────────────────────────────────────────────────

def test_deleting_user_removes_friendships(client, db, alice, bob):
    _befriend(client, alice, bob)
    assert client.delete(f"/users/{bob.id}", headers=auth_headers(bob)).status_code == 200
    assert db.query(Friendship).count() == 0
    assert _overview(client, alice)["friends"] == []


# ── lookup (suggestion while typing) ──────────────────────────────────────────

def _lookup(client, user, username):
    return client.get("/friends/lookup", params={"username": username}, headers=auth_headers(user))


def test_lookup_returns_real_capitalization(client, alice, bob):
    res = _lookup(client, alice, "bob")
    assert res.status_code == 200
    assert res.json() == {"user_id": bob.id, "username": "Bob", "relation": "none"}


def test_lookup_is_exact_not_partial(client, alice, bob):
    assert _lookup(client, alice, "Bo").status_code == 404


def test_lookup_relations(client, alice, bob):
    assert _lookup(client, alice, "alice").json()["relation"] == "self"
    fid = _invite(client, alice, "Bob").json()["id"]
    assert _lookup(client, alice, "Bob").json()["relation"] == "sent"
    assert _lookup(client, bob, "alice").json()["relation"] == "received"
    client.post(f"/friends/requests/{fid}/accept", headers=auth_headers(bob))
    assert _lookup(client, alice, "Bob").json()["relation"] == "friends"
