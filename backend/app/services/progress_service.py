"""
Business logic for user progress (flashes / captures).

Every operation that reads or writes UserProgress goes through here so routers
stay pure HTTP. Services raise plain Python exceptions; routers translate
them to HTTP codes.
"""
from datetime import datetime
from typing import List, Optional, Tuple
from sqlalchemy.orm import Session

from ..models.user_progress import UserProgress
from ..models.user import User
from ..models.space_invader import Invader
from ..core.db_utils import safe_commit


class UserMissing(Exception): ...
class InvaderMissing(Exception): ...
class CaptureMissing(Exception): ...
class CaptureAlreadyExists(Exception): ...


def list_all(db: Session) -> List[UserProgress]:
    return db.query(UserProgress).all()


def get(db: Session, capture_id: int) -> UserProgress:
    capture = db.query(UserProgress).filter(UserProgress.id == capture_id).first()
    if not capture:
        raise CaptureMissing()
    return capture


def list_for_user(
    db: Session, user_id: int, updated_since: Optional[datetime] = None
) -> List[UserProgress]:
    query = db.query(UserProgress).filter(UserProgress.user_id == user_id)
    if updated_since is not None:
        query = query.filter(UserProgress.updated_at > updated_since)
    return query.all()


def flash(db: Session, user_id: int, invader_id: int) -> UserProgress:
    """Record that `user_id` has flashed `invader_id`. Idempotency is enforced:
    a second flash for the same pair raises CaptureAlreadyExists."""
    if not db.query(User).filter(User.id == user_id).first():
        raise UserMissing()
    if not db.query(Invader).filter(Invader.id == invader_id).first():
        raise InvaderMissing()
    if db.query(UserProgress).filter(
        UserProgress.user_id == user_id,
        UserProgress.invader_id == invader_id,
    ).first():
        raise CaptureAlreadyExists()
    capture = UserProgress(user_id=user_id, invader_id=invader_id)
    db.add(capture)
    safe_commit(db)
    db.refresh(capture)
    return capture


def update(
    db: Session,
    capture_id: int,
    user_id: Optional[int] = None,
    invader_id: Optional[int] = None,
    found_at: Optional[datetime] = None,
) -> UserProgress:
    capture = db.query(UserProgress).filter(UserProgress.id == capture_id).first()
    if not capture:
        raise CaptureMissing()
    if user_id is not None:
        if not db.query(User).filter(User.id == user_id).first():
            raise UserMissing()
        capture.user_id = user_id
    if invader_id is not None:
        if not db.query(Invader).filter(Invader.id == invader_id).first():
            raise InvaderMissing()
        capture.invader_id = invader_id
    if found_at is not None:
        capture.found_at = found_at
    safe_commit(db)
    db.refresh(capture)
    return capture


def unflash(db: Session, capture_id: int) -> None:
    """Delete a capture (a.k.a. unflash)."""
    capture = db.query(UserProgress).filter(UserProgress.id == capture_id).first()
    if not capture:
        raise CaptureMissing()
    db.delete(capture)
    safe_commit(db)


def bulk_claim(
    db: Session, user_id: int, captures: list
) -> Tuple[List[UserProgress], int, int]:
    """Bulk-import guest captures when a guest creates an account.

    Idempotent by design — safe to retry after a network failure:
    - invaders unknown server-side are skipped (stale local DB), not errors
    - invaders already flashed by this user are skipped, not errors
    - duplicate invader_ids within the payload are collapsed to the first one

    `captures` items expose .invader_id and .found_at (ClaimCapture schema).
    Returns (imported rows, skipped_duplicates, skipped_missing).
    """
    requested_ids = {c.invader_id for c in captures}
    known_ids = {
        row[0]
        for row in db.query(Invader.id).filter(Invader.id.in_(requested_ids)).all()
    }
    already_flashed = {
        row[0]
        for row in db.query(UserProgress.invader_id)
        .filter(UserProgress.user_id == user_id)
        .all()
    }

    imported: List[UserProgress] = []
    skipped_duplicates = 0
    skipped_missing = 0
    seen: set = set()
    for c in captures:
        if c.invader_id in seen:
            skipped_duplicates += 1
            continue
        seen.add(c.invader_id)
        if c.invader_id not in known_ids:
            skipped_missing += 1
            continue
        if c.invader_id in already_flashed:
            skipped_duplicates += 1
            continue
        row = UserProgress(user_id=user_id, invader_id=c.invader_id)
        if c.found_at is not None:
            row.found_at = c.found_at
        db.add(row)
        imported.append(row)

    safe_commit(db)
    for row in imported:
        db.refresh(row)
    return imported, skipped_duplicates, skipped_missing
