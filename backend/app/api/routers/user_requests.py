from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime

from app.dependencies import get_db, get_current_user
from app.models.user_request import UserRequest
from app.models.space_invader import Invader  # noqa: F401 — ensures FK target is loaded
from app.schemas.user_request import UserRequestCreate, UserRequestOut
from app.core.name_utils import normalize_name
from app.core.db_utils import safe_commit
from app.services.request_service import aggregate_request

router = APIRouter(prefix="/requests", tags=["Requests"])


@router.post("/", response_model=UserRequestOut)
def submit_request(
    data: UserRequestCreate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    # Validate business rules
    if data.request_type == "modify" and data.invader_id is None:
        raise HTTPException(status_code=400, detail="invader_id is required for a modify request")
    if data.request_type == "create" and data.invader_id is not None:
        raise HTTPException(status_code=400, detail="invader_id must be null for a create request")
    if data.request_type == "create" and not data.proposed_name:
        raise HTTPException(status_code=400, detail="proposed_name is required for a create request")

    norm = normalize_name(data.proposed_name) if data.proposed_name else None

    # Duplicate check: by normalized name for create/named modify, by invader_id for unnamed modify
    if norm:
        duplicate = (
            db.query(UserRequest)
            .filter(
                UserRequest.user_id == current_user.id,
                UserRequest.normalized_name == norm,
                UserRequest.request_type == data.request_type,
                UserRequest.status == "pending",
            )
            .first()
        )
    else:
        duplicate = (
            db.query(UserRequest)
            .filter(
                UserRequest.user_id == current_user.id,
                UserRequest.invader_id == data.invader_id,
                UserRequest.request_type == "modify",
                UserRequest.status == "pending",
            )
            .first()
        )
    if duplicate:
        raise HTTPException(
            status_code=409,
            detail="You already have a pending request for this invader",
        )

    new_req = UserRequest(
        user_id=current_user.id,
        invader_id=data.invader_id,
        request_type=data.request_type,
        status="pending",
        proposed_name=data.proposed_name,
        normalized_name=norm,
        proposed_description=data.proposed_description,
        proposed_latitude=data.proposed_latitude,
        proposed_longitude=data.proposed_longitude,
        proposed_points=data.proposed_points,
        proposed_state=data.proposed_state,
        proposed_image_url=data.proposed_image_url,
    )
    db.add(new_req)
    db.flush()  # get new_req.id before aggregation

    aggregate_request(db, new_req)

    safe_commit(db)
    db.refresh(new_req)
    return new_req


@router.get("/", response_model=List[UserRequestOut])
def list_requests(
    updated_since: Optional[datetime] = Query(default=None, description="Return only requests updated after this ISO timestamp"),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Admins see all requests; regular users see only their own."""
    if current_user.is_admin:
        query = db.query(UserRequest)
    else:
        query = db.query(UserRequest).filter(UserRequest.user_id == current_user.id)
    if updated_since is not None:
        query = query.filter(UserRequest.updated_at > updated_since)
    return query.all()


@router.get("/{request_id}", response_model=UserRequestOut)
def get_request(
    request_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    req = db.query(UserRequest).filter(UserRequest.id == request_id).first()
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")
    if not current_user.is_admin and req.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not allowed")
    return req


@router.delete("/{request_id}")
def cancel_request(
    request_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    req = db.query(UserRequest).filter(UserRequest.id == request_id).first()
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")
    if not current_user.is_admin and req.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not allowed")
    if req.status != "pending":
        raise HTTPException(status_code=400, detail="Only pending requests can be cancelled")

    db.delete(req)
    safe_commit(db)
    return {"message": "Request cancelled"}
