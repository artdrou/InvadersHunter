"""
Personal ("custom") invaders — private to their owner.

- GET    /custom-invaders/         list mine (delta via updated_since)
- GET    /custom-invaders/deleted  ids to prune from the local cache
- POST   /custom-invaders/         create
- PUT    /custom-invaders/{id}     update
- DELETE /custom-invaders/{id}     delete (+ tombstone)

All endpoints are authenticated and owner-scoped: the owner comes from the token,
so there is no user_id in any payload to tamper with.
"""
from typing import List, Optional
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.schemas.custom_invader import CustomInvaderCreate, CustomInvaderOut, CustomInvaderUpdate
from app.dependencies import get_db, get_current_user
from app.services import custom_invader_service
from app.services.custom_invader_service import CustomInvaderMissing

router = APIRouter(prefix="/custom-invaders", tags=["Custom Invaders"])


@router.get("/deleted")
def list_deleted_custom_invaders(
    updated_since: Optional[datetime] = Query(default=None),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Ids deleted since updated_since (or all tombstones if omitted)."""
    return {"ids": custom_invader_service.list_deleted_ids(db, current_user.id, updated_since)}


@router.get("/", response_model=List[CustomInvaderOut])
def list_custom_invaders(
    updated_since: Optional[datetime] = Query(default=None, description="Return only rows updated after this ISO timestamp"),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    return custom_invader_service.list_for_user(db, current_user.id, updated_since)


@router.post("/", response_model=CustomInvaderOut)
def create_custom_invader(
    data: CustomInvaderCreate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    return custom_invader_service.create(db, current_user.id, data.model_dump())


@router.put("/{custom_invader_id}", response_model=CustomInvaderOut)
def update_custom_invader(
    custom_invader_id: int,
    data: CustomInvaderUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    try:
        return custom_invader_service.update(
            db, custom_invader_id, current_user.id, data.model_dump(exclude_unset=True)
        )
    except CustomInvaderMissing:
        raise HTTPException(status_code=404, detail="Custom invader not found")


@router.delete("/{custom_invader_id}")
def delete_custom_invader(
    custom_invader_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    try:
        custom_invader_service.delete(db, custom_invader_id, current_user.id)
    except CustomInvaderMissing:
        raise HTTPException(status_code=404, detail="Custom invader not found")
    return {"message": "Custom invader deleted"}
