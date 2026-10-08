"""
Tests for the InvaderQuest catalogue sync. GitHub is never hit: the client fetchers are monkeypatched.
Key invariants:
- doc/disabled entries are ignored, statuses map to canonical states
- unknown invaders are created (with or without location) as approved source="invaderquest" requests
- only empty fields are filled; existing locations and states are never overwritten
- an unchanged index version stops the run; a failed city keeps the global version unstored
- only recent "added" invaders are pushed, as one summary push past 10
"""
from datetime import date, timedelta
from unittest.mock import patch

import pytest

from app.core import invaderquest_client
from app.models.admin_request import AdminRequest
from app.models.space_invader import Invader
from app.services import admin_request_service, notification_service
from app.services import invaderquest_sync_service as svc

TODAY = date(2026, 10, 8)


def _rec(id_, lat=48.85, lng=2.35, status="ok", **extra):
    city = id_.split("_")[0]
    return {"id": id_, "city": city, "lat": lat, "lng": lng, "status": status, "points": 20,
            "datePosed": "2026-09-17", "photoUrl": f"https://spotter/{id_}.png", "source": "goguelnikov", **extra}


@pytest.fixture()
def invaders(db):
    rows = [
        # created in the app: no city/number columns, matched by name
        Invader(name="PA_10", state="Destroyed", points=None, latitude=None, longitude=None),
        Invader(name="PA_11", city="PA", number=11, state="Good", points=30,
                latitude=48.0, longitude=2.0, image_url="https://mine.png"),
    ]
    db.add_all(rows)
    db.commit()
    return {inv.name: inv for inv in rows}


@pytest.fixture()
def fake_iq(monkeypatch):
    data = {
        "index": {"version": 60, "updatedAt": "2026-10-08",
                  "cities": [{"code": "PA", "version": 36}, {"code": "BAB", "version": 3}]},
        "cities": {
            "PA": [
                {"id": "_DOC_SIGNALEMENTS", "city": "PA"},
                _rec("PA_10", lat=48.86, lng=2.36, status="ok"),
                _rec("PA_11", lat=48.9, lng=2.4, status="destroyed", points=50),
                _rec("PA_12", status="damaged"),
                _rec("PA_13", disabled=True),
                _rec("PA_14", lat=None, lng=None, status=None),
            ],
            "BAB": [_rec("BAB_01", status="hidden")],
        },
        "news": [
            {"type": "added", "id": "LAP_33", "city": "LAP", "date": "2026-10-07", "photoUrl": "https://spotter/LAP_33.png"},
            {"type": "added", "id": "PA_12", "city": "PA", "date": "2026-10-06"},
            {"type": "destroyed", "id": "PA_239", "city": "PA", "date": "2026-10-06"},
        ],
        "calls": [],
    }

    def fetch_city(session, code):
        data["calls"].append(code)
        if code in data.get("fail", ()):
            raise invaderquest_client.requests.ConnectionError("boom")
        return data["cities"][code]

    monkeypatch.setattr(invaderquest_client, "fetch_index", lambda session: data["index"])
    monkeypatch.setattr(invaderquest_client, "fetch_city", fetch_city)
    monkeypatch.setattr(invaderquest_client, "fetch_news", lambda session: data["news"])
    return data


def _run(db, **kw):
    with patch("app.services.notification_service.notify_invader_event") as push:
        report = svc.sync(db, delay=0, today=TODAY, **kw)
    return report, push


def _by_name(db, name):
    return db.query(Invader).filter(Invader.name == name).one()


# ── parsing ───────────────────────────────────────────────────────────────────

def test_clean_record_filters_and_maps():
    assert invaderquest_client.clean_record({"id": "_DOC_X", "city": "PA"}) is None
    assert invaderquest_client.clean_record(_rec("PA_1", disabled=True)) is None
    assert invaderquest_client.clean_record({**_rec("PA_1"), "city": None}) is None
    rec = invaderquest_client.clean_record(_rec("PA_01", status="damaged"))
    assert (rec["city"], rec["number"], rec["state"]) == ("PA", 1, "Degraded")
    assert rec["date_pose"] == date(2026, 9, 17)
    assert invaderquest_client.clean_record(_rec("PA_2", status=None))["state"] is None
    no_loc = invaderquest_client.clean_record(_rec("PA_3", lat=48.1, lng=None))
    assert no_loc["latitude"] is None and no_loc["longitude"] is None


# ── sync ──────────────────────────────────────────────────────────────────────

