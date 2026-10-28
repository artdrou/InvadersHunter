"""
Profile icon: stored as JSON text on `users.avatar` (NULL = the app's default icon).
Friends see it in the Social tab (friend_service reads it through `parse`).
"""
import json
from typing import Optional

from sqlalchemy.orm import Session

from ..models.user import User
from ..schemas.avatar import Avatar
from ..core.db_utils import safe_commit


def parse(raw: Optional[str]) -> Optional[dict]:
    """Stored text → avatar dict; None when unset or unreadable (the app draws the default)."""
    if not raw:
        return None
    try:
        return Avatar.model_validate(json.loads(raw)).model_dump()
    except ValueError:
        return None


def get_avatar(user: User) -> Optional[dict]:
    return parse(user.avatar)


def set_avatar(db: Session, user: User, avatar: Optional[Avatar]) -> Optional[dict]:
    """Save my icon; None goes back to the default."""
    user.avatar = json.dumps(avatar.model_dump()) if avatar else None
    safe_commit(db)
    return get_avatar(user)
