"""
In-app contact form: forwards the message to the team inbox (contact@hintvaders.app,
routed to Gmail by Cloudflare) with Reply-To set to the sender, so a reply from
Gmail goes straight to them.

Rate-limited in memory (one backend instance): MAX_MESSAGES per WINDOW per user,
or per IP for guests.
"""
import os
from typing import Callable, Optional

from ..core.email import send_contact_email
from ..core.rate_limit import SlidingWindowLimiter, RateLimited
from ..models.user import User

CONTACT_INBOX = "contact@hintvaders.app"
MAX_MESSAGES = 3
WINDOW_S = 15 * 60

_limiter = SlidingWindowLimiter(MAX_MESSAGES, WINDOW_S)


class TooManyMessages(Exception): ...


def _check_rate(key: str) -> None:
    try:
        _limiter.hit(key)
    except RateLimited:
        raise TooManyMessages()


def send_message(
    user: Optional[User],
    client_ip: str,
    subject: str,
    message: str,
    schedule: Callable,
    guest_email: Optional[str] = None,
    app_version: Optional[str] = None,
    platform: Optional[str] = None,
) -> None:
    """`schedule(fn, *args, **kwargs)` (e.g. BackgroundTasks.add_task) receives the email."""
    _check_rate(f"user:{user.id}" if user else f"ip:{client_ip}")
    sender = {
        "username": user.username if user else None,
        "email": user.email if user else guest_email,
        "user_id": user.id if user else None,
        "app_version": app_version,
        "platform": platform,
        "environment": os.getenv("RAILWAY_ENVIRONMENT_NAME"),
    }
    schedule(send_contact_email, CONTACT_INBOX, subject.strip(), message.strip(), sender)
