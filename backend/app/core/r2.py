"""Cloudflare R2 helpers — shared by upload and approval flows."""
import os
import uuid
import logging
import traceback
from datetime import datetime
from typing import Optional

import boto3
from botocore.config import Config
from fastapi import HTTPException

log = logging.getLogger("r2")

ENDPOINT   = os.getenv("R2_ENDPOINT_URL")
KEY_ID     = os.getenv("R2_ACCESS_KEY_ID")
SECRET     = os.getenv("R2_SECRET_ACCESS_KEY")
BUCKET     = os.getenv("R2_BUCKET")
PUBLIC_URL = (os.getenv("R2_PUBLIC_URL") or "").rstrip("/")


def is_configured() -> bool:
    return all([ENDPOINT, KEY_ID, SECRET, BUCKET, PUBLIC_URL])


def client():
    if not is_configured():
        raise HTTPException(status_code=503, detail="R2 storage is not configured")
    return boto3.client(
        "s3",
        endpoint_url=ENDPOINT,
        aws_access_key_id=KEY_ID,
        aws_secret_access_key=SECRET,
        config=Config(signature_version="s3v4"),
    )


def key_from_url(url: str) -> Optional[str]:
    """Extract the R2 object key from a public URL, or None if it doesn't belong to our bucket."""
    if not url or not PUBLIC_URL:
        return None
    prefix = PUBLIC_URL + "/"
    return url[len(prefix):] if url.startswith(prefix) else None


def delete_object(url: str) -> bool:
    """Best-effort deletion of an R2 object referenced by a public URL.
    Logs and swallows errors so callers don't have to wrap individual deletes."""
    key = key_from_url(url)
    if not key:
        return False
    try:
        client().delete_object(Bucket=BUCKET, Key=key)
        return True
    except Exception as e:
        log.warning("r2: delete failed for key=%s: %s", key, e)
        return False


def _put_jpeg(prefix: str, entity_id: int, jpeg_bytes: bytes) -> str:
    """Store a processed JPEG under <prefix>/<id>/<ts>_<uid>.jpg and return its
    public URL. Centralises the key convention so callers don't need to know the
    bucket layout. Raises HTTPException on R2 failure."""
    ts  = datetime.utcnow().strftime("%Y%m%d%H%M%S")
    uid = uuid.uuid4().hex[:8]
    key = f"{prefix}/{entity_id}/{ts}_{uid}.jpg"
    try:
        client().put_object(
            Bucket=BUCKET,
            Key=key,
            Body=jpeg_bytes,
            ContentType="image/jpeg",
        )
    except HTTPException:
        raise
    except Exception as e:
        log.error("r2: put_object failed key=%s: %s\n%s", key, e, traceback.format_exc())
        raise HTTPException(status_code=502, detail=f"R2 upload failed: {e}")
    return f"{PUBLIC_URL}/{key}"


def upload_request_photo(request_id: int, jpeg_bytes: bytes) -> str:
    """Upload a processed JPEG for a UserRequest and return the public URL."""
    return _put_jpeg("createRequests", request_id, jpeg_bytes)


def upload_custom_invader_photo(custom_invader_id: int, jpeg_bytes: bytes) -> str:
    """Upload a processed JPEG for a personal invader and return the public URL.
    Own prefix rather than createRequests/: these never go through admin review,
    and keeping them separated makes the bucket readable (and a future
    friends-sharing feature easier to reason about)."""
    return _put_jpeg("customInvaders", custom_invader_id, jpeg_bytes)
