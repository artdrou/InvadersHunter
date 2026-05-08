"""
Tests for POST /upload/request-photo/{request_id}.

Focus: image-size validation (we reject < 800x800 to avoid blurry upscales).
R2 is not configured in tests, so we only cover paths that fail BEFORE the R2 call.
"""
import io
import pytest
from PIL import Image

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


def test_upload_rejects_image_smaller_than_target(client, user, pending_request):
    """A 400x400 input would have to be upscaled to 800x800 — refuse it instead."""
    small_jpeg = _make_jpeg(400, 400)
    res = client.post(
        f"/upload/request-photo/{pending_request.id}",
        files={"file": ("photo.jpg", small_jpeg, "image/jpeg")},
        headers=auth_headers(user),
    )
    assert res.status_code == 422
    assert "too small" in res.json()["detail"].lower()


def test_upload_rejects_when_one_dimension_is_below_target(client, user, pending_request):
    """Centre-crop side is min(w, h); a 1200x500 input crops to 500x500 — too small."""
    landscape = _make_jpeg(1200, 500)
    res = client.post(
        f"/upload/request-photo/{pending_request.id}",
        files={"file": ("photo.jpg", landscape, "image/jpeg")},
        headers=auth_headers(user),
    )
    assert res.status_code == 422
    assert "too small" in res.json()["detail"].lower()
