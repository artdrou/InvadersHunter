from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from typing import List, Optional

from app.dependencies import get_db, require_admin
from app.models.admin_request import AdminRequest
from app.schemas.admin_request import AdminRequestOut
from app.schemas.user_request import UserRequestOut
from app.services import admin_request_service as service
from app.services.admin_request_service import (
    AdminRequestNotPending, TargetInvaderMissing,
)

router = APIRouter(prefix="/admin-requests", tags=["Admin Requests"])


def _get_admin_req_or_404(db: Session, admin_request_id: int) -> AdminRequest:
    req = db.query(AdminRequest).filter(AdminRequest.id == admin_request_id).first()
    if not req:
        raise HTTPException(status_code=404, detail="AdminRequest not found")
    return req


@router.get("/", response_model=List[AdminRequestOut])
def list_admin_requests(
    status: Optional[str] = None,
    request_type: Optional[str] = None,
    db: Session = Depends(get_db),
    admin=Depends(require_admin),
):
    query = db.query(AdminRequest)
    if status:
        query = query.filter(AdminRequest.status == status)
    if request_type:
        query = query.filter(AdminRequest.request_type == request_type)
    return query.order_by(AdminRequest.id.desc()).all()


@router.get("/{admin_request_id}", response_model=AdminRequestOut)
def get_admin_request(
    admin_request_id: int,
    db: Session = Depends(get_db),
    admin=Depends(require_admin),
):
    return _get_admin_req_or_404(db, admin_request_id)


@router.get("/{admin_request_id}/submissions", response_model=List[UserRequestOut])
def get_admin_request_submissions(
    admin_request_id: int,
    db: Session = Depends(get_db),
    admin=Depends(require_admin),
):
    """Return the individual user requests that feed this admin request, with usernames."""
    _get_admin_req_or_404(db, admin_request_id)  # 404 if missing
    rows = service.list_submissions_with_username(db, admin_request_id)
    result = []
    for req, username in rows:
        out = UserRequestOut.model_validate(req)
        out.username = username
        result.append(out)
    return result


class ApproveBody(BaseModel):
    override_latitude: Optional[float] = None
    override_longitude: Optional[float] = None
    override_image_url: Optional[str] = None


@router.post("/{admin_request_id}/approve")
def approve_admin_request(
    admin_request_id: int,
    body: ApproveBody = ApproveBody(),
    db: Session = Depends(get_db),
    admin=Depends(require_admin),
):
    admin_req = _get_admin_req_or_404(db, admin_request_id)
    try:
        service.approve(
            db, admin_req, admin,
            override_latitude=body.override_latitude,
            override_longitude=body.override_longitude,
            override_image_url=body.override_image_url,
        )
    except AdminRequestNotPending:
        raise HTTPException(status_code=400, detail="AdminRequest is not pending")
    except TargetInvaderMissing:
        raise HTTPException(status_code=404, detail="Target invader not found")
    return {"message": "AdminRequest approved", "invader_id": admin_req.invader_id}


@router.post("/{admin_request_id}/reject")
def reject_admin_request(
    admin_request_id: int,
    db: Session = Depends(get_db),
    admin=Depends(require_admin),
):
    admin_req = _get_admin_req_or_404(db, admin_request_id)
    try:
        service.reject(db, admin_req, admin)
    except AdminRequestNotPending:
        raise HTTPException(status_code=400, detail="AdminRequest is not pending")
    return {"message": "AdminRequest rejected"}
