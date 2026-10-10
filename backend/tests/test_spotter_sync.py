"""
Tests for the invader-spotter.art state sync (news + full modes).
The site is never hit: spotter_scraper fetchers are monkeypatched.
Key invariants:
- news.php parsing yields (date, [(city, number)]) filtered by the day window
- a state mismatch becomes an approved source="scraper" AdminRequest and updates the invader
- news mode notifies, full mode is silent
- news mode creates the invaders it mentions that the DB lacks (pushed only for "Ajout de")
- matching states / dry runs write nothing
- a state validated in the app is kept unless the site info is more recent
"""
from datetime import date, datetime, timedelta
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
<p class='news'><b>19 :</b> Mise à jour de plusieurs SI: <br/>STK_11 , STK_12 ,</p>
<p class='news'>STK_13 et STK_15 . Destruction de <a href='javascript:lienm("LA",67);'>H</a></p>
</div>
<div id='mois202608' style='display:none;'>
<p class='news'>orphan line before any day PA_1</p>
<p class='news'><b>31 :</b> R&eacute;activation de <a href='javascript:lienm("PA12",242);'>PA_242</a></p>
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


def _row(name, state, state_date="septembre 2026 (report)"):
    return {"name": name, "state": state, "points": 10, "state_date": state_date}


def _app_validation(db, invader, state, reviewed_at, source="community"):
    """An approved human (community/admin) state change, as the admin workflow leaves it."""
    db.add(AdminRequest(
        invader_id=invader.id, request_type="modify", status="approved", source=source,
        proposed_state=state, reviewed_at=reviewed_at, request_count=1, confidence=80,
    ))
    invader.state = state
    db.commit()


def _news_html(entries):
    """news.php markup for [(day, [(city, number), ...]), ...]."""
    return "".join(
        f"<div id='mois{day:%Y%m}'><p class='news'><b>{day.day} :</b> Mise a jour de "
        + " , ".join(f"{city}_{number}" for city, number in keys) + "</p></div>"
        for day, keys in entries
    )


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
    monkeypatch.setattr(spotter_scraper, "fetch_news_html",
                        lambda session: site.get("news_html") or _news_html(site["news"]))
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
        # continuation line (no "DD :") belongs to the 19th; "H" link -> id from its href
        (date(2026, 9, 19), [("STK", 11), ("STK", 12), ("STK", 13), ("STK", 15), ("LA", 67)]),
        (date(2026, 8, 31), [("PA", 242)]),
    ]


def test_single_invader_lookup_covers_paris_suburbs():
    payload = spotter_scraper._single_invader_payload("PA", 1306)
    assert payload["numero"] == "1306"
    assert {"PA01", "PA20", "PA77", "PA92", "PA93", "PA94", "PA95"} <= set(payload)
    assert spotter_scraper._single_invader_payload("LDN", 12) == {"numero": "12", "LDN": "on"}


def test_parse_state_date_uses_first_day_of_month():
    assert spotter_scraper.parse_state_date("septembre 2026 (report)") == date(2026, 9, 1)
    assert spotter_scraper.parse_state_date("mi-août 2020 (spott)") == date(2020, 8, 1)
    assert spotter_scraper.parse_state_date("juin  2026") == date(2026, 6, 1)
    assert spotter_scraper.parse_state_date("mai") is None
    assert spotter_scraper.parse_state_date(None) is None


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
    assert report.created == ["PA_999"]        # mentioned in news, unknown to us
    assert report.missing_in_db == []
    # PA_1 is older than the 7-day window: never fetched
    assert "PA_1" not in report.created

    db.expire_all()
    assert db.get(Invader, invaders["PA_516"].id).state == "Destroyed"
    assert db.get(Invader, invaders["PA_207"].id).state == "Good"

    reqs = db.query(AdminRequest).all()
    assert len(reqs) == 3
    assert all(r.source == "scraper" and r.status == "approved" and r.reviewed_at for r in reqs)
    assert all(r.reviewed_by is None for r in reqs)
    assert notify.call_count == 2              # PA_999 isn't an "Ajout de" news: silent catch-up


