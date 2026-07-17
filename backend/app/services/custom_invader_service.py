"""
Business logic for personal ("custom") invaders.

Every read and write here is owner-scoped: the user_id is taken from the caller's
token, never from the request body, so a user can only ever see and touch their
own rows. Admins get no special access — these are private, not moderated content.
"""
from datetime import datetime
from typing import List, Optional
from sqlalchemy.orm import Session

from ..models.custom_invader import CustomInvader, DeletedCustomInvader
from ..core.db_utils import safe_commit
from ..core import r2


class CustomInvaderMissing(Exception): ...


def list_for_user(
    db: Session, user_id: int, updated_since: Optional[datetime] = None
) -> List[CustomInvader]:
    query = db.query(CustomInvader).filter(CustomInvader.user_id == user_id)
    if updated_since is not None:
        query = query.filter(CustomInvader.updated_at > updated_since)
    return query.order_by(CustomInvader.id).all()


def list_deleted_ids(
    db: Session, user_id: int, updated_since: Optional[datetime] = None
) -> List[int]:
    """Ids the client must prune from its local cache — owner-scoped."""
    query = db.query(DeletedCustomInvader.custom_invader_id).filter(
        DeletedCustomInvader.user_id == user_id
    )
    if updated_since is not None:
        query = query.filter(DeletedCustomInvader.deleted_at > updated_since)
    return [r[0] for r in query.all()]


def get_owned(db: Session, custom_invader_id: int, user_id: int) -> CustomInvader:
    """Fetch a row the user owns. Raises CustomInvaderMissing when it doesn't
    exist *or* belongs to someone else — a 404 either way, so the endpoint never
    leaks the existence of another user's invader."""
    row = (
        db.query(CustomInvader)
        .filter(CustomInvader.id == custom_invader_id, CustomInvader.user_id == user_id)
        .first()
    )
    if not row:
        raise CustomInvaderMissing()
    return row


def create(db: Session, user_id: int, fields: dict) -> CustomInvader:
    row = CustomInvader(user_id=user_id, **fields)
    db.add(row)
    safe_commit(db)
    db.refresh(row)
    return row


def update(db: Session, custom_invader_id: int, user_id: int, fields: dict) -> CustomInvader:
    row = get_owned(db, custom_invader_id, user_id)
    for key, value in fields.items():
        setattr(row, key, value)
    safe_commit(db)
    db.refresh(row)
    return row


def delete(db: Session, custom_invader_id: int, user_id: int) -> None:
    """Hard-delete + tombstone, so the owner's other devices prune the row on
    their next delta sync."""
    row = get_owned(db, custom_invader_id, user_id)
    image_url = row.image_url
    db.add(DeletedCustomInvader(
        custom_invader_id=custom_invader_id,
        user_id=user_id,
        deleted_at=datetime.utcnow(),
    ))
    db.delete(row)
    safe_commit(db)
    # Best-effort R2 cleanup once the row is really gone (failures are logged
    # inside r2.delete_object) — nothing references the object any more.
    if image_url:
        r2.delete_object(image_url)


def bulk_claim(db: Session, user_id: int, items: List) -> List[CustomInvader]:
    """Import a guest's local custom invaders into their fresh account.

    Called by POST /account/claim. Returns one row per item, in request order, so
    the client can map each temporary negative local id onto the real server id it
    just received (see decision 4 in the roadmap).

    Idempotent, like the captures side of the claim: an item matching a row the
    user already has (same name and position) returns that row instead of adding a
    second one. Without this, a client that crashes between the server's response
    and its local cleanup would re-send the same rows on the next sync and
    duplicate every personal invader — the claim is retried on every sync by
    design, so it has to be safe to repeat.
    """
    rows: List[CustomInvader] = []
    for item in items:
        fields = item.model_dump(exclude={"local_id"})
        existing = (
            db.query(CustomInvader)
            .filter(
                CustomInvader.user_id == user_id,
                CustomInvader.name == fields["name"],
                CustomInvader.latitude == fields["latitude"],
                CustomInvader.longitude == fields["longitude"],
            )
            .first()
        )
        if existing:
            rows.append(existing)
            continue
        row = CustomInvader(user_id=user_id, **fields)
        db.add(row)
        rows.append(row)
    safe_commit(db)
    for row in rows:
        db.refresh(row)
    return rows
