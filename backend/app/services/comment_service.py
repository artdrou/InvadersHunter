"""
Business logic for the invader comment wall.

Comments go through auto-moderation at creation (see moderation_service):
clean → visible, flagged → hidden, moderation down → pending_review
(accepted anyway — a third-party outage must never block users).
"""
from typing import List, Optional, Tuple
from sqlalchemy.orm import Session

from ..models.invader_comment import InvaderComment
from ..models.comment_reaction import CommentReaction
from ..models.space_invader import Invader
from ..models.user import User
from ..core.db_utils import safe_commit
from . import moderation_service

# (comment, author username, caller's own reaction: 1 like / -1 dislike / 0 none)
CommentRow = Tuple[InvaderComment, str, int]


class InvaderMissing(Exception): ...
class CommentMissing(Exception): ...
class NotCommentOwner(Exception): ...


def _my_reactions(db: Session, user_id: Optional[int], comment_ids: List[int]) -> dict:
    """Map comment_id -> the given user's reaction value, for the listed comments."""
    if user_id is None or not comment_ids:
        return {}
    rows = (
        db.query(CommentReaction.comment_id, CommentReaction.value)
        .filter(CommentReaction.user_id == user_id, CommentReaction.comment_id.in_(comment_ids))
        .all()
    )
    return {cid: val for cid, val in rows}


def list_for_invader(db: Session, invader_id: int, user_id: Optional[int] = None) -> List[CommentRow]:
    """Comments shown in the app: everything except hidden, newest first.
    Annotates each with the caller's own reaction when user_id is given."""
    if not db.query(Invader.id).filter(Invader.id == invader_id).first():
        raise InvaderMissing()
    rows = (
        db.query(InvaderComment, User.username)
        .join(User, User.id == InvaderComment.user_id)
        .filter(
            InvaderComment.invader_id == invader_id,
            InvaderComment.status != "hidden",
        )
        .order_by(InvaderComment.created_at.desc())
        .all()
    )
    mine = _my_reactions(db, user_id, [c.id for c, _ in rows])
    return [(c, username, mine.get(c.id, 0)) for c, username in rows]


def get_summary(
    db: Session, invader_id: int, user_id: Optional[int] = None
) -> Tuple[int, Optional[CommentRow]]:
    """(number of listed comments, top comment by likes or None). The top comment
    is the most-liked visible one with at least one like; ties break newest."""
    if not db.query(Invader.id).filter(Invader.id == invader_id).first():
        raise InvaderMissing()
    base = db.query(InvaderComment).filter(
        InvaderComment.invader_id == invader_id,
        InvaderComment.status != "hidden",
    )
    count = base.count()
    top = (
        base.filter(InvaderComment.likes > 0)
        .order_by(InvaderComment.likes.desc(), InvaderComment.created_at.desc())
        .first()
    )
    if top is None:
        return count, None
    username = db.query(User.username).filter(User.id == top.user_id).scalar() or "?"
    my = _my_reactions(db, user_id, [top.id]).get(top.id, 0)
    return count, (top, username, my)


def create(db: Session, user: User, invader_id: int, body: str) -> InvaderComment:
    if not db.query(Invader.id).filter(Invader.id == invader_id).first():
        raise InvaderMissing()

    moderation = moderation_service.check_text(body)
    if moderation is None:
        status, categories = "pending_review", None  # moderation down — accept, queue for admin
    elif moderation.flagged:
        status, categories = "hidden", ",".join(moderation.categories) or None
    else:
        status, categories = "visible", None

    comment = InvaderComment(
        invader_id=invader_id,
        user_id=user.id,
        body=body,
        status=status,
        flagged_categories=categories,
    )
    db.add(comment)
    safe_commit(db)
    db.refresh(comment)
    return comment


def get(db: Session, comment_id: int) -> InvaderComment:
    comment = db.query(InvaderComment).filter(InvaderComment.id == comment_id).first()
    if not comment:
        raise CommentMissing()
    return comment


def delete(db: Session, comment_id: int, acting_user: User) -> None:
    comment = get(db, comment_id)
    if comment.user_id != acting_user.id and not acting_user.is_admin:
        raise NotCommentOwner()
    db.delete(comment)
    safe_commit(db)


def report(db: Session, comment_id: int) -> InvaderComment:
    """Flag a comment for admin review. Hidden comments stay hidden."""
    comment = get(db, comment_id)
    comment.reports += 1
    if comment.status == "visible":
        comment.status = "pending_review"
    safe_commit(db)
    db.refresh(comment)
    return comment


def set_reaction(db: Session, user: User, comment_id: int, value: int) -> InvaderComment:
    """Set the user's reaction to `value` (1 like, -1 dislike, 0 none). Idempotent
    to the target state; keeps the denormalized likes/dislikes tallies in sync."""
    comment = get(db, comment_id)
    existing = (
        db.query(CommentReaction)
        .filter(CommentReaction.comment_id == comment_id, CommentReaction.user_id == user.id)
        .first()
    )
    old = existing.value if existing else 0
    if old == value:
        return comment  # already in the requested state

    if old == 1:
        comment.likes -= 1
    elif old == -1:
        comment.dislikes -= 1
    if value == 1:
        comment.likes += 1
    elif value == -1:
        comment.dislikes += 1

    if value == 0:
        if existing:
            db.delete(existing)
    elif existing:
        existing.value = value
    else:
        db.add(CommentReaction(comment_id=comment_id, user_id=user.id, value=value))

    safe_commit(db)
    db.refresh(comment)
    return comment
