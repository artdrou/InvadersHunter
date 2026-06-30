"""
Business logic for the admin-side workflow on AdminRequests.

Routers stay thin: they only do auth, look up the AdminRequest by id, translate
domain errors to HTTP responses, and serialize the result. Everything else
(state transitions, invader creation/update, photo cleanup) lives here.
"""
from datetime import datetime
from typing import List, Optional, Tuple
from sqlalchemy.orm import Session

from ..models.admin_request import AdminRequest
from ..models.user_request import UserRequest
from ..models.space_invader import Invader
from ..models.user import User
from ..core.db_utils import safe_commit
from ..core import r2


class AdminRequestNotPending(Exception):
    """Approve/reject called on a request whose status isn't 'pending'."""


class TargetInvaderMissing(Exception):
    """Modify-approve target invader has been deleted between submission and approval."""


def list_submissions_with_username(
    db: Session, admin_request_id: int
) -> List[Tuple[UserRequest, Optional[str]]]:
    """Return (UserRequest, username) tuples for every submission feeding this AdminRequest."""
    return (
        db.query(UserRequest, User.username)
        .join(User, User.id == UserRequest.user_id)
        .filter(UserRequest.admin_request_id == admin_request_id)
        .all()
    )


def get_invader_contributors(db: Session, invader_id: int) -> dict:
    """Who discovered/modified this invader, based on approved AdminRequests.

    For each approved AdminRequest targeting this invader (create or modify),
    credit goes to whoever submitted the *first* UserRequest feeding it.
    """
    admin_reqs = (
        db.query(AdminRequest)
        .filter(AdminRequest.invader_id == invader_id, AdminRequest.status == "approved")
        .order_by(AdminRequest.created_at.asc())
        .all()
    )

    created_by: Optional[dict] = None
    modified_by: List[dict] = []

    for admin_req in admin_reqs:
        first_submission = (
            db.query(UserRequest, User.username)
            .join(User, User.id == UserRequest.user_id)
            .filter(UserRequest.admin_request_id == admin_req.id)
            .order_by(UserRequest.created_at.asc())
            .first()
        )
        if not first_submission:
            continue
        user_request, username = first_submission
        entry = {"username": username, "at": user_request.created_at}

        if admin_req.request_type == "create" and created_by is None:
            created_by = entry
        elif admin_req.request_type == "modify":
            modified_by.append(entry)

    return {"created_by": created_by, "modified_by": modified_by}


def _submission_photo_urls(db: Session, admin_request_id: int) -> List[str]:
    return [
        url for (url,) in db.query(UserRequest.proposed_image_url)
        .filter(UserRequest.admin_request_id == admin_request_id)
        .all()
        if url
    ]


def _prune_photos(urls: List[str], keep_url: Optional[str]) -> None:
    """Best-effort R2 cleanup; failures are logged inside r2.delete_object."""
    if not r2.is_configured():
        return
    for url in urls:
        if url and url != keep_url:
            r2.delete_object(url)


def approve(
    db: Session,
    admin_req: AdminRequest,
    admin_user: User,
    override_latitude: Optional[float] = None,
    override_longitude: Optional[float] = None,
    override_image_url: Optional[str] = None,
) -> AdminRequest:
    if admin_req.status != "pending":
        raise AdminRequestNotPending()

    # Admin-picked values fall back to the aggregated proposal when None
    final_lat       = override_latitude   if override_latitude   is not None else admin_req.proposed_latitude
    final_lon       = override_longitude  if override_longitude  is not None else admin_req.proposed_longitude
    final_image_url = override_image_url  if override_image_url  is not None else admin_req.proposed_image_url

    if admin_req.request_type == "create":
        invader = Invader(
            name=admin_req.proposed_name,
            description=admin_req.proposed_description,
            latitude=final_lat,
            longitude=final_lon,
            points=admin_req.proposed_points,
            state=admin_req.proposed_state or "active",
            image_url=final_image_url,
            date_pose=admin_req.proposed_date_pose,
        )
        db.add(invader)
        db.flush()
        admin_req.invader_id = invader.id

    elif admin_req.request_type == "modify":
        invader = db.query(Invader).filter(Invader.id == admin_req.invader_id).first()
        if not invader:
            raise TargetInvaderMissing()
        if admin_req.proposed_name is not None:
            invader.name = admin_req.proposed_name
        if admin_req.proposed_description is not None:
            invader.description = admin_req.proposed_description
        if final_lat is not None:
            invader.latitude = final_lat
        if final_lon is not None:
            invader.longitude = final_lon
        if admin_req.proposed_points is not None:
            invader.points = admin_req.proposed_points
        if admin_req.proposed_state is not None:
            invader.state = admin_req.proposed_state
        if final_image_url is not None:
            invader.image_url = final_image_url
        if admin_req.proposed_date_pose is not None:
            invader.date_pose = admin_req.proposed_date_pose

    submission_urls = _submission_photo_urls(db, admin_req.id)

    db.query(UserRequest).filter(
        UserRequest.admin_request_id == admin_req.id
    ).update({"status": "processed", "updated_at": datetime.utcnow()})

    admin_req.status = "approved"
    admin_req.reviewed_by = admin_user.id
    admin_req.reviewed_at = datetime.utcnow()

    safe_commit(db)
    _prune_photos(submission_urls, keep_url=final_image_url)
    return admin_req


def reject(db: Session, admin_req: AdminRequest, admin_user: User) -> AdminRequest:
    if admin_req.status != "pending":
        raise AdminRequestNotPending()

    submission_urls = _submission_photo_urls(db, admin_req.id)

    db.query(UserRequest).filter(
        UserRequest.admin_request_id == admin_req.id
    ).update({"status": "rejected", "updated_at": datetime.utcnow()})

    admin_req.status = "rejected"
    admin_req.reviewed_by = admin_user.id
    admin_req.reviewed_at = datetime.utcnow()

    safe_commit(db)
    _prune_photos(submission_urls, keep_url=None)  # nothing kept on reject
    return admin_req
