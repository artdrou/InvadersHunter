"""
Hard deletion of an invader or a user together with every row that points at it,
so no orphan is left behind (flashes, requests, comments, reactions, tokens).

Postgres declares ON DELETE CASCADE on a few of these tables, but not all of them
(user_progress, user_requests, admin_requests) and SQLite (tests) doesn't enforce
foreign keys at all, so every dependent row is removed explicitly, children first.
"""
from dataclasses import dataclass, field
from datetime import datetime
from typing import Dict, List, Set

from sqlalchemy import text
from sqlalchemy.orm import Session

from ..core import r2
from ..core.db_utils import safe_commit
from ..models.admin_request import AdminRequest
from ..models.comment_reaction import CommentReaction
from ..models.friendship import Friendship
from ..models.invader_comment import InvaderComment
from ..models.notification_settings import NotificationSettings
from ..models.push_token import PushToken
from ..models.refresh_token import RefreshToken
from ..models.space_invader import Invader
from ..models.user import User
from ..models.user_progress import UserProgress
from ..models.user_request import UserRequest
from .invader_service import InvaderMissing
from .user_service import UserMissing
from .user_request_service import aggregate_request


@dataclass
class DeletionReport:
    deleted: Dict[str, int] = field(default_factory=dict)

    def add(self, what: str, count: int) -> None:
        if count:
            self.deleted[what] = self.deleted.get(what, 0) + count


def _delete_comments(db: Session, report: DeletionReport, comment_ids: List[int]) -> None:
    """Comments and every reaction on them."""
    if not comment_ids:
        return
    report.add("comment_reactions", db.query(CommentReaction)
               .filter(CommentReaction.comment_id.in_(comment_ids)).delete(synchronize_session=False))
    report.add("comments", db.query(InvaderComment)
               .filter(InvaderComment.id.in_(comment_ids)).delete(synchronize_session=False))


def _prune_photos(urls: Set[str]) -> None:
    """Best-effort R2 cleanup after commit; non-R2 URLs (invader-spotter) are ignored."""
    if not r2.is_configured():
        return
    for url in urls:
        if url:
            r2.delete_object(url)


# ── invader ───────────────────────────────────────────────────────────────────

def delete_invader(db: Session, invader_id: int) -> DeletionReport:
    """Delete an invader, its flashes, requests, admin requests and comment wall,
    and write a tombstone so clients drop it on their next delta sync."""
    invader = db.query(Invader).filter(Invader.id == invader_id).first()
    if not invader:
        raise InvaderMissing()
    report = DeletionReport()

    admin_ids = [i for (i,) in db.query(AdminRequest.id).filter(AdminRequest.invader_id == invader_id)]
    # Create requests have invader_id NULL: they are reached through their admin request.
    req_filter = UserRequest.invader_id == invader_id
    if admin_ids:
        req_filter = req_filter | UserRequest.admin_request_id.in_(admin_ids)
    photos = {u for (u,) in db.query(UserRequest.proposed_image_url).filter(req_filter) if u}
    photos.add(invader.image_url)

    report.add("flashes", db.query(UserProgress)
               .filter(UserProgress.invader_id == invader_id).delete(synchronize_session=False))
    report.add("user_requests", db.query(UserRequest).filter(req_filter).delete(synchronize_session=False))
    if admin_ids:
        report.add("admin_requests", db.query(AdminRequest)
                   .filter(AdminRequest.id.in_(admin_ids)).delete(synchronize_session=False))
    _delete_comments(db, report, [i for (i,) in db.query(InvaderComment.id)
                                  .filter(InvaderComment.invader_id == invader_id)])

    db.execute(
        text("INSERT INTO deleted_invaders (invader_id, deleted_at) VALUES (:id, :now)"),
        {"id": invader_id, "now": datetime.utcnow()},
    )
    db.delete(invader)
    report.add("invaders", 1)
    safe_commit(db)
    _prune_photos(photos)
    return report


# ── user ──────────────────────────────────────────────────────────────────────

def _remove_user_reactions(db: Session, report: DeletionReport, user_id: int) -> None:
    """Drop the user's likes/dislikes and keep the denormalized tallies right."""
    reactions = db.query(CommentReaction).filter(CommentReaction.user_id == user_id).all()
    if not reactions:
        return
    comments = {c.id: c for c in db.query(InvaderComment)
                .filter(InvaderComment.id.in_({r.comment_id for r in reactions}))}
    for reaction in reactions:
        comment = comments.get(reaction.comment_id)
        if comment is not None:
            if reaction.value > 0:
                comment.likes = max(0, comment.likes - 1)
            else:
                comment.dislikes = max(0, comment.dislikes - 1)
        db.delete(reaction)
    report.add("comment_reactions", len(reactions))


def _refresh_pending_admin_requests(db: Session, report: DeletionReport, admin_ids: Set[int]) -> None:
    """Pending admin requests lost the user's votes: re-aggregate from the remaining
    submissions, or drop the admin request when none is left."""
    for admin_id in admin_ids:
        admin_req = db.query(AdminRequest).filter(AdminRequest.id == admin_id).first()
        if admin_req is None or admin_req.status != "pending":
            continue
        remaining = db.query(UserRequest).filter(UserRequest.admin_request_id == admin_id).first()
        if remaining is None:
            db.delete(admin_req)
            report.add("admin_requests", 1)
        else:
            aggregate_request(db, remaining)  # recomputes votes, confidence and proposals


def delete_user(db: Session, user_id: int) -> DeletionReport:
    """Delete a user and everything they own. Approved admin requests stay (they are
    the invaders' history / News feed); only the links to the user are cleared."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise UserMissing()
    report = DeletionReport()

    user_reqs = db.query(UserRequest).filter(UserRequest.user_id == user_id)
    touched_admin_ids = {a for (a,) in user_reqs.with_entities(UserRequest.admin_request_id) if a}
    photos = {u for (u,) in user_reqs.with_entities(UserRequest.proposed_image_url) if u}

    report.add("flashes", db.query(UserProgress)
               .filter(UserProgress.user_id == user_id).delete(synchronize_session=False))
    report.add("user_requests", user_reqs.delete(synchronize_session=False))
    db.flush()
    _refresh_pending_admin_requests(db, report, touched_admin_ids)

    _remove_user_reactions(db, report, user_id)
    _delete_comments(db, report, [i for (i,) in db.query(InvaderComment.id)
                                  .filter(InvaderComment.user_id == user_id)])

    report.add("friendships", db.query(Friendship)
               .filter((Friendship.requester_id == user_id) | (Friendship.addressee_id == user_id))
               .delete(synchronize_session=False))
    report.add("push_tokens", db.query(PushToken)
               .filter(PushToken.user_id == user_id).delete(synchronize_session=False))
    report.add("refresh_tokens", db.query(RefreshToken)
               .filter(RefreshToken.user_id == user_id).delete(synchronize_session=False))
    db.query(AdminRequest).filter(AdminRequest.reviewed_by == user_id) \
        .update({"reviewed_by": None}, synchronize_session=False)
    db.query(NotificationSettings).filter(NotificationSettings.updated_by == user_id) \
        .update({"updated_by": None}, synchronize_session=False)

    db.delete(user)
    report.add("users", 1)
    safe_commit(db)
    _prune_photos(photos)
    return report
