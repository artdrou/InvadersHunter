"""
Friends: invites by username, accept / decline / cancel / unfriend, the Social
tab overview, and a friend's game-stats profile.

One `Friendship` row per pair of users, whatever the direction. Inviting
someone who already invited you accepts their invite instead of creating a
second row. Every "no" (decline, cancel, unfriend) simply deletes the row, so
the pair can start over later.
"""
from datetime import datetime
from typing import Dict, List, Optional

from sqlalchemy import func, or_, and_
from sqlalchemy.orm import Session

from ..core.db_utils import safe_commit
from ..models.friendship import Friendship
from ..models.user import User
from ..models.user_progress import UserProgress
from . import notification_service, user_service

PENDING = "pending"
ACCEPTED = "accepted"

# Push copy per language: (title, body template). {username} = the other user.
NOTIFICATION_COPY = {
    "invite": {
        "fr": ("Nouvelle demande d'ami", "{username} veut devenir ton ami"),
        "en": ("New friend request", "{username} wants to be your friend"),
    },
    "accepted": {
        "fr": ("Demande d'ami acceptée", "{username} a accepté ta demande d'ami"),
        "en": ("Friend request accepted", "{username} accepted your friend request"),
    },
}
NOTIFICATION_DATA = {"screen": "/social"}


# ── Domain exceptions ────────────────────────────────────────────────────────

class FriendUserMissing(Exception): ...
class CannotFriendSelf(Exception): ...
class AlreadyFriends(Exception): ...
class InviteAlreadySent(Exception): ...
class FriendshipMissing(Exception): ...
class NotFriends(Exception): ...


# ── helpers ──────────────────────────────────────────────────────────────────

def _pair(db: Session, a: int, b: int) -> Optional[Friendship]:
    return db.query(Friendship).filter(or_(
        and_(Friendship.requester_id == a, Friendship.addressee_id == b),
        and_(Friendship.requester_id == b, Friendship.addressee_id == a),
    )).first()


def _find_user_by_username(db: Session, username: str) -> Optional[User]:
    """Exact username, falling back to a case-insensitive match (people rarely
    type the capitals right). There is no search: you must know the name."""
    name = username.strip()
    user = db.query(User).filter(User.username == name).first()
    if user:
        return user
    matches = db.query(User).filter(func.lower(User.username) == name.lower()).limit(2).all()
    return matches[0] if len(matches) == 1 else None


def _notify(db: Session, kind: str, to_user_id: int, from_username: str) -> None:
    texts = {
        lang: (title, body.format(username=from_username))
        for lang, (title, body) in NOTIFICATION_COPY[kind].items()
    }
    notification_service.notify_user(db, to_user_id, texts, NOTIFICATION_DATA)


def _flash_counts(db: Session, user_ids: List[int]) -> Dict[int, int]:
    if not user_ids:
        return {}
    rows = (
        db.query(UserProgress.user_id, func.count(UserProgress.id))
        .filter(UserProgress.user_id.in_(user_ids))
        .group_by(UserProgress.user_id)
        .all()
    )
    return dict(rows)


def are_friends(db: Session, a: int, b: int) -> bool:
    link = _pair(db, a, b)
    return link is not None and link.status == ACCEPTED


# ── Public service API ───────────────────────────────────────────────────────

def overview(db: Session, me: User) -> dict:
    """Everything the Social tab shows: friends, invites received, invites sent."""
    links = db.query(Friendship).filter(or_(
        Friendship.requester_id == me.id, Friendship.addressee_id == me.id,
    )).all()
    other_ids = [l.addressee_id if l.requester_id == me.id else l.requester_id for l in links]
    names = dict(db.query(User.id, User.username).filter(User.id.in_(other_ids)).all()) if other_ids else {}
    counts = _flash_counts(db, other_ids)

    result = {"friends": [], "incoming": [], "outgoing": []}
    for link, other_id in zip(links, other_ids):
        if other_id not in names:
            continue  # the other account is gone
        entry = {
            "id": link.id,
            "user_id": other_id,
            "username": names[other_id],
            "flashed_count": counts.get(other_id, 0),
            "since": link.accepted_at if link.status == ACCEPTED else link.created_at,
        }
        if link.status == ACCEPTED:
            result["friends"].append(entry)
        elif link.addressee_id == me.id:
            result["incoming"].append(entry)
        else:
            result["outgoing"].append(entry)
    for key in result:
        result[key].sort(key=lambda e: e["username"].lower())
    return result


def send_request(db: Session, me: User, username: str) -> dict:
    target = _find_user_by_username(db, username)
    if target is None:
        raise FriendUserMissing()
    if target.id == me.id:
        raise CannotFriendSelf()

    existing = _pair(db, me.id, target.id)
    if existing is not None:
        if existing.status == ACCEPTED:
            raise AlreadyFriends()
        if existing.requester_id == me.id:
            raise InviteAlreadySent()
        # They already invited me: saying "add" back is a yes.
        _accept(db, existing, me)
        return {"id": existing.id, "status": ACCEPTED, "accepted": True}

    link = Friendship(requester_id=me.id, addressee_id=target.id, status=PENDING)
    db.add(link)
    safe_commit(db)
    db.refresh(link)
    _notify(db, "invite", target.id, me.username)
    return {"id": link.id, "status": PENDING, "accepted": False}


def _accept(db: Session, link: Friendship, me: User) -> None:
    link.status = ACCEPTED
    link.accepted_at = datetime.utcnow()
    safe_commit(db)
    _notify(db, "accepted", link.requester_id, me.username)


def accept_request(db: Session, me: User, friendship_id: int) -> Friendship:
    """Only the invited user can accept."""
    link = db.query(Friendship).filter(Friendship.id == friendship_id).first()
    if link is None or link.addressee_id != me.id or link.status != PENDING:
        raise FriendshipMissing()
    _accept(db, link, me)
    db.refresh(link)
    return link


def remove(db: Session, me: User, friendship_id: int) -> None:
    """Decline an invite, cancel one you sent, or unfriend — either side may."""
    link = db.query(Friendship).filter(Friendship.id == friendship_id).first()
    if link is None or me.id not in (link.requester_id, link.addressee_id):
        raise FriendshipMissing()
    db.delete(link)
    safe_commit(db)


def friend_profile(db: Session, me: User, user_id: int) -> dict:
    """A friend's game stats (same numbers as the admin view, minus private
    fields — the response schema drops them)."""
    if not are_friends(db, me.id, user_id):
        raise NotFriends()
    return user_service.get_admin_profile(db, user_id)
