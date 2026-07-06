"""
Migration script: import invaders from CSV into the database.

Usage:
    python import_invaders.py [options] <csv_path>

Column flags (all included by default, use --skip-* to exclude):
    --skip-points       Do not import the points column
    --skip-state        Do not import the state column
    --skip-latitude     Do not import the latitude column
    --skip-longitude    Do not import the longitude column

Conflict behaviour (what to do when an invader with the same name already exists):
    --on-conflict fill      Only set fields that are currently null in the DB  (default)
    --on-conflict skip      Leave the existing row untouched
    --on-conflict overwrite Update all fields with CSV values

Reset (explicit opt-in only — nothing is ever deleted without this flag):
    --reset                 Delete ALL invaders and dependent rows before importing

Example:
    # Dry-run preview (no DB writes):
    python import_invaders.py --dry-run ../frontend/assets/migration/invaders.csv

    # Full import, overwrite existing rows, skip the state column:
    python import_invaders.py --on-conflict overwrite --skip-state ../frontend/assets/migration/invaders.csv
"""

import argparse
import csv
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

# Allow running the script directly from the migrations/ folder
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.database import SessionLocal
from app.models.space_invader import Invader
from app.models.user_progress import UserProgress
from app.models.admin_request import AdminRequest
from app.models.user_request import UserRequest


UPDATABLE_COLUMNS = ["points", "state", "latitude", "longitude", "city", "number", "date_pose"]

# Valid state values — must match the frontend STATE_OPTIONS list
VALID_STATES = {
    "Good",
    "Slightly degraded",
    "Degraded",
    "Badly degraded",
    "Destroyed",
    "Not visible",
    "Unknown",
}

# Maps CSV French values to canonical English states.
# Prefix matches are used for entries like "Détruit !Instagram: ..." and "OKInstagram: ..."
STATE_MAP = [
    ("OK",              "Good"),
    ("Un peu dégradé",  "Slightly degraded"),
    ("Dégradé",         "Degraded"),
    ("Très dégradé",    "Badly degraded"),
    ("Détruit !",       "Destroyed"),
    ("Détruit",         "Destroyed"),
    ("Non visible",     "Not visible"),
    ("Inconnu",         "Unknown"),
]

# Legacy lowercase values that were stored in the DB before the rename — map to new canonical
LEGACY_LOWERCASE_MAP = {
    "pristine": "Good",
    "slightly degraded": "Slightly degraded",
    "degraded": "Degraded",
    "badly degraded": "Badly degraded",
    "destroyed": "Destroyed",
    "not visible": "Not visible",
}


def normalize_state(raw: str) -> str | None:
    """Convert any state value (French CSV / legacy lowercase / already-canonical)
    to the canonical capitalized state, or None if unknown."""
    raw = raw.strip()
    if raw in VALID_STATES:
        return raw
    if raw.lower() in LEGACY_LOWERCASE_MAP:
        return LEGACY_LOWERCASE_MAP[raw.lower()]
    for prefix, canonical in STATE_MAP:
        if raw.startswith(prefix):
            return canonical
    return None


def normalize_name(name: str) -> str:
    """Strip leading zeros from the numeric part of an invader name.

    Examples:
        PA_0012  -> PA_12
        AIX_01   -> AIX_1
        RA_001   -> RA_1
    """
    import re
    return re.sub(r'_0*(\d+)$', lambda m: f"_{int(m.group(1))}", name)


def parse_args():
    parser = argparse.ArgumentParser(
        description="Import invaders from a CSV file into the database."
    )
    parser.add_argument("csv_path", help="Path to the invaders CSV file")
    parser.add_argument(
        "--on-conflict",
        choices=["skip", "overwrite", "fill"],
        default="fill",
        dest="on_conflict",
        help="What to do when an invader with the same name already exists: "
             "skip=leave untouched, overwrite=replace all fields, fill=only set fields that are currently null (default: fill)",
    )
    parser.add_argument(
        "--reset",
        action="store_true",
        help="Delete ALL existing invaders (and dependent rows) before importing. Must be explicit.",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Print what would be done without writing to the database",
    )
    for col in UPDATABLE_COLUMNS:
        parser.add_argument(
            f"--skip-{col}",
            action="store_true",
            default=False,
            help=f"Do not import/update the '{col}' column",
        )
    return parser.parse_args()


