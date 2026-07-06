"""
Push notification pipeline: Expo push token registry, the admin-controlled
global switches, and per-user opt-out.

Sending is best-effort by design (mirrors app/core/r2.py's approach to
external side effects): a slow or failing push must never break the caller's
transaction (e.g. an admin approving a request).
"""
import logging
from typing import List, Optional, Tuple

import requests
from sqlalchemy.orm import Session

from ..models.push_token import PushToken
from ..models.notification_settings import NotificationSettings
from ..models.user import User
from ..core.db_utils import safe_commit

log = logging.getLogger("notifications")

EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send"
EXPO_CHUNK_SIZE = 100
SETTINGS_ID = 1


# ── token registry ────────────────────────────────────────────────────────────

def register_token(db: Session, user_id: int, token: str, platform: Optional[str]) -> PushToken:
    """Upsert by token: a device re-registering (app restart, user switch) just
    moves the existing row to the current user instead of duplicating it."""
    existing = db.query(PushToken).filter(PushToken.token == token).first()
    if existing:
        existing.user_id = user_id
        existing.platform = platform
    else:
        existing = PushToken(user_id=user_id, token=token, platform=platform)
        db.add(existing)
    safe_commit(db)
    db.refresh(existing)
    return existing


def unregister_token(db: Session, token: str) -> None:
    db.query(PushToken).filter(PushToken.token == token).delete()
    safe_commit(db)


# ── settings ──────────────────────────────────────────────────────────────────

def get_global_settings(db: Session) -> NotificationSettings:
    settings = db.query(NotificationSettings).filter(NotificationSettings.id == SETTINGS_ID).first()
    if not settings:
        settings = NotificationSettings(id=SETTINGS_ID)
        db.add(settings)
        safe_commit(db)
        db.refresh(settings)
    return settings


def update_global_settings(db: Session, admin_user: User, fields: dict) -> NotificationSettings:
    settings = get_global_settings(db)
    for key, value in fields.items():
        if value is not None:
            setattr(settings, key, value)
    settings.updated_by = admin_user.id
    safe_commit(db)
    db.refresh(settings)
    return settings


def update_user_prefs(db: Session, user: User, fields: dict) -> User:
    for key, value in fields.items():
        if value is not None:
            setattr(user, key, value)
    safe_commit(db)
    db.refresh(user)
    return user


# ── sending ───────────────────────────────────────────────────────────────────

def _recipient_tokens_with_language(db: Session) -> List[Tuple[str, str]]:
    """(token, language) for every device whose owner hasn't opted out."""
    return (
        db.query(PushToken.token, User.language)
        .join(User, User.id == PushToken.user_id)
        .filter(User.notifications_enabled.is_(True))
        .all()
    )


def _send_expo_push(db: Session, messages: List[dict]) -> None:
    """Best-effort delivery via Expo's push API, chunked to its 100-message limit.
    Each message already carries its own (per-recipient-language) title/body.
    Prunes tokens Expo reports as dead (app uninstalled) so we stop paying for them."""
    if not messages:
        return
    dead_tokens: List[str] = []
    for i in range(0, len(messages), EXPO_CHUNK_SIZE):
        chunk = messages[i:i + EXPO_CHUNK_SIZE]
        try:
            res = requests.post(EXPO_PUSH_URL, json=chunk, timeout=10)
            res.raise_for_status()
            tickets = res.json().get("data", [])
            ok_count = 0
            for message, ticket in zip(chunk, tickets):
                token = message["to"]
                if ticket.get("status") != "error":
                    ok_count += 1
                    continue
                error = ticket.get("details", {}).get("error")
                if error == "DeviceNotRegistered":
                    dead_tokens.append(token)
                else:
                    # Surface anything else (e.g. missing FCM/APNs credentials,
                    # rate limits) — these were previously dropped silently.
                    log.warning(
                        "notifications: Expo push ticket error for %s: %s (%s)",
                        token, error, ticket.get("message"),
                    )
            log.info(
                "notifications: Expo accepted %d/%d ticket(s) in this chunk",
                ok_count, len(chunk),
            )
        except Exception as e:
            log.warning("notifications: Expo push send failed for a chunk: %s", e)

    if dead_tokens:
        db.query(PushToken).filter(PushToken.token.in_(dead_tokens)).delete(synchronize_session=False)
        safe_commit(db)


def notify_invader_event(
    db: Session,
    event_type: str,
    texts: dict,
    invader_id: Optional[int],
) -> None:
    """Send a push notification for an invader_added/invader_updated news event,
    gated by the admin-controlled global switches. `texts` maps language code
    to (title, body) — see news_service.notification_texts — so each device
    gets the notification in its owner's language. Never raises: a
    notification failure must not roll back the approval it's attached to."""
    try:
        settings = get_global_settings(db)
        if not settings.enabled:
            log.info("notifications: skipped for invader_id=%s — globally disabled", invader_id)
            return
        if event_type == "invader_added" and not settings.notify_on_create:
            log.info("notifications: skipped invader_added for invader_id=%s — notify_on_create disabled", invader_id)
            return
        if event_type == "invader_updated" and not settings.notify_on_update:
            log.info("notifications: skipped invader_updated for invader_id=%s — notify_on_update disabled", invader_id)
            return
        recipients = _recipient_tokens_with_language(db)
        if not recipients:
            log.info("notifications: skipped for invader_id=%s — no registered push tokens", invader_id)
            return
        fallback_lang = next(iter(texts))
        messages = [
            {
                "to": token,
                "title": texts.get(language, texts[fallback_lang])[0],
                "body": texts.get(language, texts[fallback_lang])[1],
                "data": {"screen": "/news", "invader_id": invader_id},
            }
            for token, language in recipients
        ]
        log.info("notifications: sending invader_id=%s to %d device(s)", invader_id, len(messages))
        _send_expo_push(db, messages)
    except Exception as e:
        log.warning("notifications: notify_invader_event failed: %s", e)
