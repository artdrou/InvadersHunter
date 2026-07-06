from sqlalchemy import Column, Integer, String, DateTime
from datetime import datetime
from ..database import Base


class Announcement(Base):
    """General app news: releases & announcements (the ~10% non-invader part of the feed)."""
    __tablename__ = "announcements"

    id = Column(Integer, primary_key=True, index=True)
    kind = Column(String, nullable=False, default="announcement")  # "announcement" | "release"
    title = Column(String, nullable=False)
    body = Column(String, nullable=True)
    version = Column(String, nullable=True)  # only for kind="release"
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
