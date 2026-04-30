"""
One-off migration: add updated_at columns to invaders and user_requests tables.

Safe to run multiple times — uses IF NOT EXISTS.
After running, existing rows will have updated_at = NULL until they are next modified,
except user_requests which are backfilled to created_at.

Usage (from backend/ directory):
    python -m app.migrate
"""

from sqlalchemy import text
from . import database  # import module, not attribute — tests patch database.engine

MIGRATIONS = [
    # Admin requests: store computed confidence score (0-100) for the admin UI
    "ALTER TABLE admin_requests ADD COLUMN IF NOT EXISTS confidence INTEGER NOT NULL DEFAULT 0",
    # Admin requests: track last modification time
    "ALTER TABLE admin_requests ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITHOUT TIME ZONE",
    "UPDATE admin_requests SET updated_at = created_at WHERE updated_at IS NULL",

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
    # Track hard-deleted invaders so clients can remove them on delta sync
    """CREATE TABLE IF NOT EXISTS deleted_invaders (
        id          SERIAL PRIMARY KEY,
        invader_id  INTEGER NOT NULL,
        deleted_at  TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW()
    )""",
    "CREATE INDEX IF NOT EXISTS idx_deleted_invaders_deleted_at ON deleted_invaders (deleted_at)",
]


def run():
    if database.engine.dialect.name != "postgresql":
        return  # tests use Base.metadata.create_all; skip postgres-specific SQL
    with database.engine.connect() as conn:
        for sql in MIGRATIONS:
            conn.execute(text(sql))
        conn.commit()
    print("Migration complete.")


if __name__ == "__main__":
    run()
