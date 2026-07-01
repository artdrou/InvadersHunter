from pydantic import BaseModel
from typing import Optional, Literal
from datetime import datetime


NewsType = Literal["invader_added", "invader_updated", "announcement", "release"]
NewsSource = Literal["community", "admin", "scraper"]


class NewsItemOut(BaseModel):
    """One entry in the unified News feed.

    Invader events (`invader_added`/`invader_updated`) carry `source`, `credit_label`
    and the invader payload. Announcements/releases carry `title`/`body`/`version`.
    """
    type: NewsType
    date: datetime

    # Invader events
    source: Optional[NewsSource] = None
    credit_label: Optional[str] = None   # username | "Équipe" | "invader-spotter.art"
    invader_id: Optional[int] = None
    invader_name: Optional[str] = None
    city: Optional[str] = None
    image_url: Optional[str] = None

    # Announcements / releases
    title: Optional[str] = None
    body: Optional[str] = None
    version: Optional[str] = None


class AnnouncementCreate(BaseModel):
    kind: Literal["announcement", "release"] = "announcement"
    title: str
    body: Optional[str] = None
    version: Optional[str] = None


class AnnouncementOut(BaseModel):
    id: int
    kind: str
    title: str
    body: Optional[str] = None
    version: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True  # remplace orm_mode en Pydantic V2
