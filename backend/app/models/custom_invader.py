from sqlalchemy import Column, Integer, String, Float, Date, DateTime, ForeignKey
from datetime import datetime
from ..database import Base


class CustomInvader(Base):
    """A user's personal invader.

    Deliberately a separate table from `invaders`: these are private to their
    owner and never enter the community dataset, so they carry no admin request,
    no contributor history and no comment wall. Shape mirrors Invader so the
    client can render both through the same map/marker code.
    """
    __tablename__ = "custom_invaders"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)

    name = Column(String, nullable=False)
    city = Column(String, nullable=True)
    number = Column(Integer, nullable=True)
    image_url = Column(String, nullable=True)
    description = Column(String, nullable=True)
    points = Column(Integer, nullable=True)
    state = Column(String, nullable=True)
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    date_pose = Column(Date, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=True)


class DeletedCustomInvader(Base):
    """Tombstone for a hard-deleted custom invader.

    Mirrors `deleted_invaders`: a delta sync only sees rows whose updated_at moved,
    so a plain DELETE would be invisible to a client that already cached the row.
    Scoped by user_id — the delete list is owner-scoped like everything else here.
    """
    __tablename__ = "deleted_custom_invaders"

    id = Column(Integer, primary_key=True, index=True)
    custom_invader_id = Column(Integer, nullable=False)
    user_id = Column(Integer, nullable=False, index=True)
    deleted_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)
