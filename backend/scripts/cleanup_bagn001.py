"""
One-shot script: delete BAGN_001 and all associated records, leaving a tombstone
in `deleted_invaders` so connected clients pick up the deletion on their next sync.

Also backfills tombstones for the previously-deleted ids that were removed before
this script knew to write them — so the existing local SQLite caches catch up.

Run from /backend:
  venv/Scripts/python.exe scripts/cleanup_bagn001.py
"""
import sys
import os
from datetime import datetime

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from sqlalchemy import text
from app.database import SessionLocal

TARGET_NAME = "BAGN_001"

# Ids that earlier runs of the script deleted from `invaders` without tombstoning.
# Inserting them into `deleted_invaders` lets the next sync remove them client-side.
LEGACY_IDS_TO_TOMBSTONE = [11846, 11847, 11848]

db = SessionLocal()
try:
    now = datetime.utcnow()

    # Backfill tombstones for ids deleted before tombstoning was wired up.
    for legacy_id in LEGACY_IDS_TO_TOMBSTONE:
        db.execute(
            text(
                "INSERT INTO deleted_invaders (invader_id, deleted_at) "
                "SELECT :id, :now "
                "WHERE NOT EXISTS (SELECT 1 FROM deleted_invaders WHERE invader_id = :id)"
            ),
            {"id": legacy_id, "now": now},
        )
        print(f"Tombstoned legacy id {legacy_id}")

    invaders = db.execute(
        text("SELECT id, name FROM invaders WHERE name = :name"),
        {"name": TARGET_NAME},
    ).fetchall()

    if not invaders:
        print(f"No invader named {TARGET_NAME} found.")
    else:
        for inv_id, inv_name in invaders:
            print(f"Found invader id={inv_id} name={inv_name}")

            admin_ids = [
                r[0] for r in db.execute(
                    text("SELECT id FROM admin_requests WHERE invader_id = :id"),
                    {"id": inv_id},
                ).fetchall()
            ]
            user_req_ids = [
                r[0] for r in db.execute(
                    text(
                        "SELECT id FROM user_requests "
                        "WHERE invader_id = :id OR admin_request_id = ANY(:aids)"
                    ),
                    {"id": inv_id, "aids": admin_ids or [-1]},
                ).fetchall()
            ]

            print(f"  admin_requests to delete: {admin_ids}")
            print(f"  user_requests to delete:  {user_req_ids}")

            res = db.execute(
                text("DELETE FROM user_progress WHERE invader_id = :id"),
                {"id": inv_id},
            )
            print(f"  deleted {res.rowcount} progress rows")

            if user_req_ids:
                res = db.execute(
                    text("DELETE FROM user_requests WHERE id = ANY(:ids)"),
                    {"ids": user_req_ids},
                )
                print(f"  deleted {res.rowcount} user_request rows")

            if admin_ids:
                res = db.execute(
                    text("DELETE FROM admin_requests WHERE id = ANY(:ids)"),
                    {"ids": admin_ids},
                )
                print(f"  deleted {res.rowcount} admin_request rows")

            # Tombstone BEFORE the invader row is gone — clients use this to drop their local copy
            db.execute(
                text(
                    "INSERT INTO deleted_invaders (invader_id, deleted_at) "
                    "SELECT :id, :now "
                    "WHERE NOT EXISTS (SELECT 1 FROM deleted_invaders WHERE invader_id = :id)"
                ),
                {"id": inv_id, "now": now},
            )

            db.execute(
                text("DELETE FROM invaders WHERE id = :id"),
                {"id": inv_id},
            )
            print(f"  deleted invader {inv_id} (tombstoned)")

    db.commit()
    print("Done.")
except Exception as e:
    db.rollback()
    print(f"Error: {e}")
    raise
finally:
    db.close()
