"""
One-off migration: add updated_at columns to invaders and user_requests tables.

Safe to run multiple times — uses IF NOT EXISTS.
After running, existing rows will have updated_at = NULL until they are next modified,
except user_requests which are backfilled to created_at.

Usage (from backend/ directory):
    python -m app.migrate
"""

from sqlalchemy import text
from .database import engine

MIGRATIONS = [
    # Invaders: track when an invader record was last changed
    "ALTER TABLE invaders ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITHOUT TIME ZONE",
    # User requests: track when a request status was last changed (pending → processed/rejected)
    "ALTER TABLE user_requests ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITHOUT TIME ZONE",
    # Backfill: set updated_at = created_at for existing user_requests so delta sync works
    # from day one (requests already have created_at, it's a good baseline)
    "UPDATE user_requests SET updated_at = created_at WHERE updated_at IS NULL",
    # User progress: track when a capture was created/modified for delta sync
    "ALTER TABLE user_progress ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()",
    # Backfill existing captures using found_at as baseline
    "UPDATE user_progress SET updated_at = found_at WHERE updated_at IS NULL",
]


def run():
    with engine.connect() as conn:
        for sql in MIGRATIONS:
            conn.execute(text(sql))
        conn.commit()
    print("Migration complete.")


if __name__ == "__main__":
    run()
