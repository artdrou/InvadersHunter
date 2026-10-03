"""
Flash Import feature — HTTP router.

POST /flash-import/  — bulk-create user progress from a list of invader names.
Authenticated; uses the JWT subject as the user_id.

GET /static/flash_import/InvadersHunter-FlashImport.exe — the PC tool built for
this backend's environment. Registered before the /static mount in main.py so
it shadows the static path the app already links to.
"""
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import FileResponse
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


tool_router = APIRouter(tags=["Flash Import"])


@tool_router.get("/static/flash_import/InvadersHunter-FlashImport.exe", include_in_schema=False)
def download_tool(request: Request):
    path = flash_import_service.tool_exe_for_host(request.url.hostname or "")
    return FileResponse(
        path,
        media_type="application/octet-stream",
        filename="InvadersHunter-FlashImport.exe",
    )