def test_news_sync_is_idempotent(db, invaders, fake_site):
    with patch("app.services.notification_service.notify_invader_event"):
        spotter_sync_service.sync_from_news(db, delay=0, today=date(2026, 9, 27))
        second = spotter_sync_service.sync_from_news(db, delay=0, today=date(2026, 9, 27))
    assert second.changes == [] and second.created == []
    assert db.query(AdminRequest).count() == 3


def test_dry_run_writes_nothing(db, invaders, fake_site):
    with patch("app.services.notification_service.notify_invader_event") as notify:
        report = spotter_sync_service.sync_from_news(db, dry_run=True, delay=0, today=date(2026, 9, 27))
    assert len(report.changes) == 2
    assert report.created == ["PA_999"]
    assert db.query(AdminRequest).count() == 0
    assert db.query(Invader).count() == 3
    assert db.get(Invader, invaders["PA_516"].id).state == "Good"
    notify.assert_not_called()


def test_unmapped_site_state_is_skipped(db, invaders, fake_site):
    fake_site["rows"][("PA", 516)] = _row("PA_516", "Quelque chose de nouveau")
    with patch("app.services.notification_service.notify_invader_event"):
        report = spotter_sync_service.sync_from_news(db, delay=0, today=date(2026, 9, 27))
    assert report.unparsed_state == ["PA_516: 'Quelque chose de nouveau'"]
    assert db.get(Invader, invaders["PA_516"].id).state == "Good"


def test_news_sync_creates_missing_invader_without_location(db, invaders, fake_site):
    """e.g. BGK_46: an old invader newly listed, in no catalogue yet."""
    fake_site["news"] = [(date(2026, 10, 9), [("BGK", 46)])]
    fake_site["rows"][("BGK", 46)] = {
        "name": "BGK_46", "state": "Détruit", "points": 20, "date_pose": "20/07/2005",
        "state_date": "octobre 2026 (report)", "picture_url": "https://x/BGK_46-grosplan.png",
    }
    with patch("app.services.notification_service.notify_invader_event") as notify:
        report = spotter_sync_service.sync_from_news(db, delay=0, today=date(2026, 10, 10))
    assert report.created == ["BGK_46"]
    inv = db.query(Invader).filter(Invader.name == "BGK_46").one()
    assert (inv.city, inv.number, inv.state, inv.points) == ("BGK", 46, "Destroyed", 20)
    assert inv.date_pose == date(2005, 7, 20)
    assert inv.image_url == "https://x/BGK_46-grosplan.png"
    assert inv.latitude is None and inv.longitude is None
    notify.assert_not_called()


def test_news_sync_pushes_creations_announced_as_added(db, invaders, fake_site):
    day = date(2026, 10, 9)
    fake_site["news"] = []
    fake_site["news_html"] = (f"<div id='mois{day:%Y%m}'><p class='news'><b>{day.day} :</b> "
                              "Ajout de PA_999 . Destruction de PA_516</p></div>")
    with patch("app.services.notification_service.notify_invader_event") as notify:
        report = spotter_sync_service.sync_from_news(db, delay=0, today=date(2026, 10, 10))
    assert report.created == ["PA_999"]
    assert sorted(call.args[1] for call in notify.call_args_list) == ["invader_added", "invader_updated"]


def test_news_sync_matches_invaders_by_name_when_city_number_are_empty(db, invaders, fake_site):
    legacy = Invader(name="PA_999", state="Good")    # created in the app, no city/number columns
    db.add(legacy)
    db.commit()
    fake_site["rows"][("PA", 999)] = _row("PA_999", "Détruit")
    with patch("app.services.notification_service.notify_invader_event"):
        report = spotter_sync_service.sync_from_news(db, delay=0, today=date(2026, 9, 27))
    assert report.created == []
    assert ("PA_999", "Good", "Destroyed") in {(c.name, c.old_state, c.new_state) for c in report.changes}
    assert db.query(Invader).filter(Invader.name == "PA_999").count() == 1


def test_parse_news_additions_and_date_pose():
    html = """<div id='mois202610'><p class='news'><b>9 :</b> Ajout de LAP_20 et LAP_21 .
    Mise &agrave; jour de BGK_46</p></div>"""
    assert [k for _, k in spotter_scraper.parse_news_additions(html)] == [("LAP", 20), ("LAP", 21)]
    assert spotter_scraper.parse_date_pose("20/07/2005") == date(2005, 7, 20)
    assert spotter_scraper.parse_date_pose(None) is None
    assert spotter_scraper.parse_date_pose("2005") is None


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


