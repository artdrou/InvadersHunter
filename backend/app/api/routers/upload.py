import os
import io
import uuid
from datetime import datetime

import boto3
from botocore.config import Config
from fastapi import APIRouter, File, UploadFile, HTTPException, Depends
from PIL import Image

from app.dependencies import get_current_user

router = APIRouter(prefix="/upload", tags=["Upload"])

_R2_ENDPOINT  = os.getenv("R2_ENDPOINT_URL")      # https://<account_id>.r2.cloudflarestorage.com
_R2_KEY_ID    = os.getenv("R2_ACCESS_KEY_ID")
_R2_SECRET    = os.getenv("R2_SECRET_ACCESS_KEY")
_R2_BUCKET    = os.getenv("R2_BUCKET")
_R2_PUBLIC    = os.getenv("R2_PUBLIC_URL", "").rstrip("/")  # https://pub-xxx.r2.dev or custom domain

_MAX_BYTES    = 8 * 1024 * 1024   # 8 MB raw upload limit
_TARGET_PX    = 800               # output square size in pixels


def _r2_client():
    if not all([_R2_ENDPOINT, _R2_KEY_ID, _R2_SECRET, _R2_BUCKET, _R2_PUBLIC]):
        raise HTTPException(status_code=503, detail="R2 storage is not configured")
    return boto3.client(
        "s3",
        endpoint_url=_R2_ENDPOINT,
        aws_access_key_id=_R2_KEY_ID,
        aws_secret_access_key=_R2_SECRET,
        config=Config(signature_version="s3v4"),
    )


def _crop_to_square_jpeg(data: bytes, size: int = _TARGET_PX) -> bytes:
    """Centre-crop then resize to size×size JPEG, quality 85."""
    img = Image.open(io.BytesIO(data)).convert("RGB")
    w, h = img.size
    side = min(w, h)
    left = (w - side) // 2
    top  = (h - side) // 2
    img  = img.crop((left, top, left + side, top + side))
    img  = img.resize((size, size), Image.LANCZOS)
    buf  = io.BytesIO()
    img.save(buf, format="JPEG", quality=85, optimize=True)
    return buf.getvalue()


@router.post("/request-photo")
async def upload_request_photo(
    file: UploadFile = File(...),
    current_user=Depends(get_current_user),
):
    """
    Accept an image upload, crop it to a square, resize to 800×800, and store it
    in R2 under  requests/<user_id>/<timestamp>_<uuid>.jpg.
    Returns {"url": "<public url>"}.
    """
    raw = await file.read()
    if len(raw) > _MAX_BYTES:
        raise HTTPException(status_code=413, detail="File too large (max 8 MB)")

    content_type = (file.content_type or "").lower()
    if not content_type.startswith("image/"):
        raise HTTPException(status_code=415, detail="Only image files are accepted")

    try:
        jpeg_bytes = _crop_to_square_jpeg(raw)
    except Exception:
        raise HTTPException(status_code=422, detail="Could not process image")

    ts  = datetime.utcnow().strftime("%Y%m%d%H%M%S")
    uid = uuid.uuid4().hex[:8]
    key = f"requests/{current_user.id}/{ts}_{uid}.jpg"

    client = _r2_client()
    client.put_object(
        Bucket=_R2_BUCKET,
        Key=key,
        Body=jpeg_bytes,
        ContentType="image/jpeg",
    )

    return {"url": f"{_R2_PUBLIC}/{key}"}
