from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from app.schemas.space_invader import InvaderCreate, InvaderOut
from app.models.space_invader import Invader
from app.database import SessionLocal

router = APIRouter(prefix="/invaders", tags=["Invaders"])

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@router.get("/", response_model=List[InvaderOut])
def list_invaders(db: Session = Depends(get_db)):
    return db.query(Invader).all()

@router.post("/", response_model=InvaderOut)
def create_invader(invader: InvaderCreate, db: Session = Depends(get_db)):
    new_invader = Invader(**invader.dict())
    db.add(new_invader)
    db.commit()
    db.refresh(new_invader)
    return new_invader