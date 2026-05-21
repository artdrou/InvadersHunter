"""
Backfill missing fields on existing invaders from a scraped CSV.

- Reads a CSV produced by getInvadersCSV.py
- For each row, finds the matching invader by name
- Updates only fields that are currently NULL/empty on the invader row
- NEVER deletes invaders, NEVER creates new ones, NEVER overwrites existing values

Run from /backend:
  venv/Scripts/python.exe scripts/backfillInvadersFromCsv.py -csv migrations/invaders_new.csv
  venv/Scripts/python.exe scripts/backfillInvadersFromCsv.py -csv migrations/invaders_new.csv --dryRun
"""
import argparse
import csv
import logging
import os
import sys
from datetime import datetime, date
from pathlib import Path

import importlib.util

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from sqlalchemy import text
from app.database import SessionLocal

# Load canonical normalize_state / parse_date from the migrations script
_importInvadersPath = os.path.join(os.path.dirname(os.path.dirname(__file__)), "migrations", "import_invaders.py")
_spec = importlib.util.spec_from_file_location("import_invaders", _importInvadersPath)
_importInvaders = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_importInvaders)
normalize_state = _importInvaders.normalize_state
parse_date = _importInvaders.parse_date


CSV_TO_DB = {
    "picture_url": "image_url",
    "state": "state",
    "points": "points",
    "date_pose": "date_pose",
}


def _coerce(dbField: str, raw):
    if raw is None or raw == "":
        return None
    if dbField == "points":
        try:
            return int(raw)
        except ValueError:
            return None
    if dbField == "date_pose":
        parsed = parse_date(str(raw))
        if parsed is None:
            logging.warning(f"  could not parse date_pose={raw!r}")
        return parsed
    if dbField == "state":
        canonical = normalize_state(str(raw))
        if canonical is None:
            logging.debug(f"  state {raw!r} → no canonical mapping, skipping")
        return canonical
    return raw


def backfill(csvPath: Path, dryRun: bool) -> None:
    db = SessionLocal()
    counts = {"matched": 0, "missing_in_db": 0, "updated": 0, "no_change": 0}
    fieldFills = {db_field: 0 for db_field in CSV_TO_DB.values()}

    try:
        with open(csvPath, "r", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for row in reader:
                name = row.get("name")
                city = row.get("city")
                rawNumber = row.get("number")
                try:
                    numberInt = int(rawNumber)
                except (TypeError, ValueError):
                    logging.warning(f"  {name}: cannot parse number={rawNumber!r}, skipping")
                    continue
                if not city:
                    continue

                inv = db.execute(
                    text(
                        "SELECT id, image_url, points, state, date_pose FROM invaders "
                        "WHERE city = :city AND number = :number"
                    ),
                    {"city": city, "number": numberInt},
                ).fetchone()
                if inv is None:
                    counts["missing_in_db"] += 1
                    logging.debug(f"  {name} ({city}/{numberInt}): not in DB, skipping")
                    continue
                counts["matched"] += 1
                current = {"image_url": inv[1], "points": inv[2], "state": inv[3], "date_pose": inv[4]}

                updates = {}
                for csvField, dbField in CSV_TO_DB.items():
                    if current.get(dbField) not in (None, ""):
                        continue
                    newValue = _coerce(dbField, row.get(csvField))
                    if newValue is None:
                        continue
                    updates[dbField] = newValue

                if not updates:
                    counts["no_change"] += 1
                    continue

                counts["updated"] += 1
                for k in updates:
                    fieldFills[k] += 1
                logging.info(f"  {name}: fill {', '.join(f'{k}={v!r}' for k, v in updates.items())}")

                if not dryRun:
                    setClauses = ", ".join(f"{k} = :{k}" for k in updates)
                    params = {**updates, "id": inv[0], "now": datetime.utcnow()}
                    db.execute(
                        text(f"UPDATE invaders SET {setClauses}, updated_at = :now WHERE id = :id"),
                        params,
                    )

        if dryRun:
            db.rollback()
            logging.warning("Dry run — no changes committed")
        else:
            db.commit()
            logging.info("Committed")
    except Exception as e:
        db.rollback()
        logging.error(f"Error: {e}")
        raise
    finally:
        db.close()

    logging.info(f"Matched in DB:    {counts['matched']}")
    logging.info(f"Missing from DB:  {counts['missing_in_db']}")
    logging.info(f"Rows updated:     {counts['updated']}")
    logging.info(f"Rows untouched:   {counts['no_change']}")
    logging.info(f"Per-field fills:  {fieldFills}")


def getArgs():
    parser = argparse.ArgumentParser(description="Backfill missing invader fields from a scraped CSV")
    parser.add_argument("-csv", "--csvPath", required=True, help="Scraped CSV (produced by getInvadersCSV.py)")
    parser.add_argument("--dryRun", action="store_true", help="Show what would change but do not commit")
    return parser.parse_args()


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
    args = getArgs()
    backfill(Path(args.csvPath), args.dryRun)
