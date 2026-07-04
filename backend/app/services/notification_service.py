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


def update_user_prefs(db: Session, user: User, notifications_enabled: bool) -> User:
    user.notifications_enabled = notifications_enabled
    safe_commit(db)
    db.refresh(user)
    return user


# ── sending ───────────────────────────────────────────────────────────────────

def _recipient_tokens(db: Session) -> List[str]:
    rows = (
        db.query(PushToken.token)
        .join(User, User.id == PushToken.user_id)
        .filter(User.notifications_enabled.is_(True))
        .all()
    )
    return [t for (t,) in rows]


def _send_expo_push(db: Session, tokens: List[str], title: str, body: str, data: Optional[dict]) -> None:
    """Best-effort delivery via Expo's push API, chunked to its 100-message limit.
    Prunes tokens Expo reports as dead (app uninstalled) so we stop paying for them."""
    if not tokens:
        return
    dead_tokens: List[str] = []
    for i in range(0, len(tokens), EXPO_CHUNK_SIZE):
        chunk = tokens[i:i + EXPO_CHUNK_SIZE]
        messages = [{"to": t, "title": title, "body": body, "data": data or {}} for t in chunk]
        try:
            res = requests.post(EXPO_PUSH_URL, json=messages, timeout=10)
            res.raise_for_status()
            tickets = res.json().get("data", [])
            ok_count = 0
            for token, ticket in zip(chunk, tickets):
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
    title: str,
    body: str,
    invader_id: Optional[int],
) -> None:
    """Send a push notification for an invader_added/invader_updated news event,
    gated by the admin-controlled global switches. Never raises: a notification
    failure must not roll back the approval it's attached to."""
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
        tokens = _recipient_tokens(db)
        if not tokens:
            log.info("notifications: skipped for invader_id=%s — no registered push tokens", invader_id)
            return
        log.info("notifications: sending invader_id=%s to %d device(s)", invader_id, len(tokens))
        _send_expo_push(db, tokens, title, body, {"screen": "/news", "invader_id": invader_id})
    except Exception as e:
        log.warning("notifications: notify_invader_event failed: %s", e)
