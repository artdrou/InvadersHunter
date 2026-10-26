"""
Personal data export (GDPR right of access, art. 15): everything stored about a user,
emailed to the account's own address as a zipped JSON attachment.

Never includes secrets (password hash, reset code, refresh / push tokens).
"""
import io
import json
import re
import zipfile
from datetime import date, datetime
from typing import Callable

from sqlalchemy.orm import Session

from ..core.email import send_personal_data_email
from ..models.friendship import Friendship
from ..models.invader_comment import InvaderComment
from ..models.push_token import PushToken
from ..models.space_invader import Invader
from ..models.user import User
from ..models.user_progress import UserProgress
from ..models.user_request import UserRequest
from .user_service import UserMissing


def _iso(value):
    return value.isoformat() if isinstance(value, (datetime, date)) else value


def build_export(db: Session, user: User) -> dict:
    flashes = (db.query(Invader.name, UserProgress.found_at)
               .join(Invader, Invader.id == UserProgress.invader_id)
               .filter(UserProgress.user_id == user.id)
               .order_by(UserProgress.found_at).all())
    requests = db.query(UserRequest).filter(UserRequest.user_id == user.id).order_by(UserRequest.created_at).all()
    comments = (db.query(InvaderComment, Invader.name)
                .join(Invader, Invader.id == InvaderComment.invader_id)
                .filter(InvaderComment.user_id == user.id)
                .order_by(InvaderComment.created_at).all())
    friendships = db.query(Friendship).filter(
        (Friendship.requester_id == user.id) | (Friendship.addressee_id == user.id)).all()
    other_ids = {f.addressee_id if f.requester_id == user.id else f.requester_id for f in friendships}
    names = dict(db.query(User.id, User.username).filter(User.id.in_(other_ids)).all()) if other_ids else {}
    devices = db.query(PushToken).filter(PushToken.user_id == user.id).all()

    return {
        "exported_at": _iso(datetime.utcnow()),
        "account": {
            "id": user.id,
            "username": user.username,
            "email": user.email,
            "created_at": _iso(user.created_at),
            "is_admin": bool(user.is_admin),
            "language": user.language,
            "notifications_enabled": bool(user.notifications_enabled),
        },
        "flashes": [{"invader": name, "found_at": _iso(found_at)} for name, found_at in flashes],
        "requests": [{
            "type": r.request_type, "status": r.status, "invader_id": r.invader_id,
            "proposed_name": r.proposed_name, "proposed_description": r.proposed_description,
            "proposed_latitude": r.proposed_latitude, "proposed_longitude": r.proposed_longitude,
            "proposed_points": r.proposed_points, "proposed_state": r.proposed_state,
            "proposed_image_url": r.proposed_image_url, "proposed_date_pose": _iso(r.proposed_date_pose),
            "created_at": _iso(r.created_at),
        } for r in requests],
        "comments": [{
            "invader": invader_name, "body": c.body, "status": c.status,
            "likes": c.likes, "dislikes": c.dislikes, "created_at": _iso(c.created_at),
        } for c, invader_name in comments],
        "friends": [{
            "username": names.get(f.addressee_id if f.requester_id == user.id else f.requester_id),
            "status": f.status,
            "direction": "sent" if f.requester_id == user.id else "received",
            "since": _iso(f.accepted_at or f.created_at),
        } for f in friendships],
        "devices": [{
            "platform": d.platform, "app_variant": d.app_variant,
            "registered_at": _iso(d.created_at), "last_update": _iso(d.updated_at),
        } for d in devices],
    }


def send_personal_data(db: Session, user_id: int, schedule: Callable) -> None:
    """Build the export and hand the email to `schedule` (e.g. BackgroundTasks.add_task).
    Always sent to the account's own email, whoever asked (owner or admin)."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise UserMissing()
    data = build_export(db, user)
    summary = {
        "account": user.created_at.strftime("%d/%m/%Y") if user.created_at else "-",
        "flashes": len(data["flashes"]),
        "requests": len(data["requests"]),
        "comments": len(data["comments"]),
        "friends": sum(1 for f in data["friends"] if f["status"] == "accepted"),
        "devices": len(data["devices"]),
    }
    # Brevo refuses .json attachments (fixed list of extensions), .zip is allowed.
    name = f"hintvaders-data-{re.sub(r'[^A-Za-z0-9_-]', '_', user.username)}"
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as archive:
        archive.writestr(f"{name}.json", json.dumps(data, ensure_ascii=False, indent=2))
    schedule(send_personal_data_email, user.email, user.username, summary, f"{name}.zip",
             buffer.getvalue(), language=user.language)
