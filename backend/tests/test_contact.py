"""In-app contact form: forwarded to the team inbox, Reply-To = the sender, rate-limited."""
from unittest.mock import patch, AsyncMock

import pytest

from app.core import email
from app.core.security import hash_password
from app.models.user import User
from app.services import contact_service

from tests.conftest import auth_headers

MSG = {"subject": "Bug carte", "message": "La carte ne charge plus à Lyon.", "app_version": "0.2.0"}


@pytest.fixture(autouse=True)
def reset_rate_limit():
    contact_service._limiter.clear()


@pytest.fixture()
def user(db):
    u = User(username="alice", email="alice@test.com", hashed_password=hash_password("pw"))
    db.add(u)
    db.flush()
    return u


def test_signed_in_message_goes_to_inbox_with_user_details(client, user):
    with patch("app.services.contact_service.send_contact_email", new_callable=AsyncMock) as m:
        res = client.post("/contact/", json=MSG, headers=auth_headers(user))
    assert res.status_code == 202
    to, subject, message, sender = m.await_args.args
    assert to == "contact@hintvaders.app" and subject == "Bug carte"
    assert sender["username"] == "alice" and sender["email"] == "alice@test.com"
    assert sender["app_version"] == "0.2.0"


def test_guest_can_leave_an_email(client):
    with patch("app.services.contact_service.send_contact_email", new_callable=AsyncMock) as m:
        res = client.post("/contact/", json={**MSG, "email": "guest@test.com"})
    assert res.status_code == 202
    assert m.await_args.args[3]["email"] == "guest@test.com"
    assert m.await_args.args[3]["username"] is None


def test_validation(client):
    assert client.post("/contact/", json={**MSG, "subject": "a"}).status_code == 422
    assert client.post("/contact/", json={**MSG, "message": "short"}).status_code == 422


def test_rate_limited_per_user(client, user):
    with patch("app.services.contact_service.send_contact_email", new_callable=AsyncMock):
        codes = [client.post("/contact/", json=MSG, headers=auth_headers(user)).status_code
                 for _ in range(contact_service.MAX_MESSAGES + 1)]
    assert codes[-1] == 429 and all(c == 202 for c in codes[:-1])


def test_reply_to_is_the_sender():
    with patch("app.core.email.os.getenv", return_value="key"), \
         patch("app.core.email.requests.post") as post:
        email._send("inbox@test.com", "s", "t", "<p>h</p>", reply_to="alice@test.com")
    assert post.call_args.kwargs["json"]["replyTo"] == {"email": "alice@test.com"}


def test_contact_template_escapes_and_flags_environment():
    subject, text, html = email.contact_message_email(
        "<b>hi</b>", "line1\nline2", {"username": "a<b", "email": None, "environment": "staging"})
    assert subject.startswith("[Contact staging]")
    assert "a<b" not in html and "<b>hi</b>" not in html and "line1<br>line2" in html
