"""
Tests for the invader comment wall: list, create (with auto-moderation),
report, delete. The OpenAI moderation call is always mocked.
"""
import pytest
from unittest.mock import patch

from app.models.user import User
from app.models.space_invader import Invader
from app.models.invader_comment import InvaderComment
from app.services.moderation_service import ModerationResult
from app.core.security import hash_password

from tests.conftest import auth_headers

CLEAN = ModerationResult(flagged=False, categories=[])
FLAGGED = ModerationResult(flagged=True, categories=["harassment", "hate"])

MODERATION_TARGET = "app.services.comment_service.moderation_service.check_text"


@pytest.fixture()
def user(db):
    u = User(username="alice", email="alice@test.com", hashed_password=hash_password("pw"))
    db.add(u)
    db.flush()
    return u


@pytest.fixture()
def other_user(db):
    u = User(username="bob", email="bob@test.com", hashed_password=hash_password("pw"))
    db.add(u)
    db.flush()
    return u


@pytest.fixture()
def admin(db):
    u = User(username="root", email="root@test.com", hashed_password=hash_password("pw"), is_admin=True)
    db.add(u)
    db.flush()
    return u


@pytest.fixture()
def invader(db):
    inv = Invader(id=1, name="PA_0001", state="Good")
    db.add(inv)
    db.flush()
    return inv


# ── create (POST /invaders/{id}/comments) ─────────────────────────────────────

def test_create_requires_auth(client, invader):
    res = client.post(f"/invaders/{invader.id}/comments", json={"body": "hello"})
    assert res.status_code == 401


def test_create_clean_comment_is_visible(client, user, invader):
    with patch(MODERATION_TARGET, return_value=CLEAN):
        res = client.post(
            f"/invaders/{invader.id}/comments",
            json={"body": "Accessible depuis la rue, lever les yeux au 2e etage"},
            headers=auth_headers(user),
        )
    assert res.status_code == 200
    body = res.json()
    assert body["status"] == "visible"
    assert body["username"] == "alice"
    assert body["invader_id"] == invader.id


def test_create_flagged_comment_is_hidden(client, db, user, invader):
    with patch(MODERATION_TARGET, return_value=FLAGGED):
        res = client.post(
            f"/invaders/{invader.id}/comments",
            json={"body": "quelque chose d'insultant"},
            headers=auth_headers(user),
        )
    assert res.status_code == 200
    assert res.json()["status"] == "hidden"

    db.expire_all()
    row = db.query(InvaderComment).first()
    assert row.status == "hidden"
    assert "harassment" in row.flagged_categories


def test_create_when_moderation_down_is_pending_review(client, user, invader):
    with patch(MODERATION_TARGET, return_value=None):
        res = client.post(
            f"/invaders/{invader.id}/comments",
            json={"body": "astuce sympa"},
            headers=auth_headers(user),
        )
    assert res.status_code == 200
    assert res.json()["status"] == "pending_review"  # accepted, queued — never blocking


def test_create_on_unknown_invader_404(client, user):
    with patch(MODERATION_TARGET, return_value=CLEAN):
        res = client.post("/invaders/999/comments", json={"body": "hello"}, headers=auth_headers(user))
    assert res.status_code == 404


def test_create_empty_body_rejected(client, user, invader):
    res = client.post(f"/invaders/{invader.id}/comments", json={"body": ""}, headers=auth_headers(user))
    assert res.status_code == 422


def test_create_too_long_body_rejected(client, user, invader):
    res = client.post(
        f"/invaders/{invader.id}/comments",
        json={"body": "x" * 501},
        headers=auth_headers(user),
    )
    assert res.status_code == 422


# ── list (GET /invaders/{id}/comments) ────────────────────────────────────────

def test_list_is_public(client, db, user, invader):
    db.add(InvaderComment(invader_id=invader.id, user_id=user.id, body="hello", status="visible"))
    db.flush()

    res = client.get(f"/invaders/{invader.id}/comments")  # no auth header
    assert res.status_code == 200
    assert len(res.json()) == 1
    assert res.json()[0]["username"] == "alice"


def test_list_excludes_hidden(client, db, user, invader):
    db.add(InvaderComment(invader_id=invader.id, user_id=user.id, body="ok", status="visible"))
    db.add(InvaderComment(invader_id=invader.id, user_id=user.id, body="bad", status="hidden"))
    db.add(InvaderComment(invader_id=invader.id, user_id=user.id, body="meh", status="pending_review"))
    db.flush()

    res = client.get(f"/invaders/{invader.id}/comments")
    bodies = [c["body"] for c in res.json()]
    assert "ok" in bodies
    assert "meh" in bodies       # pending_review stays visible until an admin rules
    assert "bad" not in bodies


