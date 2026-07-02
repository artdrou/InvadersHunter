"""
Business logic for the News feed.

Invader news is *derived* from approved AdminRequests (no duplicated table):
each approved request is a create/modify event, dated by `reviewed_at` and linked
to its invader by `invader_id`. General announcements/releases live in their own
small `announcements` table. Both are merged into one date-sorted feed.
"""
from datetime import datetime, timedelta
from typing import List, Optional

from sqlalchemy.orm import Session

from ..models.admin_request import AdminRequest
from ..models.user_request import UserRequest
from ..models.user import User
from ..models.space_invader import Invader
from ..models.announcement import Announcement
from ..schemas.news import NewsItemOut, AnnouncementCreate

DEFAULT_WINDOW_DAYS = 30
SCRAPER_LABEL = "invader-spotter.art"
ADMIN_LABEL = "Equipe"  # accent-free: the app's pixel font has no accented glyphs


def _credit_label(db: Session, admin_req: AdminRequest) -> Optional[str]:
    """Who to credit for an invader event, based on the *proposer* (`source`)."""
    if admin_req.source == "scraper":
        return SCRAPER_LABEL
    if admin_req.source == "admin":
        return ADMIN_LABEL
    # community: whoever submitted the first UserRequest feeding this AdminRequest
    row = (
        db.query(User.username)
        .join(UserRequest, UserRequest.user_id == User.id)
        .filter(UserRequest.admin_request_id == admin_req.id)
        .order_by(UserRequest.created_at.asc())
        .first()
    )
    return row[0] if row else None


def list_news(db: Session, before: Optional[datetime], limit: int) -> List[NewsItemOut]:
    """Unified feed, newest first.

    Without `before`: only the last 30 days. With `before` (cursor): items strictly
    older than it, capped at `limit`. Merges invader events + announcements.
    """
    # Compare naive-vs-naive: reviewed_at/created_at are stored as naive UTC.
    if before is not None and before.tzinfo is not None:
        before = before.replace(tzinfo=None)

    invader_q = (
        db.query(AdminRequest, Invader)
        .outerjoin(Invader, Invader.id == AdminRequest.invader_id)
        .filter(AdminRequest.status == "approved", AdminRequest.reviewed_at.isnot(None))
    )
    ann_q = db.query(Announcement)

    if before is not None:
        invader_q = invader_q.filter(AdminRequest.reviewed_at < before)
        ann_q = ann_q.filter(Announcement.created_at < before)
    else:
        cutoff = datetime.utcnow() - timedelta(days=DEFAULT_WINDOW_DAYS)
        invader_q = invader_q.filter(AdminRequest.reviewed_at >= cutoff)
        ann_q = ann_q.filter(Announcement.created_at >= cutoff)

    items: List[NewsItemOut] = []

    for admin_req, invader in invader_q.order_by(AdminRequest.reviewed_at.desc()).limit(limit).all():
        changes: List[str] = []
        if admin_req.proposed_name is not None:
            changes.append("name")
        if admin_req.proposed_state is not None:
            changes.append("state")
        if admin_req.proposed_latitude is not None or admin_req.proposed_longitude is not None:
            changes.append("location")
        if admin_req.proposed_points is not None:
            changes.append("points")
        if admin_req.proposed_image_url is not None:
            changes.append("image")
        if admin_req.proposed_description is not None:
            changes.append("description")
        items.append(NewsItemOut(
            type="invader_added" if admin_req.request_type == "create" else "invader_updated",
            date=admin_req.reviewed_at,
            source=admin_req.source,
            credit_label=_credit_label(db, admin_req),
            invader_id=admin_req.invader_id,
            invader_name=(invader.name if invader else admin_req.proposed_name),
            city=(invader.city if invader else None),
            image_url=(invader.image_url if invader else admin_req.proposed_image_url),
            changes=changes,
            new_state=admin_req.proposed_state,
            new_points=admin_req.proposed_points,
        ))

    for ann in ann_q.order_by(Announcement.created_at.desc()).limit(limit).all():
        items.append(NewsItemOut(
            type="release" if ann.kind == "release" else "announcement",
            date=ann.created_at,
            title=ann.title,
            body=ann.body,
            version=ann.version,
        ))

    items.sort(key=lambda item: item.date, reverse=True)
    return items[:limit]


def create_announcement(db: Session, data: AnnouncementCreate) -> Announcement:
    ann = Announcement(kind=data.kind, title=data.title, body=data.body, version=data.version)
    db.add(ann)
    db.flush()
    db.refresh(ann)
    return ann
