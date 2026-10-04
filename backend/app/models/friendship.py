from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, UniqueConstraint
from datetime import datetime
from ..database import Base


class Friendship(Base):
    """A friend link between two users. Starts as an invite (`pending`, sent by
    `requester` to `addressee`) and becomes `accepted` when the addressee says
    yes. Declining, cancelling or unfriending deletes the row. The service keeps
    at most one row per pair, whatever the direction."""
    __tablename__ = "friendships"

    id = Column(Integer, primary_key=True, index=True)
    requester_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    addressee_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    status = Column(String, nullable=False, default="pending")  # "pending" | "accepted"
    created_at = Column(DateTime, default=datetime.utcnow)
    accepted_at = Column(DateTime, nullable=True)

    __table_args__ = (UniqueConstraint("requester_id", "addressee_id", name="uq_friendship_pair"),)
