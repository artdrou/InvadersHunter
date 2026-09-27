"""
Tests for the invader-spotter.art state sync (news + full modes).
The site is never hit: spotter_scraper fetchers are monkeypatched.
Key invariants:
- news.php parsing yields (date, [(city, number)]) filtered by the day window
- a state mismatch becomes an approved source="scraper" AdminRequest and updates the invader
- news mode notifies, full mode is silent
- matching states / dry runs write nothing
"""
from datetime import date
from unittest.mock import patch

import pytest

from app.core import spotter_scraper
from app.models.admin_request import AdminRequest
from app.models.space_invader import Invader
from app.services import spotter_sync_service


NEWS_HTML = """
<div id='mois202609'>
<p class='news'><b>27 :</b> R&eacute;activation de <a href='#'>PA_207</a> , <a>PA_267</a> et <a>PA_692</a></p>
<p class='news'><b>23 :</b> Destruction de <a class='ko'>PA_516</a></p>
<p class='news'><b>19 :</b> Mise à jour de plusieurs SI: <br/>STK_11 , STK_12 , <br/>STK_13 et STK_15</p>
</div>
<div id='mois202608' style='display:none;'>
<p class='news'><b>31 :</b> R&eacute;activation de <a>PA_242</a></p>
<p class='news'>no day here PA_1</p>
</div>
"""


@pytest.fixture()
def invaders(db):
    rows = [
        Invader(name="PA_516", city="PA", number=516, state="Good", points=10),
        Invader(name="PA_207", city="PA", number=207, state="Destroyed", points=20),
        Invader(name="PA_267", city="PA", number=267, state="Good", points=20),
    ]
    db.add_all(rows)
    db.commit()
    return {inv.name: inv for inv in rows}


def _row(name, state):
    return {"name": name, "state": state, "points": 10}


@pytest.fixture()
def fake_site(monkeypatch):
    """Site state keyed by (city, number); news entries configurable per test."""
    site = {
        "news": [(date(2026, 9, 27), [("PA", 207), ("PA", 267), ("PA", 999)]),
                 (date(2026, 9, 23), [("PA", 516)]),
                 (date(2026, 8, 1), [("PA", 1)])],
        "rows": {("PA", 516): _row("PA_516", "Détruit"),
                 ("PA", 207): _row("PA_207", "OK"),
                 ("PA", 267): _row("PA_267", "OK"),
                 ("PA", 999): _row("PA_999", "OK")},    # on site, not in DB
    }
    monkeypatch.setattr(spotter_scraper, "fetch_news", lambda session: site["news"])
    monkeypatch.setattr(spotter_scraper, "new_search_session", lambda: None)
    monkeypatch.setattr(spotter_scraper, "new_listing_session", lambda: None)
    monkeypatch.setattr(spotter_scraper, "fetch_single_invader",
                        lambda session, city, number: site["rows"].get((city, number)))
    monkeypatch.setattr(spotter_scraper, "fetch_city",
                        lambda session, city, delay=0: {k: v for k, v in site["rows"].items() if k[0] == city})
    return site


# ── parsing ───────────────────────────────────────────────────────────────────

def test_parse_news_html_extracts_dates_and_names():
    entries = spotter_scraper.parse_news_html(NEWS_HTML)
    assert entries == [
        (date(2026, 9, 27), [("PA", 207), ("PA", 267), ("PA", 692)]),
        (date(2026, 9, 23), [("PA", 516)]),
        (date(2026, 9, 19), [("STK", 11), ("STK", 12), ("STK", 13), ("STK", 15)]),
        (date(2026, 8, 31), [("PA", 242)]),
    ]


def test_split_name_strips_padding():
    assert spotter_scraper.split_name("AMS_02") == ("AMS", 2)
    assert spotter_scraper.split_name("not an invader") is None


# ── news mode ─────────────────────────────────────────────────────────────────

def test_news_sync_applies_changes_as_approved_scraper_requests(db, invaders, fake_site):
    with patch("app.services.notification_service.notify_invader_event") as notify:
        report = spotter_sync_service.sync_from_news(db, days=7, delay=0, today=date(2026, 9, 27))

    assert {(c.name, c.old_state, c.new_state) for c in report.changes} == {
        ("PA_516", "Good", "Destroyed"),
        ("PA_207", "Destroyed", "Good"),
    }
    assert report.checked == 3                 # PA_267 already aligned
    assert report.missing_in_db == ["PA_999"]  # mentioned in news, unknown to us
    # PA_1 is older than the 7-day window: never fetched
    assert "PA_1" not in report.missing_in_db

    db.expire_all()
    assert db.get(Invader, invaders["PA_516"].id).state == "Destroyed"
    assert db.get(Invader, invaders["PA_207"].id).state == "Good"

    reqs = db.query(AdminRequest).all()
    assert len(reqs) == 2
    assert all(r.source == "scraper" and r.status == "approved" and r.reviewed_at for r in reqs)
    assert all(r.reviewed_by is None for r in reqs)
    assert notify.call_count == 2


def test_news_sync_is_idempotent(db, invaders, fake_site):
    with patch("app.services.notification_service.notify_invader_event"):
        spotter_sync_service.sync_from_news(db, delay=0, today=date(2026, 9, 27))
        second = spotter_sync_service.sync_from_news(db, delay=0, today=date(2026, 9, 27))
    assert second.changes == []
    assert db.query(AdminRequest).count() == 2


def test_dry_run_writes_nothing(db, invaders, fake_site):
    with patch("app.services.notification_service.notify_invader_event") as notify:
        report = spotter_sync_service.sync_from_news(db, dry_run=True, delay=0, today=date(2026, 9, 27))
    assert len(report.changes) == 2
    assert db.query(AdminRequest).count() == 0
    assert db.get(Invader, invaders["PA_516"].id).state == "Good"
    notify.assert_not_called()


def test_unmapped_site_state_is_skipped(db, invaders, fake_site):
    fake_site["rows"][("PA", 516)] = _row("PA_516", "Quelque chose de nouveau")
    with patch("app.services.notification_service.notify_invader_event"):
        report = spotter_sync_service.sync_from_news(db, delay=0, today=date(2026, 9, 27))
    assert report.unparsed_state == ["PA_516: 'Quelque chose de nouveau'"]
    assert db.get(Invader, invaders["PA_516"].id).state == "Good"


# ── full mode ─────────────────────────────────────────────────────────────────

def test_full_sync_is_silent_and_reports_gaps(db, invaders, fake_site):
    del fake_site["rows"][("PA", 267)]                         # gone from site
    with patch("app.services.notification_service.notify_invader_event") as notify:
        report = spotter_sync_service.sync_full(db, delay=0)

    assert len(report.changes) == 2
    assert report.missing_in_db == ["PA_999"]
    assert report.missing_on_site == ["PA_267"]
    notify.assert_not_called()
    assert db.query(AdminRequest).filter(AdminRequest.status == "approved").count() == 2


def test_full_sync_notifies_when_asked(db, invaders, fake_site):
    with patch("app.services.notification_service.notify_invader_event") as notify:
        spotter_sync_service.sync_full(db, delay=0, notify=True)
    assert notify.call_count == 2
