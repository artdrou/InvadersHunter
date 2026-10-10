"""
Tests for app.services.notification_service: gating (global + per-type +
per-user opt-out), per-recipient language selection, and the Expo push send
(chunking, dead-token pruning, resilience to HTTP failures).
"""
import pytest
from app.models.user import User
from app.models.push_token import PushToken
from app.core.security import hash_password
from app.services import news_service, notification_service


TEXTS = {"fr": ("Titre", "Corps"), "en": ("Title", "Body")}


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
    token = PushToken(user_id=user.id, token="ExponentPushToken[a]", platform="ios", app_variant="development")
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

    notification_service.notify_invader_event(db, "invader_added", TEXTS, 42)

    assert len(calls) == 1
    assert calls[0][0]["to"] == "ExponentPushToken[a]"
    assert calls[0][0]["title"] == "Titre"  # default User.language is "fr"
    assert calls[0][0]["data"]["invader_id"] == 42
    assert calls[0][0]["data"]["screen"] == "/news"


def test_notify_uses_recipient_language(db, user_with_token, monkeypatch):
    user, _ = user_with_token
    user.language = "en"
    db.flush()
    calls = []
    monkeypatch.setattr(
        notification_service.requests, "post",
        lambda url, json, timeout: calls.append(json) or FakeResponse([{"status": "ok"}] * len(json)),
    )

    notification_service.notify_invader_event(db, "invader_added", TEXTS, 1)

    assert calls[0][0]["title"] == "Title"
    assert calls[0][0]["body"] == "Body"


def test_notify_skipped_when_globally_disabled(db, user_with_token, monkeypatch):
    notification_service.update_global_settings(db, user_with_token[0], {"enabled": False})
    calls = []
    monkeypatch.setattr(notification_service.requests, "post", lambda *a, **k: calls.append(1))

    notification_service.notify_invader_event(db, "invader_added", TEXTS, 1)

    assert calls == []


@pytest.mark.parametrize(
    "flag,event_type",
    [("notify_on_create", "invader_added"), ("notify_on_update", "invader_updated")],
)
def test_notify_respects_per_type_flag(db, user_with_token, monkeypatch, flag, event_type):
    notification_service.update_global_settings(db, user_with_token[0], {flag: False})
    calls = []
    monkeypatch.setattr(notification_service.requests, "post", lambda *a, **k: calls.append(1))

    notification_service.notify_invader_event(db, event_type, TEXTS, 1)

    assert calls == []


def test_notify_excludes_opted_out_users(db, user_with_token, monkeypatch):
    user, _ = user_with_token
    user.notifications_enabled = False
    db.flush()
    calls = []
    monkeypatch.setattr(notification_service.requests, "post", lambda *a, **k: calls.append(1))

    notification_service.notify_invader_event(db, "invader_added", TEXTS, 1)

    assert calls == []


def test_notify_swallows_http_errors(db, user_with_token, monkeypatch):
    def boom(*a, **k):
        raise RuntimeError("network down")
    monkeypatch.setattr(notification_service.requests, "post", boom)

    # Must not raise — a push failure can't break the caller's transaction.
    notification_service.notify_invader_event(db, "invader_added", TEXTS, 1)


# ── sending internals ─────────────────────────────────────────────────────────

def _messages(tokens, title="Titre", body="Corps"):
    return [{"to": t, "title": title, "body": body, "data": {}} for t in tokens]


def test_send_expo_push_chunks_over_limit(db, monkeypatch):
    tokens = [f"ExponentPushToken[{i}]" for i in range(150)]
    calls = []
    monkeypatch.setattr(
        notification_service.requests, "post",
        lambda url, json, timeout: calls.append(json) or FakeResponse([{"status": "ok"}] * len(json)),
    )

    notification_service._send_expo_push(db, _messages(tokens))

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

    notification_service._send_expo_push(db, _messages([token_str]))

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
        notification_service._send_expo_push(db, _messages([token.token]))

    assert db.query(PushToken).filter(PushToken.token == token.token).first() is not None
    assert any("MessageTooBig" in r.message for r in caplog.records)


# ── environments (the 3 databases were copied from one original) ──────────────

