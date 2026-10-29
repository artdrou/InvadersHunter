from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.dependencies import get_db, require_admin
from app.schemas.news import NewsItemOut, AnnouncementCreate, AnnouncementOut, ReactivationOut
from app.services import news_service

router = APIRouter(prefix="/news", tags=["News"])


@router.get("/", response_model=List[NewsItemOut])
def list_news(
    before: Optional[datetime] = None,
    limit: int = 30,
    db: Session = Depends(get_db),
):
    """Public unified feed. No `before` → last 30 days; `before` = cursor for older items."""
    limit = max(1, min(limit, 100))
    return news_service.list_news(db, before, limit)


@router.get("/reactivations", response_model=List[ReactivationOut])
def list_reactivations(db: Session = Depends(get_db)):
    """Public: invaders reactivated in the last 60 days (map "Reactivated" state color)."""
    return news_service.list_reactivations(db)


@router.post("/announcements", response_model=AnnouncementOut)
def create_announcement(
    body: AnnouncementCreate,
    db: Session = Depends(get_db),
    admin=Depends(require_admin),
):
    return news_service.create_announcement(db, body)
