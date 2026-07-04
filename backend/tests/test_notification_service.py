"""
Tests for app.services.notification_service: gating (global + per-type +
per-user opt-out) and the Expo push send (chunking, dead-token pruning,
resilience to HTTP failures).
"""
import pytest
from app.models.user import User
from app.models.push_token import PushToken
from app.core.security import hash_password
from app.services import notification_service


class FakeResponse:
    def __init__(self, tickets):
        self._tickets = tickets

    def raise_for_status(self):
        pass

    def json(self):
        return {"data": self._tickets}


@pytest.fixture()
def user_with_token(db):
    user = User(username="u1", email="u1@test.com", hashed_password=hash_password("pw"))
    db.add(user)
    db.flush()
    token = PushToken(user_id=user.id, token="ExponentPushToken[a]", platform="ios")
    db.add(token)
    db.flush()
    return user, token


# ── gating ────────────────────────────────────────────────────────────────────

def test_notify_sends_when_enabled(db, user_with_token, monkeypatch):
    calls = []
    monkeypatch.setattr(
        notification_service.requests, "post",
        lambda url, json, timeout: calls.append(json) or FakeResponse([{"status": "ok"}] * len(json)),
    )

    notification_service.notify_invader_event(db, "invader_added", "Titre", "Corps", 42)

    assert len(calls) == 1
    assert calls[0][0]["to"] == "ExponentPushToken[a]"
    assert calls[0][0]["title"] == "Titre"
    assert calls[0][0]["data"]["invader_id"] == 42
    assert calls[0][0]["data"]["screen"] == "/news"


def test_notify_skipped_when_globally_disabled(db, user_with_token, monkeypatch):
    notification_service.update_global_settings(db, user_with_token[0], {"enabled": False})
    calls = []
    monkeypatch.setattr(notification_service.requests, "post", lambda *a, **k: calls.append(1))

    notification_service.notify_invader_event(db, "invader_added", "Titre", "Corps", 1)

    assert calls == []


@pytest.mark.parametrize(
    "flag,event_type",
    [("notify_on_create", "invader_added"), ("notify_on_update", "invader_updated")],
)
def test_notify_respects_per_type_flag(db, user_with_token, monkeypatch, flag, event_type):
    notification_service.update_global_settings(db, user_with_token[0], {flag: False})
    calls = []
    monkeypatch.setattr(notification_service.requests, "post", lambda *a, **k: calls.append(1))

    notification_service.notify_invader_event(db, event_type, "Titre", "Corps", 1)

    assert calls == []


def test_notify_excludes_opted_out_users(db, user_with_token, monkeypatch):
    user, _ = user_with_token
    user.notifications_enabled = False
    db.flush()
    calls = []
    monkeypatch.setattr(notification_service.requests, "post", lambda *a, **k: calls.append(1))

    notification_service.notify_invader_event(db, "invader_added", "Titre", "Corps", 1)

    assert calls == []


def test_notify_swallows_http_errors(db, user_with_token, monkeypatch):
    def boom(*a, **k):
        raise RuntimeError("network down")
    monkeypatch.setattr(notification_service.requests, "post", boom)

    # Must not raise — a push failure can't break the caller's transaction.
    notification_service.notify_invader_event(db, "invader_added", "Titre", "Corps", 1)


# ── sending internals ─────────────────────────────────────────────────────────

def test_send_expo_push_chunks_over_limit(db, monkeypatch):
    tokens = [f"ExponentPushToken[{i}]" for i in range(150)]
    calls = []
    monkeypatch.setattr(
        notification_service.requests, "post",
        lambda url, json, timeout: calls.append(json) or FakeResponse([{"status": "ok"}] * len(json)),
    )

    notification_service._send_expo_push(db, tokens, "Titre", "Corps", {})

    assert len(calls) == 2
    assert len(calls[0]) == 100
    assert len(calls[1]) == 50


def test_send_expo_push_prunes_dead_tokens(db, user_with_token, monkeypatch):
    _, token = user_with_token
    token_str = token.token
    monkeypatch.setattr(
        notification_service.requests, "post",
        lambda url, json, timeout: FakeResponse(
            [{"status": "error", "details": {"error": "DeviceNotRegistered"}}]
        ),
    )

    notification_service._send_expo_push(db, [token_str], "Titre", "Corps", {})

    assert db.query(PushToken).filter(PushToken.token == token_str).first() is None


def test_send_expo_push_logs_other_errors_without_pruning(db, user_with_token, monkeypatch, caplog):
    """A ticket error that isn't DeviceNotRegistered (e.g. missing FCM/APNs
    credentials) must be logged, not silently dropped, and must not prune the
    token — the device is still valid, delivery just failed this time."""
    _, token = user_with_token
    monkeypatch.setattr(
        notification_service.requests, "post",
        lambda url, json, timeout: FakeResponse(
            [{"status": "error", "details": {"error": "MessageTooBig"}, "message": "boom"}]
        ),
    )

    with caplog.at_level("WARNING", logger="notifications"):
        notification_service._send_expo_push(db, [token.token], "Titre", "Corps", {})

    assert db.query(PushToken).filter(PushToken.token == token.token).first() is not None
    assert any("MessageTooBig" in r.message for r in caplog.records)
