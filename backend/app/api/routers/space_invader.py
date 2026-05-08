from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import text
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime
from app.schemas.space_invader import InvaderCreate, InvaderOut, InvaderUpdate
from app.models.space_invader import Invader
from app.database import SessionLocal
from app.dependencies import get_db
from app.core.db_utils import safe_commit

router = APIRouter(prefix="/invaders", tags=["Invaders"])

@router.get("/deleted")
def list_deleted_invaders(
    updated_since: Optional[datetime] = Query(default=None),
    db: Session = Depends(get_db),
):
    """Return IDs of invaders deleted since updated_since (or all if omitted)."""
    sql = "SELECT invader_id FROM deleted_invaders"
    params: dict = {}
    if updated_since is not None:
        sql += " WHERE deleted_at > :since"
        params["since"] = updated_since
    rows = db.execute(text(sql), params).fetchall()
    return {"ids": [r[0] for r in rows]}


@router.get("/", response_model=List[InvaderOut])
def list_invaders(
    updated_since: Optional[datetime] = Query(default=None, description="Return only invaders updated after this ISO timestamp"),
    db: Session = Depends(get_db),
):
    query = db.query(Invader)
    if updated_since is not None:
        query = query.filter(Invader.updated_at > updated_since)
    return query.all()

@router.get("/{invader_id}", response_model=InvaderOut)
def get_invader(invader_id: int, db: Session = Depends(get_db)):
    inv = db.query(Invader).filter(Invader.id == invader_id).first()
    if not inv:
        raise HTTPException(status_code=404, detail="Invader not found")
    return inv

@router.post("/", response_model=InvaderOut)
def create_invader(invader: InvaderCreate, db: Session = Depends(get_db)):
    try:
        new_invader = Invader(**invader.model_dump())

        db.add(new_invader)
        safe_commit(db)
        db.refresh(new_invader)

        return new_invader

    except Exception:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail="Failed to create invader"
        )


@router.put("/{invader_id}", response_model=InvaderOut)
def update_invader(invader_id: int, invader_update: InvaderUpdate, db: Session = Depends(get_db)):
    try:
        db_invader = db.query(Invader).filter(Invader.id == invader_id).first()
        if not db_invader:
            raise HTTPException(status_code=404, detail="Invader not found")

        update_data = invader_update.model_dump(exclude_unset=True)

        for key, value in update_data.items():
            setattr(db_invader, key, value)

        safe_commit(db)
        db.refresh(db_invader)
        return db_invader

    except HTTPException:
        db.rollback()
        raise
    except Exception:
        db.rollback()
        raise HTTPException(status_code=500, detail="Failed to update invader")

@router.delete("/{invader_id}")
def delete_invader(invader_id: int, db: Session = Depends(get_db)):
    try:
        db_invader = db.query(Invader).filter(Invader.id == invader_id).first()
        if not db_invader:
            raise HTTPException(status_code=404, detail="Invader not found")

        db.execute(
            text("INSERT INTO deleted_invaders (invader_id, deleted_at) VALUES (:id, :now)"),
            {"id": invader_id, "now": datetime.utcnow()},
        )
        db.delete(db_invader)
        safe_commit(db)

        return {"message": "Invader deleted successfully"}

    except HTTPException:
        db.rollback()
        raise
    except Exception:
        db.rollback()
        raise HTTPException(status_code=500, detail="Failed to delete invader")