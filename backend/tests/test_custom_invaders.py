"""
Tests for /custom-invaders — personal invaders, owner-scoped.

The load-bearing property here is isolation: a user must never read, update or
delete another user's rows, and must never learn they exist (404, not 403).
"""
import pytest
from datetime import datetime, timedelta

from app.models.user import User
from app.models.custom_invader import CustomInvader
from app.core.security import hash_password

from tests.conftest import auth_headers


@pytest.fixture()
def alice(db):
    u = User(username="alice", email="alice@test.com", hashed_password=hash_password("secret"))
    db.add(u)
    db.flush()
    return u


@pytest.fixture()
def bob(db):
    u = User(username="bob", email="bob@test.com", hashed_password=hash_password("secret"))
    db.add(u)
    db.flush()
    return u


def _payload(**overrides):
    base = {
        "name": "PA_9001",
        "city": "PA",
        "number": 9001,
        "points": 30,
        "state": "Good",
        "latitude": 48.8566,
        "longitude": 2.3522,
    }
    base.update(overrides)
    return base


# ── auth ───────────────────────────────────────────────────────────────────────

def test_list_requires_auth(client):
    assert client.get("/custom-invaders/").status_code == 401


def test_create_requires_auth(client):
    assert client.post("/custom-invaders/", json=_payload()).status_code == 401


def test_deleted_requires_auth(client):
    assert client.get("/custom-invaders/deleted").status_code == 401


# ── create ─────────────────────────────────────────────────────────────────────

def test_create_returns_row_owned_by_caller(client, alice):
    res = client.post("/custom-invaders/", json=_payload(), headers=auth_headers(alice))
    assert res.status_code == 200
    body = res.json()
    assert body["name"] == "PA_9001"
    assert body["user_id"] == alice.id
    assert body["latitude"] == pytest.approx(48.8566)
    assert body["id"] > 0


def test_create_ignores_user_id_in_body(client, alice, bob):
    """Ownership comes from the token — a spoofed user_id in the payload is
    dropped by the schema, never honoured."""
    res = client.post(
        "/custom-invaders/",
        json=_payload(user_id=bob.id),
        headers=auth_headers(alice),
    )
    assert res.status_code == 200
    assert res.json()["user_id"] == alice.id


def test_create_rejects_empty_name(client, alice):
    res = client.post("/custom-invaders/", json=_payload(name=""), headers=auth_headers(alice))
    assert res.status_code == 422


def test_create_rejects_out_of_range_coords(client, alice):
    res = client.post("/custom-invaders/", json=_payload(latitude=91), headers=auth_headers(alice))
    assert res.status_code == 422
    res = client.post("/custom-invaders/", json=_payload(longitude=-181), headers=auth_headers(alice))
    assert res.status_code == 422


# ── list / isolation ───────────────────────────────────────────────────────────

def test_list_returns_only_own_rows(client, db, alice, bob):
    db.add_all([
        CustomInvader(user_id=alice.id, name="A1"),
        CustomInvader(user_id=alice.id, name="A2"),
        CustomInvader(user_id=bob.id, name="B1"),
    ])
    db.flush()

    res = client.get("/custom-invaders/", headers=auth_headers(alice))
    assert res.status_code == 200
    assert {r["name"] for r in res.json()} == {"A1", "A2"}

    res = client.get("/custom-invaders/", headers=auth_headers(bob))
    assert {r["name"] for r in res.json()} == {"B1"}


def test_list_empty_for_new_user(client, alice):
    assert client.get("/custom-invaders/", headers=auth_headers(alice)).json() == []


# ── update ─────────────────────────────────────────────────────────────────────

def test_update_own_row(client, db, alice):
    row = CustomInvader(user_id=alice.id, name="A1", points=10, state="Good")
    db.add(row)
    db.flush()

    res = client.put(
        f"/custom-invaders/{row.id}",
        json={"points": 50, "state": "Degraded"},
        headers=auth_headers(alice),
    )
    assert res.status_code == 200
    body = res.json()
    assert body["points"] == 50
    assert body["state"] == "Degraded"
    assert body["name"] == "A1"  # untouched fields survive a partial update


