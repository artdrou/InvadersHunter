"""
Business logic for the Invader entity and its companion `deleted_invaders`
tombstone table (used by clients to prune their local SQLite caches on sync).
"""
from datetime import datetime
from typing import List, Optional
from sqlalchemy import text
from sqlalchemy.orm import Session

from ..models.space_invader import Invader
from ..core.db_utils import safe_commit


class InvaderMissing(Exception): ...


def list_all(db: Session, updated_since: Optional[datetime] = None) -> List[Invader]:
    query = db.query(Invader)
    if updated_since is not None:
        query = query.filter(Invader.updated_at > updated_since)
    return query.all()


def list_deleted_ids(db: Session, updated_since: Optional[datetime] = None) -> List[int]:
    sql = "SELECT invader_id FROM deleted_invaders"
    params: dict = {}
    if updated_since is not None:
        sql += " WHERE deleted_at > :since"
        params["since"] = updated_since
    rows = db.execute(text(sql), params).fetchall()
    return [r[0] for r in rows]


def get_by_id(db: Session, invader_id: int) -> Invader:
    inv = db.query(Invader).filter(Invader.id == invader_id).first()
    if not inv:
        raise InvaderMissing()
    return inv


def create(db: Session, fields: dict) -> Invader:
    invader = Invader(**fields)
    db.add(invader)
    safe_commit(db)
    db.refresh(invader)
    return invader


def update(db: Session, invader_id: int, fields: dict) -> Invader:
    invader = db.query(Invader).filter(Invader.id == invader_id).first()
    if not invader:
        raise InvaderMissing()
    for key, value in fields.items():
        setattr(invader, key, value)
    safe_commit(db)
    db.refresh(invader)
    return invader


def delete(db: Session, invader_id: int) -> None:
    """Hard-delete an invader and write a tombstone row so connected clients
    pick up the removal on their next delta sync."""
    invader = db.query(Invader).filter(Invader.id == invader_id).first()
    if not invader:
        raise InvaderMissing()
    db.execute(
        text("INSERT INTO deleted_invaders (invader_id, deleted_at) VALUES (:id, :now)"),
        {"id": invader_id, "now": datetime.utcnow()},
    )
    db.delete(invader)
    safe_commit(db)
