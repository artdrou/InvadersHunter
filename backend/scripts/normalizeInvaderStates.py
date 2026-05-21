"""
Normalize state values to the canonical capitalized set across all tables that
store one. Idempotent. Safe to run multiple times. Designed to be run MANUALLY
before deploying the auto-migration in app/migrate.py — gives you a chance to
preview every change.

Tables / columns handled:
  - invaders.state
  - admin_requests.proposed_state
  - user_requests.proposed_state

Canonical set (must match VALID_STATES in migrations/import_invaders.py):
  Good, Slightly degraded, Degraded, Badly degraded, Destroyed, Not visible, Unknown

Each non-canonical value is run through normalize_state() (handles legacy
lowercase, French CSV, etc.). Values with no mapping are set to NULL.

Run from /backend:
  venv/Scripts/python.exe scripts/normalizeInvaderStates.py --dryRun
  venv/Scripts/python.exe scripts/normalizeInvaderStates.py
  venv/Scripts/python.exe scripts/normalizeInvaderStates.py --tables invaders
"""
import argparse
import importlib.util
import logging
import os
import sys
from datetime import datetime

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from sqlalchemy import text
from app.database import SessionLocal

_importInvadersPath = os.path.join(os.path.dirname(os.path.dirname(__file__)), "migrations", "import_invaders.py")
_spec = importlib.util.spec_from_file_location("import_invaders", _importInvadersPath)
_importInvaders = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_importInvaders)
normalize_state = _importInvaders.normalize_state
VALID_STATES = _importInvaders.VALID_STATES


# table -> (state column, also bump updated_at?)
TABLE_SPECS = {
    "invaders":        {"col": "state",          "bumpUpdatedAt": True,  "labelCol": "name"},
    "admin_requests":  {"col": "proposed_state", "bumpUpdatedAt": True,  "labelCol": "id"},
    "user_requests":   {"col": "proposed_state", "bumpUpdatedAt": True,  "labelCol": "id"},
}


def _normalizeTable(db, table: str, dryRun: bool) -> dict:
    spec = TABLE_SPECS[table]
    col = spec["col"]
    labelCol = spec["labelCol"]
    bumpUpdatedAt = spec["bumpUpdatedAt"]

    stats = {"scanned": 0, "already_canonical": 0, "remapped": 0, "cleared": 0, "null_bumped": 0}
    perValueCounts: dict = {}

    rows = db.execute(
        text(f"SELECT id, {labelCol}, {col} FROM {table} WHERE {col} IS NOT NULL")
    ).fetchall()
    stats["scanned"] = len(rows)
    logging.info(f"[{table}] scanning {len(rows)} rows with non-null {col}")

    # Also bump updated_at on rows where the state is NULL, so delta sync picks
    # those rows up on clients after the rename (keeps everyone in lockstep).
    if bumpUpdatedAt:
        nullRows = db.execute(
            text(f"SELECT id FROM {table} WHERE {col} IS NULL")
        ).fetchall()
        stats["null_bumped"] = len(nullRows)
        logging.info(f"[{table}] also bumping updated_at on {len(nullRows)} rows with NULL {col}")
        if not dryRun and nullRows:
            db.execute(
                text(f"UPDATE {table} SET updated_at = :now WHERE {col} IS NULL"),
                {"now": datetime.utcnow()},
            )

    for rowId, label, value in rows:
        if value in VALID_STATES:
            stats["already_canonical"] += 1
            continue

        canonical = normalize_state(value)
        perValueCounts.setdefault(value, {"to": canonical, "count": 0})
        perValueCounts[value]["count"] += 1

        if canonical is None:
            stats["cleared"] += 1
            logging.info(f"  [{table}] {label}: {col}={value!r} -> NULL (no canonical mapping)")
            if not dryRun:
                sql = f"UPDATE {table} SET {col} = NULL"
                params = {"id": rowId}
                if bumpUpdatedAt:
                    sql += ", updated_at = :now"
                    params["now"] = datetime.utcnow()
                sql += " WHERE id = :id"
                db.execute(text(sql), params)
        else:
            stats["remapped"] += 1
            logging.info(f"  [{table}] {label}: {col}={value!r} -> {canonical!r}")
            if not dryRun:
                sql = f"UPDATE {table} SET {col} = :s"
                params = {"id": rowId, "s": canonical}
                if bumpUpdatedAt:
                    sql += ", updated_at = :now"
                    params["now"] = datetime.utcnow()
                sql += " WHERE id = :id"
                db.execute(text(sql), params)

    logging.info(f"[{table}] per non-canonical value:")
    for original, info in sorted(perValueCounts.items(), key=lambda kv: -kv[1]["count"]):
        logging.info(f"  {original!r:30s} -> {info['to']!r:25s} ({info['count']} rows)")
    logging.info(
        f"[{table}] scanned={stats['scanned']} already_canonical={stats['already_canonical']} "
        f"remapped={stats['remapped']} cleared={stats['cleared']} null_bumped={stats['null_bumped']}"
    )
    return stats


def run(tables: list[str], dryRun: bool) -> None:
    db = SessionLocal()
    try:
        totals = {"scanned": 0, "already_canonical": 0, "remapped": 0, "cleared": 0, "null_bumped": 0}
        for table in tables:
            s = _normalizeTable(db, table, dryRun)
            for k in totals:
                totals[k] += s[k]

        if dryRun:
            db.rollback()
            logging.warning("Dry run -- no changes committed")
        else:
            db.commit()
            logging.info("Committed")

        logging.info("=== TOTALS ===")
        for k, v in totals.items():
            logging.info(f"  {k}: {v}")
    except Exception as e:
        db.rollback()
        logging.error(f"Error: {e}")
        raise
    finally:
        db.close()


def getArgs():
    p = argparse.ArgumentParser(description="Normalize state values to canonical capitalized set across tables")
    p.add_argument("--dryRun", action="store_true", help="Show what would change but do not commit")
    p.add_argument(
        "--tables",
        nargs="+",
        choices=list(TABLE_SPECS.keys()) + ["all"],
        default=["all"],
        help="Which tables to normalize (default: all)",
    )
    return p.parse_args()


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
    args = getArgs()
    tables = list(TABLE_SPECS.keys()) if "all" in args.tables else args.tables
    run(tables, args.dryRun)
