"""
Schemas for personal ("custom") invaders — owner-scoped, never part of the
community dataset. See models/custom_invader.py.
"""
from pydantic import BaseModel, Field
from typing import Literal, Optional
from datetime import date, datetime

# The six marker silhouettes the owner can pick from, named by point tier.
# None → follow `points`, i.e. look like a community invader of the same tier.
IconShape = Literal[10, 20, 30, 40, 50, 100]


class CustomInvaderBase(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    city: Optional[str] = None
    number: Optional[int] = None
    image_url: Optional[str] = None
    description: Optional[str] = None
    points: Optional[int] = None
    state: Optional[str] = None
    latitude: Optional[float] = Field(default=None, ge=-90, le=90)
    longitude: Optional[float] = Field(default=None, ge=-180, le=180)
    date_pose: Optional[date] = None
    icon_shape: Optional[IconShape] = None


class CustomInvaderCreate(CustomInvaderBase):
    pass


class CustomInvaderUpdate(BaseModel):
    # Every field optional: PATCH-like semantics via exclude_unset on the router.
    name: Optional[str] = Field(default=None, min_length=1, max_length=120)
    city: Optional[str] = None
    number: Optional[int] = None
    image_url: Optional[str] = None
    description: Optional[str] = None
    points: Optional[int] = None
    state: Optional[str] = None
    latitude: Optional[float] = Field(default=None, ge=-90, le=90)
    longitude: Optional[float] = Field(default=None, ge=-180, le=180)
    date_pose: Optional[date] = None
    icon_shape: Optional[IconShape] = None


class CustomInvaderOut(CustomInvaderBase):
    id: int
    user_id: int
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True
