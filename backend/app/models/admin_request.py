from sqlalchemy import Column, Integer, String, Float, DateTime, Date, ForeignKey
from datetime import datetime
from ..database import Base


class AdminRequest(Base):
    __tablename__ = "admin_requests"

    id = Column(Integer, primary_key=True, index=True)

    # null for "create" requests (invader doesn't exist yet)
    invader_id = Column(Integer, ForeignKey("invaders.id"), nullable=True)

    request_type = Column(String, nullable=False)  # "create" | "modify"
    status = Column(String, nullable=False, default="pending")  # "pending" | "approved" | "rejected"

    # Aggregated proposed data
    proposed_name = Column(String, nullable=True)
    normalized_name = Column(String, nullable=True, index=True)
    proposed_description = Column(String, nullable=True)
    proposed_latitude = Column(Float, nullable=True)
    proposed_longitude = Column(Float, nullable=True)
    proposed_points = Column(Integer, nullable=True)
    proposed_state = Column(String, nullable=True)
    proposed_image_url = Column(String, nullable=True)
    proposed_date_pose = Column(Date, nullable=True)  # year of installation (stored as YYYY-01-01)

    request_count = Column(Integer, nullable=False, default=0)
    confidence = Column(Integer, nullable=False, default=0)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    reviewed_at = Column(DateTime, nullable=True)
    reviewed_by = Column(Integer, ForeignKey("users.id"), nullable=True)
