from sqlalchemy import Boolean, Column, Integer, String, Float, DateTime, Date, ForeignKey
from datetime import datetime
from ..database import Base

# Sources fed by scheduled jobs, not by a human: never count as an app validation.
AUTOMATED_SOURCES = ("scraper", "invaderquest")


class AdminRequest(Base):
    __tablename__ = "admin_requests"

    id = Column(Integer, primary_key=True, index=True)

    # null for "create" requests (invader doesn't exist yet)
    invader_id = Column(Integer, ForeignKey("invaders.id"), nullable=True, index=True)

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

    # Invader state just before this request was approved (modify only) — lets the
    # News feed tell a reactivation (Destroyed -> Good) from any other update.
    previous_state = Column(String, nullable=True)
    # Whether the invader had a location just before (modify only; NULL on older rows):
    # False + a proposed location = first location found ("discovered").
    previous_located = Column(Boolean, nullable=True)
    # True when this change only makes precise InvaderQuest's coarse "damaged" level
    # (stored as Degraded): nothing happened on the site, so no News entry nor push.
    refines_state = Column(Boolean, nullable=True)

    request_count = Column(Integer, nullable=False, default=0)
    confidence = Column(Integer, nullable=False, default=0)

    # Who *proposed* this change — drives the News feed credit/badge.
    # "community" (crowdsourced user) | "admin" (direct admin action)
    # | "scraper" (invader-spotter.art) | "invaderquest" (InvaderQuest open data)
    source = Column(String, nullable=False, default="community")
    # Who *validated* it (traceability only, never displayed in the app).
    validated_by = Column(String, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    reviewed_at = Column(DateTime, nullable=True)
    reviewed_by = Column(Integer, ForeignKey("users.id"), nullable=True)
