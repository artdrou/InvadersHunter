from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from app.schemas.user import UserCreate, UserOut, UserUpdate
from app.models.user import User
from typing import List
from app.database import SessionLocal, engine
from app.core import security, email
from passlib.context import CryptContext
from app.dependencies import get_db
from app.core.db_utils import safe_commit


router = APIRouter(prefix="/users", tags=["Users"])
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

@router.get("/", response_model=List[UserOut])
def list_users(db: Session = Depends(get_db)):
    return db.query(User).all()

@router.post("/", response_model=UserOut)
async def create_user(
    user: UserCreate,
    db: Session = Depends(get_db)
):
    try:
        existing_username = db.query(User).filter(User.username == user.username).first()
        if existing_username:
            raise HTTPException(status_code=400, detail="Username already exists")

        existing_email = db.query(User).filter(User.email == user.email).first()
        if existing_email:
            raise HTTPException(status_code=400, detail="Email already exists")

        hashed_password = security.hash_password(user.password)

        db_user = User(
            username=user.username,
            email=user.email,
            hashed_password=hashed_password
        )
        db.add(db_user)
        db.flush()

        await email.send_account_created_email(db_user.email)

        safe_commit(db)
        db.refresh(db_user)

        return db_user

    except HTTPException:
        db.rollback()
        raise

    except ConnectionError:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail="Account creation failed: confirmation email could not be sent"
        )

    except Exception:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail="Account creation failed"
        )
    
@router.put("/{user_id}", response_model=UserOut)
def update_user(user_id: int, user_update: UserUpdate, db: Session = Depends(get_db)):
    try:
        db_user = db.query(User).filter(User.id == user_id).first()

        if not db_user:
            raise HTTPException(status_code=404, detail="User not found")

        # Vérification username unique
        if user_update.username and user_update.username != db_user.username:
            existing_username = db.query(User).filter(User.username == user_update.username).first()
            if existing_username:
                raise HTTPException(status_code=400, detail="Username already exists")
            db_user.username = user_update.username

        # Vérification email unique
        if user_update.email and user_update.email != db_user.email:
            existing_email = db.query(User).filter(User.email == user_update.email).first()
            if existing_email:
                raise HTTPException(status_code=400, detail="Email already exists")
            db_user.email = user_update.email

        # Update password
        if user_update.password:
            db_user.hashed_password = security.hash_password(user_update.password)

        # Update admin flag
        if user_update.is_admin is not None:
            db_user.is_admin = user_update.is_admin

        safe_commit(db)
        db.refresh(db_user)

        return db_user

    except HTTPException:
        db.rollback()
        raise
    except Exception:
        db.rollback()
        raise HTTPException(status_code=500, detail="Failed to update user")


@router.delete("/{user_id}")
def delete_user(user_id: int, db: Session = Depends(get_db)):
    try:
        db_user = db.query(User).filter(User.id == user_id).first()

        if not db_user:
            raise HTTPException(status_code=404, detail="User not found")

        db.delete(db_user)
        safe_commit(db)

        return {"message": "User deleted successfully"}

    except HTTPException:
        db.rollback()
        raise
    except Exception:
        db.rollback()
        raise HTTPException(status_code=500, detail="Failed to delete user")