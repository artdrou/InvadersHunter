from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from typing import List, Optional

from app.dependencies import get_db, require_admin
from app.models.admin_request import AdminRequest
from app.models.user_request import UserRequest
from app.models.space_invader import Invader
from app.models.user import User
from app.schemas.admin_request import AdminRequestOut
from app.schemas.user_request import UserRequestOut
from app.core.db_utils import safe_commit

router = APIRouter(prefix="/admin-requests", tags=["Admin Requests"])


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
    req = db.query(AdminRequest).filter(AdminRequest.id == admin_request_id).first()
    if not req:
        raise HTTPException(status_code=404, detail="AdminRequest not found")
    return req


@router.get("/{admin_request_id}/submissions", response_model=List[UserRequestOut])
def get_admin_request_submissions(
    admin_request_id: int,
    db: Session = Depends(get_db),
    admin=Depends(require_admin),
):
    """Return the individual user requests that feed this admin request."""
    admin_req = db.query(AdminRequest).filter(AdminRequest.id == admin_request_id).first()
    if not admin_req:
        raise HTTPException(status_code=404, detail="AdminRequest not found")
    rows = (
        db.query(UserRequest, User.username)
        .join(User, User.id == UserRequest.user_id)
        .filter(UserRequest.admin_request_id == admin_request_id)
        .all()
    )
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
    admin_req = db.query(AdminRequest).filter(AdminRequest.id == admin_request_id).first()
    if not admin_req:
        raise HTTPException(status_code=404, detail="AdminRequest not found")
    if admin_req.status != "pending":
        raise HTTPException(status_code=400, detail="AdminRequest is not pending")

    # Admin-picked values override the aggregated proposals
    final_lat       = body.override_latitude  if body.override_latitude  is not None else admin_req.proposed_latitude
    final_lon       = body.override_longitude if body.override_longitude is not None else admin_req.proposed_longitude
    final_image_url = body.override_image_url if body.override_image_url is not None else admin_req.proposed_image_url

    if admin_req.request_type == "create":
        invader = Invader(
            name=admin_req.proposed_name,
            description=admin_req.proposed_description,
            latitude=final_lat,
            longitude=final_lon,
            points=admin_req.proposed_points,
            state=admin_req.proposed_state or "active",
            image_url=final_image_url,
        )
        db.add(invader)
        db.flush()
        admin_req.invader_id = invader.id

    elif admin_req.request_type == "modify":
        invader = db.query(Invader).filter(Invader.id == admin_req.invader_id).first()
        if not invader:
            raise HTTPException(status_code=404, detail="Target invader not found")
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

    db.query(UserRequest).filter(
        UserRequest.admin_request_id == admin_req.id
    ).update({"status": "processed", "updated_at": datetime.utcnow()})

    admin_req.status = "approved"
    admin_req.reviewed_by = admin.id
    admin_req.reviewed_at = datetime.utcnow()

    safe_commit(db)
    return {"message": "AdminRequest approved", "invader_id": admin_req.invader_id}


@router.post("/{admin_request_id}/reject")
def reject_admin_request(
    admin_request_id: int,
    db: Session = Depends(get_db),
    admin=Depends(require_admin),
):
    admin_req = db.query(AdminRequest).filter(AdminRequest.id == admin_request_id).first()
    if not admin_req:
        raise HTTPException(status_code=404, detail="AdminRequest not found")
    if admin_req.status != "pending":
        raise HTTPException(status_code=400, detail="AdminRequest is not pending")

    db.query(UserRequest).filter(
        UserRequest.admin_request_id == admin_req.id
    ).update({"status": "rejected", "updated_at": datetime.utcnow()})

    admin_req.status = "rejected"
    admin_req.reviewed_by = admin.id
    admin_req.reviewed_at = datetime.utcnow()

    safe_commit(db)
    return {"message": "AdminRequest rejected"}
