"""
HTTP + parsing for InvaderQuest's open data (GitHub repo marcoclsn-bit/invader-map).

Three static JSON files, rebuilt daily (commit usually lands 12:00-13:00 UTC):
  index.json             {version, updatedAt, cities: [{code, version, ...}]}
  invaders_{CODE}.json   {..., invaders: [{id, city, lat, lng, status, points, datePosed, photoUrl, source, ...}]}
  news.json              {events: [{type, id, city, date, photoUrl?}]}  type: added|destroyed|damaged|reactivated|updated

Data under ODbL v1.0 — credited in the app's About page and News feed.
Photos are invader-spotter.art URLs: link to them, never rehost.
"""
import re
from datetime import date
from typing import List, Optional

import requests

BASE_URL = "https://raw.githubusercontent.com/marcoclsn-bit/invader-map/main/data"
TIMEOUT_S = 30
USER_AGENT = "InvadersHunter-sync/1.0 (+https://github.com/artdrou)"

# Real invader ids only: the city files also hold doc/comment entries (e.g. "_DOC_SIGNALEMENTS")
INVADER_ID_RE = re.compile(r"^([A-Z]+)_(\d+)$")

# InvaderQuest status -> canonical state (core.invader_states.VALID_STATES).
# "damaged" is coarser than our 3 degraded levels; null means unknown.
STATUS_MAP = {
    "ok": "Good",
    "damaged": "Degraded",
    "destroyed": "Destroyed",
    "hidden": "Not visible",
}


def new_session() -> requests.Session:
    s = requests.Session()
    s.headers["User-Agent"] = USER_AGENT
    return s


def _get_json(session: requests.Session, filename: str) -> dict:
    r = session.get(f"{BASE_URL}/{filename}", timeout=TIMEOUT_S)
    r.raise_for_status()
    return r.json()


def fetch_index(session: requests.Session) -> dict:
    return _get_json(session, "index.json")


def fetch_city(session: requests.Session, code: str) -> List[dict]:
    """Raw records of one city file (unfiltered — see clean_record)."""
    return _get_json(session, f"invaders_{code}.json").get("invaders") or []


def fetch_news(session: requests.Session) -> List[dict]:
    return _get_json(session, "news.json").get("events") or []


def split_id(raw) -> Optional[tuple]:
    """'PA_01' -> ('PA', 1); None for anything that isn't an invader id."""
    m = INVADER_ID_RE.fullmatch(raw) if isinstance(raw, str) else None
    return (m.group(1), int(m.group(2))) if m else None


def map_status(raw) -> Optional[str]:
    return STATUS_MAP.get(raw) if isinstance(raw, str) else None


def _parse_date(raw) -> Optional[date]:
    try:
        return date.fromisoformat(raw) if isinstance(raw, str) and raw else None
    except ValueError:
        return None


def _coord(raw) -> Optional[float]:
    return float(raw) if isinstance(raw, (int, float)) and not isinstance(raw, bool) else None


def clean_record(rec: dict) -> Optional[dict]:
    """Keep real, enabled invaders only; normalise to our field names.

    Returns {name, city, number, latitude, longitude, state, points, date_pose,
    image_url, location_source} or None. A missing location is normal (new
    invaders get coordinates days to weeks later): both coords or neither.
    """
    if not isinstance(rec, dict) or not rec.get("city") or rec.get("disabled") is True:
        return None
    key = split_id(rec.get("id"))
    if key is None:
        return None
    lat, lng = _coord(rec.get("lat")), _coord(rec.get("lng"))
    if lat is None or lng is None or (lat == 0 and lng == 0):
        lat = lng = None
    points = rec.get("points")
    return {
        "name": rec["id"],
        "city": key[0],
        "number": key[1],
        "latitude": lat,
        "longitude": lng,
        "state": map_status(rec.get("status")),
        "points": points if isinstance(points, int) and not isinstance(points, bool) and points > 0 else None,
        "date_pose": _parse_date(rec.get("datePosed")),
        "image_url": rec.get("photoUrl") or None,
        "location_source": rec.get("source"),
    }


def clean_event(ev: dict) -> Optional[dict]:
    """news.json event -> {type, name, city, number, date, image_url} or None."""
    if not isinstance(ev, dict):
        return None
    key = split_id(ev.get("id"))
    day = _parse_date(ev.get("date"))
    if key is None or day is None or not ev.get("type"):
        return None
    return {
        "type": ev["type"],
        "name": ev["id"],
        "city": key[0],
        "number": key[1],
        "date": day,
        "image_url": ev.get("photoUrl") or None,
    }
