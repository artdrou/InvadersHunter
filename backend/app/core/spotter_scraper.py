"""
HTTP client + HTML parsing for invader-spotter.art.

Three entry points, all returning plain dicts (no DB access here):
  - fetch_news()            -> news.php feed: which invaders changed, and when
  - fetch_single_invader()  -> one invader's current info (deep-link search)
  - fetch_city()            -> every invader of a city (paginated listing)

Row parsing (`parse_row`) is shared with the offline scripts in backend/scripts/.
"""
import logging
import re
import time
from datetime import date
from typing import Dict, List, Optional, Tuple

import requests
from bs4 import BeautifulSoup

log = logging.getLogger("spotter")

BASE_URL = "https://www.invader-spotter.art"
LISTING_URL = f"{BASE_URL}/listing.php"
NEWS_URL = f"{BASE_URL}/news.php"
SEARCH_URL = f"{BASE_URL}/cherche.php"
REQUEST_TIMEOUT = (10, 30)  # (connect, read) seconds
USER_AGENT = "InvadersHunter-sync/1.0 (+https://invader-hunter-development.up.railway.app)"

INVADER_NAME_RE = re.compile(r"\b([A-Z]{1,5})_(\d{1,4})\b")
_NEWS_MONTH_ID_RE = re.compile(r"^mois(\d{4})(\d{2})$")
_NEWS_DAY_RE = re.compile(r"(\d{1,2})")


def split_name(name: str) -> Optional[Tuple[str, int]]:
    """'PA_0516' -> ('PA', 516); None if it isn't an invader name."""
    m = INVADER_NAME_RE.fullmatch(name.strip().upper())
    return (m.group(1), int(m.group(2))) if m else None


# ── news.php ──────────────────────────────────────────────────────────────────

def parse_news_html(html: str) -> List[Tuple[date, List[Tuple[str, int]]]]:
    """[(day, [(city, number), ...]), ...] newest first.

    Page layout: one <div id='moisYYYYMM'> per month, each holding
    <p class='news'><b>DD :</b> Destruction de <a>PA_516</a> ...</p> entries.
    """
    soup = BeautifulSoup(html, "html.parser")
    entries: List[Tuple[date, List[Tuple[str, int]]]] = []
    for month_div in soup.find_all("div", id=_NEWS_MONTH_ID_RE):
        year, month = map(int, _NEWS_MONTH_ID_RE.match(month_div["id"]).groups())
        for p in month_div.find_all("p", class_="news"):
            bold = p.find("b")
            day_match = _NEWS_DAY_RE.search(bold.get_text()) if bold else None
            if not day_match:
                continue
            try:
                day = date(year, month, int(day_match.group(1)))
            except ValueError:
                continue
            seen = []
            for city, number in INVADER_NAME_RE.findall(p.get_text(" ")):
                key = (city, int(number))
                if key not in seen:
                    seen.append(key)
            if seen:
                entries.append((day, seen))
    entries.sort(key=lambda e: e[0], reverse=True)
    return entries


def new_session() -> requests.Session:
    s = requests.Session()
    s.headers.update({"User-Agent": USER_AGENT})
    return s


def fetch_news(session: requests.Session) -> List[Tuple[date, List[Tuple[str, int]]]]:
    r = session.get(NEWS_URL, timeout=REQUEST_TIMEOUT)
    r.raise_for_status()
    return parse_news_html(r.text)


# ── invader rows (listing.php) ────────────────────────────────────────────────

def _split_by_br(font):
    segments, current = [], []
    for child in font.children:
        if getattr(child, "name", None) == "br":
            segments.append(current)
            current = []
        else:
            current.append(child)
    segments.append(current)
    return segments


def _segment_text(segment):
    parts = [c.get_text() if hasattr(c, "get_text") else str(c) for c in segment]
    return "".join(parts).strip()


