"""Tests for the email check after sign-up: code in the app, link in the email,
resend, login blocked until verified, stale unverified accounts freed."""
from datetime import datetime, timedelta
from unittest.mock import patch, AsyncMock

import pytest

from app.models.user import User
from app.core.security import hash_password


def _signup(client, username="bob", email="bob@test.com"):
    with patch("app.services.auth_service.send_verification_email", new_callable=AsyncMock) as sent:
        res = client.post("/users/", json={"username": username, "email": email, "password": "pass1234"})
    assert res.status_code == 200
    return sent


def _code(db, username="bob"):
    db.expire_all()
    return db.query(User).filter(User.username == username).first().verify_code


@pytest.fixture()
def welcome():
    with patch("app.services.auth_service.send_account_created_email", new_callable=AsyncMock) as sent:
        yield sent


def test_signup_sends_code_and_link(client, db):
    sent = _signup(client)
    sent.assert_awaited_once()
    email, code, link, username, _language = sent.await_args.args
    assert email == "bob@test.com" and username == "bob"
    assert code == _code(db) and len(code) == 6
    assert "/auth/verify-email?username=bob&code=" + code in link


def test_login_refused_until_verified(client, db, welcome):
    _signup(client)
    res = client.post("/auth/login", json={"username": "bob", "password": "pass1234"})
    assert res.status_code == 403
    # A wrong password still answers 401: the 403 only comes with the right one
    res = client.post("/auth/login", json={"username": "bob", "password": "nope"})
    assert res.status_code == 401


def test_code_activates_and_logs_in(client, db, welcome):
    _signup(client)
    res = client.post("/auth/verify-email", json={"username": "bob", "code": _code(db)})
    assert res.status_code == 200 and "refresh_token" in res.json()
    welcome.assert_awaited_once()
    assert client.post("/auth/login", json={"username": "bob", "password": "pass1234"}).status_code == 200
    # Code used up
    res = client.post("/auth/verify-email", json={"username": "bob", "code": "123456"})
    assert res.json()["detail"] == "already_verified"


def test_wrong_or_expired_code(client, db, welcome):
    _signup(client)
    res = client.post("/auth/verify-email", json={"username": "bob", "code": "000000"})
    assert res.status_code == 400 and res.json()["detail"] == "invalid_code"
    user = db.query(User).filter(User.username == "bob").first()
    user.verify_code_expires = datetime.utcnow() - timedelta(minutes=1)
    db.commit()
    res = client.post("/auth/verify-email", json={"username": "bob", "code": user.verify_code})
    assert res.status_code == 400
    welcome.assert_not_awaited()


def test_code_guesses_are_limited(client, db, welcome):
    from app.services import auth_service
    _signup(client)
    for _ in range(auth_service.VERIFY_CODE_LIMIT.max_hits):
        client.post("/auth/verify-email", json={"username": "bob", "code": "000000"})
    res = client.post("/auth/verify-email", json={"username": "bob", "code": _code(db)})
    assert res.status_code == 429


def test_link_activates(client, db, welcome):
    _signup(client)
    res = client.get("/auth/verify-email", params={"username": "bob", "code": _code(db)})
    assert res.status_code == 200 and "text/html" in res.headers["content-type"]
    welcome.assert_awaited_once()
    assert client.post("/auth/login", json={"username": "bob", "password": "pass1234"}).status_code == 200
    # Opened again (mail scanners, double tap): still a friendly page
    res = client.get("/auth/verify-email", params={"username": "bob", "code": "123456"})
    assert res.status_code == 200


def test_bad_link(client, db, welcome):
    _signup(client)
    res = client.get("/auth/verify-email", params={"username": "bob", "code": "000000"})
    assert res.status_code == 400
    res = client.get("/auth/verify-email", params={"username": "ghost", "code": "000000"})
    assert res.status_code == 400


def test_resend_replaces_code_and_is_capped(client, db):
    from app.services import auth_service
    _signup(client)  # 1st email
    first = _code(db)
    with patch("app.services.auth_service.send_verification_email", new_callable=AsyncMock) as sent:
        for _ in range(auth_service.VERIFY_EMAIL_LIMIT.max_hits):
            assert client.post("/auth/resend-verification", json={"username": "bob"}).status_code == 200
    assert sent.await_count == auth_service.VERIFY_EMAIL_LIMIT.max_hits - 1
    assert _code(db) != first


def test_resend_is_silent_for_unknown_or_verified(client, db):
    db.add(User(username="alice", email="alice@test.com", hashed_password=hash_password("pw")))
    db.flush()
    with patch("app.services.auth_service.send_verification_email", new_callable=AsyncMock) as sent:
        for name in ("alice", "ghost"):
            assert client.post("/auth/resend-verification", json={"username": name}).status_code == 200
    sent.assert_not_awaited()


def test_existing_accounts_stay_verified(client, db):
    db.add(User(username="alice", email="alice@test.com", hashed_password=hash_password("pw")))
    db.flush()
    assert client.post("/auth/login", json={"username": "alice", "password": "pw"}).status_code == 200


def test_stale_unverified_account_frees_its_name(client, db):
    _signup(client)
    # Fresh: still holds the name and the email
    with patch("app.services.auth_service.send_verification_email", new_callable=AsyncMock):
        assert client.post("/users/", json={"username": "bob", "email": "x@test.com", "password": "pass1234"}).status_code == 400
    user = db.query(User).filter(User.username == "bob").first()
    user.created_at = datetime.utcnow() - timedelta(days=2)
    db.commit()
    _signup(client, username="bobby", email="bob@test.com")
    db.expire_all()
    assert db.query(User).filter(User.username == "bob").first() is None


def test_signup_email_in_app_language(client, db):
    with patch("app.services.auth_service.send_verification_email", new_callable=AsyncMock) as sent:
        client.post("/users/", json={"username": "en1", "email": "en1@test.com", "password": "pass1234", "language": "en"})
        client.post("/users/", json={"username": "xx1", "email": "xx1@test.com", "password": "pass1234", "language": "de-DE"})
    assert [call.args[4] for call in sent.await_args_list] == ["en", "fr"]
