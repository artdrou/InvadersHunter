"""
Push notification pipeline: Expo push token registry, the admin-controlled
global switches, and per-user opt-out.

Sending is best-effort by design (mirrors app/core/r2.py's approach to
external side effects): a slow or failing push must never break the caller's
transaction (e.g. an admin approving a request).
"""
import logging
from collections import Counter
from typing import Dict, List, Optional, Tuple

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

def register_token(
    db: Session,
    user_id: int,
    token: str,
    platform: Optional[str],
    app_variant: Optional[str] = None,
    server_env: Optional[str] = None,
) -> Optional[PushToken]:
    """Upsert by token: a device re-registering (app restart, user switch) just
    moves the existing row to the current user instead of duplicating it.

    `server_env` is this backend's environment (from the request host). An app
    of another environment (e.g. a prod app sent here by a bad OTA URL) is
    refused, and any copy of its token is dropped. Returns None when refused."""
    existing = db.query(PushToken).filter(PushToken.token == token).first()
    if server_env and app_variant and app_variant != server_env:
        log.warning("notifications: refused %s app token on %s backend", app_variant, server_env)
        if existing:
            db.delete(existing)
            safe_commit(db)
        return None
    if existing:
        existing.user_id = user_id
        existing.platform = platform
        existing.app_variant = app_variant
    else:
        existing = PushToken(user_id=user_id, token=token, platform=platform, app_variant=app_variant)
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

# Only tokens an app registered with its variant. Untagged rows may be copies
# from another environment's database (they reached prod phones from dev).
_REGISTERED_HERE = (PushToken.app_variant.isnot(None),)


def _recipient_tokens_with_language(db: Session) -> List[Tuple[str, str]]:
    """(token, language) for every device whose owner hasn't opted out."""
    return (
        db.query(PushToken.token, User.language)
        .join(User, User.id == PushToken.user_id)
        .filter(User.notifications_enabled.is_(True), *_REGISTERED_HERE)
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


def notify_user(db: Session, user_id: int, texts: dict, data: dict) -> None:
    """Push to every device of one user (unless they opted out). `texts` maps
    language code to (title, body), like notify_invader_event. Not gated by the
    admin's global switches, which only cover invader news. Never raises."""
    try:
        recipients = (
            db.query(PushToken.token, User.language)
            .join(User, User.id == PushToken.user_id)
            .filter(PushToken.user_id == user_id, User.notifications_enabled.is_(True), *_REGISTERED_HERE)
            .all()
        )
        if not recipients:
            return
        fallback_lang = next(iter(texts))
        messages = [
            {
                "to": token,
                "title": texts.get(language, texts[fallback_lang])[0],
                "body": texts.get(language, texts[fallback_lang])[1],
                "data": data,
            }
            for token, language in recipients
        ]
        _send_expo_push(db, messages)
    except Exception as e:
        log.warning("notifications: notify_user failed for user_id=%s: %s", user_id, e)


def _event_allowed(settings: NotificationSettings, event_type: str) -> bool:
    if event_type == "invader_added":
        return bool(settings.notify_on_create)
    if event_type == "invader_updated":
        return bool(settings.notify_on_update)
    return True


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
        if not _event_allowed(settings, event_type):
            log.info("notifications: skipped %s for invader_id=%s — disabled by admin switch", event_type, invader_id)
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


# ── batched sends (scheduled jobs) ────────────────────────────────────────────

# Above this many invader pushes in one run, send a single summary push instead.
MAX_INDIVIDUAL_PUSHES = 10

SUMMARY_TITLE = {"fr": "Du nouveau chez les invaders", "en": "Invader news"}
# kind (news_service.classify_event) -> (singular, plural) per language, in display order.
SUMMARY_PARTS = {
    "create": {"fr": ("{n} nouvel invader", "{n} nouveaux invaders"), "en": ("{n} new invader", "{n} new invaders")},
    "destroyed": {"fr": ("{n} detruit", "{n} detruits"), "en": ("{n} destroyed", "{n} destroyed")},
    "hidden": {"fr": ("{n} non visible", "{n} non visibles"), "en": ("{n} not visible", "{n} not visible")},
    "unknown": {"fr": ("{n} etat inconnu", "{n} etats inconnus"), "en": ("{n} state unknown", "{n} states unknown")},
    "discovered": {"fr": ("{n} decouvert", "{n} decouverts"), "en": ("{n} discovered", "{n} discovered")},
    "reactivated": {"fr": ("{n} reactive", "{n} reactives"), "en": ("{n} reactivated", "{n} reactivated")},
    "degraded": {"fr": ("{n} degrade", "{n} degrades"), "en": ("{n} degraded", "{n} degraded")},
    "restored": {"fr": ("{n} restaure", "{n} restaures"), "en": ("{n} restored", "{n} restored")},
    "state_changed": {"fr": ("{n} changement d'etat", "{n} changements d'etat"),
                      "en": ("{n} state change", "{n} state changes")},
    "moved": {"fr": ("{n} deplace", "{n} deplaces"), "en": ("{n} moved", "{n} moved")},
    "updated": {"fr": ("{n} modifie", "{n} modifies"), "en": ("{n} updated", "{n} updated")},
}


def summary_texts(counts: Dict[str, int]) -> dict:
    """{"fr": (title, body), "en": ...} for "x new invaders, y destroyed, ..." from
    {kind: count} (zero counts left out, no names)."""
    out = {}
    for lang in SUMMARY_TITLE:
        parts = []
        for kind, forms in SUMMARY_PARTS.items():
            n = counts.get(kind, 0)
            if n:
                one, many = forms[lang]
                parts.append((one if n == 1 else many).format(n=n))
        out[lang] = (SUMMARY_TITLE[lang], ", ".join(parts) + ".")
    return out


class InvaderNotificationBatch:
    """Collects the invader pushes of one job run (sync jobs), then flush() sends
    them one by one — or, past MAX_INDIVIDUAL_PUSHES, as one "x new, y destroyed, ..."
    push, so a big sync never floods phones."""

    def __init__(self) -> None:
        self.events: List[Tuple[str, str, dict, Optional[int]]] = []

    def add(self, event_type: str, kind: str, texts: dict, invader_id: Optional[int]) -> None:
        """`kind` is news_service.classify_event's, counted in the summary push."""
        self.events.append((event_type, kind, texts, invader_id))

    def flush(self, db: Session) -> int:
        """Send what was collected; returns how many distinct pushes went out. Never raises."""
        events, self.events = self.events, []
        if len(events) <= MAX_INDIVIDUAL_PUSHES:
            for event_type, _, texts, invader_id in events:
                notify_invader_event(db, event_type, texts, invader_id)
            return len(events)
        try:
            settings = get_global_settings(db)
            if not settings.enabled:
                log.info("notifications: summary skipped — globally disabled")
                return 0
            allowed = [e for e in events if _event_allowed(settings, e[0])]
            if not allowed:
                return 0
            counts = Counter(e[1] for e in allowed)
            texts = summary_texts(counts)
            messages = [
                {
                    "to": token,
                    "title": texts.get(language, texts["fr"])[0],
                    "body": texts.get(language, texts["fr"])[1],
                    "data": {"screen": "/news"},
                }
                for token, language in _recipient_tokens_with_language(db)
            ]
            log.info("notifications: summary push (%s) to %d device(s)", dict(counts), len(messages))
            _send_expo_push(db, messages)
            return 1
        except Exception as e:
            log.warning("notifications: summary push failed: %s", e)
            return 0
