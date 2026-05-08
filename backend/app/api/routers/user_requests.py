from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime

from app.dependencies import get_db, get_current_user
from app.models.space_invader import Invader  # noqa: F401 — ensures FK target is loaded
from app.schemas.user_request import UserRequestCreate, UserRequestOut
from app.services import user_request_service
from app.services.user_request_service import (
    InvalidRequestPayload, DuplicatePendingRequest,
    RequestMissing, NotRequestOwner, RequestNotPending,
)

router = APIRouter(prefix="/requests", tags=["Requests"])


@router.post("/", response_model=UserRequestOut)
def submit_request(
    data: UserRequestCreate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    try:
        return user_request_service.submit(db, current_user, data)
    except InvalidRequestPayload as e:
        raise HTTPException(status_code=400, detail=e.detail)
    except DuplicatePendingRequest:
        raise HTTPException(status_code=409, detail="You already have a pending request for this invader")


@router.get("/", response_model=List[UserRequestOut])
def list_requests(
    updated_since: Optional[datetime] = Query(default=None, description="Return only requests updated after this ISO timestamp"),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    return user_request_service.list_for_user(db, current_user, updated_since)


@router.get("/{request_id}", response_model=UserRequestOut)
def get_request(
    request_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    try:
        return user_request_service.get_by_id(db, current_user, request_id)
    except RequestMissing:
        raise HTTPException(status_code=404, detail="Request not found")
    except NotRequestOwner:
        raise HTTPException(status_code=403, detail="Not allowed")


@router.delete("/{request_id}")
def cancel_request(
    request_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    try:
        user_request_service.cancel(db, current_user, request_id)
    except RequestMissing:
        raise HTTPException(status_code=404, detail="Request not found")
    except NotRequestOwner:
        raise HTTPException(status_code=403, detail="Not allowed")
    except RequestNotPending:
        raise HTTPException(status_code=400, detail="Only pending requests can be cancelled")
    return {"message": "Request cancelled"}
