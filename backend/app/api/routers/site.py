"""Presentation website (static files in static/site/)."""
from fastapi import APIRouter
from fastapi.responses import RedirectResponse

router = APIRouter(tags=["Site"])


@router.get("/site", include_in_schema=False)
def site():
    return RedirectResponse("/static/site/index.html")
