from sqlalchemy import Column, Integer, String, Text, DateTime, Boolean
from datetime import datetime
from ..database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    is_admin = Column(Boolean, default=False)
    reset_code = Column(String, nullable=True)
    reset_code_expires = Column(DateTime, nullable=True)
    notifications_enabled = Column(Boolean, nullable=False, default=True)
    # Friend code (e.g. "K7QM-3XPA", stored without the dash): shared to be added as a
    # friend. Given on first request (friend_service.get_friend_code)
    friend_code = Column(String(8), unique=True, index=True, nullable=True)
    # Profile icon as JSON text (avatar_service); NULL = the default icon
    avatar = Column(Text, nullable=True)
    language = Column(String, nullable=False, default="fr")  # "fr" | "en" — drives push notification text