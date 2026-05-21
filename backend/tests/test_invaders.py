"""Tests for space invader routes: CRUD and delta sync."""
import pytest
from datetime import datetime, timedelta, timezone

from app.models.space_invader import Invader


@pytest.fixture()
def inv(db):
    i = Invader(name="PA_10", city="PA", number=10, latitude=48.85, longitude=2.35, state="Good", points=10)
    db.add(i)
    db.flush()
    return i


@pytest.fixture()
def inv2(db):
    i = Invader(name="PA_11", city="PA", number=11, latitude=48.86, longitude=2.36, state="Degraded", points=20)
    db.add(i)
    db.flush()
    return i


# ── list (GET /invaders/) ─────────────────────────────────────────────────────

def test_list_invaders_returns_all(client, inv, inv2):
    res = client.get("/invaders/")
    assert res.status_code == 200
    assert len(res.json()) == 2


def test_list_invaders_empty(client):
    res = client.get("/invaders/")
    assert res.status_code == 200
    assert res.json() == []


def test_list_invaders_delta_sync(client, db, inv, inv2):
    old = datetime.now(timezone.utc) - timedelta(hours=2)
    recent = datetime.now(timezone.utc)

    db.query(Invader).filter(Invader.id == inv.id).update({"updated_at": old})
    db.query(Invader).filter(Invader.id == inv2.id).update({"updated_at": recent})
    db.flush()

    cutoff = (datetime.utcnow() - timedelta(hours=1)).strftime('%Y-%m-%dT%H:%M:%S')
    res = client.get(f"/invaders/?updated_since={cutoff}")
    assert res.status_code == 200
    ids = [i["id"] for i in res.json()]
    assert inv2.id in ids
    assert inv.id not in ids


def test_list_invaders_delta_sync_no_results(client, db, inv):
    old = datetime.now(timezone.utc) - timedelta(hours=2)
    db.query(Invader).filter(Invader.id == inv.id).update({"updated_at": old})
    db.flush()

    cutoff = (datetime.utcnow() - timedelta(hours=1)).strftime('%Y-%m-%dT%H:%M:%S')
    res = client.get(f"/invaders/?updated_since={cutoff}")
    assert res.status_code == 200
    assert res.json() == []


# ── get (GET /invaders/{id}) ──────────────────────────────────────────────────

def test_get_invader_returns_correct_data(client, inv):
    res = client.get(f"/invaders/{inv.id}")
    assert res.status_code == 200
    body = res.json()
    assert body["name"] == "PA_10"
    assert body["state"] == "Good"
    assert body["points"] == 10


def test_get_invader_not_found(client):
    res = client.get("/invaders/9999")
    assert res.status_code == 404


# ── create (POST /invaders/) ──────────────────────────────────────────────────

def test_create_invader(client):
    res = client.post("/invaders/", json={"name": "LYO_1", "latitude": 45.74, "longitude": 4.83})
    assert res.status_code == 200
    body = res.json()
    assert body["name"] == "LYO_1"
    assert body["id"] is not None


def test_create_invader_with_all_fields(client):
    res = client.post("/invaders/", json={
        "name": "LYO_2",
        "city": "LYO",
        "number": 2,
        "latitude": 45.74,
        "longitude": 4.83,
        "state": "Good",
        "points": 50,
        "description": "Near the market",
    })
    assert res.status_code == 200
    body = res.json()
    assert body["city"] == "LYO"
    assert body["points"] == 50


def test_created_invader_appears_in_list(client):
    client.post("/invaders/", json={"name": "LYO_1", "latitude": 45.74, "longitude": 4.83})
    res = client.get("/invaders/")
    assert any(i["name"] == "LYO_1" for i in res.json())


# ── update (PUT /invaders/{id}) ───────────────────────────────────────────────

def test_update_invader_state(client, inv):
    res = client.put(f"/invaders/{inv.id}", json={"state": "Destroyed"})
    assert res.status_code == 200
    assert res.json()["state"] == "Destroyed"


def test_update_invader_location(client, inv):
    res = client.put(f"/invaders/{inv.id}", json={"latitude": 48.90, "longitude": 2.40})
    assert res.status_code == 200
    body = res.json()
    assert body["latitude"] == pytest.approx(48.90)
    assert body["longitude"] == pytest.approx(2.40)


def test_update_invader_partial_fields_unchanged(client, inv):
    res = client.put(f"/invaders/{inv.id}", json={"state": "Degraded"})
    assert res.status_code == 200
    body = res.json()
    assert body["name"] == "PA_10"  # unchanged
    assert body["points"] == 10     # unchanged


def test_update_invader_not_found(client):
    res = client.put("/invaders/9999", json={"state": "Destroyed"})
    assert res.status_code == 404


# ── delete (DELETE /invaders/{id}) ────────────────────────────────────────────

def test_delete_invader(client, db, inv):
    res = client.delete(f"/invaders/{inv.id}")
    assert res.status_code == 200
    assert db.query(Invader).filter(Invader.id == inv.id).first() is None


def test_delete_invader_not_found(client):
    res = client.delete("/invaders/9999")
    assert res.status_code == 404


def test_delete_invader_no_longer_in_list(client, db, inv):
    client.delete(f"/invaders/{inv.id}")
    res = client.get("/invaders/")
    assert not any(i["id"] == inv.id for i in res.json())
