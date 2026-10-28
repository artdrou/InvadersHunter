from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.dependencies import get_db, get_current_user
from app.schemas.avatar import AvatarBody
from app.services import avatar_service

router = APIRouter(prefix="/avatar", tags=["Avatar"])


@router.get("/me", response_model=AvatarBody)
def get_my_avatar(current_user=Depends(get_current_user)):
    """My profile icon (null = default)."""
    return {"avatar": avatar_service.get_avatar(current_user)}


@router.put("/me", response_model=AvatarBody)
def set_my_avatar(body: AvatarBody, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    """Save my profile icon; null resets it to the default."""
    return {"avatar": avatar_service.set_avatar(db, current_user, body.avatar)}
