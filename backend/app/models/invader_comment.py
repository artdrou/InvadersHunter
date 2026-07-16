from sqlalchemy import Column, Integer, String, DateTime, ForeignKey
from datetime import datetime
from ..database import Base


class InvaderComment(Base):
    __tablename__ = "invader_comments"

    id = Column(Integer, primary_key=True, index=True)
    invader_id = Column(Integer, ForeignKey("invaders.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)

    body = Column(String, nullable=False)

    # "visible"        — passed auto-moderation, shown to everyone
    # "hidden"         — flagged by auto-moderation (or admin), never listed
    # "pending_review" — moderation unavailable at post time, or reported by a
    #                    user; still listed, queued for admin review
    status = Column(String, nullable=False, default="visible")
    # Comma-separated OpenAI moderation categories that fired — admin context only
    flagged_categories = Column(String, nullable=True)
    reports = Column(Integer, nullable=False, default=0)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=True)
