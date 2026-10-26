"""Account emails: username changed, admin role granted / revoked, account deleted,
personal data export. Sends are patched; we check who gets what."""
import io
import json
import zipfile
from unittest.mock import patch, AsyncMock

import pytest

from app.core import email
from app.core.security import hash_password
from app.models.space_invader import Invader
from app.models.user import User
from app.models.user_progress import UserProgress

from tests.conftest import auth_headers


@pytest.fixture()
def user(db):
    u = User(username="alice", email="alice@test.com", hashed_password=hash_password("pw"), language="en")
    db.add(u)
    db.flush()
    return u


@pytest.fixture()
def admin(db):
    u = User(username="root", email="root@test.com", hashed_password=hash_password("pw"), is_admin=True)
    db.add(u)
    db.flush()
    return u


def test_username_change_emails_the_user(client, user):
    with patch("app.services.user_service.send_username_changed_email", new_callable=AsyncMock) as m:
        res = client.put(f"/users/{user.id}", json={"username": "alicia"}, headers=auth_headers(user))
    assert res.status_code == 200
    m.assert_awaited_once_with("alice@test.com", old="alice", new="alicia", language="en")


def test_same_username_sends_nothing(client, user):
    with patch("app.services.user_service.send_username_changed_email", new_callable=AsyncMock) as m:
        client.put(f"/users/{user.id}", json={"username": "alice"}, headers=auth_headers(user))
    m.assert_not_awaited()


def test_admin_grant_and_revoke_email_the_target(client, user, admin):
    with patch("app.services.user_service.send_admin_role_email", new_callable=AsyncMock) as m:
        client.put(f"/users/{user.id}", json={"is_admin": True}, headers=auth_headers(admin))
        client.put(f"/users/{user.id}", json={"is_admin": True}, headers=auth_headers(admin))   # no change
        client.put(f"/users/{user.id}", json={"is_admin": False}, headers=auth_headers(admin))
    assert [c.kwargs["granted"] for c in m.await_args_list] == [True, False]
    assert all(c.args == ("alice@test.com",) for c in m.await_args_list)


def test_delete_emails_the_deleted_user(client, user, admin):
    with patch("app.services.deletion_service.send_account_deleted_email", new_callable=AsyncMock) as m:
        res = client.delete(f"/users/{user.id}", headers=auth_headers(admin))
    assert res.status_code == 200
    m.assert_awaited_once_with("alice@test.com", "alice", language="en")


def test_data_export_goes_to_the_account_email(client, db, user, admin):
    inv = Invader(name="PA_01", latitude=48.85, longitude=2.35, state="Good")
    db.add(inv)
    db.flush()
    db.add(UserProgress(user_id=user.id, invader_id=inv.id))
    db.flush()
    with patch("app.services.data_export_service.send_personal_data_email", new_callable=AsyncMock) as m:
        res = client.post(f"/users/{user.id}/data-export", headers=auth_headers(admin))
    assert res.status_code == 202
    to, username, summary, filename, payload = m.await_args.args
    assert to == "alice@test.com" and username == "alice"   # never the admin's address
    assert summary["flashes"] == 1
    assert filename == "hintvaders-data-alice.zip"
    with zipfile.ZipFile(io.BytesIO(payload)) as archive:
        data = json.loads(archive.read("hintvaders-data-alice.json"))
    assert data["flashes"][0]["invader"] == "PA_01"
    assert "hashed_password" not in json.dumps(data)


def test_data_export_forbidden_for_other_users(client, db, user):
    bob = User(username="bob", email="bob@test.com", hashed_password=hash_password("pw"))
    db.add(bob)
    db.flush()
    res = client.post(f"/users/{user.id}/data-export", headers=auth_headers(bob))
    assert res.status_code == 403


def test_no_api_key_sends_nothing():
    with patch("app.core.email.requests.post") as post:
        email._send("x@test.com", "s", "t", "<p>h</p>")
    post.assert_not_called()


@pytest.mark.parametrize("lang", ["fr", "en"])
def test_templates_render(lang):
    for subject, text, html in [
        email.account_deleted_email("a<b", lang),
        email.admin_role_email("a", True, lang),
        email.admin_role_email("a", False, lang),
        email.username_changed_email("old", "new", lang),
        email.personal_data_email("a", {"account": "01/01/2026", "flashes": 3, "requests": 0,
                                        "comments": 1, "friends": 2, "devices": 1}, "f.json", lang),
    ]:
        assert subject and text and "<b>" not in text
        assert "a<b" not in html   # usernames are escaped


def test_password_change_from_account_emails_the_user(client, user):
    with patch("app.services.user_service.send_password_changed_email", new_callable=AsyncMock) as m:
        res = client.put(f"/users/{user.id}", json={"password": "newpass1"}, headers=auth_headers(user))
    assert res.status_code == 200
    m.assert_awaited_once_with("alice@test.com", username="alice", language="en")


def test_password_reset_by_code_emails_the_user(client, db, user):
    from datetime import datetime, timedelta
    user.reset_code, user.reset_code_expires = "123456", datetime.utcnow() + timedelta(minutes=10)
    db.flush()
    with patch("app.services.auth_service.send_password_changed_email", new_callable=AsyncMock) as m:
        res = client.post("/auth/reset-password",
                          json={"email": "alice@test.com", "token": "123456", "new_password": "newpass1"})
    assert res.status_code == 200
    m.assert_awaited_once_with("alice@test.com", "alice", language="en")


def test_password_changed_template_renders():
    for lang in ("fr", "en"):
        subject, text, html = email.password_changed_email("a<b", "26/10/2026 18:42", lang)
        assert "26/10/2026 18:42" in html and "a<b" not in html and "<b>" not in text
