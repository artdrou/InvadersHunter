"""
Find invaders in the DB with missing info, and scrape invader-spotter.art ONE
INVADER AT A TIME via its single-invader deep-link endpoint. Fills only the
fields that are currently NULL.

How the single-invader lookup works (reverse-engineered from invader-spotter.art):
  - Visit cherche.php once to get a PHPSESSID cookie.
  - POST to listing.php with body {numero: N, <CITY_CODE>: 'on', ...} and
    Referer set to an invader-spotter.art page.
  - For Paris (city='PA'), the city is split across PA01..PA20 (arrondissements);
    we pass all 20 at once so the server returns the single matching row
    regardless of arrondissement.
  - For other cities, the code is just the city prefix (BBO, AIX, LDN, ...).

- Never deletes invaders, never creates new ones, never overwrites existing values
- Bumps updated_at on every modified row so delta sync propagates the change

Run from /backend:
  venv/Scripts/python.exe scripts/scrapeMissingFromDb.py --dryRun
  venv/Scripts/python.exe scripts/scrapeMissingFromDb.py
  venv/Scripts/python.exe scripts/scrapeMissingFromDb.py --city PA --limit 50
"""
import argparse
import importlib.util
import logging
import os
import sys
import time
from datetime import datetime

import requests
from bs4 import BeautifulSoup

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
sys.path.insert(0, os.path.dirname(__file__))

from sqlalchemy import text
from app.database import SessionLocal
from getInvadersCSV import _parseRow, BASE_URL, LISTING_URL

_importInvadersPath = os.path.join(os.path.dirname(os.path.dirname(__file__)), "migrations", "import_invaders.py")
_spec = importlib.util.spec_from_file_location("import_invaders", _importInvadersPath)
_importInvaders = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_importInvaders)
normalize_state = _importInvaders.normalize_state
parse_date = _importInvaders.parse_date


DB_TO_SCRAPED = {
    "image_url": "picture_url",
    "state":     "state",
    "points":    "points",
    "date_pose": "date_pose",
}


def _coerce(dbField: str, raw):
    if raw is None or raw == "":
        return None
    if dbField == "points":
        try:
            return int(raw)
        except (TypeError, ValueError):
            return None
    if dbField == "date_pose":
        return parse_date(str(raw))
    if dbField == "state":
        return normalize_state(str(raw))
    return raw


def _newSession() -> requests.Session:
    s = requests.Session()
    s.get("https://www.invader-spotter.art/cherche.php", timeout=30)  # PHPSESSID
    s.headers.update({"Referer": "https://www.invader-spotter.art/cherche.php"})
    return s


def _buildPayload(city: str, number: int) -> dict:
    """Body that asks invader-spotter.art for a single invader."""
    payload: dict = {"numero": str(number)}
    if city == "PA":
        for i in range(1, 21):
            payload[f"PA{i:02d}"] = "on"
    else:
        payload[city] = "on"
    return payload


def scrapeSingleInvader(session: requests.Session, city: str, number: int) -> dict | None:
    """Return the parsed info dict for one invader, or None if not found."""
    r = session.post(LISTING_URL, data=_buildPayload(city, number), timeout=30)
    soup = BeautifulSoup(r.text, "html.parser")
    rows = soup.find_all("tr", {"class": "haut"})
    if not rows:
        return None
    # Find the one whose name matches (CITY_NUMBER, any zero-padding)
    target = f"{city}_{number}".upper()
    targetPadded = lambda n: f"{city}_{str(number).zfill(n)}".upper()
    candidates = {target, targetPadded(2), targetPadded(3), targetPadded(4)}
    for row in rows:
        info = _parseRow(row)
        if info and info.get("name") and info["name"].upper() in candidates:
            return info
    # Fallback: if there's exactly one row, take it
    if len(rows) == 1:
        return _parseRow(rows[0])
    return None


