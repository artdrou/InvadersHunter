"""
Business logic for the User entity: registration, profile updates, deletion.

Account creation sends the email-check code (auth_service.new_verify_code) — the
router schedules the email, the service hands it back so nothing is sent before
the row is committed. The welcome email follows once the address is confirmed.
"""
from datetime import datetime, timedelta
from functools import partial
from typing import List, Optional, Tuple, Callable
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from ..models.user import User
from ..models.user_progress import UserProgress
from ..models.user_request import UserRequest
from ..models.admin_request import AdminRequest
from ..models.invader_comment import InvaderComment
from ..models.refresh_token import RefreshToken
from ..core.security import hash_password
from ..core.email import (
    send_admin_role_email, send_password_changed_email,
    send_username_changed_email,
)
from ..core.db_utils import safe_commit
from ..core.rate_limit import SlidingWindowLimiter, RateLimited
from . import auth_service


# ── Domain exceptions ────────────────────────────────────────────────────────

class UserMissing(Exception): ...
class UsernameTaken(Exception): ...
class EmailTaken(Exception): ...
class TooManySignups(Exception): ...


# Accounts created per IP (stops scripted sign-ups). Not lower: mobile carriers
# put many phones behind one IP.
SIGNUP_LIMIT = SlidingWindowLimiter(10, 60 * 60)
# An unverified account holds its username / email this long, then a new sign-up
# can take them (someone signed up with an address that isn't theirs)
UNVERIFIED_HOLD = timedelta(hours=24)


def _drop_stale_unverified(db: Session, username: str, email: str) -> None:
    stale = db.query(User).filter(
        or_(User.username == username, User.email == email),
        User.email_verified.is_(False),
        User.created_at < datetime.utcnow() - UNVERIFIED_HOLD,
    ).all()
    for user in stale:
        db.delete(user)
    if stale:
        db.flush()


# ── Public service API ───────────────────────────────────────────────────────

def list_all(db: Session) -> List[User]:
    return db.query(User).all()


def get_admin_profile(db: Session, user_id: int) -> dict:
    """Everything the admin "user profile" screen shows: account fields, key dates,
    contribution counts, and the flashed invader ids (the app computes the
    collection stats from them, exactly like the user's own profile)."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise UserMissing()

    flashes = db.query(UserProgress.invader_id, UserProgress.found_at).filter(UserProgress.user_id == user_id).all()
    found = [f for _, f in flashes if f is not None]

    requests = (
        db.query(UserRequest.status, UserRequest.created_at, AdminRequest.status)
        .outerjoin(AdminRequest, AdminRequest.id == UserRequest.admin_request_id)
        .filter(UserRequest.user_id == user_id)
        .all()
    )
    # A submission counts as accepted when the admin request it fed was approved.
    accepted = sum(1 for _, _, admin_status in requests if admin_status == "approved")
    rejected = sum(1 for status, _, admin_status in requests if status == "rejected" or admin_status == "rejected")
    pending = sum(1 for status, _, _ in requests if status == "pending")
    request_dates = [created for _, created, _ in requests if created is not None]

    last_login = db.query(func.max(RefreshToken.created_at)).filter(RefreshToken.user_id == user_id).scalar()
    comments = db.query(func.count(InvaderComment.id)).filter(InvaderComment.user_id == user_id).scalar() or 0

    return {
        "id": user.id,
        "username": user.username,
        "email": user.email,
        "is_admin": bool(user.is_admin),
        "language": user.language,
        "notifications_enabled": bool(user.notifications_enabled),
        "created_at": user.created_at,
        "last_login_at": last_login,
        "first_flash_at": min(found) if found else None,
        "last_flash_at": max(found) if found else None,
        "last_request_at": max(request_dates) if request_dates else None,
        "requests_sent": len(requests),
        "requests_accepted": accepted,
        "requests_rejected": rejected,
        "requests_pending": pending,
        "comments": comments,
        "flashed_invader_ids": [invader_id for invader_id, _ in flashes],
    }


def register(db: Session, username: str, email: str, password: str,
             client_ip: str = "?", language: Optional[str] = None) -> Tuple[User, Optional[Callable]]:
    """Create a new, unverified user. Returns (user, verification_email) so the
    router can schedule the email as a background task post-commit.
    Only accounts actually created count toward the per-IP limit."""
    _drop_stale_unverified(db, username, email)
    if db.query(User).filter(User.username == username).first():
        raise UsernameTaken()
    if db.query(User).filter(User.email == email).first():
        raise EmailTaken()
    try:
        SIGNUP_LIMIT.hit(f"ip:{client_ip}")
    except RateLimited:
        raise TooManySignups()

    user = User(
        username=username,
        email=email,
        hashed_password=hash_password(password),
        email_verified=False,
        language=language if language in ("fr", "en") else "fr",
    )
    send_code = auth_service.new_verify_code(user)
    db.add(user)
    safe_commit(db)
    db.refresh(user)
    return user, send_code


def update(
    db: Session,
    user_id: int,
    username: Optional[str] = None,
    email: Optional[str] = None,
    password: Optional[str] = None,
    is_admin: Optional[bool] = None,
    schedule: Optional[Callable] = None,
) -> User:
    """`schedule(fn, *args, **kwargs)` (e.g. BackgroundTasks.add_task) receives the
    emails to send after the commit: username / password changed, admin role granted / revoked."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise UserMissing()
    emails = []

    if username and username != user.username:
        if db.query(User).filter(User.username == username).first():
            raise UsernameTaken()
        emails.append(partial(send_username_changed_email, old=user.username, new=username))
        user.username = username

    if email and email != user.email:
        if db.query(User).filter(User.email == email).first():
            raise EmailTaken()
        user.email = email

    if password:
        user.hashed_password = hash_password(password)
        emails.append(partial(send_password_changed_email, username=user.username))

    if is_admin is not None and is_admin != bool(user.is_admin):
        emails.append(partial(send_admin_role_email, username=user.username, granted=is_admin))
        user.is_admin = is_admin

    safe_commit(db)
    db.refresh(user)
    if schedule:
        for email_fn in emails:
            schedule(email_fn, user.email, language=user.language)
    return user


# Deletion (with flashes, requests, comments, tokens…) lives in deletion_service.delete_user.
