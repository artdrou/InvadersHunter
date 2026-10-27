from typing import Optional

from fastapi import APIRouter, Depends, Header, Request
from fastapi.responses import HTMLResponse
from sqlalchemy.orm import Session

from app.dependencies import get_db
from app.services import friend_link_service

router = APIRouter(tags=["Friend links"])


@router.get("/f/{code}", response_class=HTMLResponse, include_in_schema=False)
def friend_link(
    code: str,
    request: Request,
    db: Session = Depends(get_db),
    accept_language: Optional[str] = Header(None),
):
    """Friend link opened outside the app: invite page with the code and an Open button."""
    return friend_link_service.landing_page(db, code, request.headers.get("host"), accept_language)


@router.get("/.well-known/assetlinks.json", include_in_schema=False)
def asset_links():
    """Android App Links verification (which app packages may open /f/ links)."""
    return friend_link_service.asset_links()
