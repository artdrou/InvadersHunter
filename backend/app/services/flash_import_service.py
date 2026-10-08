"""
Flash Import feature — service layer.

Self-contained logic for bulk-importing flashes from a list of invader names
(typically obtained by listing files inside the official FlashInvaders app
data folder via `adb`). Kept separate from progress_service to keep the
feature isolated and easy to remove/refactor.

Routers must delegate to import_flashes() and translate exceptions.
"""
import re
from pathlib import Path
from typing import Iterable, List
from sqlalchemy import or_
from sqlalchemy.orm import Session

from ..models.user_progress import UserProgress
from ..models.user import User
from ..models.space_invader import Invader
from ..core.db_utils import safe_commit
from ..core.name_utils import normalize_name
from ..core.environment import environment_for_host


class UserMissing(Exception): ...


# Matches the canonical "CITYCODE_NUMBER" pattern after normalize_name(); used to
# strip leading zeros from the number part. The DB mixes both spellings
# ("FTBL_4" but "ORLN_01"), so file names and DB names are compared on this key.
_CANONICAL_RE = re.compile(r"^([A-Z]{2,6})_0*(\d+)$")


def _match_key(normalized: str) -> str:
    m = _CANONICAL_RE.match(normalized)
    return f"{m.group(1)}_{m.group(2)}" if m else normalized


def _extract_names(raw_names: Iterable[str]) -> List[str]:
    """Strip file extensions, normalize, drop leading zeros from the number,
    dedupe — preserve insertion order."""
    seen: set[str] = set()
    out: List[str] = []
    for raw in raw_names:
        if not raw:
            continue
        stem = raw.rsplit(".", 1)[0] if "." in raw else raw
        normalized = _match_key(normalize_name(stem))
        if normalized and normalized not in seen:
            seen.add(normalized)
            out.append(normalized)
    return out


def import_flashes(db: Session, user_id: int, raw_names: Iterable[str]) -> dict:
    """Bulk-create UserProgress rows for the given invader names.

    Returns a summary: imported / already_flashed / unknown.
    Idempotent: re-running with the same names is a no-op.
    """
    if not db.query(User).filter(User.id == user_id).first():
        raise UserMissing()

    names = _extract_names(raw_names)
    if not names:
        return {"imported": 0, "already_flashed": 0, "unknown": [], "total_submitted": 0}

    # Fetch every invader of the submitted cities, then match on the
    # zero-stripped key so "ORLN_1" finds the DB's "ORLN_01".
    cities = {n.split("_", 1)[0] for n in names}
    city_filters = [Invader.name.startswith(f"{c}_", autoescape=True) for c in cities]
    invaders = (
        db.query(Invader.id, Invader.name)
        .filter(or_(Invader.name.in_(names), *city_filters))
        .all()
    )
    name_to_id: dict[str, int] = {}
    for iid, name in invaders:
        name_to_id.setdefault(_match_key(name), iid)

    already = {
        row.invader_id
        for row in db.query(UserProgress.invader_id)
        .filter(UserProgress.user_id == user_id)
        .filter(UserProgress.invader_id.in_(name_to_id.values()))
        .all()
    }

    imported = 0
    already_flashed = 0
    unknown: List[str] = []

    for name in names:
        invader_id = name_to_id.get(name)
        if invader_id is None:
            unknown.append(name)
            continue
        if invader_id in already:
            already_flashed += 1
            continue
        db.add(UserProgress(user_id=user_id, invader_id=invader_id))
        already.add(invader_id)
        imported += 1

    safe_commit(db)

    return {
        "imported": imported,
        "already_flashed": already_flashed,
        "unknown": unknown,
        "total_submitted": len(names),
    }


# --- PC tool download --------------------------------------------------------

# One exe per environment, each with its API URL baked in (see build_exes.ps1).
_TOOL_BUILDS_DIR = Path(__file__).resolve().parents[2] / "static" / "flash_import" / "builds"


def tool_exe_for_host(host: str) -> Path:
    """The PC tool exe that talks to the backend reached at `host`.

    Unknown hosts (localhost, LAN IP) get the development build.
    """
    env = environment_for_host(host) or "development"
    return _TOOL_BUILDS_DIR / f"InvadersHunter-FlashImport-{env}.exe"
