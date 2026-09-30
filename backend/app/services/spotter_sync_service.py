"""
Keeps invader states aligned with invader-spotter.art.

Two modes, both run by app/jobs/spotter_sync.py on a Railway Cron schedule:
  - sync_from_news(): cheap, twice a day. Reads news.php, then re-fetches each
    invader mentioned in the last few days (the news text alone doesn't always
    say the new state, e.g. "Mise à jour du statut de PA_1324").
  - sync_full():      weekly safety net. Scrapes every city listing and fixes any
    drift. Silent by default (--notify to push) so a large backlog doesn't spam users.

Every change goes through a `source="scraper"` AdminRequest auto-approved via
admin_request_service.approve(), so it shows up in the News feed (credited
"invader-spotter.art"), bumps updated_at for delta sync, and (news mode) sends
the usual push notification.

A state validated in the app (community/admin approval) is never overwritten by
older site info: the site change applies only if its date is later than that
validation. Site date = the news day (news mode) or the "Date et source" month
(full mode, first day of the month, so the app wins ties within a month).

Only `state` is synced. Invaders the site lists but the DB lacks (new ones:
"Ajout de ...") are reported, not created: the site has no GPS coordinates.
"""
import logging
import time
from dataclasses import dataclass, field
from datetime import date, datetime, timedelta
from typing import Dict, List, Optional, Tuple

import requests
from sqlalchemy import func
from sqlalchemy.orm import Session

from ..core import spotter_scraper
from ..core.invader_states import normalize_state
from ..models.admin_request import AdminRequest
from ..models.space_invader import Invader
from . import admin_request_service

log = logging.getLogger("spotter_sync")

DEFAULT_NEWS_DAYS = 7          # overlap covers skipped runs (redeploys, site downtime)
DEFAULT_DELAY_S = 0.5          # between requests — be polite to a hobby site
VALIDATED_BY = "invader-spotter-sync"


@dataclass
class StateChange:
    name: str
    old_state: Optional[str]
    new_state: str


@dataclass
class SyncReport:
    mode: str
    dry_run: bool
    checked: int = 0
    changes: List[StateChange] = field(default_factory=list)
    missing_in_db: List[str] = field(default_factory=list)      # on the site, not in our DB
    missing_on_site: List[str] = field(default_factory=list)    # asked the site, got nothing
    unparsed_state: List[str] = field(default_factory=list)     # site label we can't map
    kept_app_state: List[str] = field(default_factory=list)     # app validation newer than site info
    errors: List[str] = field(default_factory=list)

    def summary(self) -> str:
        return (
            f"[{self.mode}{' DRY-RUN' if self.dry_run else ''}] checked={self.checked} "
            f"changed={len(self.changes)} missing_in_db={len(self.missing_in_db)} "
            f"missing_on_site={len(self.missing_on_site)} unparsed_state={len(self.unparsed_state)} "
            f"kept_app_state={len(self.kept_app_state)} "
            f"errors={len(self.errors)}"
        )


def _apply_state(db: Session, invader_id: int, new_state: str, notify: bool) -> None:
    """Record the change as an auto-approved scraper AdminRequest (News feed + delta sync)."""
    admin_req = AdminRequest(
        invader_id=invader_id,
        request_type="modify",
        status="pending",
        proposed_state=new_state,
        request_count=0,
        confidence=100,
        source="scraper",
        validated_by=VALIDATED_BY,
    )
    db.add(admin_req)
    db.flush()
    admin_request_service.approve(db, admin_req, admin_user=None, notify=notify)


def _last_app_state_validation(db: Session, invader_ids: List[int]) -> Dict[int, datetime]:
    """invader_id -> when a human (community/admin) approval last set its state."""
    if not invader_ids:
        return {}
    rows = (
        db.query(AdminRequest.invader_id, func.max(AdminRequest.reviewed_at))
        .filter(
            AdminRequest.invader_id.in_(invader_ids),
            AdminRequest.status == "approved",
            AdminRequest.source != "scraper",
            AdminRequest.proposed_state.isnot(None),
            AdminRequest.reviewed_at.isnot(None),
        )
        .group_by(AdminRequest.invader_id)
        .all()
    )
    return {invader_id: reviewed_at for invader_id, reviewed_at in rows}


