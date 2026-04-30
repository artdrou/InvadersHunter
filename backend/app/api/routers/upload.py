import os
import io
import uuid
from datetime import datetime

import boto3
from botocore.config import Config
from fastapi import APIRouter, File, UploadFile, HTTPException, Depends
from PIL import Image
from sqlalchemy.orm import Session

from app.dependencies import get_current_user, get_db
from app.models.user_request import UserRequest
from app.models.admin_request import AdminRequest
from app.core.db_utils import safe_commit

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


@router.post("/request-photo/{request_id}")
async def upload_request_photo(
    request_id: int,
    file: UploadFile = File(...),
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Accept an image for an existing UserRequest, crop to 800×800 square, store in R2
    under createRequests/<request_id>/<timestamp>_<uuid>.jpg, and update the request record.
    Returns {"url": "<public url>"}.
    """
    req = db.query(UserRequest).filter(UserRequest.id == request_id).first()
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")
    if req.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not allowed")

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
    key = f"createRequests/{request_id}/{ts}_{uid}.jpg"

    client = _r2_client()
    client.put_object(
        Bucket=_R2_BUCKET,
        Key=key,
        Body=jpeg_bytes,
        ContentType="image/jpeg",
    )

    url = f"{_R2_PUBLIC}/{key}"
    req.proposed_image_url = url
    req.updated_at = datetime.utcnow()

    # Propagate to the linked AdminRequest if it has no image yet
    if req.admin_request_id:
        admin_req = db.query(AdminRequest).filter(AdminRequest.id == req.admin_request_id).first()
        if admin_req and admin_req.proposed_image_url is None:
            admin_req.proposed_image_url = url

    safe_commit(db)

    return {"url": url}