def run(cityFilter: str | None, limit: int | None, delay: float, dryRun: bool) -> None:
    db = SessionLocal()
    try:
        whereCity = " AND city LIKE :cityPattern" if cityFilter else ""
        params = {"cityPattern": f"{cityFilter}%"} if cityFilter else {}
        rows = db.execute(
            text(
                "SELECT id, name, city, number, image_url, state, points, date_pose "
                "FROM invaders "
                "WHERE city IS NOT NULL AND number IS NOT NULL "
                "  AND (image_url IS NULL OR state IS NULL OR points IS NULL OR date_pose IS NULL)"
                f"{whereCity} "
                "ORDER BY city, number"
            ),
            params,
        ).fetchall()
        logging.info(
            f"Found {len(rows)} invaders with missing info"
            + (f" (city filter: {cityFilter})" if cityFilter else "")
        )
        if limit is not None:
            rows = rows[:limit]
            logging.info(f"Limited to first {len(rows)} for this run")
        if not rows:
            logging.info("Nothing to do.")
            return

        session = _newSession()
        totals = {"updated": 0, "no_change": 0, "scrape_miss": 0, "request_error": 0}
        perField = {f: 0 for f in DB_TO_SCRAPED.keys()}

        for idx, (invId, name, city, number, image_url, state, points, date_pose) in enumerate(rows, 1):
            current = {"image_url": image_url, "state": state, "points": points, "date_pose": date_pose}
            try:
                info = scrapeSingleInvader(session, city, int(number))
            except requests.RequestException as e:
                totals["request_error"] += 1
                logging.warning(f"  [{idx}/{len(rows)}] {name}: request failed ({e})")
                continue

            if info is None:
                totals["scrape_miss"] += 1
                logging.warning(f"  [{idx}/{len(rows)}] {name}: not found on invader-spotter.art")
                if delay:
                    time.sleep(delay)
                continue

            updates = {}
            for dbField, scrapedKey in DB_TO_SCRAPED.items():
                if current.get(dbField) not in (None, ""):
                    continue
                newValue = _coerce(dbField, info.get(scrapedKey))
                if newValue is None:
                    continue
                updates[dbField] = newValue

            if not updates:
                totals["no_change"] += 1
                logging.info(f"  [{idx}/{len(rows)}] {name}: site has no new info")
            else:
                totals["updated"] += 1
                for k in updates:
                    perField[k] += 1
                logging.info(
                    f"  [{idx}/{len(rows)}] {name}: fill "
                    + ", ".join(f"{k}={v!r}" for k, v in updates.items())
                )
                if not dryRun:
                    setClauses = ", ".join(f"{k} = :{k}" for k in updates)
                    db.execute(
                        text(f"UPDATE invaders SET {setClauses}, updated_at = :now WHERE id = :id"),
                        {**updates, "id": invId, "now": datetime.utcnow()},
                    )

            if delay:
                time.sleep(delay)

        if dryRun:
            db.rollback()
            logging.warning("Dry run -- no changes committed")
        else:
            db.commit()
            logging.info("Committed")

        logging.info("=== SUMMARY ===")
        logging.info(f"Updated:        {totals['updated']}")
        logging.info(f"No new info:    {totals['no_change']}")
        logging.info(f"Scrape miss:    {totals['scrape_miss']}")
        logging.info(f"Request errors: {totals['request_error']}")
        logging.info(f"Per-field fills: {perField}")
    except Exception as e:
        db.rollback()
        logging.error(f"Error: {e}")
        raise
    finally:
        db.close()


def getArgs():
    p = argparse.ArgumentParser(description="Scrape invader-spotter.art one invader at a time to backfill DB gaps")
    p.add_argument("-c", "--city", default=None, help="Limit to a city prefix (e.g. PA)")
    p.add_argument("--limit", type=int, default=None, help="Process only the first N incomplete invaders (useful for testing)")
    p.add_argument("--delay", type=float, default=0.2, help="Seconds to sleep between requests (be polite)")
    p.add_argument("--dryRun", action="store_true", help="Show what would change but do not commit")
    return p.parse_args()


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
    args = getArgs()
    run(args.city, args.limit, args.delay, args.dryRun)
