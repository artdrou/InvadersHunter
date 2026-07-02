"""
Tests for the News feed (/news).
- Approved invader modify appears as an `invader_updated` item, credited to the community user
- `source` drives the credit label (scraper -> invader-spotter.art)
- Announcements appear in the feed; creation is admin-only
- Default window = 30 days; `before` cursor returns older history
"""
import pytest
from datetime import datetime, timedelta

from app.models.user import User
from app.models.space_invader import Invader
from app.models.user_request import UserRequest
from app.models.admin_request import AdminRequest
from app.models.announcement import Announcement
from app.core.security import hash_password
from app.services.user_request_service import aggregate_request
from tests.conftest import auth_headers


@pytest.fixture()
def users(db):
    regular = User(username="u1", email="u1@test.com", hashed_password=hash_password("pw"))
    admin = User(username="admin", email="admin@test.com", hashed_password=hash_password("pw"), is_admin=True)
    db.add_all([regular, admin])
    db.flush()
    return regular, admin


@pytest.fixture()
def invader(db):
    inv = Invader(name="PA_10", city="Paris", latitude=48.8566, longitude=2.3522, state="Good", points=10)
    db.add(inv)
    db.flush()
    return inv


def _approve_modify(db, client, user_id, admin, invader_id):
    req = UserRequest(
        user_id=user_id, invader_id=invader_id, request_type="modify", status="pending",
        proposed_state="Degraded", proposed_latitude=48.99, proposed_longitude=2.99,
    )
    db.add(req)
    db.flush()
    aggregate_request(db, req)
    db.commit()
    ar = db.query(AdminRequest).filter(AdminRequest.invader_id == invader_id).one()
    res = client.post(f"/admin-requests/{ar.id}/approve", headers=auth_headers(admin))
    assert res.status_code == 200
    return ar


# ── invader events ────────────────────────────────────────────────────────────

def test_approved_modify_appears_in_news_credited_to_community(db, client, users, invader):
    regular, admin = users
    _approve_modify(db, client, regular.id, admin, invader.id)

    res = client.get("/news/")
    assert res.status_code == 200
    items = res.json()
    updated = [i for i in items if i["type"] == "invader_updated"]
    assert len(updated) == 1
    item = updated[0]
    assert item["invader_id"] == invader.id
    assert item["invader_name"] == "PA_10"
    assert item["city"] == "Paris"
    assert item["source"] == "community"
    assert item["credit_label"] == "u1"
    assert item["new_state"] == "Degraded"
    assert set(item["changes"]) >= {"state", "location"}


def test_scraper_source_credited_to_invader_spotter(db, client, invader):
    ar = AdminRequest(
        invader_id=invader.id, request_type="modify", status="approved",
        source="scraper", reviewed_at=datetime.utcnow(),
    )
    db.add(ar)
    db.commit()

    items = client.get("/news/").json()
    assert items
    assert items[0]["source"] == "scraper"
    assert items[0]["credit_label"] == "invader-spotter.art"


# ── announcements ─────────────────────────────────────────────────────────────

def test_admin_can_create_announcement_and_it_shows_in_feed(db, client, users):
    _, admin = users
    res = client.post(
        "/news/announcements",
        json={"kind": "release", "title": "v1.2.0", "body": "Nouvelle page News", "version": "1.2.0"},
        headers=auth_headers(admin),
    )
    assert res.status_code == 200

    items = client.get("/news/").json()
    releases = [i for i in items if i["type"] == "release"]
    assert len(releases) == 1
    assert releases[0]["title"] == "v1.2.0"
    assert releases[0]["version"] == "1.2.0"


def test_create_announcement_requires_admin(db, client, users):
    regular, _ = users
    res = client.post(
        "/news/announcements",
        json={"title": "nope"},
        headers=auth_headers(regular),
    )
    assert res.status_code == 403


# ── pagination window ─────────────────────────────────────────────────────────

def test_default_window_is_30_days_and_before_cursor_returns_history(db, client):
    old = Announcement(title="old", created_at=datetime.utcnow() - timedelta(days=60))
    recent = Announcement(title="recent", created_at=datetime.utcnow() - timedelta(days=1))
    db.add_all([old, recent])
    db.commit()

    default_items = client.get("/news/").json()
    titles = [i["title"] for i in default_items]
    assert "recent" in titles
    assert "old" not in titles

    cursor = (datetime.utcnow() - timedelta(days=2)).isoformat()
    older_items = client.get("/news/", params={"before": cursor}).json()
    older_titles = [i["title"] for i in older_items]
    assert "old" in older_titles
    assert "recent" not in older_titles
