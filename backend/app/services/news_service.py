"""
Business logic for the News feed.

Invader news is *derived* from approved AdminRequests (no duplicated table):
each approved request is a create/modify event, dated by `reviewed_at` and linked
to its invader by `invader_id`. General announcements/releases live in their own
small `announcements` table. Both are merged into one date-sorted feed.
"""
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple

from sqlalchemy.orm import Session

from ..models.admin_request import AdminRequest
from ..models.user_request import UserRequest
from ..models.user import User
from ..models.space_invader import Invader
from ..models.announcement import Announcement
from ..schemas.news import NewsItemOut, AnnouncementCreate

DEFAULT_WINDOW_DAYS = 30
SCRAPER_LABEL = "invader-spotter.art"
ADMIN_LABEL = "Equipe"  # accent-free: the app's pixel font has no accented glyphs

# Canonical state strings (see migrate.py's state-normalization migration).
GOOD_STATE = "Good"
DEGRADED_STATES = {"Slightly degraded", "Degraded", "Badly degraded"}
DESTROYED_STATE = "Destroyed"
HIDDEN_STATE = "Not visible"
_MOVE_EPSILON = 1e-6  # ignore float round-trip noise, not real position changes

# Push notification copy, one entry per supported app language (see
# frontend/src/services/i18n.ts SUPPORTED_LANGUAGES). "{label}" is filled in
# with the invader's name, or a language-appropriate fallback when unnamed.
NOTIFICATION_COPY: Dict[str, Dict[str, Tuple[str, str]]] = {
    "create": {
        "fr": ("Nouvel Invader", "{label} a ete ajoute a la carte."),
        "en": ("New Invader", "{label} was added to the map."),
    },
    "destroyed": {
        "fr": ("Invader detruit", "{label} a ete detruit."),
        "en": ("Invader destroyed", "{label} has been destroyed."),
    },
    "hidden": {
        "fr": ("Invader invisible", "{label} n'est plus visible."),
        "en": ("Invader hidden", "{label} is no longer visible."),
    },
    "reactivated": {
        "fr": ("Invader reactive", "{label} a ete reactive."),
        "en": ("Invader reactivated", "{label} has been reactivated."),
    },
    "degraded": {
        "fr": ("Invader degrade", "{label} s'est degrade."),
        "en": ("Invader degraded", "{label} has degraded."),
    },
    "moved": {
        "fr": ("Invader deplace", "{label} a change d'emplacement."),
        "en": ("Invader moved", "{label}'s location has changed."),
    },
    "updated": {
        "fr": ("Invader mis a jour", "{label} a ete mis a jour."),
        "en": ("Invader updated", "{label} has been updated."),
    },
}
NOTIFICATION_LANGUAGES = ("fr", "en")
DEFAULT_NOTIFICATION_LANGUAGE = "fr"


def _credit_label(db: Session, admin_req: AdminRequest) -> Optional[str]:
    """Who to credit for an invader event, based on the *proposer* (`source`)."""
    if admin_req.source == "scraper":
        return SCRAPER_LABEL
    if admin_req.source == "admin":
        return ADMIN_LABEL
    # community: whoever submitted the first UserRequest feeding this AdminRequest
    row = (
        db.query(User.username)
        .join(UserRequest, UserRequest.user_id == User.id)
        .filter(UserRequest.admin_request_id == admin_req.id)
        .order_by(UserRequest.created_at.asc())
        .first()
    )
    return row[0] if row else None