def parse_row(element) -> Optional[dict]:
    """One <tr class='haut'> of listing.php -> {name, points, date_pose, state, state_date, picture_url}.

    `state` is the raw French label (e.g. 'Détruit', 'OK') — see core.invader_states.normalize_state.
    """
    font = element.find("font", {"class": "normal"})
    if font is None:
        return None
    info = {"name": None, "points": None, "date_pose": None, "state": None, "state_date": None, "picture_url": None}

    for segment in _split_by_br(font):
        text = _segment_text(segment)
        if not text:
            continue

        for c in segment:
            if getattr(c, "name", None) == "b":
                b_text = c.get_text()
                name_match = re.search(r"\b([A-Z]{1,4}_\d{1,4})\b", b_text.upper())
                if name_match:
                    info["name"] = name_match.group(1)
                pts_match = re.search(r"\[(\d+)\s*pts\]", b_text)
                if pts_match:
                    info["points"] = int(pts_match.group(1))

        if "Date de pose" in text:
            m = re.search(r"Date de pose\s*:\s*([\d/]+)", text)
            if m:
                info["date_pose"] = m.group(1)
            continue

        if "Date et source" in text:
            m = re.search(r"Date et source\s*:\s*(.+)", text)
            if m:
                info["state_date"] = m.group(1).strip() or None
            continue

        if re.search(r"Dernier\s+.{1,5}tat\s+connu", text, re.IGNORECASE):
            raw_parts = []
            for c in segment:
                if getattr(c, "name", None) == "img":
                    continue
                raw_parts.append(c.get_text() if hasattr(c, "get_text") else str(c))
            joined = "".join(raw_parts)
            m = re.search(r":\s*(.+)$", joined, re.DOTALL)
            if m:
                state = m.group(1).strip().rstrip("!").strip()
                info["state"] = state or None
            continue

    img_tag = element.find("img", src=re.compile(r"grosplan", re.IGNORECASE))
    if img_tag is None:
        img_tag = element.find("img", src=re.compile(r"\.(png|jpg|jpeg|gif)", re.IGNORECASE))
    if img_tag is None:
        img_tag = element.find("img", class_=lambda c: c != "banniere")
    if img_tag and img_tag.get("src"):
        src = img_tag["src"]
        info["picture_url"] = src if src.startswith("http") else f"{BASE_URL}/{src.lstrip('/')}"

    return info


def new_search_session() -> requests.Session:
    """Session for single-invader lookups: needs a PHPSESSID from cherche.php first."""
    s = new_session()
    s.get(SEARCH_URL, timeout=REQUEST_TIMEOUT)
    s.headers.update({"Referer": SEARCH_URL})
    return s


def new_listing_session() -> requests.Session:
    s = new_session()
    s.headers.update({"Referer": f"{BASE_URL}/villes.php", "Origin": BASE_URL})
    return s


def _single_invader_payload(city: str, number: int) -> dict:
    """Paris is split into arrondissements PA01..PA20 on the site: tick them all."""
    payload: dict = {"numero": str(number)}
    if city == "PA":
        for i in range(1, 21):
            payload[f"PA{i:02d}"] = "on"
    else:
        payload[city] = "on"
    return payload


def fetch_single_invader(session: requests.Session, city: str, number: int) -> Optional[dict]:
    """Current info for one invader, or None if the site doesn't list it."""
    r = session.post(LISTING_URL, data=_single_invader_payload(city, number), timeout=REQUEST_TIMEOUT)
    r.raise_for_status()
    soup = BeautifulSoup(r.text, "html.parser")
    for row in soup.find_all("tr", {"class": "haut"}):
        info = parse_row(row)
        if info and info.get("name") and split_name(info["name"]) == (city, number):
            return info
    return None


def fetch_city(session: requests.Session, city: str, delay: float = 0.0) -> Dict[Tuple[str, int], dict]:
    """{(city, number): info} for every invader of `city` (100 per page)."""
    out: Dict[Tuple[str, int], dict] = {}
    page = 0
    while True:
        data = {"ville": city, "arron": "00", "mode": "lst", "rang": "100"}
        if page > 0:
            data["page"] = str(page + 1)
        r = session.post(url=LISTING_URL, data=data, timeout=REQUEST_TIMEOUT)
        r.raise_for_status()
        soup = BeautifulSoup(r.text, "html.parser")
        elements = soup.find_all("tr", {"class": "haut"})
        if not elements:
            break
        before = len(out)
        for element in elements:
            info = parse_row(element)
            key = split_name(info["name"]) if info and info.get("name") else None
            if key is None:
                continue
            info["_raw_text"] = element.get_text(" ", strip=True)
            info["_raw_html"] = str(element)
            out[key] = info
        if len(out) == before:
            break  # site served the same page again: stop instead of looping forever
        page += 1
        if delay:
            time.sleep(delay)
    return out
