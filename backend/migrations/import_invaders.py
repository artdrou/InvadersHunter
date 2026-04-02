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
    --on-conflict skip      Leave the existing row untouched  (default)
    --on-conflict overwrite Update the existing row with CSV values

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
    "pristine",
    "slightly degraded",
    "degraded",
    "badly degraded",
    "destroyed",
    "not visible",
}

# Maps CSV French values to canonical English states.
# Prefix matches are used for entries like "Détruit !Instagram: ..." and "OKInstagram: ..."
STATE_MAP = [
    ("OK",              "pristine"),
    ("Un peu dégradé",  "slightly degraded"),
    ("Dégradé",         "degraded"),
    ("Très dégradé",    "badly degraded"),
    ("Détruit !",       "destroyed"),
    ("Non visible",     "not visible"),
    ("Inconnu",         None),   # no equivalent — will be stored as None
]


def normalize_state(raw: str) -> str | None:
    """Convert a CSV state value to a canonical frontend state, or None if unknown."""
    raw = raw.strip()
    for prefix, canonical in STATE_MAP:
        if raw.startswith(prefix):
            return canonical
    # Already a valid canonical value (e.g. re-running after partial migration)
    if raw.lower() in VALID_STATES:
        return raw.lower()
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
        choices=["skip", "overwrite"],
        default="skip",
        dest="on_conflict",
        help="What to do when an invader with the same name already exists (default: skip)",
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
        counts = {
            "user_progress":  db.query(UserProgress).count(),
            "admin_requests": db.query(AdminRequest).count(),
            "user_requests":  db.query(UserRequest).count(),
            "invaders":       db.query(Invader).count(),
        }
        if not args.dry_run:
            db.query(UserProgress).delete()
            db.query(UserRequest).delete()
            db.query(AdminRequest).delete()
            db.query(Invader).delete()
            for table, n in counts.items():
                print(f"  DELETED {n} {table} row(s)")
        else:
            for table, n in counts.items():
                print(f"  DRY RUN: would delete {n} {table} row(s)")
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
