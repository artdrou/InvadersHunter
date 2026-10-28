"""
Business logic for authentication: login, refresh-token rotation, logout,
the password-reset flow (request code, verify code, set new password) and
changing the password while signed in (checks the current one).

Routers handle HTTP and translate the domain exceptions below.
"""
import random
from datetime import datetime, timedelta, timezone
from typing import Callable, Optional, Tuple
from sqlalchemy.orm import Session

from ..models.user import User
from ..models.refresh_token import RefreshToken
from ..core.security import (
    verify_password, create_access_token, create_refresh_token, create_guest_pass, hash_password,
)
from ..core.email import send_password_changed_email, send_reset_password_email
from ..core.rate_limit import SlidingWindowLimiter, RateLimited


# ── Domain exceptions ────────────────────────────────────────────────────────

class InvalidCredentials(Exception): ...
class InvalidRefreshToken(Exception): ...
class InvalidResetCode(Exception): ...
class TooManyAttempts(Exception): ...


# Wrong current passwords allowed per account before a pause (stops guessing it
# from an unlocked phone)
CHANGE_PASSWORD_LIMIT = SlidingWindowLimiter(5, 15 * 60)
# Login attempts per username (stops password guessing on one account)
LOGIN_LIMIT = SlidingWindowLimiter(10, 15 * 60)
# Reset-code checks per email, verify + reset together (a code has 1M values and
# lives 15 min: without a cap it can be guessed)
RESET_CODE_LIMIT = SlidingWindowLimiter(10, 15 * 60)
# Reset emails per address (stops flooding someone's inbox)
RESET_EMAIL_LIMIT = SlidingWindowLimiter(3, 60 * 60)

# Guest passes per IP (a pass lasts 30 days: the app only asks again when it expires)
GUEST_PASS_LIMIT = SlidingWindowLimiter(20, 60 * 60)

AUTH_LIMITS = (CHANGE_PASSWORD_LIMIT, LOGIN_LIMIT, RESET_CODE_LIMIT, RESET_EMAIL_LIMIT, GUEST_PASS_LIMIT)


# ── Helpers ──────────────────────────────────────────────────────────────────

def _limit(limiter: SlidingWindowLimiter, key: str) -> None:
    try:
        limiter.hit(key)
    except RateLimited:
        raise TooManyAttempts()


def _is_expired(dt) -> bool:
    """Compare a (possibly naive) DB datetime against the current aware UTC clock."""
    return dt.replace(tzinfo=timezone.utc) < datetime.now(timezone.utc)


def _issue_token_pair(db: Session, user: User) -> Tuple[str, str]:
    """Mint an access+refresh pair and persist the refresh token."""
    access_token = create_access_token(
        data={"sub": str(user.id), "username": user.username, "is_admin": user.is_admin}
    )
    refresh_token_value, expires_at = create_refresh_token()
    db.add(RefreshToken(token=refresh_token_value, user_id=user.id, expires_at=expires_at))
    return access_token, refresh_token_value


# ── Public service API ───────────────────────────────────────────────────────

def login(db: Session, username: str, password: str) -> dict:
    _limit(LOGIN_LIMIT, f"user:{username.strip().lower()}")
    user = db.query(User).filter(User.username == username).first()
    if not user or not verify_password(password, user.hashed_password):
        raise InvalidCredentials()

    access_token, refresh_token_value = _issue_token_pair(db, user)
    db.commit()
    return {
        "access_token": access_token,
        "refresh_token": refresh_token_value,
        "token_type": "bearer",
    }


def guest_pass(client_ip: str) -> dict:
    """Anonymous pass for guest mode (map catalog only), limited per IP."""
    _limit(GUEST_PASS_LIMIT, f"ip:{client_ip}")
    return {"access_token": create_guest_pass(), "token_type": "bearer"}


def refresh(db: Session, refresh_token: str) -> dict:
    entry = db.query(RefreshToken).filter(RefreshToken.token == refresh_token).first()
    if not entry or entry.revoked or _is_expired(entry.expires_at):
        raise InvalidRefreshToken()

    user = db.query(User).filter(User.id == entry.user_id).first()
    if not user:
        raise InvalidRefreshToken()

    # Rotate: revoke old, issue new
    entry.revoked = True
    access_token, refresh_token_value = _issue_token_pair(db, user)
    db.commit()
    return {
        "access_token": access_token,
        "refresh_token": refresh_token_value,
        "token_type": "bearer",
    }


def logout(db: Session, refresh_token: str) -> None:
    """Revoke the supplied refresh token if it exists. Always silent — we don't
    leak whether the token was valid or not."""
    entry = db.query(RefreshToken).filter(RefreshToken.token == refresh_token).first()
    if entry:
        entry.revoked = True
        db.commit()


async def request_password_reset(db: Session, username: str, email: str) -> None:
    """If a user matches the (username, email) pair, generate a 6-digit code and
    email it. Always returns None so callers can present a uniform "if exists" reply."""
    user = db.query(User).filter(
        User.username == username,
        User.email == email,
    ).first()
    if not user:
        return
    try:
        RESET_EMAIL_LIMIT.hit(f"email:{email.strip().lower()}")
    except RateLimited:
        return  # silent: same reply as for an unknown account

    code = str(random.randint(100000, 999999))
    user.reset_code = code
    user.reset_code_expires = datetime.now(timezone.utc) + timedelta(minutes=15)
    db.commit()
    await send_reset_password_email(email, code, user.username, user.language)


def verify_reset_code(db: Session, email: str, token: str) -> None:
    _limit(RESET_CODE_LIMIT, f"email:{email.strip().lower()}")
    user = db.query(User).filter(User.email == email).first()
    if (
        not user
        or user.reset_code != token
        or not user.reset_code_expires
        or _is_expired(user.reset_code_expires)
    ):
        raise InvalidResetCode()


def change_password(db: Session, user: User, current_password: str, new_password: str,
                    schedule: Optional[Callable] = None) -> None:
    """Signed-in password change: the current password must match. `schedule`
    receives the "password changed" email, as for reset_password."""
    _limit(CHANGE_PASSWORD_LIMIT, f"user:{user.id}")
    if not verify_password(current_password, user.hashed_password):
        raise InvalidCredentials()

    user.hashed_password = hash_password(new_password)
    db.commit()
    if schedule:
        schedule(send_password_changed_email, user.email, user.username, language=user.language)


def reset_password(db: Session, email: str, token: str, new_password: str,
                   schedule: Optional[Callable] = None) -> None:
    """`schedule(fn, *args, **kwargs)` (e.g. BackgroundTasks.add_task) receives the
    "password changed" email, sent after the commit."""
    _limit(RESET_CODE_LIMIT, f"email:{email.strip().lower()}")
    user = db.query(User).filter(User.email == email).first()
    if (
        not user
        or user.reset_code != token
        or not user.reset_code_expires
        or _is_expired(user.reset_code_expires)
    ):
        raise InvalidResetCode()

    user.hashed_password = hash_password(new_password)
    user.reset_code = None
    user.reset_code_expires = None
    db.commit()
    if schedule:
        schedule(send_password_changed_email, user.email, user.username, language=user.language)
