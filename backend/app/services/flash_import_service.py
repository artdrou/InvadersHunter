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
from typing import Iterable, List, Optional
from sqlalchemy import or_
from sqlalchemy.orm import Session

from ..models.user_progress import UserProgress
from ..models.user import User
from ..models.space_invader import Invader
from ..core.db_utils import safe_commit
from ..core.name_utils import normalize_name
from ..core.environment import environment_for_host


class UserMissing(Exception): ...


class MirrorRefused(Exception):
    """A full sync (mirror) would remove flashes from a phone list that looks incomplete."""

    def __init__(self, reason: str):
        super().__init__(reason)
        self.reason = reason


# Mirror mode removes flashes the phone doesn't list: refused when the phone lists
# fewer than this share of the account's flashes (a partial folder, e.g. the cache).
MIRROR_MIN_RATIO = 0.5


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


def _mirror_refusal(app_total: int, phone_total: int) -> Optional[str]:
    """Why removing the flashes the phone doesn't list would be unsafe, if it would."""
    if phone_total == 0:
        return "the phone lists none of the known invaders"
    if phone_total < MIRROR_MIN_RATIO * app_total:
        return (f"the phone lists {phone_total} known invaders but the account has {app_total} flashes "
                f"(less than {MIRROR_MIN_RATIO:.0%}): the phone folder looks incomplete")
    return None


def import_flashes(
    db: Session, user_id: int, raw_names: Iterable[str], mirror: bool = False, confirm: bool = False,
) -> dict:
    """Bulk-create UserProgress rows for the given invader names.

    Returns a summary: imported / already_flashed / unknown, plus the account and
    phone totals. Idempotent: re-running with the same names is a no-op.

    `mirror` also removes the account's flashes the phone doesn't list. It is a
    two-step operation: without `confirm` nothing is written (preview: what would be
    added / removed); with `confirm` it is applied, unless the phone list looks
    incomplete (MirrorRefused, see MIRROR_MIN_RATIO).
    """
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise UserMissing()
    app_flashes = dict(
        db.query(UserProgress.invader_id, Invader.name)
        .join(Invader, Invader.id == UserProgress.invader_id)
        .filter(UserProgress.user_id == user_id)
        .all()
    )
    summary = {
        "username": user.username,
        "app_total": len(app_flashes),
        "mirror": mirror,
        "applied": not mirror or confirm,
    }

    names = _extract_names(raw_names)
    if not names:
        if mirror and confirm:
            raise MirrorRefused(_mirror_refusal(len(app_flashes), 0))
        return {**summary, "imported": 0, "already_flashed": 0, "unknown": [], "total_submitted": 0,
                "phone_total": 0, "to_remove": [], "removed": 0,
                "refused": _mirror_refusal(len(app_flashes), 0) if mirror else None}

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

    already = set(app_flashes)

    to_add: List[int] = []
    already_flashed = 0
    unknown: List[str] = []
    on_phone: set[int] = set()

    for name in names:
        invader_id = name_to_id.get(name)
        if invader_id is None:
            unknown.append(name)
            continue
        on_phone.add(invader_id)
        if invader_id in already:
            already_flashed += 1
            continue
        to_add.append(invader_id)
        already.add(invader_id)

    to_remove = sorted(iid for iid in app_flashes if iid not in on_phone) if mirror else []
    if mirror:
        refusal = _mirror_refusal(len(app_flashes), len(on_phone))
        if refusal and confirm:
            raise MirrorRefused(refusal)
        summary["refused"] = refusal

    if summary["applied"]:
        for invader_id in to_add:
            db.add(UserProgress(user_id=user_id, invader_id=invader_id))
        if to_remove:
            db.query(UserProgress).filter(
                UserProgress.user_id == user_id, UserProgress.invader_id.in_(to_remove),
            ).delete(synchronize_session=False)
        safe_commit(db)

    return {
        **summary,
        "imported": len(to_add),
        "already_flashed": already_flashed,
        "unknown": unknown,
        "total_submitted": len(names),
        "phone_total": len(on_phone),
        "to_remove": sorted(app_flashes[iid] for iid in to_remove),
        "removed": len(to_remove) if summary["applied"] else 0,
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
