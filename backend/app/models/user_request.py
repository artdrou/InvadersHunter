from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey
from datetime import datetime
from ..database import Base


class UserRequest(Base):
    __tablename__ = "user_requests"

    id = Column(Integer, primary_key=True, index=True)

    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    # null for "create" requests (invader doesn't exist yet)
    invader_id = Column(Integer, ForeignKey("invaders.id"), nullable=True)

    request_type = Column(String, nullable=False)  # "create" | "modify"
    status = Column(String, nullable=False, default="pending")  # "pending" | "processed" | "rejected"

    # What the user proposes
    proposed_name = Column(String, nullable=True)
    normalized_name = Column(String, nullable=True, index=True)
    proposed_description = Column(String, nullable=True)
    proposed_latitude = Column(Float, nullable=True)
    proposed_longitude = Column(Float, nullable=True)
    proposed_points = Column(Integer, nullable=True)
    proposed_state = Column(String, nullable=True)
    proposed_image_url = Column(String, nullable=True)

    # Set once this request is aggregated into an admin_request
    admin_request_id = Column(Integer, ForeignKey("admin_requests.id"), nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=True)
