"""
Business logic for the invader comment wall.

Comments go through auto-moderation at creation (see moderation_service):
clean → visible, flagged → hidden, moderation down → pending_review
(accepted anyway — a third-party outage must never block users).
"""
from typing import List, Optional, Tuple
from sqlalchemy.orm import Session

from ..models.invader_comment import InvaderComment
from ..models.space_invader import Invader
from ..models.user import User
from ..core.db_utils import safe_commit
from . import moderation_service


class InvaderMissing(Exception): ...
class CommentMissing(Exception): ...
class NotCommentOwner(Exception): ...


def list_for_invader(db: Session, invader_id: int) -> List[Tuple[InvaderComment, str]]:
    """Comments shown in the app: everything except hidden, newest first.
    Returns (comment, author username) tuples."""
    if not db.query(Invader.id).filter(Invader.id == invader_id).first():
        raise InvaderMissing()
    return (
        db.query(InvaderComment, User.username)
        .join(User, User.id == InvaderComment.user_id)
        .filter(
            InvaderComment.invader_id == invader_id,
            InvaderComment.status != "hidden",
        )
        .order_by(InvaderComment.created_at.desc())
        .all()
    )


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
