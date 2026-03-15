from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from app.schemas.user_progress import UserProgressCreate, UserProgressOut
from app.models.user_progress import UserProgress
from app.models.space_invader import Invader
from app.database import SessionLocal
from app.schemas.space_invader import InvaderOut

router = APIRouter(prefix="/progress", tags=["Progress"])

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# Add a capture
@router.post("/", response_model=UserProgressOut)
def add_capture(progress: UserProgressCreate, db: Session = Depends(get_db)):
    new_progress = UserProgress(**progress.dict())
    db.add(new_progress)
    db.commit()
    db.refresh(new_progress)
    return new_progress

# List all invaders flashed by one user
@router.get("/user/{user_id}", response_model=List[InvaderOut])
def get_user_invaders(user_id: int, db: Session = Depends(get_db)):
    invaders = (
        db.query(Invader)
        .join(UserProgress, UserProgress.invader_id == Invader.id)
        .filter(UserProgress.user_id == user_id, UserProgress.captured == True)
        .all()
    )
    return invaders