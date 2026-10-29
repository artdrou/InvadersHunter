"""
Tests for GET /news/reactivations (map "Reactivated" state color).
- Destroyed / Not visible -> Good, approved, within 60 days: listed (latest per invader)
- Pending, other transitions, InvaderQuest refinements and old ones: not listed
"""
from datetime import datetime, timedelta

from app.models.space_invader import Invader
from app.models.admin_request import AdminRequest


def _invader(db, name):
    inv = Invader(name=name, city="Paris", latitude=48.85, longitude=2.35, state="Good", points=10)
    db.add(inv)
    db.flush()
    return inv


def _change(db, invader, previous, new, days_ago, status="approved", refines=None):
    db.add(AdminRequest(
        invader_id=invader.id, request_type="modify", status=status, source="scraper",
        previous_state=previous, proposed_state=new, refines_state=refines,
        reviewed_at=datetime.utcnow() - timedelta(days=days_ago),
    ))
    db.flush()


def test_lists_recent_reactivations_latest_first(db, client):
    a, b = _invader(db, "PA_1"), _invader(db, "PA_2")
    _change(db, a, "Destroyed", "Good", days_ago=40)
    _change(db, a, "Not visible", "Good", days_ago=5)
    _change(db, b, "Destroyed", "Good", days_ago=10)
    db.commit()

    res = client.get("/news/reactivations")
    assert res.status_code == 200
    items = res.json()
    assert [i["invader_id"] for i in items] == [a.id, b.id]
    # latest reactivation of PA_1 (5 days ago), not the 40-day-old one
    assert datetime.fromisoformat(items[0]["date"]) > datetime.utcnow() - timedelta(days=6)


def test_ignores_non_reactivations(db, client):
    inv = _invader(db, "PA_3")
    _change(db, inv, "Destroyed", "Badly degraded", days_ago=1)   # still there, worn
    _change(db, inv, "Degraded", "Good", days_ago=1)              # restored, never gone
    _change(db, inv, "Destroyed", "Good", days_ago=1, status="pending")
    _change(db, inv, "Destroyed", "Good", days_ago=1, refines=True)
    _change(db, inv, "Destroyed", "Good", days_ago=70)            # older than the window
    _change(db, inv, None, "Good", days_ago=1)                    # before previous_state existed
    db.commit()

    assert client.get("/news/reactivations").json() == []
