from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime

from app.schemas.space_invader import InvaderCreate, InvaderOut, InvaderUpdate
from app.schemas.admin_request import InvaderContributorsOut
from app.dependencies import get_db
from app.services import invader_service, admin_request_service
from app.services.invader_service import InvaderMissing

router = APIRouter(prefix="/invaders", tags=["Invaders"])


@router.get("/deleted")
def list_deleted_invaders(
    updated_since: Optional[datetime] = Query(default=None),
    db: Session = Depends(get_db),
):
    """Return IDs of invaders deleted since updated_since (or all if omitted)."""
    return {"ids": invader_service.list_deleted_ids(db, updated_since)}


@router.get("/", response_model=List[InvaderOut])
def list_invaders(
    updated_since: Optional[datetime] = Query(default=None, description="Return only invaders updated after this ISO timestamp"),
    db: Session = Depends(get_db),
):
    return invader_service.list_all(db, updated_since)


@router.get("/{invader_id}", response_model=InvaderOut)
def get_invader(invader_id: int, db: Session = Depends(get_db)):
    try:
        return invader_service.get_by_id(db, invader_id)
    except InvaderMissing:
        raise HTTPException(status_code=404, detail="Invader not found")


@router.get("/{invader_id}/contributors", response_model=InvaderContributorsOut)
def get_invader_contributors(invader_id: int, db: Session = Depends(get_db)):
    try:
        invader_service.get_by_id(db, invader_id)
    except InvaderMissing:
        raise HTTPException(status_code=404, detail="Invader not found")
    return admin_request_service.get_invader_contributors(db, invader_id)


@router.post("/", response_model=InvaderOut)
def create_invader(invader: InvaderCreate, db: Session = Depends(get_db)):
    return invader_service.create(db, invader.model_dump())


@router.put("/{invader_id}", response_model=InvaderOut)
def update_invader(invader_id: int, invader_update: InvaderUpdate, db: Session = Depends(get_db)):
    try:
        return invader_service.update(db, invader_id, invader_update.model_dump(exclude_unset=True))
    except InvaderMissing:
        raise HTTPException(status_code=404, detail="Invader not found")


@router.delete("/{invader_id}")
def delete_invader(invader_id: int, db: Session = Depends(get_db)):
    try:
        invader_service.delete(db, invader_id)
    except InvaderMissing:
        raise HTTPException(status_code=404, detail="Invader not found")
    return {"message": "Invader deleted successfully"}
