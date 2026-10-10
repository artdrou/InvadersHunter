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
INVADERQUEST_LABEL = "InvaderQuest"
ADMIN_LABEL = "Equipe"  # accent-free: the app's pixel font has no accented glyphs

# Canonical state strings (see migrate.py's state-normalization migration).
# Wear order: a move right is a degradation, a move left a restoration.
WEAR_ORDER = ("Good", "Slightly degraded", "Degraded", "Badly degraded")
DESTROYED_STATE = "Destroyed"
HIDDEN_STATE = "Not visible"
UNKNOWN_STATE = "Unknown"
IQ_DAMAGED_STATE = "Degraded"   # InvaderQuest's single "damaged" level (invaderquest_client.STATUS_MAP)
_MOVE_EPSILON = 1e-6  # ignore float round-trip noise, not real position changes

# Push notification copy, one entry per supported app language (see
# frontend/src/services/i18n.ts SUPPORTED_LANGUAGES). "{label}" is filled in
# with the invader's name, or a language-appropriate fallback when unnamed.
# Titles double as the News feed labels: frontend locales `news.kind<Kind>`
# must match them (tests/test_notification_text.py checks it).
NOTIFICATION_COPY: Dict[str, Dict[str, Tuple[str, str]]] = {
    "create": {
        "fr": ("Nouvel invader", "{label} a ete ajoute a la carte."),
        "en": ("New invader", "{label} was added to the map."),
    },
    "destroyed": {
        "fr": ("Invader detruit", "{label} a ete detruit."),
        "en": ("Invader destroyed", "{label} has been destroyed."),
    },
    "hidden": {
        "fr": ("Invader non visible", "{label} n'est plus visible."),
        "en": ("Invader not visible", "{label} is no longer visible."),
    },
    "unknown": {
        "fr": ("Etat inconnu", "{label} n'a plus d'etat connu."),
        "en": ("State unknown", "{label}'s state is now unknown."),
    },
    "discovered": {
        "fr": ("Invader decouvert", "{label} a ete decouvert."),
        "en": ("Invader discovered", "{label} has been discovered."),
    },
    "reactivated": {
        "fr": ("Invader reactive", "{label} a ete reactive."),
        "en": ("Invader reactivated", "{label} has been reactivated."),
    },
    "degraded": {
        "fr": ("Invader degrade", "{label} s'est degrade."),
        "en": ("Invader degraded", "{label} has degraded."),
    },
    "restored": {
        "fr": ("Invader restaure", "{label} a ete restaure."),
        "en": ("Invader restored", "{label} has been restored."),
    },
    "state_changed": {
        "fr": ("Etat modifie", "{label} a change d'etat."),
        "en": ("State changed", "{label}'s state has changed."),
    },
    "moved": {
        "fr": ("Invader deplace", "{label} a change d'emplacement."),
        "en": ("Invader moved", "{label}'s location has changed."),
    },
    "updated": {
        "fr": ("Invader modifie", "{label} a ete modifie."),
        "en": ("Invader updated", "{label} has been updated."),
    },
}
NOTIFICATION_LANGUAGES = ("fr", "en")
DEFAULT_NOTIFICATION_LANGUAGE = "fr"


def _credit_label(db: Session, admin_req: AdminRequest) -> Optional[str]:
    """Who to credit for an invader event, based on the *proposer* (`source`)."""
    if admin_req.source == "scraper":
        return SCRAPER_LABEL
    if admin_req.source == "invaderquest":
        return INVADERQUEST_LABEL
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
            kind=classify_event(
                admin_req.request_type, admin_req.previous_state, admin_req.proposed_state,
                moved="location" in changes,
                located="location" in changes and admin_req.previous_located is False,
                refined=admin_req.refines_state is True,
            ),
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


def is_state_refinement(
    db: Session, invader_id: Optional[int], source: Optional[str],
    previous_state: Optional[str], new_state: Optional[str],
) -> bool:
    """Does this state change only make precise InvaderQuest's coarse "damaged" level?

    InvaderQuest has a single "damaged" status, stored as Degraded. When the site later
    gives the exact level (Slightly / Badly degraded), that's a precision, not the
    invader wearing or being repaired. Call before the change is approved."""
    if (invader_id is None or source == "invaderquest" or previous_state != IQ_DAMAGED_STATE
            or new_state not in WEAR_ORDER[1:] or new_state == previous_state):
        return False
    last = (
        db.query(AdminRequest.source)
        .filter(
            AdminRequest.invader_id == invader_id,
            AdminRequest.status == "approved",
            AdminRequest.proposed_state.isnot(None),
        )
        .order_by(AdminRequest.reviewed_at.desc(), AdminRequest.id.desc())
        .first()
    )
    return last is not None and last[0] == "invaderquest"


