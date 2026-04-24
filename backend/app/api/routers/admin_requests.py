from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from app.dependencies import get_db, require_admin
from app.models.admin_request import AdminRequest
from app.models.user_request import UserRequest
from app.models.space_invader import Invader
from app.schemas.admin_request import AdminRequestOut
from app.core.db_utils import safe_commit

router = APIRouter(prefix="/admin-requests", tags=["Admin Requests"])


@router.get("/", response_model=List[AdminRequestOut])
def list_admin_requests(
    db: Session = Depends(get_db),
    admin=Depends(require_admin),
):
    return db.query(AdminRequest).all()


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


@router.post("/{admin_request_id}/approve")
def approve_admin_request(
    admin_request_id: int,
    db: Session = Depends(get_db),
    admin=Depends(require_admin),
):
    admin_req = db.query(AdminRequest).filter(AdminRequest.id == admin_request_id).first()
    if not admin_req:
        raise HTTPException(status_code=404, detail="AdminRequest not found")
    if admin_req.status != "pending":
        raise HTTPException(status_code=400, detail="AdminRequest is not pending")

    if admin_req.request_type == "create":
        invader = Invader(
            name=admin_req.proposed_name,
            description=admin_req.proposed_description,
            latitude=admin_req.proposed_latitude,
            longitude=admin_req.proposed_longitude,
            points=admin_req.proposed_points,
            state=admin_req.proposed_state or "active",
            image_url=admin_req.proposed_image_url,
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
        if admin_req.proposed_latitude is not None:
            invader.latitude = admin_req.proposed_latitude
        if admin_req.proposed_longitude is not None:
            invader.longitude = admin_req.proposed_longitude
        if admin_req.proposed_points is not None:
            invader.points = admin_req.proposed_points
        if admin_req.proposed_state is not None:
            invader.state = admin_req.proposed_state
        if admin_req.proposed_image_url is not None:
            invader.image_url = admin_req.proposed_image_url

    # Mark all linked user requests as processed
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

    # Mark all linked user requests as rejected
    db.query(UserRequest).filter(
        UserRequest.admin_request_id == admin_req.id
    ).update({"status": "rejected", "updated_at": datetime.utcnow()})

    admin_req.status = "rejected"
    admin_req.reviewed_by = admin.id
    admin_req.reviewed_at = datetime.utcnow()

    safe_commit(db)
    return {"message": "AdminRequest rejected"}
