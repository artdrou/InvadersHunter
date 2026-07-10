from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime

from app.schemas.user_progress import UserProgressCreate, UserProgressOut, UserProgressUpdate
from app.dependencies import get_db, get_current_user, require_admin
from app.services import progress_service
from app.services.progress_service import (
    UserMissing, InvaderMissing, CaptureMissing, CaptureAlreadyExists,
)

router = APIRouter(prefix="/progress", tags=["Progress"])


def _check_owner_or_admin(owner_id: int, current_user) -> None:
    """Captures are user-scoped: only their owner (or an admin) may touch them."""
    if owner_id != current_user.id and not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Not allowed for this user")


@router.get("/", response_model=List[UserProgressOut])
def list_captures(db: Session = Depends(get_db), _admin=Depends(require_admin)):
    # Global listing exposes every user's activity — admin/debug only
    return progress_service.list_all(db)


@router.get("/user/{user_id}", response_model=List[UserProgressOut])
def get_user_captures(
    user_id: int,
    updated_since: Optional[datetime] = Query(default=None, description="Return only captures updated after this ISO timestamp"),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    _check_owner_or_admin(user_id, current_user)
    return progress_service.list_for_user(db, user_id, updated_since)


@router.post("/", response_model=UserProgressOut)
def add_capture(
    progress: UserProgressCreate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    _check_owner_or_admin(progress.user_id, current_user)
    try:
        return progress_service.flash(db, progress.user_id, progress.invader_id)
    except UserMissing:
        raise HTTPException(status_code=404, detail="User not found")
    except InvaderMissing:
        raise HTTPException(status_code=404, detail="Invader not found")
    except CaptureAlreadyExists:
        raise HTTPException(status_code=409, detail="Invader already flashed by this user")


@router.put("/{progress_id}", response_model=UserProgressOut)
def update_capture(
    progress_id: int,
    progress_update: UserProgressUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    try:
        capture = progress_service.get(db, progress_id)
    except CaptureMissing:
        raise HTTPException(status_code=404, detail="Capture not found")
    _check_owner_or_admin(capture.user_id, current_user)
    if progress_update.user_id is not None:
        # Reassigning a capture to someone else is admin territory
        _check_owner_or_admin(progress_update.user_id, current_user)
    try:
        return progress_service.update(
            db, progress_id,
            user_id=progress_update.user_id,
            invader_id=progress_update.invader_id,
            found_at=progress_update.found_at,
        )
    except CaptureMissing:
        raise HTTPException(status_code=404, detail="Capture not found")
    except UserMissing:
        raise HTTPException(status_code=404, detail="User not found")
    except InvaderMissing:
        raise HTTPException(status_code=404, detail="Invader not found")


@router.delete("/{progress_id}")
def delete_capture(
    progress_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    try:
        capture = progress_service.get(db, progress_id)
    except CaptureMissing:
        raise HTTPException(status_code=404, detail="Capture not found")
    _check_owner_or_admin(capture.user_id, current_user)
    progress_service.unflash(db, progress_id)
    return {"message": "Capture deleted successfully"}