# ── app validation vs site info ───────────────────────────────────────────────

def test_full_sync_keeps_app_validation_newer_than_site(db, invaders, fake_site):
    """User reported PA_267 destroyed (validated 15/09); site still says OK as of 'août 2026'."""
    _app_validation(db, invaders["PA_267"], "Destroyed", datetime(2026, 9, 15, 10))
    fake_site["rows"][("PA", 267)] = _row("PA_267", "OK", "août 2026 (report)")
    with patch("app.services.notification_service.notify_invader_event"):
        report = spotter_sync_service.sync_full(db, delay=0)

    assert "PA_267" not in [c.name for c in report.changes]
    assert len(report.kept_app_state) == 1 and report.kept_app_state[0].startswith("PA_267")
    assert db.get(Invader, invaders["PA_267"].id).state == "Destroyed"


def test_full_sync_same_month_favours_app(db, invaders, fake_site):
    """Site date is month-only: a validation during that month counts as newer."""
    _app_validation(db, invaders["PA_267"], "Destroyed", datetime(2026, 9, 2))
    fake_site["rows"][("PA", 267)] = _row("PA_267", "OK", "septembre 2026 (report)")
    with patch("app.services.notification_service.notify_invader_event"):
        spotter_sync_service.sync_full(db, delay=0)
    assert db.get(Invader, invaders["PA_267"].id).state == "Destroyed"


def test_full_sync_overrides_app_validation_older_than_site(db, invaders, fake_site):
    """Validated in June, site reports a newer state in September: site wins."""
    _app_validation(db, invaders["PA_267"], "Destroyed", datetime(2026, 6, 10), source="admin")
    fake_site["rows"][("PA", 267)] = _row("PA_267", "OK", "septembre 2026 (report)")
    with patch("app.services.notification_service.notify_invader_event"):
        report = spotter_sync_service.sync_full(db, delay=0)
    assert "PA_267" in [c.name for c in report.changes]
    assert db.get(Invader, invaders["PA_267"].id).state == "Good"


def test_full_sync_keeps_app_validation_when_site_has_no_date(db, invaders, fake_site):
    _app_validation(db, invaders["PA_267"], "Destroyed", datetime(2026, 6, 10))
    fake_site["rows"][("PA", 267)] = _row("PA_267", "OK", "")
    with patch("app.services.notification_service.notify_invader_event"):
        report = spotter_sync_service.sync_full(db, delay=0)
    assert db.get(Invader, invaders["PA_267"].id).state == "Destroyed"
    assert report.kept_app_state[0].endswith("(no date)")


def test_news_sync_uses_exact_news_day(db, invaders, fake_site):
    """Validated on 25/09, news of 27/09 reactivates it: the newer news wins.
    Validated on 24/09, news of 23/09 destroys it: the app validation wins."""
    _app_validation(db, invaders["PA_207"], "Destroyed", datetime(2026, 9, 25))
    _app_validation(db, invaders["PA_516"], "Good", datetime(2026, 9, 24))
    with patch("app.services.notification_service.notify_invader_event"):
        report = spotter_sync_service.sync_from_news(db, delay=0, today=date(2026, 9, 27))

    assert [c.name for c in report.changes] == ["PA_207"]
    assert db.get(Invader, invaders["PA_207"].id).state == "Good"
    assert db.get(Invader, invaders["PA_516"].id).state == "Good"


def test_previous_scraper_changes_do_not_count_as_app_validation(db, invaders, fake_site):
    """Only human approvals protect a state — the sync's own past changes don't."""
    _app_validation(db, invaders["PA_267"], "Destroyed", datetime(2026, 9, 20), source="scraper")
    with patch("app.services.notification_service.notify_invader_event"):
        spotter_sync_service.sync_full(db, delay=0)
    assert db.get(Invader, invaders["PA_267"].id).state == "Good"


# ── reactivation backfill (News colours) ─────────────────────────────────────

