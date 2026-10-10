"""
Business logic for the Invader entity and its companion `deleted_invaders`
tombstone table (used by clients to prune their local SQLite caches on sync).
"""
from datetime import datetime
from typing import List, Optional
from sqlalchemy import func, text
from sqlalchemy.orm import Session

from ..models.space_invader import Invader
from ..core.db_utils import safe_commit
from ..core.name_utils import normalize_name
from ..core.spotter_scraper import split_name


class InvaderMissing(Exception): ...


class InvaderAlreadyExists(Exception):
    def __init__(self, invader: Invader):
        super().__init__(f"{invader.name} already exists (id {invader.id})")
        self.invader_id = invader.id
        self.name = invader.name


def find_existing(db: Session, name: str) -> Optional[Invader]:
    """The invader a would-be creation named `name` would duplicate, if any.

    Same city + number whatever the zero padding or case ("pa 10", "PA_010" and
    "PA_10" are one invader), matched on the city/number columns or on the name
    (invaders created before those columns were filled)."""
    key = split_name(normalize_name(name))
    if key is None:
        cond = func.upper(Invader.name) == normalize_name(name)
    else:
        city, number = key
        variants = {f"{city}_{number:0{width}d}" for width in (1, 2, 3, 4)}
        cond = ((Invader.city == city) & (Invader.number == number)) | func.upper(Invader.name).in_(variants)
    return db.query(Invader).filter(cond).order_by(Invader.id).first()


def ensure_new(db: Session, name: Optional[str]) -> None:
    """Raise InvaderAlreadyExists when creating `name` would make a duplicate."""
    existing = find_existing(db, name) if name else None
    if existing is not None:
        raise InvaderAlreadyExists(existing)


def list_all(db: Session, updated_since: Optional[datetime] = None) -> List[Invader]:
    query = db.query(Invader)
    if updated_since is not None:
        query = query.filter(
            (Invader.updated_at > updated_since) | (Invader.latitude == None)
        )
    return query.all()


def list_deleted_ids(db: Session, updated_since: Optional[datetime] = None) -> List[int]:
    sql = "SELECT invader_id FROM deleted_invaders"
    params: dict = {}
    if updated_since is not None:
        sql += " WHERE deleted_at > :since"
        params["since"] = updated_since
    rows = db.execute(text(sql), params).fetchall()
    return [r[0] for r in rows]


def list_ids(db: Session) -> List[int]:
    """Every existing invader id. Clients diff it against their local cache to
    drop invaders removed without a tombstone (e.g. deleted by hand in the DB)."""
    return [r[0] for r in db.query(Invader.id).all()]


def get_by_id(db: Session, invader_id: int) -> Invader:
    inv = db.query(Invader).filter(Invader.id == invader_id).first()
    if not inv:
        raise InvaderMissing()
    return inv


def create(db: Session, fields: dict) -> Invader:
    ensure_new(db, fields.get("name"))
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


# Deletion (with flashes, requests, comments…) lives in deletion_service.delete_invader.