def test_untagged_token_is_never_pushed(db, user_with_token, monkeypatch):
    """A token copied from another environment's database has no app_variant."""
    user, token = user_with_token
    token.app_variant = None
    db.flush()
    calls = []
    monkeypatch.setattr(notification_service.requests, "post", lambda *a, **k: calls.append(1))

    notification_service.notify_invader_event(db, "invader_added", TEXTS, 1)
    notification_service.notify_user(db, user.id, TEXTS, {"screen": "/social"})

    assert calls == []


def test_register_tags_the_token(db, user_with_token):
    user, token = user_with_token
    token.app_variant = None
    db.flush()
    saved = notification_service.register_token(
        db, user.id, "ExponentPushToken[a]", "android", app_variant="staging", server_env="staging")
    assert saved.app_variant == "staging"


def test_register_refuses_app_of_another_environment(db, user_with_token):
    """A prod app pointed at the dev backend: refused, and its copied row dropped."""
    user, _ = user_with_token
    saved = notification_service.register_token(
        db, user.id, "ExponentPushToken[a]", "android", app_variant="production", server_env="development")
    assert saved is None
    assert db.query(PushToken).count() == 0


@pytest.mark.parametrize("host, env", [
    ("invader-hunter-development.up.railway.app", "development"),
    ("invader-hunter-staging.up.railway.app", "staging"),
    ("invader-hunter-production.up.railway.app:443", "production"),
    ("localhost:8000", None),
    ("testserver", None),
    (None, None),
])
def test_environment_for_host(host, env):
    from app.core.environment import environment_for_host
    assert environment_for_host(host) == env


# ── batched sends (sync jobs) ─────────────────────────────────────────────────

def _capture_posts(monkeypatch):
    calls = []
    monkeypatch.setattr(
        notification_service.requests, "post",
        lambda url, json, timeout: calls.append(json) or FakeResponse([{"status": "ok"}] * len(json)),
    )
    return calls


def _batch(added, updated):
    batch = notification_service.InvaderNotificationBatch()
    for i in range(added):
        batch.add("invader_added", "create", TEXTS, i)
    for i in range(updated):
        batch.add("invader_updated", "destroyed" if i % 2 else "reactivated", TEXTS, 100 + i)
    return batch


def test_batch_up_to_limit_sends_each_push(db, user_with_token, monkeypatch):
    calls = _capture_posts(monkeypatch)
    sent = _batch(6, notification_service.MAX_INDIVIDUAL_PUSHES - 6).flush(db)
    assert sent == notification_service.MAX_INDIVIDUAL_PUSHES
    assert len(calls) == notification_service.MAX_INDIVIDUAL_PUSHES


def test_batch_over_limit_sends_one_summary(db, user_with_token, monkeypatch):
    calls = _capture_posts(monkeypatch)
    assert _batch(8, 4).flush(db) == 1
    assert len(calls) == 1
    msg = calls[0][0]
    assert msg["body"] == "8 nouveaux invaders, 2 detruits, 2 reactives."   # default language fr
    assert msg["data"] == {"screen": "/news"}


def test_batch_summary_respects_per_type_switch(db, user_with_token, monkeypatch):
    calls = _capture_posts(monkeypatch)
    settings = notification_service.get_global_settings(db)
    settings.notify_on_update = False
    db.commit()
    _batch(11, 5).flush(db)
    assert calls[0][0]["body"] == "11 nouveaux invaders."


def test_summary_texts_singular_and_english():
    texts = notification_service.summary_texts({"create": 1, "state_changed": 1})
    assert texts["fr"][1] == "1 nouvel invader, 1 changement d'etat."
    assert texts["en"][1] == "1 new invader, 1 state change."


def test_summary_texts_counts_each_kind_in_a_fixed_order():
    texts = notification_service.summary_texts({"updated": 1, "destroyed": 3, "create": 2, "degraded": 0})
    assert texts["fr"][1] == "2 nouveaux invaders, 3 detruits, 1 modifie."
    assert texts["en"][1] == "2 new invaders, 3 destroyed, 1 updated."


def test_summary_parts_cover_every_kind():
    assert set(notification_service.SUMMARY_PARTS) == set(news_service.NOTIFICATION_COPY)
