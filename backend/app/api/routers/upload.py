import io
import logging
import traceback
from datetime import datetime

from fastapi import APIRouter, File, UploadFile, HTTPException, Depends
from PIL import Image, ImageOps
from sqlalchemy.orm import Session

log = logging.getLogger("upload")

from app.dependencies import get_current_user, get_db
from app.models.user_request import UserRequest
from app.models.admin_request import AdminRequest
from app.core.db_utils import safe_commit
from app.core import r2

router = APIRouter(prefix="/upload", tags=["Upload"])

_MAX_BYTES = 8 * 1024 * 1024   # 8 MB raw upload limit
_TARGET_PX = 800               # output square size in pixels


class ImageTooSmall(ValueError):
    """Raised when the centre-cropped square would be smaller than the target size."""


def _crop_to_square_jpeg(data: bytes, size: int = _TARGET_PX) -> bytes:
    """Centre-crop then resize to size×size JPEG, quality 85.
    Raises ImageTooSmall when the input's shortest side is below `size` — we refuse
    to upscale because the output would just be a blurry version of the original."""
    img = Image.open(io.BytesIO(data))
    img = ImageOps.exif_transpose(img)  # honour EXIF orientation tag from phone cameras
    img = img.convert("RGB")
    w, h = img.size
    side = min(w, h)
    if side < size:
        raise ImageTooSmall(f"image is {w}x{h}, minimum required is {size}x{size} after centre crop")
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
    except ImageTooSmall as e:
        raise HTTPException(status_code=422, detail=f"Image too small: {e}")
    except Exception as e:
        log.error("upload: image processing failed: %s\n%s", e, traceback.format_exc())
        raise HTTPException(status_code=422, detail=f"Could not process image: {e}")

    url = r2.upload_request_photo(request_id, jpeg_bytes)
    req.proposed_image_url = url
    req.updated_at = datetime.utcnow()

    # Propagate to the linked AdminRequest if it has no image yet
    if req.admin_request_id:
        admin_req = db.query(AdminRequest).filter(AdminRequest.id == req.admin_request_id).first()
        if admin_req and admin_req.proposed_image_url is None:
            admin_req.proposed_image_url = url

    safe_commit(db)

    return {"url": url}
