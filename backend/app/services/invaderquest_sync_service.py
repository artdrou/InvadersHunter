"""
Completes the invader catalogue from InvaderQuest's open data (see core/invaderquest_client.py).

invader-spotter.art (spotter_sync_service) stays the authority on `state`. This
source brings what the site lacks:
  - invaders we don't have yet -> created, with GPS coordinates when known.
    No coordinates is normal for new ones: they show in the list, not on the map.
  - empty fields on existing invaders (location, points, pose date, photo) -> filled.
    A value already set (by a human or a previous import) is never overwritten:
    a location far from InvaderQuest's is only reported (`far_locations`).

Run once a day by app/jobs/invaderquest_sync.py. Steps:
  1. Network phase: index.json; skip everything if its version is unchanged.
     Re-download only the cities whose version changed, plus news.json.
  2. DB phase: diff, then one auto-approved `source="invaderquest"` AdminRequest
     per invader (News feed entry credited "InvaderQuest" + delta sync). Pushes
     (freshly added invaders only) go through notification_service.InvaderNotificationBatch:
     one per invader, or a single "x new invaders, ..." push past 10.
  3. Remember the versions seen (sync_state table) for the next run.

Never deletes: a city file can be skipped for a day by the maintainer's checks.
"""
import json
import logging
import time
from dataclasses import dataclass, field
from datetime import date, timedelta
from typing import Dict, List, Optional, Tuple

import requests
from sqlalchemy.orm import Session

from ..core import invaderquest_client
from ..core.geo_utils import haversine_m
from ..core.spotter_scraper import split_name
from ..models.admin_request import AdminRequest
from ..models.space_invader import Invader
from ..models.sync_state import SyncState
from . import admin_request_service, invader_service, notification_service

log = logging.getLogger("invaderquest_sync")

STATE_KEY = "invaderquest"
SOURCE = "invaderquest"
VALIDATED_BY = "invaderquest-sync"
DEFAULT_DELAY_S = 0.2          # between city files — GitHub raw, but stay polite
NEWS_DAYS = 7                  # "added" events this recent count as new (push-worthy)
FAR_LOCATION_M = 150           # report (never fix) app locations this far from InvaderQuest's
FILLABLE = ("latitude", "longitude", "points", "date_pose", "image_url")

Key = Tuple[str, int]


@dataclass
class SyncReport:
    dry_run: bool
    skipped_unchanged: bool = False
    cities_fetched: List[str] = field(default_factory=list)
    checked: int = 0
    created: List[str] = field(default_factory=list)
    created_without_location: List[str] = field(default_factory=list)
    filled: List[str] = field(default_factory=list)            # "PA_12: latitude, longitude"
    far_locations: List[str] = field(default_factory=list)
    errors: List[str] = field(default_factory=list)
    pushes_sent: int = 0

    def summary(self) -> str:
        if self.skipped_unchanged:
            return f"[invaderquest{' DRY-RUN' if self.dry_run else ''}] data unchanged since last run, nothing to do"
        return (
            f"[invaderquest{' DRY-RUN' if self.dry_run else ''}] cities={len(self.cities_fetched)} "
            f"checked={self.checked} created={len(self.created)} "
            f"(without location={len(self.created_without_location)}) filled={len(self.filled)} "
            f"far_locations={len(self.far_locations)} pushes={self.pushes_sent} errors={len(self.errors)}"
        )


# ── sync_state ────────────────────────────────────────────────────────────────

def _load_versions(db: Session) -> dict:
    row = db.query(SyncState).filter(SyncState.key == STATE_KEY).first()
    return json.loads(row.value) if row and row.value else {}


def _save_versions(db: Session, versions: dict) -> None:
    row = db.query(SyncState).filter(SyncState.key == STATE_KEY).first()
    if row is None:
        row = SyncState(key=STATE_KEY)
        db.add(row)
    row.value = json.dumps(versions, sort_keys=True)
    db.commit()


