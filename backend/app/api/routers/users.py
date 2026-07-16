from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from typing import List

from app.schemas.user import UserCreate, UserOut, UserUpdate
from app.dependencies import get_db, get_current_user, require_admin
from app.services import user_service
from app.services.user_service import UserMissing, UsernameTaken, EmailTaken

router = APIRouter(prefix="/users", tags=["Users"])


def _check_owner_or_admin(user_id: int, current_user) -> None:
    if user_id != current_user.id and not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Not allowed for this user")


@router.get("/", response_model=List[UserOut])
def list_users(db: Session = Depends(get_db), _admin=Depends(require_admin)):
    # Exposes every account (usernames + emails) — admin only
    return user_service.list_all(db)


@router.post("/", response_model=UserOut)
async def create_user(
    user: UserCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    # Public: this is the registration endpoint
    try:
        new_user, welcome_email_fn, email_address = user_service.register(
            db, user.username, user.email, user.password
        )
    except UsernameTaken:
        raise HTTPException(status_code=400, detail="Username already exists")
    except EmailTaken:
        raise HTTPException(status_code=400, detail="Email already exists")

    background_tasks.add_task(welcome_email_fn, email_address)
    return new_user


@router.put("/{user_id}", response_model=UserOut)
def update_user(
    user_id: int,
    user_update: UserUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    _check_owner_or_admin(user_id, current_user)
    if user_update.is_admin is not None and not current_user.is_admin:
        # Privilege escalation guard: only admins may grant/revoke admin
        raise HTTPException(status_code=403, detail="Only admins can change admin status")
    try:
        return user_service.update(
            db, user_id,
            username=user_update.username,
            email=user_update.email,
            password=user_update.password,
            is_admin=user_update.is_admin,
        )
    except UserMissing:
        raise HTTPException(status_code=404, detail="User not found")
    except UsernameTaken:
        raise HTTPException(status_code=400, detail="Username already exists")
    except EmailTaken:
        raise HTTPException(status_code=400, detail="Email already exists")


@router.delete("/{user_id}")
def delete_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    _check_owner_or_admin(user_id, current_user)
    try:
        user_service.delete(db, user_id)
    except UserMissing:
        raise HTTPException(status_code=404, detail="User not found")
    return {"message": "User deleted successfully"}
