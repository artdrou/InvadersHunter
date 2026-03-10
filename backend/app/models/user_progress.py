from sqlalchemy import Column, Integer, ForeignKey, DateTime
from datetime import datetime
from ..database import Base

class UserProgress(Base):
    __tablename__ = "user_progress"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    invader_id = Column(Integer, ForeignKey("invaders.id"), nullable=False)
    found_at = Column(DateTime, default=datetime.utcnow)