"""
Migration: add city, number, date_pose columns to the invaders table.

Run this ONCE before running import_invaders.py.
It is safe to run again — it skips columns that already exist.

Usage:
    python migrations/add_invader_columns.py
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.database import engine
from sqlalchemy import text, inspect

NEW_COLUMNS = [
    ("city",      "VARCHAR"),
    ("number",    "INTEGER"),
    ("date_pose", "DATE"),
]


def main():
    inspector = inspect(engine)
    existing = {col["name"] for col in inspector.get_columns("invaders")}

    with engine.connect() as conn:
        for col_name, col_type in NEW_COLUMNS:
            if col_name in existing:
                print(f"  SKIP  {col_name} (already exists)")
            else:
                conn.execute(text(f"ALTER TABLE invaders ADD COLUMN {col_name} {col_type}"))
                print(f"  ADDED {col_name} {col_type}")
        conn.commit()

    print("\nDone.")


if __name__ == "__main__":
    main()
