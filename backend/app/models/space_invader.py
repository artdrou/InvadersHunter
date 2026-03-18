from sqlalchemy import Column, Integer, String, Float
from ..database import Base

class Invader(Base):
    __tablename__ = "invaders"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    image_url = Column(String)
    description = Column(String)
    points = Column(Integer)
    state = Column(String)
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)