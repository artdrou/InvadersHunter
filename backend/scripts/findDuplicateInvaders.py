"""
Read-only: list invaders stored more than once (same city + number, whatever the
zero padding or case of their names, e.g. PA_10 / PA_0010). Writes nothing.

For each group: id, name, state, location and how many flashes point at each row,
to decide which one to keep before merging / deleting by hand.

Run from /backend (DATABASE_URL of the environment to check):
  venv/Scripts/python.exe scripts/findDuplicateInvaders.py
"""
import os
import sys
from collections import defaultdict

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from sqlalchemy import text
from app.core.name_utils import normalize_name
from app.core.spotter_scraper import split_name
from app.database import SessionLocal

db = SessionLocal()
try:
    rows = db.execute(text(
        "SELECT i.id, i.name, i.city, i.number, i.state, i.latitude, i.longitude, "
        "(SELECT COUNT(*) FROM user_progress p WHERE p.invader_id = i.id) AS flashes "
        "FROM invaders i ORDER BY i.id"
    )).fetchall()
finally:
    db.close()

groups = defaultdict(list)
for row in rows:
    key = (row.city, row.number) if row.city and row.number is not None else None
    key = key or (split_name(normalize_name(row.name)) if row.name else None) or (row.name or "").upper()
    groups[key].append(row)

duplicates = {key: group for key, group in groups.items() if len(group) > 1}
print(f"{len(rows)} invaders, {len(duplicates)} duplicated")
for key, group in sorted(duplicates.items(), key=lambda kv: str(kv[0])):
    print(f"\n{key}:")
    for r in group:
        location = f"{r.latitude:.5f},{r.longitude:.5f}" if r.latitude is not None and r.longitude is not None else "no location"
        print(f"  id={r.id:<6} {r.name:<12} {r.state or '-':<18} {location:<22} flashes={r.flashes}")
