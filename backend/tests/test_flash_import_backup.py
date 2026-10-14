"""
Web importer backup / revert: snapshot the account's flashes before a sync and
put them back exactly when the sync fails.
- snapshot lists every flash with its original found_at
- restore removes what the sync added, re-adds what it removed, keeps found_at
- restore is per account and skips invaders deleted since the backup
- the import response names the invaders it adds (to_add)
"""
from datetime import datetime

import pytest

from app.core.security import hash_password
from app.models.space_invader import Invader
from app.models.user import User
from app.models.user_progress import UserProgress
from app.services.flash_import_service import import_flashes, restore, snapshot
from tests.conftest import auth_headers

FOUND = datetime(2023, 5, 17, 12, 0, 0)


@pytest.fixture()
def account(db):
    """alice has flashed PA_1..PA_3 (found long ago); PA_4..PA_6 exist."""
    user = User(username="alice", email="alice@test.com", hashed_password=hash_password("pw"))
    invaders = [Invader(name=f"PA_{i}", state="Good") for i in range(1, 7)]
    db.add_all([user, *invaders])
    db.flush()
    db.add_all([UserProgress(user_id=user.id, invader_id=inv.id, found_at=FOUND) for inv in invaders[:3]])
    db.commit()
    return user


def _flashed(db, user):
    return sorted(
        name for (name,) in db.query(Invader.name).join(UserProgress, UserProgress.invader_id == Invader.id)
        .filter(UserProgress.user_id == user.id)
    )


def test_snapshot_lists_flashes_with_dates(db, account):
    snap = snapshot(db, account.id)
    assert (snap["username"], snap["total"]) == ("alice", 3)
    assert [f["name"] for f in snap["flashes"]] == ["PA_1", "PA_2", "PA_3"]
    assert all(f["found_at"] == FOUND for f in snap["flashes"])


def test_restore_reverts_a_full_sync(db, account):
    backup = snapshot(db, account.id)["flashes"]
    import_flashes(db, account.id, ["PA_1", "PA_2", "PA_4", "PA_5"], mirror=True, confirm=True)
    assert _flashed(db, account) == ["PA_1", "PA_2", "PA_4", "PA_5"]

    res = restore(db, account.id, backup)

    assert _flashed(db, account) == ["PA_1", "PA_2", "PA_3"]
    assert res["total"] == 3 and res["skipped"] == []
    assert all(f["found_at"] == FOUND for f in res["flashes"])


def test_restore_skips_deleted_invaders(db, account):
    backup = snapshot(db, account.id)["flashes"] + [{"invader_id": 999, "name": "GONE_1", "found_at": None}]
    res = restore(db, account.id, backup)
    assert res["total"] == 3 and res["skipped"] == [999]


def test_restore_only_touches_own_account(db, account):
    bob = User(username="bob", email="bob@test.com", hashed_password=hash_password("pw"))
    db.add(bob)
    db.flush()
    db.add(UserProgress(user_id=bob.id, invader_id=1))
    db.commit()

    restore(db, account.id, [])

    assert _flashed(db, account) == []
    assert _flashed(db, bob) == ["PA_1"]


def test_import_names_what_it_adds(db, account):
    res = import_flashes(db, account.id, ["PA_1.jpg", "PA_06.jpg", "PA_4.jpg"])
    assert res["to_add"] == ["PA_4", "PA_6"]


def test_snapshot_and_restore_endpoints(client, db, account):
    headers = auth_headers(account)
    snap = client.get("/flash-import/snapshot", headers=headers)
    assert snap.status_code == 200 and snap.json()["total"] == 3

    client.post("/flash-import/", headers=headers, json={"names": ["PA_5"]})
    assert _flashed(db, account) == ["PA_1", "PA_2", "PA_3", "PA_5"]

    res = client.post("/flash-import/restore", headers=headers, json={"flashes": snap.json()["flashes"]})
    assert res.status_code == 200 and res.json()["total"] == 3
    assert _flashed(db, account) == ["PA_1", "PA_2", "PA_3"]


def test_endpoints_require_auth(client):
    assert client.get("/flash-import/snapshot").status_code in (401, 403)
    assert client.post("/flash-import/restore", json={"flashes": []}).status_code in (401, 403)


def test_web_route_redirects_to_page(client):
    res = client.get("/flash-import/web", follow_redirects=False)
    assert res.status_code in (302, 307)
    assert res.headers["location"] == "/static/flash_import/web/index.html"
