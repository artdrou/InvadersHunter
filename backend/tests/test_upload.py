"""
Tests for POST /upload/request-photo/{request_id} and the image-processing helper.

The endpoint centre-crops to a square and downscales to at most 800x800; images
below 100x100 (after crop) are rejected, smaller-than-target ones are kept at their
native resolution (never upscaled). R2 is not configured in tests, so the success
path is covered via the pure helper rather than the route.
"""
import io
import pytest
from PIL import Image

from app.api.routers.upload import _crop_to_square_jpeg, _TARGET_PX, _MIN_PX, ImageTooSmall
from app.models.user import User
from app.models.user_request import UserRequest
from app.core.security import hash_password
from tests.conftest import auth_headers


def _make_jpeg(width: int, height: int, color=(120, 80, 200)) -> bytes:
    img = Image.new("RGB", (width, height), color=color)
    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=85)
    return buf.getvalue()


@pytest.fixture()
def user(db):
    u = User(username="alice", email="a@t.com", hashed_password=hash_password("pw"))
    db.add(u)
    db.flush()
    return u


@pytest.fixture()
def pending_request(db, user):
    req = UserRequest(
        user_id=user.id, invader_id=None, request_type="create", status="pending",
        proposed_name="PA_99", normalized_name="PA_99",
        proposed_latitude=48.85, proposed_longitude=2.35,
    )
    db.add(req)
    db.flush()
    return req


def test_upload_rejects_image_below_minimum(client, user, pending_request):
    """A 50x50 input crops below the 100x100 minimum — refuse it."""
    tiny_jpeg = _make_jpeg(50, 50)
    res = client.post(
        f"/upload/request-photo/{pending_request.id}",
        files={"file": ("photo.jpg", tiny_jpeg, "image/jpeg")},
        headers=auth_headers(user),
    )
    assert res.status_code == 422
    assert "too small" in res.json()["detail"].lower()


def test_crop_rejects_when_one_dimension_below_minimum():
    """Centre-crop side is min(w, h); a 1200x50 input crops to 50x50 — below minimum."""
    with pytest.raises(ImageTooSmall):
        _crop_to_square_jpeg(_make_jpeg(1200, 50))


def _square_side(jpeg_bytes: bytes) -> int:
    return Image.open(io.BytesIO(jpeg_bytes)).size[0]


def test_crop_keeps_native_size_when_below_target():
    """A 400x400 input is valid (>100) but below the 800 target — keep it at 400, no upscale."""
    out = _crop_to_square_jpeg(_make_jpeg(400, 400))
    assert _square_side(out) == 400


def test_crop_downscales_when_above_target():
    """A 1600x1600 input is downscaled to the 800 target."""
    out = _crop_to_square_jpeg(_make_jpeg(1600, 1600))
    assert _square_side(out) == _TARGET_PX


def test_crop_centre_crops_landscape_to_square():
    """A 1200x900 input crops to 900x900, then downscales to the 800 target."""
    out = _crop_to_square_jpeg(_make_jpeg(1200, 900))
    img = Image.open(io.BytesIO(out))
    assert img.size == (_TARGET_PX, _TARGET_PX)
