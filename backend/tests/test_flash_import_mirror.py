"""
Flash import "full sync" (mirror): also removes the account's flashes the phone
doesn't list. Key invariants:
- without confirm: a preview that writes nothing (account, totals, what would change)
- with confirm: adds and removes
- refused when the phone lists less than MIRROR_MIN_RATIO of the account's flashes
- the default import never removes anything
"""
import pytest

from app.core.security import hash_password
from app.models.space_invader import Invader
from app.models.user import User
from app.models.user_progress import UserProgress
from app.services import flash_import_service
from app.services.flash_import_service import MirrorRefused, import_flashes
from tests.conftest import auth_headers


@pytest.fixture()
def account(db):
    """alice has flashed PA_1..PA_4; PA_5 and PA_6 exist but aren't flashed."""
    user = User(username="alice", email="alice@test.com", hashed_password=hash_password("pw"))
    invaders = [Invader(name=f"PA_{i}", state="Good") for i in range(1, 7)]
    db.add_all([user, *invaders])
    db.flush()
    db.add_all([UserProgress(user_id=user.id, invader_id=inv.id) for inv in invaders[:4]])
    db.commit()
    return user


def _flashed(db, user):
    return sorted(
        name for (name,) in db.query(Invader.name).join(UserProgress, UserProgress.invader_id == Invader.id)
        .filter(UserProgress.user_id == user.id)
    )


PHONE = ["PA_1.jpg", "PA_2.jpg", "PA_3.jpg", "PA_5.jpg", "XX_9.jpg"]   # PA_4 gone, PA_5 new


def test_default_import_never_removes(db, account):
    res = import_flashes(db, account.id, PHONE)
    assert (res["imported"], res["removed"], res["to_remove"]) == (1, 0, [])
    assert _flashed(db, account) == ["PA_1", "PA_2", "PA_3", "PA_4", "PA_5"]


def test_mirror_preview_writes_nothing(db, account):
    res = import_flashes(db, account.id, PHONE, mirror=True)
    assert res["applied"] is False and res["refused"] is None
    assert (res["username"], res["app_total"], res["phone_total"]) == ("alice", 4, 4)
    assert (res["imported"], res["to_remove"], res["removed"]) == (1, ["PA_4"], 0)
    assert res["unknown"] == ["XX_9"]
    assert _flashed(db, account) == ["PA_1", "PA_2", "PA_3", "PA_4"]


def test_mirror_confirm_adds_and_removes(db, account):
    res = import_flashes(db, account.id, PHONE, mirror=True, confirm=True)
    assert res["applied"] is True and res["removed"] == 1
    assert _flashed(db, account) == ["PA_1", "PA_2", "PA_3", "PA_5"]


def test_mirror_refused_when_phone_list_looks_incomplete(db, account):
    partial = ["PA_1.jpg"]   # 1 known invader for 4 flashes: under 50 %
    preview = import_flashes(db, account.id, partial, mirror=True)
    assert "incomplete" in preview["refused"] and preview["to_remove"] == ["PA_2", "PA_3", "PA_4"]
    with pytest.raises(MirrorRefused):
        import_flashes(db, account.id, partial, mirror=True, confirm=True)
    assert _flashed(db, account) == ["PA_1", "PA_2", "PA_3", "PA_4"]


def test_mirror_refused_when_phone_lists_no_known_invader(db, account):
    with pytest.raises(MirrorRefused):
        import_flashes(db, account.id, ["XX_1.jpg"], mirror=True, confirm=True)
    assert len(_flashed(db, account)) == 4


def test_api_preview_then_confirm(client, db, account):
    h = auth_headers(account)
    preview = client.post("/flash-import/", json={"names": PHONE, "mirror": True}, headers=h).json()
    assert preview["to_remove"] == ["PA_4"] and preview["applied"] is False
    done = client.post("/flash-import/", json={"names": PHONE, "mirror": True, "confirm": True}, headers=h)
    assert done.status_code == 200 and done.json()["removed"] == 1
    refused = client.post("/flash-import/", json={"names": ["PA_1"], "mirror": True, "confirm": True}, headers=h)
    assert refused.status_code == 409 and "Full sync refused" in refused.json()["detail"]


def test_capture_ids_endpoint(client, db, account):
    ids = client.get(f"/progress/user/{account.id}/ids", headers=auth_headers(account)).json()["ids"]
    assert sorted(ids) == sorted(r.id for r in db.query(UserProgress).filter_by(user_id=account.id))
    other = User(username="bob", email="bob@test.com", hashed_password=hash_password("pw"))
    db.add(other)
    db.commit()
    assert client.get(f"/progress/user/{account.id}/ids", headers=auth_headers(other)).status_code == 403
