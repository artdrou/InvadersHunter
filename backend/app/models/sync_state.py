from sqlalchemy import Column, String, Text, DateTime
from datetime import datetime
from ..database import Base


class SyncState(Base):
    """Small key/value store for scheduled jobs (e.g. last data versions seen)."""
    __tablename__ = "sync_state"

    key = Column(String, primary_key=True)
    value = Column(Text, nullable=True)   # JSON
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
