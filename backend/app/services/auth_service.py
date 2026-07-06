"""
Business logic for authentication: login, refresh-token rotation, logout,
and the password-reset flow (request code, verify code, set new password).

Routers handle HTTP and translate the domain exceptions below.
"""
import random
from datetime import datetime, timedelta, timezone
from typing import Tuple
from sqlalchemy.orm import Session

from ..models.user import User
from ..models.refresh_token import RefreshToken
from ..core.security import (
    verify_password, create_access_token, create_refresh_token, hash_password,
)
from ..core.email import send_reset_password_email


# ── Domain exceptions ────────────────────────────────────────────────────────

class InvalidCredentials(Exception): ...
class InvalidRefreshToken(Exception): ...
class InvalidResetCode(Exception): ...


# ── Helpers ──────────────────────────────────────────────────────────────────

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

    code = str(random.randint(100000, 999999))
    user.reset_code = code
    user.reset_code_expires = datetime.now(timezone.utc) + timedelta(minutes=15)
    db.commit()
    await send_reset_password_email(email, code)


def verify_reset_code(db: Session, email: str, token: str) -> None:
    user = db.query(User).filter(User.email == email).first()
    if (
        not user
        or user.reset_code != token
        or not user.reset_code_expires
        or _is_expired(user.reset_code_expires)
    ):
        raise InvalidResetCode()


def reset_password(db: Session, email: str, token: str, new_password: str) -> None:
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
