from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from app.schemas.user_progress import UserProgressCreate, UserProgressOut, UserProgressUpdate
from app.models.user_progress import UserProgress
from app.models.user import User
from app.models.space_invader import Invader
from app.dependencies import get_db
from app.core.db_utils import safe_commit

router = APIRouter(prefix="/progress", tags=["Progress"])

# List all invaders flashed
@router.get("/", response_model=List[UserProgressOut])
def list_captures(db: Session = Depends(get_db)):
    return db.query(UserProgress).all()

# List all captures by one user
@router.get("/user/{user_id}", response_model=List[UserProgressOut])
def get_user_captures(user_id: int, db: Session = Depends(get_db)):
    return db.query(UserProgress).filter(UserProgress.user_id == user_id).all()

# Add a capture
@router.post("/", response_model=UserProgressOut)
def add_capture(progress: UserProgressCreate, db: Session = Depends(get_db)):
    try:
        user = db.query(User).filter(User.id == progress.user_id).first()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        invader = db.query(Invader).filter(Invader.id == progress.invader_id).first()
        if not invader:
            raise HTTPException(status_code=404, detail="Invader not found")

        new_progress = UserProgress(**progress.model_dump())

        db.add(new_progress)
        safe_commit(db)
        db.refresh(new_progress)

        return new_progress

    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        print("CREATE CAPTURE ERROR:", e)
        raise HTTPException(status_code=500, detail="Failed to create capture")


@router.put("/{progress_id}", response_model=UserProgressOut)
def update_capture(progress_id: int, progress_update: UserProgressUpdate, db: Session = Depends(get_db)):
    try:
        db_progress = db.query(UserProgress).filter(UserProgress.id == progress_id).first()
        if not db_progress:
            raise HTTPException(status_code=404, detail="Capture not found")

        if progress_update.user_id is not None:
            user = db.query(User).filter(User.id == progress_update.user_id).first()
            if not user:
                raise HTTPException(status_code=404, detail="User not found")
            db_progress.user_id = progress_update.user_id

        if progress_update.invader_id is not None:
            invader = db.query(Invader).filter(Invader.id == progress_update.invader_id).first()
            if not invader:
                raise HTTPException(status_code=404, detail="Invader not found")
            db_progress.invader_id = progress_update.invader_id

        if progress_update.found_at is not None:
            db_progress.found_at = progress_update.found_at

        safe_commit(db)
        db.refresh(db_progress)
        return db_progress

    except HTTPException:
        db.rollback()
        raise
    except Exception:
        db.rollback()
        raise HTTPException(status_code=500, detail="Failed to update capture")


@router.delete("/{progress_id}")
def delete_capture(progress_id: int, db: Session = Depends(get_db)):
    try:
        db_progress = db.query(UserProgress).filter(UserProgress.id == progress_id).first()
        if not db_progress:
            raise HTTPException(status_code=404, detail="Capture not found")

        db.delete(db_progress)
        safe_commit(db)

        return {"message": "Capture deleted successfully"}

    except HTTPException:
        db.rollback()
        raise
    except Exception:
        db.rollback()
        raise HTTPException(status_code=500, detail="Failed to delete capture")

