from pydantic import BaseModel
from typing import Optional
from datetime import date, datetime

class InvaderBase(BaseModel):
    name: str
    city: Optional[str] = None
    number: Optional[int] = None
    description: Optional[str] = None
    points: Optional[int] = None
    state: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    date_pose: Optional[date] = None

class InvaderCreate(InvaderBase):
    pass

class InvaderUpdate(BaseModel):
    name: Optional[str] = None
    city: Optional[str] = None
    number: Optional[int] = None
    image_url: Optional[str] = None
    description: Optional[str] = None
    points: Optional[int] = None
    state: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    date_pose: Optional[date] = None

class InvaderOut(BaseModel):
    id: int
    name: str
    city: Optional[str] = None
    number: Optional[int] = None
    image_url: Optional[str] = None
    description: Optional[str] = None
    points: Optional[int] = None
    state: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    date_pose: Optional[date] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True  # remplace orm_mode en Pydantic V2