# ── matching ──────────────────────────────────────────────────────────────────

def _invader_key(invader: Invader) -> Optional[Key]:
    """city/number columns, else parsed from the name (invaders created in the app before
    those columns were filled on creation)."""
    if invader.city and invader.number is not None:
        return (invader.city, invader.number)
    return split_name(invader.name) if invader.name else None


def _db_snapshot(db: Session) -> Dict[Key, dict]:
    """(city, number) -> plain values. Plain dicts because every approve() commits,
    which expires loaded ORM objects."""
    out: Dict[Key, dict] = {}
    for inv in db.query(Invader).all():
        key = _invader_key(inv)
        if key is not None and key not in out:
            out[key] = {"id": inv.id, "name": inv.name, **{f: getattr(inv, f) for f in FILLABLE}}
    return out


# ── writes ────────────────────────────────────────────────────────────────────

Batch = Optional[notification_service.InvaderNotificationBatch]


def _approve(db: Session, admin_req: AdminRequest, batch: Batch) -> None:
    db.add(admin_req)
    db.flush()
    admin_request_service.approve(
        db, admin_req, admin_user=None, notify=batch is not None, notify_batch=batch,
    )


def _create(db: Session, rec: dict, batch: Batch) -> None:
    _approve(db, AdminRequest(
        request_type="create",
        status="pending",
        proposed_name=rec["name"],
        proposed_latitude=rec["latitude"],
        proposed_longitude=rec["longitude"],
        proposed_state=rec["state"] or "Unknown",
        proposed_points=rec["points"],
        proposed_image_url=rec["image_url"],
        proposed_date_pose=rec["date_pose"],
        request_count=0,
        confidence=100,
        source=SOURCE,
        validated_by=VALIDATED_BY,
    ), batch)


def _fill(db: Session, invader_id: int, values: dict) -> None:
    """Only the empty fields; silent (a found location isn't push-worthy)."""
    _approve(db, AdminRequest(
        invader_id=invader_id,
        request_type="modify",
        status="pending",
        proposed_latitude=values.get("latitude"),
        proposed_longitude=values.get("longitude"),
        proposed_points=values.get("points"),
        proposed_image_url=values.get("image_url"),
        proposed_date_pose=values.get("date_pose"),
        request_count=0,
        confidence=100,
        source=SOURCE,
        validated_by=VALIDATED_BY,
    ), None)


def _missing_fields(current: dict, rec: dict) -> dict:
    fill = {}
    if current["latitude"] is None and current["longitude"] is None and rec["latitude"] is not None:
        fill["latitude"], fill["longitude"] = rec["latitude"], rec["longitude"]
    for f in ("points", "date_pose", "image_url"):
        if current[f] is None and rec[f] is not None:
            fill[f] = rec[f]
    return fill


# ── main entry ────────────────────────────────────────────────────────────────

def _fetch(report: SyncReport, previous: dict, force: bool, city: Optional[str], delay: float):
    """Network phase -> (records by key, news events, versions to store) or None if unchanged."""
    session = invaderquest_client.new_session()
    index = invaderquest_client.fetch_index(session)
    version = {"version": index.get("version"), "updatedAt": index.get("updatedAt")}
    unchanged = all(previous.get(k) == v for k, v in version.items())
    if unchanged and not force and city is None:
        report.skipped_unchanged = True
        return None

    seen_cities: Dict[str, object] = dict(previous.get("cities") or {})
    records: Dict[Key, dict] = {}
    for entry in index.get("cities") or []:
        code = entry.get("code")
        if not code or (city and code != city):
            continue
        if not force and city is None and seen_cities.get(code) == entry.get("version"):
            continue
        try:
            raw = invaderquest_client.fetch_city(session, code)
        except (requests.RequestException, ValueError) as e:
            report.errors.append(f"{code}: {e}")   # version not stored -> retried next run
            continue
        finally:
            if delay:
                time.sleep(delay)
        for rec in map(invaderquest_client.clean_record, raw):
            if rec is not None:
                records[(rec["city"], rec["number"])] = rec
        seen_cities[code] = entry.get("version")
        report.cities_fetched.append(code)

    events: List[dict] = []
    try:
        events = [e for e in map(invaderquest_client.clean_event, invaderquest_client.fetch_news(session)) if e]
    except (requests.RequestException, ValueError) as e:
        report.errors.append(f"news.json: {e}")
    if city:
        events = [e for e in events if e["city"] == city]

    # The global version lets the next run stop early: store it only after a complete
    # run (all cities, none failed), else a failed city would wait for the next data change.
    versions = {**previous, "cities": seen_cities}
    city_failed = any(not err.startswith("news.json") for err in report.errors)
    if city is None and not city_failed:
        versions.update(version)
    return records, events, versions


