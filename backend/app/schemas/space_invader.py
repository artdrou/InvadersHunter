from pydantic import BaseModel, Field
from typing import Optional

class InvaderBase(BaseModel):
    name: str
    description: Optional[str] = None
    points: Optional[int] = None
    state: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None

class InvaderCreate(InvaderBase):
    pass

class InvaderUpdate(BaseModel):
    name: Optional[str] = None
    image_url: Optional[str] = None
    description: Optional[str] = None
    points: Optional[int] = None
    state: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None

class InvaderOut(BaseModel):
    id: int
    name: str
    description: str
    state: str
    latitude: float
    longitude: float

    class Config:
        from_attributes = True  # remplace orm_mode en Pydantic V2