def test_update_other_users_row_is_404(client, db, alice, bob):
    row = CustomInvader(user_id=bob.id, name="B1", points=10)
    db.add(row)
    db.flush()

    res = client.put(
        f"/custom-invaders/{row.id}",
        json={"points": 50},
        headers=auth_headers(alice),
    )
    assert res.status_code == 404
    db.refresh(row)
    assert row.points == 10  # untouched


def test_update_missing_row_is_404(client, alice):
    res = client.put("/custom-invaders/999", json={"points": 50}, headers=auth_headers(alice))
    assert res.status_code == 404


# ── delete + tombstone ─────────────────────────────────────────────────────────

def test_delete_own_row_writes_tombstone(client, db, alice):
    row = CustomInvader(user_id=alice.id, name="A1")
    db.add(row)
    db.flush()
    row_id = row.id

    res = client.delete(f"/custom-invaders/{row_id}", headers=auth_headers(alice))
    assert res.status_code == 200
    assert client.get("/custom-invaders/", headers=auth_headers(alice)).json() == []

    deleted = client.get("/custom-invaders/deleted", headers=auth_headers(alice))
    assert deleted.json()["ids"] == [row_id]


def test_delete_other_users_row_is_404(client, db, alice, bob):
    row = CustomInvader(user_id=bob.id, name="B1")
    db.add(row)
    db.flush()

    res = client.delete(f"/custom-invaders/{row.id}", headers=auth_headers(alice))
    assert res.status_code == 404
    assert db.query(CustomInvader).filter(CustomInvader.id == row.id).first() is not None


def test_deleted_ids_are_owner_scoped(client, db, alice, bob):
    a = CustomInvader(user_id=alice.id, name="A1")
    b = CustomInvader(user_id=bob.id, name="B1")
    db.add_all([a, b])
    db.flush()
    a_id, b_id = a.id, b.id

    client.delete(f"/custom-invaders/{a_id}", headers=auth_headers(alice))
    client.delete(f"/custom-invaders/{b_id}", headers=auth_headers(bob))

    assert client.get("/custom-invaders/deleted", headers=auth_headers(alice)).json()["ids"] == [a_id]
    assert client.get("/custom-invaders/deleted", headers=auth_headers(bob)).json()["ids"] == [b_id]


# ── delta sync ─────────────────────────────────────────────────────────────────

def test_list_delta_returns_only_rows_updated_since(client, db, alice):
    old = CustomInvader(
        user_id=alice.id, name="OLD",
        updated_at=datetime(2026, 1, 1, 12, 0, 0),
    )
    recent = CustomInvader(
        user_id=alice.id, name="RECENT",
        updated_at=datetime(2026, 7, 1, 12, 0, 0),
    )
    db.add_all([old, recent])
    db.flush()

    res = client.get(
        "/custom-invaders/",
        params={"updated_since": "2026-06-01T00:00:00"},
        headers=auth_headers(alice),
    )
    assert res.status_code == 200
    assert [r["name"] for r in res.json()] == ["RECENT"]


def test_list_without_updated_since_returns_everything(client, db, alice):
    db.add_all([
        CustomInvader(user_id=alice.id, name="OLD", updated_at=datetime(2020, 1, 1)),
        CustomInvader(user_id=alice.id, name="RECENT", updated_at=datetime(2026, 7, 1)),
    ])
    db.flush()
    res = client.get("/custom-invaders/", headers=auth_headers(alice))
    assert {r["name"] for r in res.json()} == {"OLD", "RECENT"}


def test_update_bumps_updated_at_into_the_delta(client, db, alice):
    """A row edited after the client's last sync must come back in the delta."""
    row = CustomInvader(user_id=alice.id, name="A1", updated_at=datetime(2020, 1, 1))
    db.add(row)
    db.flush()
    before = datetime.utcnow() - timedelta(seconds=1)

    client.put(f"/custom-invaders/{row.id}", json={"points": 50}, headers=auth_headers(alice))

    res = client.get(
        "/custom-invaders/",
        params={"updated_since": before.isoformat()},
        headers=auth_headers(alice),
    )
    assert [r["name"] for r in res.json()] == ["A1"]


