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

    # Proposed installation year (stored as a DATE, YYYY-01-01) on both request tables
    "ALTER TABLE user_requests ADD COLUMN IF NOT EXISTS proposed_date_pose DATE",
    "ALTER TABLE admin_requests ADD COLUMN IF NOT EXISTS proposed_date_pose DATE",

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
    # Seed the ISS special invader — no lat/lon, position comes from the ISS live API
    """INSERT INTO invaders (name, description, points, state)
       SELECT 'SPACE2ISS', 'International Space Station', 10, 'Good'
       WHERE NOT EXISTS (SELECT 1 FROM invaders WHERE name = 'SPACE2ISS')""",

    # Rename canonical state values: lowercase → capitalized, pristine → Good
    # Idempotent: rows already in the new format are unchanged.
    """UPDATE invaders SET state = CASE state
        WHEN 'pristine'          THEN 'Good'
        WHEN 'slightly degraded' THEN 'Slightly degraded'
        WHEN 'degraded'          THEN 'Degraded'
        WHEN 'badly degraded'    THEN 'Badly degraded'
        WHEN 'destroyed'         THEN 'Destroyed'
        WHEN 'not visible'       THEN 'Not visible'
        ELSE state END,
        updated_at = NOW()
       WHERE state IN ('pristine','slightly degraded','degraded','badly degraded','destroyed','not visible')""",
    """UPDATE admin_requests SET proposed_state = CASE proposed_state
        WHEN 'pristine'          THEN 'Good'
        WHEN 'slightly degraded' THEN 'Slightly degraded'
        WHEN 'degraded'          THEN 'Degraded'
        WHEN 'badly degraded'    THEN 'Badly degraded'
        WHEN 'destroyed'         THEN 'Destroyed'
        WHEN 'not visible'       THEN 'Not visible'
        ELSE proposed_state END,
        updated_at = NOW()
       WHERE proposed_state IN ('pristine','slightly degraded','degraded','badly degraded','destroyed','not visible')""",
    """UPDATE user_requests SET proposed_state = CASE proposed_state
        WHEN 'pristine'          THEN 'Good'
        WHEN 'slightly degraded' THEN 'Slightly degraded'
        WHEN 'degraded'          THEN 'Degraded'
        WHEN 'badly degraded'    THEN 'Badly degraded'
        WHEN 'destroyed'         THEN 'Destroyed'
        WHEN 'not visible'       THEN 'Not visible'
        ELSE proposed_state END,
        updated_at = NOW()
       WHERE proposed_state IN ('pristine','slightly degraded','degraded','badly degraded','destroyed','not visible')""",

    # News feed — attribution of the *proposer* on admin requests (community | admin | scraper),
    # plus the validator (traceability only, never displayed). Existing rows default to community.
    "ALTER TABLE admin_requests ADD COLUMN IF NOT EXISTS source VARCHAR NOT NULL DEFAULT 'community'",
    "ALTER TABLE admin_requests ADD COLUMN IF NOT EXISTS validated_by VARCHAR",
    # Speeds up the reviewed_at-ordered News query
    "CREATE INDEX IF NOT EXISTS idx_admin_requests_reviewed_at ON admin_requests (reviewed_at)",
    # News feed — general announcements & releases (the ~10% non-invader part)
    """CREATE TABLE IF NOT EXISTS announcements (
        id         SERIAL PRIMARY KEY,
        kind       VARCHAR NOT NULL DEFAULT 'announcement',
        title      VARCHAR NOT NULL,
        body       VARCHAR,
        version    VARCHAR,
        created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW()
    )""",
    "CREATE INDEX IF NOT EXISTS idx_announcements_created_at ON announcements (created_at)",
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