def _reconcile(
    db: Session,
    report: SyncReport,
    scraped: Dict[Tuple[str, int], dict],
    notify: bool,
    city: Optional[str] = None,
) -> None:
    """DB phase: diff scraped rows against the DB, then apply.

    Runs only once all scraping is done: Neon drops connections left idle in a
    transaction for minutes, so no transaction may stay open across network calls.
    Diffs are computed on plain values first because each approve() commits,
    which expires every loaded ORM object.
    """
    q = db.query(Invader).filter(Invader.city.isnot(None), Invader.number.isnot(None))
    if city:
        q = q.filter(Invader.city == city)
    db_invaders = {(inv.city, inv.number): inv for inv in q.all()}

    candidates: List[Tuple[Invader, str, Optional[date]]] = []
    for key, info in sorted(scraped.items()):
        invader = db_invaders.get(key)
        if invader is None:
            report.missing_in_db.append(info.get("name") or f"{key[0]}_{key[1]}")
            continue
        report.checked += 1
        raw_state = info.get("state")
        new_state = normalize_state(raw_state) if raw_state else None
        if new_state is None:
            report.unparsed_state.append(f"{invader.name}: {raw_state!r}")
            continue
        if new_state == invader.state:
            continue
        candidates.append((invader, new_state, info.get("_site_date")))

    app_validated = _last_app_state_validation(db, [inv.id for inv, _, _ in candidates])
    pending: List[Tuple[int, str]] = []
    for invader, new_state, site_date in candidates:
        validated_at = app_validated.get(invader.id)
        if validated_at is not None and (site_date is None or validated_at.date() >= site_date):
            report.kept_app_state.append(
                f"{invader.name}: app {invader.state} (validated {validated_at:%Y-%m-%d}) "
                f"vs site {new_state} ({site_date or 'no date'})"
            )
            continue
        report.changes.append(StateChange(invader.name, invader.state, new_state))
        pending.append((invader.id, new_state))

    if report.dry_run:
        return
    for invader_id, new_state in pending:
        _apply_state(db, invader_id, new_state, notify=notify)


def sync_from_news(
    db: Session,
    days: int = DEFAULT_NEWS_DAYS,
    dry_run: bool = False,
    delay: float = DEFAULT_DELAY_S,
    today: Optional[date] = None,
) -> SyncReport:
    report = SyncReport(mode="news", dry_run=dry_run)
    cutoff = (today or date.today()) - timedelta(days=days)

    # Network phase
    log.info("news: fetching %s", spotter_scraper.NEWS_URL)
    entries = spotter_scraper.fetch_news(spotter_scraper.new_session())
    news_day: Dict[Tuple[str, int], date] = {}   # newest mention wins (entries are newest first)
    for day, invaders in entries:
        if day < cutoff:
            continue
        for key in invaders:
            news_day.setdefault(key, day)
    names = list(news_day)
    log.info("news: %d invaders mentioned since %s", len(names), cutoff)

    session = spotter_scraper.new_search_session()
    scraped: Dict[Tuple[str, int], dict] = {}
    for idx, (city, number) in enumerate(names, 1):
        label = f"{city}_{number}"
        log.info("news: [%d/%d] fetching %s", idx, len(names), label)
        try:
            info = spotter_scraper.fetch_single_invader(session, city, number)
        except requests.RequestException as e:
            report.errors.append(f"{label}: {e}")
            continue
        finally:
            if delay:
                time.sleep(delay)
        if info is None:
            report.missing_on_site.append(label)
        else:
            info["_site_date"] = news_day[(city, number)]
            scraped[(city, number)] = info

    # DB phase
    log.info("news: comparing %d scraped invaders with the DB", len(scraped))
    _reconcile(db, report, scraped, notify=True)
    return report


def sync_full(
    db: Session,
    dry_run: bool = False,
    delay: float = DEFAULT_DELAY_S,
    city: Optional[str] = None,
    notify: bool = False,
) -> SyncReport:
    """`notify` defaults to False so a large drift backlog doesn't spam users."""
    report = SyncReport(mode="full", dry_run=dry_run)

    q = db.query(Invader.city, Invader.number).filter(Invader.city.isnot(None), Invader.number.isnot(None))
    if city:
        q = q.filter(Invader.city == city)
    db_keys = set(q.all())
    log.info("full: %d invaders in DB across %d cities", len(db_keys), len({c for c, _ in db_keys}))
    db.rollback()  # release the connection before minutes of scraping

    # Network phase
    session = spotter_scraper.new_listing_session()
    scraped: Dict[Tuple[str, int], dict] = {}
    for city_code in sorted({c for c, _ in db_keys}):
        try:
            city_rows = spotter_scraper.fetch_city(session, city_code, delay=delay)
        except requests.RequestException as e:
            report.errors.append(f"{city_code}: {e}")
            continue
        finally:
            if delay:
                time.sleep(delay)
        if not city_rows:
            # Whole city absent: most likely a code mismatch with the site, not 100 missing invaders.
            report.errors.append(f"{city_code}: site returned no invaders")
            continue
        for info in city_rows.values():
            info["_site_date"] = spotter_scraper.parse_state_date(info.get("state_date"))
        scraped.update(city_rows)
        for key in sorted(k for k in db_keys if k[0] == city_code and k not in city_rows):
            report.missing_on_site.append(f"{key[0]}_{key[1]}")
        log.info("full: %s scraped (%d on site)", city_code, len(city_rows))

    # DB phase
    log.info("full: comparing %d scraped invaders with the DB", len(scraped))
    _reconcile(db, report, scraped, notify=notify, city=city)
    return report