def list_news(db: Session, before: Optional[datetime], limit: int) -> List[NewsItemOut]:
    """Unified feed, newest first.

    Without `before`: only the last 30 days. With `before` (cursor): items strictly
    older than it, capped at `limit`. Merges invader events + announcements.
    """
    # Compare naive-vs-naive: reviewed_at/created_at are stored as naive UTC.
    if before is not None and before.tzinfo is not None:
        before = before.replace(tzinfo=None)

    invader_q = (
        db.query(AdminRequest, Invader)
        .outerjoin(Invader, Invader.id == AdminRequest.invader_id)
        .filter(AdminRequest.status == "approved", AdminRequest.reviewed_at.isnot(None))
    )
    ann_q = db.query(Announcement)

    if before is not None:
        invader_q = invader_q.filter(AdminRequest.reviewed_at < before)
        ann_q = ann_q.filter(Announcement.created_at < before)
    else:
        cutoff = datetime.utcnow() - timedelta(days=DEFAULT_WINDOW_DAYS)
        invader_q = invader_q.filter(AdminRequest.reviewed_at >= cutoff)
        ann_q = ann_q.filter(Announcement.created_at >= cutoff)

    items: List[NewsItemOut] = []

    for admin_req, invader in invader_q.order_by(AdminRequest.reviewed_at.desc()).limit(limit).all():
        changes: List[str] = []
        if admin_req.proposed_name is not None:
            changes.append("name")
        if admin_req.proposed_state is not None:
            changes.append("state")
        if admin_req.proposed_latitude is not None or admin_req.proposed_longitude is not None:
            changes.append("location")
        if admin_req.proposed_points is not None:
            changes.append("points")
        if admin_req.proposed_image_url is not None:
            changes.append("image")
        if admin_req.proposed_description is not None:
            changes.append("description")
        items.append(NewsItemOut(
            type="invader_added" if admin_req.request_type == "create" else "invader_updated",
            date=admin_req.reviewed_at,
            source=admin_req.source,
            credit_label=_credit_label(db, admin_req),
            invader_id=admin_req.invader_id,
            invader_name=(invader.name if invader else admin_req.proposed_name),
            city=(invader.city if invader else None),
            image_url=(invader.image_url if invader else admin_req.proposed_image_url),
            changes=changes,
            new_state=admin_req.proposed_state,
            new_points=admin_req.proposed_points,
        ))

    for ann in ann_q.order_by(Announcement.created_at.desc()).limit(limit).all():
        items.append(NewsItemOut(
            type="release" if ann.kind == "release" else "announcement",
            date=ann.created_at,
            title=ann.title,
            body=ann.body,
            version=ann.version,
        ))

    items.sort(key=lambda item: item.date, reverse=True)
    return items[:limit]


def _moved(previous_latitude: Optional[float], previous_longitude: Optional[float], invader: Invader) -> bool:
    if previous_latitude is None or previous_longitude is None:
        return False
    if invader.latitude is None or invader.longitude is None:
        return False
    return (
        abs(invader.latitude - previous_latitude) > _MOVE_EPSILON
        or abs(invader.longitude - previous_longitude) > _MOVE_EPSILON
    )


def _classify_transition(
    admin_req: AdminRequest,
    invader: Optional[Invader],
    previous_state: Optional[str],
    previous_latitude: Optional[float],
    previous_longitude: Optional[float],
) -> str:
    """Which NOTIFICATION_COPY entry describes this approved event."""
    if admin_req.request_type == "create":
        return "create"

    new_state = invader.state if invader else None

    if new_state == DESTROYED_STATE and previous_state != DESTROYED_STATE:
        return "destroyed"
    if new_state == HIDDEN_STATE and previous_state != HIDDEN_STATE:
        return "hidden"
    if previous_state in (DESTROYED_STATE, HIDDEN_STATE) and new_state == GOOD_STATE:
        return "reactivated"
    if previous_state == GOOD_STATE and new_state in DEGRADED_STATES:
        return "degraded"
    if invader is not None and _moved(previous_latitude, previous_longitude, invader):
        return "moved"
    return "updated"


def _fallback_label(kind: str, lang: str) -> str:
    if kind == "create":
        return "Un nouvel invader" if lang == "fr" else "A new invader"
    return "Un invader" if lang == "fr" else "An invader"


def notification_texts(
    admin_req: AdminRequest,
    invader: Optional[Invader],
    previous_state: Optional[str] = None,
    previous_latitude: Optional[float] = None,
    previous_longitude: Optional[float] = None,
) -> Dict[str, Tuple[str, str]]:
    """{"fr": (title, body), "en": (title, body)} for the push notification tied
    to a just-approved invader event — the same event that will show up in the
    News feed, one entry per supported app language.

    For "modify" events, `previous_*` are the invader's values *before* this
    approval applied its changes, so the specific transition (degraded,
    destroyed, hidden, reactivated, moved) can be called out — falling back to
    a generic "updated" message for anything else (name/photo/points-only edits).
    """
    name = invader.name if invader else admin_req.proposed_name
    kind = _classify_transition(admin_req, invader, previous_state, previous_latitude, previous_longitude)
    copy = NOTIFICATION_COPY[kind]

    return {
        lang: (title, body_template.format(label=name or _fallback_label(kind, lang)))
        for lang, (title, body_template) in copy.items()
    }


def create_announcement(db: Session, data: AnnouncementCreate) -> Announcement:
    ann = Announcement(kind=data.kind, title=data.title, body=data.body, version=data.version)
    db.add(ann)
    db.flush()
    db.refresh(ann)
    return ann