def test_list_newest_first(client, db, user, invader):
    from datetime import datetime, timedelta
    old = datetime.utcnow() - timedelta(hours=1)
    db.add(InvaderComment(invader_id=invader.id, user_id=user.id, body="older", created_at=old))
    db.add(InvaderComment(invader_id=invader.id, user_id=user.id, body="newer"))
    db.flush()

    res = client.get(f"/invaders/{invader.id}/comments")
    assert [c["body"] for c in res.json()] == ["newer", "older"]


def test_list_unknown_invader_404(client):
    res = client.get("/invaders/999/comments")
    assert res.status_code == 404


# ── report (POST /comments/{id}/report) ───────────────────────────────────────

def test_report_requires_auth(client, db, user, invader):
    c = InvaderComment(invader_id=invader.id, user_id=user.id, body="hello")
    db.add(c)
    db.flush()

    res = client.post(f"/comments/{c.id}/report")
    assert res.status_code == 401


def test_report_flags_for_review(client, db, user, other_user, invader):
    c = InvaderComment(invader_id=invader.id, user_id=user.id, body="hello", status="visible")
    db.add(c)
    db.flush()

    res = client.post(f"/comments/{c.id}/report", headers=auth_headers(other_user))
    assert res.status_code == 200
    assert res.json()["status"] == "pending_review"

    db.expire_all()
    assert db.query(InvaderComment).get(c.id).reports == 1


def test_report_hidden_comment_stays_hidden(client, db, user, other_user, invader):
    c = InvaderComment(invader_id=invader.id, user_id=user.id, body="bad", status="hidden")
    db.add(c)
    db.flush()

    res = client.post(f"/comments/{c.id}/report", headers=auth_headers(other_user))
    assert res.json()["status"] == "hidden"


def test_report_unknown_404(client, user):
    res = client.post("/comments/999/report", headers=auth_headers(user))
    assert res.status_code == 404


# ── delete (DELETE /comments/{id}) ────────────────────────────────────────────

def test_delete_own_comment(client, db, user, invader):
    c = InvaderComment(invader_id=invader.id, user_id=user.id, body="hello")
    db.add(c)
    db.flush()

    res = client.delete(f"/comments/{c.id}", headers=auth_headers(user))
    assert res.status_code == 200
    assert db.query(InvaderComment).filter(InvaderComment.id == c.id).first() is None


def test_delete_others_comment_forbidden(client, db, user, other_user, invader):
    c = InvaderComment(invader_id=invader.id, user_id=user.id, body="hello")
    db.add(c)
    db.flush()

    res = client.delete(f"/comments/{c.id}", headers=auth_headers(other_user))
    assert res.status_code == 403
    assert db.query(InvaderComment).filter(InvaderComment.id == c.id).first() is not None


def test_delete_as_admin(client, db, user, admin, invader):
    c = InvaderComment(invader_id=invader.id, user_id=user.id, body="hello")
    db.add(c)
    db.flush()

    res = client.delete(f"/comments/{c.id}", headers=auth_headers(admin))
    assert res.status_code == 200


def test_delete_requires_auth(client, db, user, invader):
    c = InvaderComment(invader_id=invader.id, user_id=user.id, body="hello")
    db.add(c)
    db.flush()

    res = client.delete(f"/comments/{c.id}")
    assert res.status_code == 401


def test_delete_unknown_404(client, user):
    res = client.delete("/comments/999", headers=auth_headers(user))
    assert res.status_code == 404


# ── reactions (POST /comments/{id}/react) ─────────────────────────────────────

def _make_comment(db, invader, user, body="hi", status="visible"):
    c = InvaderComment(invader_id=invader.id, user_id=user.id, body=body, status=status)
    db.add(c)
    db.flush()
    return c


def test_react_requires_auth(client, db, user, invader):
    c = _make_comment(db, invader, user)
    res = client.post(f"/comments/{c.id}/react", json={"value": 1})
    assert res.status_code == 401


def test_like_increments_and_sets_my_reaction(client, db, user, other_user, invader):
    c = _make_comment(db, invader, user)
    res = client.post(f"/comments/{c.id}/react", json={"value": 1}, headers=auth_headers(other_user))
    assert res.status_code == 200
    body = res.json()
    assert body["likes"] == 1 and body["dislikes"] == 0 and body["my_reaction"] == 1


def test_dislike_increments(client, db, user, other_user, invader):
    c = _make_comment(db, invader, user)
    res = client.post(f"/comments/{c.id}/react", json={"value": -1}, headers=auth_headers(other_user))
    body = res.json()
    assert body["dislikes"] == 1 and body["likes"] == 0 and body["my_reaction"] == -1


def test_toggle_like_off(client, db, user, other_user, invader):
    c = _make_comment(db, invader, user)
    client.post(f"/comments/{c.id}/react", json={"value": 1}, headers=auth_headers(other_user))
    res = client.post(f"/comments/{c.id}/react", json={"value": 0}, headers=auth_headers(other_user))
    body = res.json()
    assert body["likes"] == 0 and body["my_reaction"] == 0