def parse_date(raw: str):
    """Parse DD/MM/YYYY date strings from the CSV."""
    from datetime import date
    raw = raw.strip()
    if not raw:
        return None
    try:
        day, month, year = raw.split("/")
        return date(int(year), int(month), int(day))
    except ValueError:
        return None


def build_invader_data(row: dict, active_columns: list[str]) -> dict:
    """Build a dict of DB field values from a CSV row, only for active columns."""
    data = {}
    if "points" in active_columns:
        raw = row.get("points", "").strip()
        data["points"] = int(raw) if raw else None
    if "state" in active_columns:
        data["state"] = normalize_state(row.get("state", ""))
    if "city" in active_columns:
        data["city"] = row.get("city", "").strip() or None
    if "number" in active_columns:
        raw = row.get("number", "").strip()
        data["number"] = int(raw) if raw else None
    if "date_pose" in active_columns:
        data["date_pose"] = parse_date(row.get("date_pose", ""))
    if "latitude" in active_columns:
        raw = row.get("latitude", "").strip()
        data["latitude"] = float(raw) if raw else None
    if "longitude" in active_columns:
        raw = row.get("longitude", "").strip()
        data["longitude"] = float(raw) if raw else None
    return data


def main():
    args = parse_args()

    active_columns = [c for c in UPDATABLE_COLUMNS if not getattr(args, f"skip_{c}")]

    csv_path = Path(args.csv_path)
    if not csv_path.exists():
        print(f"ERROR: CSV file not found: {csv_path}")
        sys.exit(1)

    print(f"CSV        : {csv_path}")
    print(f"Columns    : {active_columns}")
    print(f"On conflict: {args.on_conflict}")
    print(f"Dry run    : {args.dry_run}")
    print()

    with open(csv_path, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        rows = list(reader)

    print(f"Rows in CSV: {len(rows)}")

    db = SessionLocal()
    try:
        invader_count = db.query(Invader).count()
        print(f"Invaders in DB: {invader_count}")

        if args.reset:
            if not args.dry_run:
                db.query(UserProgress).delete()
                db.query(UserRequest).delete()
                db.query(AdminRequest).delete()
                db.query(Invader).delete()
                print(f"  DELETED all existing rows (--reset)")
            else:
                print(f"  DRY RUN: would delete all existing rows")
        print()

        inserted = 0
        updated = 0
        skipped = 0

        for row in rows:
            name = normalize_name(row.get("name", "").strip())
            if not name:
                print(f"  WARN: row with empty name, skipping: {row}")
                skipped += 1
                continue

            existing = db.query(Invader).filter(Invader.name == name).first()
            field_data = build_invader_data(row, active_columns)

            if existing is None:
                # Always set name; only set selected columns
                invader = Invader(name=name, **field_data)
                if not args.dry_run:
                    db.add(invader)
                print(f"  INSERT {name}")
                inserted += 1

            elif args.on_conflict == "overwrite":
                changed_fields = []
                for field, value in field_data.items():
                    if getattr(existing, field) != value:
                        changed_fields.append(f"{field}: {getattr(existing, field)!r} → {value!r}")
                        if not args.dry_run:
                            setattr(existing, field, value)
                if changed_fields:
                    print(f"  UPDATE {name}: {', '.join(changed_fields)}")
                    updated += 1
                else:
                    print(f"  UNCHANGED {name}")
                    skipped += 1

            elif args.on_conflict == "fill":
                filled_fields = []
                for field, value in field_data.items():
                    if getattr(existing, field) is None and value is not None:
                        filled_fields.append(f"{field}: null → {value!r}")
                        if not args.dry_run:
                            setattr(existing, field, value)
                if filled_fields:
                    print(f"  FILL {name}: {', '.join(filled_fields)}")
                    updated += 1
                else:
                    print(f"  UNCHANGED {name}")
                    skipped += 1

            else:  # skip
                print(f"  SKIP {name} (already exists)")
                skipped += 1

        if not args.dry_run:
            db.commit()
            print()
            print("Changes committed to database.")
        else:
            print()
            print("Dry run — no changes written.")

        print()
        print(f"Done. inserted={inserted}  updated={updated}  skipped={skipped}")

    except Exception as e:
        db.rollback()
        print(f"\nERROR: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