def sync(
    db: Session,
    dry_run: bool = False,
    force: bool = False,
    city: Optional[str] = None,
    delay: float = DEFAULT_DELAY_S,
    today: Optional[date] = None,
) -> SyncReport:
    """`force` re-reads every city even if versions are unchanged (first run, repair)."""
    report = SyncReport(dry_run=dry_run)

    # A dry run promises no writes, and may run before the sync_state migration.
    previous = {} if dry_run else _load_versions(db)
    db.rollback()  # release the connection during the network phase (Neon idle timeout)

    fetched = _fetch(report, previous, force=force, city=city, delay=delay)
    if fetched is None:
        return report
    records, events, versions = fetched

    # Cities without a file yet (e.g. LAP): "added" news are the only trace -> create without location.
    cutoff = (today or date.today()) - timedelta(days=NEWS_DAYS)
    recently_added = {(e["city"], e["number"]) for e in events if e["type"] == "added" and e["date"] >= cutoff}
    for e in events:
        key = (e["city"], e["number"])
        if e["type"] == "added" and key not in records:
            records[key] = {
                "name": e["name"], "city": e["city"], "number": e["number"],
                "latitude": None, "longitude": None, "state": "Good", "points": None,
                "date_pose": None, "image_url": e["image_url"], "location_source": None,
            }

    # DB phase
    snapshot = _db_snapshot(db)
    to_create: List[dict] = []
    to_fill: List[Tuple[int, str, dict]] = []
    for key, rec in sorted(records.items()):
        current = snapshot.get(key)
        if current is None:
            to_create.append(rec)
            continue
        report.checked += 1
        fill = _missing_fields(current, rec)
        if fill:
            to_fill.append((current["id"], current["name"], fill))
        if (current["latitude"] is not None and current["longitude"] is not None
                and rec["latitude"] is not None):
            dist = haversine_m(current["latitude"], current["longitude"], rec["latitude"], rec["longitude"])
            if dist > FAR_LOCATION_M:
                report.far_locations.append(f"{current['name']}: {dist:.0f} m ({rec['location_source']})")

    for rec in to_create:
        report.created.append(rec["name"])
        if rec["latitude"] is None:
            report.created_without_location.append(rec["name"])
    for _, name, fill in to_fill:
        report.filled.append(f"{name}: {', '.join(fill)}")

    if dry_run:
        return report

    # Only freshly added invaders are push-worthy; the batch sends them one by one,
    # or as one "x new" push past MAX_INDIVIDUAL_PUSHES.
    batch = notification_service.InvaderNotificationBatch()
    for rec in to_create:
        fresh = (rec["city"], rec["number"]) in recently_added
        try:
            _create(db, rec, batch=batch if fresh else None)
        except invader_service.InvaderAlreadyExists as e:   # safety net: matched above already
            db.rollback()
            report.created.remove(rec["name"])
            report.errors.append(f"{rec['name']}: not created, {e}")
    for invader_id, _, fill in to_fill:
        _fill(db, invader_id, fill)
    report.pushes_sent = batch.flush(db)
    _save_versions(db, versions)
    return report
