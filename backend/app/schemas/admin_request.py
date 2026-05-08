from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class AdminRequestOut(BaseModel):
    id: int
    invader_id: Optional[int]
    request_type: str
    status: str
    proposed_name: Optional[str]
    normalized_name: Optional[str]
    proposed_description: Optional[str]
    proposed_latitude: Optional[float]
    proposed_longitude: Optional[float]
    proposed_points: Optional[int]
    proposed_state: Optional[str]
    proposed_image_url: Optional[str]
    request_count: int
    confidence: int
    created_at: datetime
    updated_at: datetime
    reviewed_at: Optional[datetime]
    reviewed_by: Optional[int]

    class Config:
        from_attributes = True
