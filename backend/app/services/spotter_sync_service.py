"""
Keeps invader states aligned with invader-spotter.art.

Two modes, both run by app/jobs/spotter_sync.py on a Railway Cron schedule:
  - sync_from_news(): cheap, twice a day. Reads news.php, then re-fetches each
    invader mentioned in the last few days (the news text alone doesn't always
    say the new state, e.g. "Mise à jour du statut de PA_1324"). Also tags that
    window's "Réactivation" news on past changes (see _backfill_reactivations).
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

Only `state` is synced on known invaders. Invaders a news mentions that the DB
lacks are created (news mode only) without location: the site has no GPS, the
InvaderQuest sync fills it in later. Pushed only when the news says "Ajout de"
(really new); others are catalogue catch-up (e.g. an old invader newly listed).
Full mode only reports them, so a large catalogue gap doesn't flood the News feed.
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
from ..models.admin_request import AUTOMATED_SOURCES, AdminRequest
from ..models.space_invader import Invader
from . import admin_request_service, notification_service

log = logging.getLogger("spotter_sync")

DEFAULT_NEWS_DAYS = 7          # overlap covers skipped runs (redeploys, site downtime)
REACTIVATION_BACKFILL_DAYS = 90   # full mode: only recent "Réactivation" news are back-filled
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
    created: List[str] = field(default_factory=list)            # news mode: was missing from our DB
    missing_in_db: List[str] = field(default_factory=list)      # full mode: on the site, not in our DB
    missing_on_site: List[str] = field(default_factory=list)    # asked the site, got nothing
    unparsed_state: List[str] = field(default_factory=list)     # site label we can't map
    kept_app_state: List[str] = field(default_factory=list)     # app validation newer than site info
    backfilled_reactivations: List[str] = field(default_factory=list)  # past changes now tagged reactivated
    errors: List[str] = field(default_factory=list)

    def summary(self) -> str:
        return (
            f"[{self.mode}{' DRY-RUN' if self.dry_run else ''}] checked={self.checked} "
            f"changed={len(self.changes)} created={len(self.created)} missing_in_db={len(self.missing_in_db)} "
            f"missing_on_site={len(self.missing_on_site)} unparsed_state={len(self.unparsed_state)} "
            f"kept_app_state={len(self.kept_app_state)} "
            f"backfilled_reactivations={len(self.backfilled_reactivations)} "
            f"errors={len(self.errors)}"
        )


def _apply_state(
    db: Session, invader_id: int, new_state: str,
    notify_batch: Optional[notification_service.InvaderNotificationBatch],
) -> None:
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
    admin_request_service.approve(
        db, admin_req, admin_user=None, notify=notify_batch is not None, notify_batch=notify_batch,
    )


def _last_app_state_validation(db: Session, invader_ids: List[int]) -> Dict[int, datetime]:
    """invader_id -> when a human (community/admin) approval last set its state."""
    if not invader_ids:
        return {}
    rows = (
        db.query(AdminRequest.invader_id, func.max(AdminRequest.reviewed_at))
        .filter(
            AdminRequest.invader_id.in_(invader_ids),
            AdminRequest.status == "approved",
            AdminRequest.source.notin_(AUTOMATED_SOURCES),
            AdminRequest.proposed_state.isnot(None),
            AdminRequest.reviewed_at.isnot(None),
        )
        .group_by(AdminRequest.invader_id)
        .all()
    )
    return {invader_id: reviewed_at for invader_id, reviewed_at in rows}


def _create(
    db: Session, info: dict, state: Optional[str],
    notify_batch: Optional[notification_service.InvaderNotificationBatch],
) -> None:
    """A news invader missing from the DB, as an auto-approved scraper creation (no location)."""
    admin_req = AdminRequest(
        request_type="create",
        status="pending",
        proposed_name=info["name"],
        proposed_state=state or "Unknown",
        proposed_points=info.get("points"),
        proposed_image_url=info.get("picture_url"),
        proposed_date_pose=spotter_scraper.parse_date_pose(info.get("date_pose")),
        request_count=0,
        confidence=100,
        source="scraper",
        validated_by=VALIDATED_BY,
    )
    db.add(admin_req)
    db.flush()
    admin_request_service.approve(
        db, admin_req, admin_user=None, notify=notify_batch is not None, notify_batch=notify_batch,
    )


def _invader_key(invader: Invader) -> Optional[Tuple[str, int]]:
    """city/number columns, else parsed from the name (invaders created in the app
    before those columns were filled on creation)."""
    if invader.city and invader.number is not None:
        return (invader.city, invader.number)
    return spotter_scraper.split_name(invader.name) if invader.name else None


def _reconcile(
    db: Session,
    report: SyncReport,
    scraped: Dict[Tuple[str, int], dict],
    notify: bool,
    city: Optional[str] = None,
    create_missing: bool = False,
    push_creations: Optional[set] = None,
) -> None:
    """DB phase: diff scraped rows against the DB, then apply.

    Runs only once all scraping is done: Neon drops connections left idle in a
    transaction for minutes, so no transaction may stay open across network calls.
    Diffs are computed on plain values first because each approve() commits,
    which expires every loaded ORM object.

    `create_missing` creates scraped invaders the DB lacks; `push_creations` holds
    the keys whose creation is push-worthy ("Ajout de" news).
    """
    db_invaders: Dict[Tuple[str, int], Invader] = {}
    for inv in db.query(Invader).all():
        key = _invader_key(inv)
        if key is not None and (city is None or key[0] == city):
            db_invaders.setdefault(key, inv)

    to_create: List[Tuple[Tuple[str, int], dict, Optional[str]]] = []
    candidates: List[Tuple[Invader, str, Optional[date]]] = []
    for key, info in sorted(scraped.items()):
        invader = db_invaders.get(key)
        if invader is None:
            name = info.get("name") or f"{key[0]}_{key[1]}"
            if create_missing:
                raw_state = info.get("state")
                to_create.append((key, {**info, "name": name}, normalize_state(raw_state) if raw_state else None))
                report.created.append(name)
            else:
                report.missing_in_db.append(name)
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
    # Pushes go out at the end: one by one, or one summary past MAX_INDIVIDUAL_PUSHES
    batch = notification_service.InvaderNotificationBatch() if notify else None
    for key, info, state in to_create:
        _create(db, info, state, notify_batch=batch if key in (push_creations or ()) else None)
    for invader_id, new_state in pending:
        _apply_state(db, invader_id, new_state, notify_batch=batch)
    if batch is not None:
        batch.flush(db)


def _invader_ids_by_key(db: Session, keys: List[Tuple[str, int]]) -> Dict[Tuple[str, int], int]:
    """(city, number) -> invader id, also matching by name for invaders whose
    city/number columns were never filled (created from the app)."""
    out: Dict[Tuple[str, int], int] = {}
    for city, number in set(keys):
        names = {f"{city}_{number}", f"{city}_{number:02d}", f"{city}_{number:03d}", f"{city}_{number:04d}"}
        inv = (
            db.query(Invader.id)
            .filter(
                ((Invader.city == city) & (Invader.number == number)) | Invader.name.in_(names)
            )
            .first()
        )
        if inv:
            out[(city, number)] = inv[0]
    return out


def _backfill_reactivations(
    db: Session, report: SyncReport, reactivations: List[Tuple[date, Tuple[str, int]]],
) -> None:
    """Tag past changes as reactivations, so the News feed shows them in magenta.

    `previous_state` is only recorded since the News colours shipped. For each recent
    "Réactivation de X" news, the first approved change of X back to Good on or after
    that day, whose previous state is unknown, gets previous_state = Destroyed.
    Rows that already have a previous_state are never touched (re-runs are no-ops).
    """
    ids = _invader_ids_by_key(db, [key for _, key in reactivations])
    tagged: List[int] = []   # one news -> one change (two reactivations of X tag two changes)
    for day, key in reactivations:
        invader_id = ids.get(key)
        if invader_id is None:
            continue
        admin_req = (
            db.query(AdminRequest)
            .filter(
                AdminRequest.invader_id == invader_id,
                AdminRequest.status == "approved",
                AdminRequest.request_type == "modify",
                AdminRequest.proposed_state == "Good",
                AdminRequest.previous_state.is_(None),
                AdminRequest.reviewed_at >= datetime(day.year, day.month, day.day),
                AdminRequest.id.notin_(tagged),
            )
            .order_by(AdminRequest.reviewed_at.asc())
            .first()
        )
        if admin_req is None:
            continue
        tagged.append(admin_req.id)
        report.backfilled_reactivations.append(f"{key[0]}_{key[1]} (news {day})")
        if not report.dry_run:
            admin_req.previous_state = "Destroyed"
    if report.backfilled_reactivations and not report.dry_run:
        db.commit()


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
    news_html = spotter_scraper.fetch_news_html(spotter_scraper.new_session())
    entries = spotter_scraper.parse_news_html(news_html)
    reactivations = [
        (day, key) for day, key in spotter_scraper.parse_news_reactivations(news_html) if day >= cutoff
    ]
    additions = {key for day, key in spotter_scraper.parse_news_additions(news_html) if day >= cutoff}
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
    _reconcile(db, report, scraped, notify=True, create_missing=True, push_creations=additions)
    _backfill_reactivations(db, report, reactivations)
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

    db_keys = {
        key for key in map(_invader_key, db.query(Invader).all())
        if key is not None and (city is None or key[0] == city)
    }
    log.info("full: %d invaders in DB across %d cities", len(db_keys), len({c for c, _ in db_keys}))
    db.rollback()  # release the connection before minutes of scraping

    # Network phase
    reactivations: List[Tuple[date, Tuple[str, int]]] = []
    try:
        cutoff = date.today() - timedelta(days=REACTIVATION_BACKFILL_DAYS)
        reactivations = [
            (day, key)
            for day, key in spotter_scraper.parse_news_reactivations(
                spotter_scraper.fetch_news_html(spotter_scraper.new_session())
            )
            if day >= cutoff and (city is None or key[0] == city)
        ]
    except requests.RequestException as e:
        report.errors.append(f"news.php: {e}")

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
    _backfill_reactivations(db, report, reactivations)
    return report
