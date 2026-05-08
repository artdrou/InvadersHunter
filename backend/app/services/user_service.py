"""
Business logic for the User entity: registration, profile updates, deletion.

Account creation triggers a background welcome email — the router schedules the
task, the service hands back the email address (and the function reference) so
nothing is sent before the row is committed.
"""
from typing import List, Optional, Tuple, Callable
from sqlalchemy.orm import Session

from ..models.user import User
from ..core.security import hash_password
from ..core.email import send_account_created_email
from ..core.db_utils import safe_commit


# ── Domain exceptions ────────────────────────────────────────────────────────

class UserMissing(Exception): ...
class UsernameTaken(Exception): ...
class EmailTaken(Exception): ...


# ── Public service API ───────────────────────────────────────────────────────

def list_all(db: Session) -> List[User]:
    return db.query(User).all()


def register(db: Session, username: str, email: str, password: str) -> Tuple[User, Callable, str]:
    """Create a new user. Returns (user, welcome_email_fn, email_address) so the
    router can schedule the welcome email as a background task post-commit."""
    if db.query(User).filter(User.username == username).first():
        raise UsernameTaken()
    if db.query(User).filter(User.email == email).first():
        raise EmailTaken()

    user = User(
        username=username,
        email=email,
        hashed_password=hash_password(password),
    )
    db.add(user)
    safe_commit(db)
    db.refresh(user)
    return user, send_account_created_email, user.email


def update(
    db: Session,
    user_id: int,
    username: Optional[str] = None,
    email: Optional[str] = None,
    password: Optional[str] = None,
    is_admin: Optional[bool] = None,
) -> User:
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise UserMissing()

    if username and username != user.username:
        if db.query(User).filter(User.username == username).first():
            raise UsernameTaken()
        user.username = username

    if email and email != user.email:
        if db.query(User).filter(User.email == email).first():
            raise EmailTaken()
        user.email = email

    if password:
        user.hashed_password = hash_password(password)

    if is_admin is not None:
        user.is_admin = is_admin

    safe_commit(db)
    db.refresh(user)
    return user


def delete(db: Session, user_id: int) -> None:
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise UserMissing()
    db.delete(user)
    safe_commit(db)
