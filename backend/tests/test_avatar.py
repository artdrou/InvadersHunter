"""Tests for the profile icon: save / read / reset my avatar, validation, and
friends seeing it in the Social overview."""
import pytest
from unittest.mock import patch

from app.models.user import User
from app.core.security import hash_password

from tests.conftest import auth_headers

ICON = {"shape": 30, "icon": "#FF0062", "glow": "#A300B3", "bloom": 4}


def _user(db, name):
    u = User(username=name, email=f"{name}@test.com", hashed_password=hash_password("pw"))
    db.add(u)
    db.flush()
    return u


@pytest.fixture()
def alice(db):
    return _user(db, "alice")


@pytest.fixture()
def bob(db):
    return _user(db, "bob")


def test_default_is_null(client, alice):
    res = client.get("/avatar/me", headers=auth_headers(alice))
    assert res.status_code == 200
    assert res.json() == {"avatar": None}


def test_save_then_read_then_reset(client, alice):
    res = client.put("/avatar/me", json={"avatar": ICON}, headers=auth_headers(alice))
    assert res.status_code == 200
    assert res.json()["avatar"] == ICON
    assert client.get("/avatar/me", headers=auth_headers(alice)).json()["avatar"] == ICON

    res = client.put("/avatar/me", json={"avatar": None}, headers=auth_headers(alice))
    assert res.json() == {"avatar": None}


def test_profile_only_shape_accepted(client, alice):
    icon = {**ICON, "shape": "big-3"}
    res = client.put("/avatar/me", json={"avatar": icon}, headers=auth_headers(alice))
    assert res.status_code == 200
    assert res.json()["avatar"] == icon


@pytest.mark.parametrize("bad", [
    {**ICON, "shape": 15},
    {**ICON, "shape": "20"},
    {**ICON, "shape": "<script>"},
    {**ICON, "icon": "red"},
    {**ICON, "glow": "#12345"},
    {**ICON, "bloom": 9},
])
def test_invalid_avatar_rejected(client, alice, bad):
    res = client.put("/avatar/me", json={"avatar": bad}, headers=auth_headers(alice))
    assert res.status_code == 422


def test_requires_login(client):
    assert client.get("/avatar/me").status_code == 401


def test_friend_sees_my_avatar(client, alice, bob):
    client.put("/avatar/me", json={"avatar": ICON}, headers=auth_headers(alice))
    with patch("app.services.notification_service.notify_user"):
        fid = client.post("/friends/requests", json={"username": "bob"}, headers=auth_headers(alice)).json()["id"]
        # pending invite: bob already sees alice's icon
        incoming = client.get("/friends/", headers=auth_headers(bob)).json()["incoming"]
        assert incoming[0]["avatar"] == ICON
        client.post(f"/friends/requests/{fid}/accept", headers=auth_headers(bob))

    overview = client.get("/friends/", headers=auth_headers(bob)).json()
    assert overview["friends"][0]["avatar"] == ICON
    # bob never picked one → null, the app draws the default
    assert client.get("/friends/", headers=auth_headers(alice)).json()["friends"][0]["avatar"] is None
    assert client.get("/friends/lookup", params={"username": "alice"}, headers=auth_headers(bob)).json()["avatar"] == ICON
