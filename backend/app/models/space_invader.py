from sqlalchemy import Column, Integer, String, Float, Date, DateTime
from datetime import datetime
from ..database import Base

class Invader(Base):
    __tablename__ = "invaders"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    city = Column(String, nullable=True)
    number = Column(Integer, nullable=True)
    image_url = Column(String)
    description = Column(String)
    points = Column(Integer)
    state = Column(String)
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    date_pose = Column(Date, nullable=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=True)