def test_parse_news_reactivations_keeps_only_reactivated_names():
    html = """<div id='mois202609'>
    <p class='news'><b>27 :</b> R&eacute;activation de PA_207 et PA_267 . Destruction de PA_516</p>
    <p class='news'>et PA_692 . D&eacute;gradation de PA_262</p>
    </div>"""
    got = spotter_scraper.parse_news_reactivations(html)
    assert [key for _, key in got] == [("PA", 207), ("PA", 267)]
    html2 = """<div id='mois202609'>
    <p class='news'><b>18 :</b> R&eacute;activation de GNV_02 , GNV_07 ,</p>
    <p class='news'>GNV_14 et GNV_15 . Destruction de WN_54</p></div>"""
    # sentence spills over a continuation line
    assert [k for _, k in spotter_scraper.parse_news_reactivations(html2)] == [
        ("GNV", 2), ("GNV", 7), ("GNV", 14), ("GNV", 15)]


def _scraper_good(db, invader, reviewed_at, previous_state=None):
    ar = AdminRequest(invader_id=invader.id, request_type="modify", status="approved", source="scraper",
                      proposed_state="Good", previous_state=previous_state, reviewed_at=reviewed_at,
                      request_count=0, confidence=100)
    db.add(ar)
    db.commit()
    return ar


def test_full_sync_backfills_recent_reactivations(db, invaders, fake_site):
    recent = date.today() - timedelta(days=10)
    old = date.today() - timedelta(days=200)
    fake_site["news_html"] = f"""
    <div id='mois{recent:%Y%m}'><p class='news'><b>{recent.day} :</b> R&eacute;activation de PA_207</p></div>
    <div id='mois{old:%Y%m}'><p class='news'><b>{old.day} :</b> R&eacute;activation de PA_267</p></div>"""
    hit = _scraper_good(db, invaders["PA_207"], datetime.utcnow() - timedelta(days=5))
    too_old = _scraper_good(db, invaders["PA_267"], datetime.utcnow() - timedelta(days=150))
    with patch("app.services.notification_service.notify_invader_event"):
        report = spotter_sync_service.sync_full(db, delay=0)

    db.expire_all()
    assert db.get(AdminRequest, hit.id).previous_state == "Destroyed"
    assert db.get(AdminRequest, too_old.id).previous_state is None   # news older than 3 months
    assert report.backfilled_reactivations == [f"PA_207 (news {recent})"]


def test_backfill_never_overrides_known_previous_state(db, invaders, fake_site):
    recent = date.today() - timedelta(days=10)
    fake_site["news_html"] = f"""<div id='mois{recent:%Y%m}'><p class='news'><b>{recent.day} :</b>
    R&eacute;activation de PA_207</p></div>"""
    known = _scraper_good(db, invaders["PA_207"], datetime.utcnow() - timedelta(days=5), previous_state="Degraded")
    with patch("app.services.notification_service.notify_invader_event"):
        report = spotter_sync_service.sync_full(db, delay=0)
    db.expire_all()
    assert db.get(AdminRequest, known.id).previous_state == "Degraded"
    assert report.backfilled_reactivations == []


def test_news_sync_backfills_reactivations_of_its_window(db, invaders, fake_site):
    recent = date.today() - timedelta(days=2)
    old = date.today() - timedelta(days=30)
    fake_site["news"] = []
    fake_site["news_html"] = f"""
    <div id='mois{recent:%Y%m}'><p class='news'><b>{recent.day} :</b> R&eacute;activation de PA_207</p></div>
    <div id='mois{old:%Y%m}'><p class='news'><b>{old.day} :</b> R&eacute;activation de PA_267</p></div>"""
    hit = _scraper_good(db, invaders["PA_207"], datetime.utcnow() - timedelta(days=1))
    outside = _scraper_good(db, invaders["PA_267"], datetime.utcnow() - timedelta(days=20))
    with patch("app.services.notification_service.notify_invader_event"):
        report = spotter_sync_service.sync_from_news(db, delay=0)
    db.expire_all()
    assert db.get(AdminRequest, hit.id).previous_state == "Destroyed"
    assert db.get(AdminRequest, outside.id).previous_state is None   # left to the weekly full sync
    assert report.backfilled_reactivations == [f"PA_207 (news {recent})"]