def test_deleted_delta_respects_updated_since(client, db, alice):
    row = CustomInvader(user_id=alice.id, name="A1")
    db.add(row)
    db.flush()
    row_id = row.id
    client.delete(f"/custom-invaders/{row_id}", headers=auth_headers(alice))

    # A client that already synced past the deletion sees nothing new
    future = (datetime.utcnow() + timedelta(minutes=5)).isoformat()
    res = client.get("/custom-invaders/deleted", params={"updated_since": future}, headers=auth_headers(alice))
    assert res.json()["ids"] == []

    past = (datetime.utcnow() - timedelta(minutes=5)).isoformat()
    res = client.get("/custom-invaders/deleted", params={"updated_since": past}, headers=auth_headers(alice))
    assert res.json()["ids"] == [row_id]


# ── guest claim ────────────────────────────────────────────────────────────────

def test_claim_imports_custom_invaders_and_maps_local_ids(client, alice):
    res = client.post(
        "/account/claim",
        json={
            "captures": [],
            "custom_invaders": [
                {"local_id": -1001, **_payload(name="PERSO_1")},
                {"local_id": -1002, **_payload(name="PERSO_2")},
            ],
        },
        headers=auth_headers(alice),
    )
    assert res.status_code == 200
    claimed = res.json()["custom_invaders"]
    assert len(claimed) == 2
    # Each temporary local id is paired with the real row that replaced it
    assert [c["local_id"] for c in claimed] == [-1001, -1002]
    assert [c["invader"]["name"] for c in claimed] == ["PERSO_1", "PERSO_2"]
    assert all(c["invader"]["id"] > 0 for c in claimed)
    assert all(c["invader"]["user_id"] == alice.id for c in claimed)

    # And they're now listable as normal owned rows
    listed = client.get("/custom-invaders/", headers=auth_headers(alice)).json()
    assert {r["name"] for r in listed} == {"PERSO_1", "PERSO_2"}


def test_claim_without_custom_invaders_still_works(client, alice):
    """Older clients (pre-custom-invaders OTA) send only captures."""
    res = client.post("/account/claim", json={"captures": []}, headers=auth_headers(alice))
    assert res.status_code == 200
    assert res.json()["custom_invaders"] == []


def test_claim_is_idempotent(client, alice):
    """The claim is retried on every sync, so a repeat must not duplicate rows —
    e.g. a client that died between the 200 and its local cleanup."""
    body = {
        "captures": [],
        "custom_invaders": [{"local_id": -1001, **_payload(name="PERSO_1")}],
    }
    first = client.post("/account/claim", json=body, headers=auth_headers(alice))
    second = client.post("/account/claim", json=body, headers=auth_headers(alice))
    assert second.status_code == 200

    # Same canonical row handed back, not a second one
    assert (second.json()["custom_invaders"][0]["invader"]["id"]
            == first.json()["custom_invaders"][0]["invader"]["id"])
    listed = client.get("/custom-invaders/", headers=auth_headers(alice)).json()
    assert len(listed) == 1


def test_claim_keeps_distinct_rows_at_different_positions(client, alice):
    """Dedupe keys on name *and* position — same name elsewhere is a real row."""
    res = client.post(
        "/account/claim",
        json={"captures": [], "custom_invaders": [
            {"local_id": -1, **_payload(name="PERSO_1", latitude=48.0)},
            {"local_id": -2, **_payload(name="PERSO_1", latitude=49.0)},
        ]},
        headers=auth_headers(alice),
    )
    assert res.status_code == 200
    ids = [c["invader"]["id"] for c in res.json()["custom_invaders"]]
    assert ids[0] != ids[1]
    assert len(client.get("/custom-invaders/", headers=auth_headers(alice)).json()) == 2
