import json
from pathlib import Path
from fastapi import APIRouter, HTTPException
from fastapi.responses import RedirectResponse

router = APIRouter(tags=["APK"])

_MANIFEST_PATH = Path(__file__).resolve().parents[3] / "static" / "apk" / "version.json"


@router.get("/apk/download")
def apk_download():
    try:
        data = json.loads(_MANIFEST_PATH.read_text())
    except (FileNotFoundError, json.JSONDecodeError):
        raise HTTPException(status_code=503, detail="APK manifest unavailable")
    url = data.get("url")
    if not url:
        raise HTTPException(status_code=503, detail="APK URL missing from manifest")
    return RedirectResponse(url=url)
