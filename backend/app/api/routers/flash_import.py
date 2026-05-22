"""
Flash Import feature — HTTP router.

POST /flash-import/  — bulk-create user progress from a list of invader names.
Authenticated; uses the JWT subject as the user_id.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.dependencies import get_db, get_current_user
from app.schemas.flash_import import FlashImportRequest, FlashImportResponse
from app.services import flash_import_service
from app.services.flash_import_service import UserMissing

router = APIRouter(prefix="/flash-import", tags=["Flash Import"])


@router.post("/", response_model=FlashImportResponse)
def import_flashes(
    payload: FlashImportRequest,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        return flash_import_service.import_flashes(db, current_user.id, payload.names)
    except UserMissing:
        raise HTTPException(status_code=404, detail="User not found")