def classify_event(
    request_type: str, previous_state: Optional[str], new_state: Optional[str], moved: bool,
    located: bool = False, refined: bool = False,
) -> str:
    """Nature of an approved invader event — one of the NOTIFICATION_COPY keys.

    Shared by push notifications and the News feed `kind` (label + colour), so
    both always name an event the same way. `previous_state` is None for rows
    approved before it was recorded: any proposed state then counts as a change.
    `located`: an invader without location just got its first one ("discovered",
    unless it's at the same time destroyed / hidden / lost track of).
    `refined`: see is_state_refinement — neither a degradation nor a restoration.
    """
    if request_type == "create":
        return "create"
    if located and new_state not in (DESTROYED_STATE, HIDDEN_STATE, UNKNOWN_STATE):
        return "discovered"
    if new_state is None or new_state == previous_state:
        return "moved" if moved else "updated"
    if new_state == DESTROYED_STATE:
        return "destroyed"
    if new_state == HIDDEN_STATE:
        return "hidden"
    if new_state == UNKNOWN_STATE:
        return "unknown"
    if refined:
        return "state_changed"
    good = WEAR_ORDER[0]
    # Only a fresh mosaic (back to Good) is a reactivation: "Destroyed -> Badly degraded"
    # means it was still there, worn. Along the wear scale, worse = degraded, better = restored.
    if previous_state in (DESTROYED_STATE, HIDDEN_STATE) and new_state in WEAR_ORDER:
        return "reactivated" if new_state == good else "degraded"
    if previous_state == UNKNOWN_STATE and new_state in WEAR_ORDER:
        return "discovered" if new_state == good else "degraded"
    if previous_state in WEAR_ORDER and new_state in WEAR_ORDER:
        if WEAR_ORDER.index(new_state) > WEAR_ORDER.index(previous_state):
            return "degraded"
        return "restored"
    return "state_changed"


def _classify_transition(
    admin_req: AdminRequest,
    invader: Optional[Invader],
    previous_state: Optional[str],
    previous_latitude: Optional[float],
    previous_longitude: Optional[float],
) -> str:
    """Which NOTIFICATION_COPY entry describes this just-approved event."""
    located = (
        invader is not None
        and (previous_latitude is None or previous_longitude is None)
        and invader.latitude is not None and invader.longitude is not None
    )
    return classify_event(
        admin_req.request_type,
        previous_state,
        invader.state if invader else None,
        invader is not None and _moved(previous_latitude, previous_longitude, invader),
        located=located,
        refined=admin_req.refines_state is True,
    )


def _fallback_label(kind: str, lang: str) -> str:
    if kind == "create":
        return "Un nouvel invader" if lang == "fr" else "A new invader"
    return "Un invader" if lang == "fr" else "An invader"


def notification_event(
    admin_req: AdminRequest,
    invader: Optional[Invader],
    previous_state: Optional[str] = None,
    previous_latitude: Optional[float] = None,
    previous_longitude: Optional[float] = None,
) -> Tuple[str, Dict[str, Tuple[str, str]]]:
    """(kind, {"fr": (title, body), "en": (title, body)}) for the push notification
    tied to a just-approved invader event — the same event that will show up in
    the News feed, one entry per supported app language.

    For "modify" events, `previous_*` are the invader's values *before* this
    approval applied its changes, so the specific transition can be called out.
    """
    name = invader.name if invader else admin_req.proposed_name
    kind = _classify_transition(admin_req, invader, previous_state, previous_latitude, previous_longitude)
    texts = {
        lang: (title, body_template.format(label=name or _fallback_label(kind, lang)))
        for lang, (title, body_template) in NOTIFICATION_COPY[kind].items()
    }
    return kind, texts


def notification_texts(
    admin_req: AdminRequest,
    invader: Optional[Invader],
    previous_state: Optional[str] = None,
    previous_latitude: Optional[float] = None,
    previous_longitude: Optional[float] = None,
) -> Dict[str, Tuple[str, str]]:
    """Just the texts of notification_event()."""
    return notification_event(admin_req, invader, previous_state, previous_latitude, previous_longitude)[1]


def create_announcement(db: Session, data: AnnouncementCreate) -> Announcement:
    ann = Announcement(kind=data.kind, title=data.title, body=data.body, version=data.version)
    db.add(ann)
    db.flush()
    db.refresh(ann)
    return ann