def test_creates_missing_invaders_with_and_without_location(db, invaders, fake_iq):
    report, _ = _run(db)

    assert sorted(report.created) == ["BAB_01", "LAP_33", "PA_12", "PA_14"]
    assert sorted(report.created_without_location) == ["LAP_33", "PA_14"]

    pa12 = _by_name(db, "PA_12")
    assert (pa12.city, pa12.number, pa12.state, pa12.points) == ("PA", 12, "Degraded", 20)
    assert pa12.latitude == 48.85 and pa12.image_url == "https://spotter/PA_12.png"
    assert _by_name(db, "PA_14").state == "Unknown"
    assert _by_name(db, "BAB_01").state == "Not visible"
    lap = _by_name(db, "LAP_33")
    assert lap.latitude is None and lap.image_url == "https://spotter/LAP_33.png"
    assert db.query(Invader).filter(Invader.name == "PA_13").count() == 0   # disabled

    created = db.query(AdminRequest).filter(AdminRequest.request_type == "create").all()
    assert len(created) == 4
    assert all(r.status == "approved" and r.source == "invaderquest" for r in created)


def test_fills_only_empty_fields_and_never_touches_state(db, invaders, fake_iq):
    report, _ = _run(db)

    pa10 = _by_name(db, "PA_10")   # matched by name (no city/number columns)
    assert (pa10.latitude, pa10.longitude, pa10.points) == (48.86, 2.36, 20)
    assert pa10.state == "Destroyed"            # InvaderQuest says ok: state is spotter's job
    pa11 = _by_name(db, "PA_11")
    assert (pa11.latitude, pa11.points, pa11.state, pa11.image_url) == (48.0, 30, "Good", "https://mine.png")
    assert pa11.date_pose == date(2026, 9, 17)  # was empty
    assert any(f.startswith("PA_11:") for f in report.far_locations)


def test_news_credits_invaderquest(db, client, invaders, fake_iq):
    _run(db)
    items = client.get("/news/").json()
    pa12 = next(i for i in items if i["invader_name"] == "PA_12")
    assert pa12["source"] == "invaderquest" and pa12["credit_label"] == "InvaderQuest"


def test_second_run_is_noop_and_unchanged_index_skips(db, invaders, fake_iq):
    _run(db)
    fake_iq["calls"].clear()
    report, _ = _run(db)
    assert report.skipped_unchanged and fake_iq["calls"] == []

    fake_iq["index"]["version"] = 61
    fake_iq["index"]["cities"][1]["version"] = 4    # only BAB changed
    report, _ = _run(db)
    assert fake_iq["calls"] == ["BAB"]
    assert report.created == [] and report.filled == []


def test_failed_city_is_retried_next_run(db, invaders, fake_iq):
    fake_iq["fail"] = {"BAB"}
    report, _ = _run(db)
    assert report.errors and "BAB_01" not in report.created

    fake_iq["fail"] = set()
    fake_iq["calls"].clear()
    report, _ = _run(db)
    assert fake_iq["calls"] == ["BAB"] and report.created == ["BAB_01"]


def test_dry_run_writes_nothing(db, invaders, fake_iq):
    report, push = _run(db, dry_run=True)
    assert len(report.created) == 4
    assert db.query(Invader).count() == 2
    assert db.query(AdminRequest).count() == 0
    push.assert_not_called()


def test_pushes_only_recently_added(db, invaders, fake_iq):
    _, push = _run(db)
    pushed = {call.args[3] for call in push.call_args_list}
    assert pushed == {_by_name(db, "LAP_33").id, _by_name(db, "PA_12").id}


def test_many_new_invaders_get_one_push_but_each_its_news_entry(db, client, invaders, fake_iq):
    n = notification_service.MAX_INDIVIDUAL_PUSHES + 2
    fake_iq["news"] = [
        {"type": "added", "id": f"LAP_{i}", "city": "LAP", "date": str(TODAY - timedelta(days=1))}
        for i in range(1, n + 1)
    ]
    with patch.object(notification_service, "_send_expo_push") as send, \
            patch.object(notification_service, "_recipient_tokens_with_language", return_value=[("tok", "en")]):
        report = svc.sync(db, delay=0, today=TODAY)

    assert report.pushes_sent == 1
    send.assert_called_once()
    assert send.call_args.args[1][0]["body"] == f"{n} new invaders."

    items = client.get("/news/").json()
    filled = [f.split(":")[0] for f in report.filled]
    assert sorted(i["invader_name"] for i in items) == sorted(report.created + filled)   # one entry each
    assert all(i["credit_label"] == "InvaderQuest" for i in items)


def test_app_created_invader_gets_city_and_number(db):
    req = AdminRequest(request_type="create", status="pending", proposed_name="LY_42",
                       proposed_latitude=45.7, proposed_longitude=4.8, request_count=1, confidence=50)
    db.add(req)
    db.commit()
    admin_request_service.approve(db, req, admin_user=None, notify=False)
    inv = _by_name(db, "LY_42")
    assert (inv.city, inv.number) == ("LY", 42)
