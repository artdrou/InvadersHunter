from sqlalchemy import Column, Integer, DateTime, ForeignKey, UniqueConstraint
from datetime import datetime
from ..database import Base


class CommentReaction(Base):
    """One like/dislike per (comment, user). The aggregate counts live
    denormalized on invader_comments.likes / .dislikes so the wall and the
    "top comment" summary sort cheaply."""
    __tablename__ = "comment_reactions"

    id = Column(Integer, primary_key=True, index=True)
    comment_id = Column(Integer, ForeignKey("invader_comments.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)

    value = Column(Integer, nullable=False)  # 1 = like, -1 = dislike
    created_at = Column(DateTime, default=datetime.utcnow)

    __table_args__ = (UniqueConstraint("comment_id", "user_id", name="uq_comment_reaction"),)