def test_switch_like_to_dislike(client, db, user, other_user, invader):
    c = _make_comment(db, invader, user)
    client.post(f"/comments/{c.id}/react", json={"value": 1}, headers=auth_headers(other_user))
    res = client.post(f"/comments/{c.id}/react", json={"value": -1}, headers=auth_headers(other_user))
    body = res.json()
    assert body["likes"] == 0 and body["dislikes"] == 1 and body["my_reaction"] == -1


def test_react_is_one_per_user(client, db, user, other_user, admin, invader):
    c = _make_comment(db, invader, user)
    client.post(f"/comments/{c.id}/react", json={"value": 1}, headers=auth_headers(other_user))
    res = client.post(f"/comments/{c.id}/react", json={"value": 1}, headers=auth_headers(admin))
    assert res.json()["likes"] == 2  # two distinct users


def test_react_unknown_comment_404(client, user):
    res = client.post("/comments/999/react", json={"value": 1}, headers=auth_headers(user))
    assert res.status_code == 404


def test_react_invalid_value_422(client, db, user, other_user, invader):
    c = _make_comment(db, invader, user)
    res = client.post(f"/comments/{c.id}/react", json={"value": 2}, headers=auth_headers(other_user))
    assert res.status_code == 422


def test_list_annotates_my_reaction(client, db, user, other_user, invader):
    c = _make_comment(db, invader, user)
    client.post(f"/comments/{c.id}/react", json={"value": 1}, headers=auth_headers(other_user))

    mine = client.get(f"/invaders/{invader.id}/comments", headers=auth_headers(other_user)).json()[0]
    assert mine["my_reaction"] == 1 and mine["likes"] == 1

    anon = client.get(f"/invaders/{invader.id}/comments").json()[0]
    assert anon["my_reaction"] == 0 and anon["likes"] == 1  # count is public, personal reaction isn't


# ── summary (GET /invaders/{id}/comments/summary) ─────────────────────────────

def test_summary_counts_and_top(client, db, user, other_user, invader):
    _make_comment(db, invader, user, body="meh")
    top = _make_comment(db, invader, user, body="great tip")
    client.post(f"/comments/{top.id}/react", json={"value": 1}, headers=auth_headers(other_user))

    body = client.get(f"/invaders/{invader.id}/comments/summary").json()
    assert body["count"] == 2
    assert body["top"]["body"] == "great tip"
    assert body["top"]["likes"] == 1


def test_summary_top_none_without_likes(client, db, user, invader):
    _make_comment(db, invader, user, body="hi")
    body = client.get(f"/invaders/{invader.id}/comments/summary").json()
    assert body["count"] == 1 and body["top"] is None


def test_summary_excludes_hidden_from_count(client, db, user, invader):
    _make_comment(db, invader, user, body="ok", status="visible")
    _make_comment(db, invader, user, body="bad", status="hidden")
    assert client.get(f"/invaders/{invader.id}/comments/summary").json()["count"] == 1


def test_summary_unknown_invader_404(client):
    assert client.get("/invaders/999/comments/summary").status_code == 404


# ── overview (GET /invaders/{id}/overview) ────────────────────────────────────

def test_overview_bundles_contributors_and_comments(client, db, user, other_user, invader):
    top = _make_comment(db, invader, user, body="great tip")
    client.post(f"/comments/{top.id}/react", json={"value": 1}, headers=auth_headers(other_user))

    body = client.get(f"/invaders/{invader.id}/overview").json()
    assert "contributors" in body and "comments" in body
    assert body["comments"]["count"] == 1
    assert body["comments"]["top"]["body"] == "great tip"
    # no approved requests in this fixture → contributors empty but well-formed
    assert body["contributors"]["created_by"] is None
    assert body["contributors"]["modified_by"] == []


def test_overview_unknown_invader_404(client):
    assert client.get("/invaders/999/overview").status_code == 404


# ── moderation service unit tests ─────────────────────────────────────────────

def test_moderation_returns_none_without_api_key(monkeypatch):
    from app.services import moderation_service
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    assert moderation_service.check_text("hello") is None


def test_moderation_parses_openai_response(monkeypatch):
    from app.services import moderation_service
    monkeypatch.setenv("OPENAI_API_KEY", "sk-test")

    class FakeResponse:
        def raise_for_status(self): ...
        def json(self):
            return {"results": [{"flagged": True, "categories": {"hate": True, "violence": False}}]}

    with patch("app.services.moderation_service.requests.post", return_value=FakeResponse()) as post:
        result = moderation_service.check_text("something nasty")

    assert result == ModerationResult(flagged=True, categories=["hate"])
    assert post.call_args.kwargs["json"]["model"] == "omni-moderation-latest"


def test_moderation_returns_none_on_network_error(monkeypatch):
    from app.services import moderation_service
    monkeypatch.setenv("OPENAI_API_KEY", "sk-test")

    with patch("app.services.moderation_service.requests.post", side_effect=ConnectionError):
        assert moderation_service.check_text("hello") is None
