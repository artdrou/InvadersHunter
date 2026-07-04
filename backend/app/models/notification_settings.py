from sqlalchemy import Column, Integer, Boolean, DateTime, ForeignKey
from datetime import datetime
from ..database import Base


class NotificationSettings(Base):
    """Singleton row (id always 1) holding the admin-controlled global switches
    for the invader push-notification pipeline."""
    __tablename__ = "notification_settings"

    id = Column(Integer, primary_key=True)
    enabled = Column(Boolean, nullable=False, default=True)
    notify_on_create = Column(Boolean, nullable=False, default=True)
    notify_on_update = Column(Boolean, nullable=False, default=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    updated_by = Column(Integer, ForeignKey("users.id"), nullable=True)
