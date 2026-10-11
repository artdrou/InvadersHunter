"""
Business logic for the user-side workflow on UserRequests.

Public API:
- submit            : create a UserRequest, run aggregation into an AdminRequest
- cancel            : delete a pending UserRequest, drop the orphaned AdminRequest if any
- list_for_user     : list requests visible to one user (admins see all)
- get_by_id         : fetch one request, enforcing ownership unless admin
- aggregate_request : the aggregation engine (called by submit, also exposed for tests)
- compute_confidence: scoring used by the aggregation
"""

from datetime import datetime
from types import SimpleNamespace
from typing import List, Optional
from sqlalchemy.orm import Session

from ..models.user import User
from ..models.user_request import UserRequest
from ..models.admin_request import AdminRequest
from ..models.space_invader import Invader
from ..core.geo_utils import compute_barycenter, haversine_m, _simple_centroid
from ..core.name_utils import normalize_name
from ..core.spotter_scraper import split_name
from ..core.db_utils import safe_commit
from . import invader_service

AGGREGATION_THRESHOLD = 1  # minimum number of similar requests to trigger an AdminRequest

# ── Confidence scoring tunables (see compute_confidence) ──────────────────────
FULL_VOTE_COUNT = 5           # this many agreeing submissions = full vote weight
LOCATION_TIGHTNESS_M = 300.0  # coord spread (m) at/under which location agreement scores full


# ── Domain exceptions ────────────────────────────────────────────────────────

class InvalidRequestPayload(Exception):
    """request_type / invader_id / proposed_name combination doesn't match the rules."""
    def __init__(self, detail: str):
        super().__init__(detail)
        self.detail = detail


class DuplicatePendingRequest(Exception): ...
class RequestMissing(Exception): ...
class NotRequestOwner(Exception): ...
class RequestNotPending(Exception): ...


def compute_confidence(siblings: list) -> int:
    """
    0-100 score reflecting how much the user submissions agree with each other.

    Factors:
    - Vote weight  : normalised vote count (5+ votes = full weight)
    - State agreement : fraction of submissions sharing the most common proposed state
    - Location tightness : how clustered the proposed coords are (< 300 m spread = tight)
    """
    n = len(siblings)
    if n == 0:
        return 0

    vote_score = min(n / FULL_VOTE_COUNT, 1.0)

    states = [s.proposed_state for s in siblings if s.proposed_state]
    if states:
        most_common = max(set(states), key=states.count)
        state_score = states.count(most_common) / len(states)
    else:
        state_score = 1.0

    coords = [
        (s.proposed_latitude, s.proposed_longitude)
        for s in siblings
        if s.proposed_latitude is not None and s.proposed_longitude is not None
    ]
    if len(coords) >= 2:
        center = _simple_centroid(coords)
        avg_dist = sum(haversine_m(lat, lon, center[0], center[1]) for lat, lon in coords) / len(coords)
        location_score: float | None = max(0.0, 1.0 - avg_dist / LOCATION_TIGHTNESS_M)
    elif len(coords) == 1:
        location_score = 1.0
    else:
        location_score = None

    factors = [vote_score, state_score]
    if location_score is not None:
        factors.append(location_score)

    return round(sum(factors) / len(factors) * 100)


def canonical_name(name: str) -> str:
    """Name key of a proposal: normalized, zero padding dropped ("pa 0099" -> "PA_99"),
    so spelling variants of one invader are one proposal (duplicate check + votes)."""
    norm = normalize_name(name)
    key = split_name(norm)
    return f"{key[0]}_{key[1]}" if key else norm


def proposed_fields(req) -> set:
    """Details a modify proposal touches. The photo isn't one: it's uploaded onto the
    request after it is created (and several photos are fine)."""
    fields = set()
    if req.proposed_state is not None:
        fields.add("state")
    if req.proposed_latitude is not None or req.proposed_longitude is not None:
        fields.add("location")
    for name in ("points", "date_pose", "name", "description"):
        if getattr(req, f"proposed_{name}") is not None:
            fields.add(name)
    return fields


def _latest_per_user(requests: list, value) -> dict:
    """user_id -> that user's latest non-null `value(request)`: one vote per person."""
    latest: dict = {}
    for r in sorted(requests, key=lambda r: (r.created_at or datetime.min, r.id or 0)):
        v = value(r)
        if v is not None:
            latest[r.user_id] = v
    return latest


def _most_common(votes: dict):
    """Most voted value (first proposed wins a tie), None without votes."""
    if not votes:
        return None
    values = list(votes.values())
    return max(values, key=values.count)


def aggregate_request(db: Session, new_request: UserRequest) -> None:
    """Called right after a new UserRequest is added (and flushed) to the session."""

    # Creations are grouped by (canonical) name; modifications by target invader,
    # whatever name they carry — one pending AdminRequest per invader.
    named = new_request.request_type == "create"

    if named:
        siblings = (
            db.query(UserRequest)
            .filter(
                UserRequest.normalized_name == new_request.normalized_name,
                UserRequest.request_type == new_request.request_type,
                UserRequest.status == "pending",
            )
            .all()
        )
    else:
        siblings = (
            db.query(UserRequest)
            .filter(
                UserRequest.invader_id == new_request.invader_id,
                UserRequest.request_type == "modify",
                UserRequest.status == "pending",
            )
            .all()
        )

    if len(siblings) < AGGREGATION_THRESHOLD:
        return
    all_siblings = siblings
    # One vote per user and per detail: each user's latest value of each proposed
    # detail counts once. A user may propose the location, then the state (both
    # merged into this AdminRequest), but repeating a detail never adds votes.
    states = _latest_per_user(siblings, lambda r: r.proposed_state)
    coords = _latest_per_user(
        siblings,
        lambda r: (r.proposed_latitude, r.proposed_longitude)
        if r.proposed_latitude is not None and r.proposed_longitude is not None else None,
    )
    center = compute_barycenter(list(coords.values())) if coords else None
    agg_lat = center[0] if center else None
    agg_lon = center[1] if center else None
    best_state = _most_common(states) or new_request.proposed_state
    best_name = _most_common(_latest_per_user(siblings, lambda r: r.proposed_name)) or new_request.proposed_name
    agg_description = _most_common(_latest_per_user(siblings, lambda r: r.proposed_description))
    agg_points = _most_common(_latest_per_user(siblings, lambda r: r.proposed_points))
    agg_image_url = _most_common(_latest_per_user(siblings, lambda r: r.proposed_image_url))
    agg_date_pose = _most_common(_latest_per_user(siblings, lambda r: r.proposed_date_pose))
    voters = {r.user_id for r in siblings}
    confidence = compute_confidence([
        SimpleNamespace(
            proposed_state=states.get(uid),
            proposed_latitude=coords[uid][0] if uid in coords else None,
            proposed_longitude=coords[uid][1] if uid in coords else None,
        )
        for uid in voters
    ])

    # Find existing pending AdminRequest for the same target
    if named:
        admin_req = (
            db.query(AdminRequest)
            .filter(
                AdminRequest.normalized_name == new_request.normalized_name,
                AdminRequest.request_type == new_request.request_type,
                AdminRequest.status == "pending",
            )
            .first()
        )
    else:
        admin_req = (
            db.query(AdminRequest)
            .filter(
                AdminRequest.invader_id == new_request.invader_id,
                AdminRequest.request_type == "modify",
                AdminRequest.status == "pending",
            )
            .first()
        )

    if admin_req is None:
        admin_req = AdminRequest(
            invader_id=new_request.invader_id,
            request_type=new_request.request_type,
            status="pending",
            proposed_name=best_name,
            normalized_name=new_request.normalized_name,
            proposed_description=agg_description,
            proposed_latitude=agg_lat,
            proposed_longitude=agg_lon,
            proposed_points=agg_points,
            proposed_state=best_state,
            proposed_image_url=agg_image_url,
            proposed_date_pose=agg_date_pose,
            request_count=len(voters),
            confidence=confidence,
        )
        db.add(admin_req)
        db.flush()  # get admin_req.id
    else:
        admin_req.proposed_name = best_name
        admin_req.proposed_description = agg_description
        admin_req.proposed_latitude = agg_lat
        admin_req.proposed_longitude = agg_lon
        admin_req.proposed_points = agg_points
        admin_req.proposed_state = best_state
        admin_req.proposed_image_url = agg_image_url
        admin_req.proposed_date_pose = agg_date_pose
        admin_req.request_count = len(voters)
        admin_req.confidence = confidence

    # Link every submission (duplicates included) to this AdminRequest
    for req in all_siblings:
        req.admin_request_id = admin_req.id


# ── Public service API ───────────────────────────────────────────────────────

def submit(db: Session, current_user: User, data) -> UserRequest:
    """Validate, persist, and aggregate a user request. `data` is a UserRequestCreate
    (or anything with the same fields). Raises domain exceptions on rule violations."""
    if data.request_type == "modify" and data.invader_id is None:
        raise InvalidRequestPayload("invader_id is required for a modify request")
    if data.request_type == "create" and data.invader_id is not None:
        raise InvalidRequestPayload("invader_id must be null for a create request")
    if data.request_type == "create" and not data.proposed_name:
        raise InvalidRequestPayload("proposed_name is required for a create request")

    if data.request_type == "create":
        invader_service.ensure_new(db, data.proposed_name)   # InvaderAlreadyExists

    norm = canonical_name(data.proposed_name) if data.proposed_name else None

    # One pending proposal per user and target: a creation by (canonical) name; a
    # modification per invader AND detail (location, state…): the same user may
    # propose the location, then the state — both merged into one AdminRequest —
    # but never stack votes on one detail
    if data.request_type == "modify":
        invader = db.query(Invader).filter(Invader.id == data.invader_id).first()
        if invader is not None and data.proposed_state == invader.state:
            data.proposed_state = None   # unchanged state (forms send it): not a proposal
    if data.request_type == "create":
        duplicate = (
            db.query(UserRequest)
            .filter(
                UserRequest.user_id == current_user.id,
                UserRequest.normalized_name == norm,
                UserRequest.request_type == "create",
                UserRequest.status == "pending",
            )
            .first()
        )
    else:
        mine = (
            db.query(UserRequest)
            .filter(
                UserRequest.user_id == current_user.id,
                UserRequest.invader_id == data.invader_id,
                UserRequest.request_type == "modify",
                UserRequest.status == "pending",
            )
            .all()
        )
        already = set().union(*(proposed_fields(r) for r in mine)) if mine else set()
        duplicate = bool(proposed_fields(data) & already)
    if duplicate:
        raise DuplicatePendingRequest()

    new_req = UserRequest(
        user_id=current_user.id,
        invader_id=data.invader_id,
        request_type=data.request_type,
        status="pending",
        proposed_name=data.proposed_name,
        normalized_name=norm,
        proposed_description=data.proposed_description,
        proposed_latitude=data.proposed_latitude,
        proposed_longitude=data.proposed_longitude,
        proposed_points=data.proposed_points,
        proposed_state=data.proposed_state,
        proposed_image_url=data.proposed_image_url,
        proposed_date_pose=data.proposed_date_pose,
    )
    db.add(new_req)
    db.flush()  # need new_req.id before aggregation

    aggregate_request(db, new_req)

    safe_commit(db)
    db.refresh(new_req)
    return new_req


def list_for_user(
    db: Session, current_user: User, updated_since: Optional[datetime] = None
) -> List[UserRequest]:
    """Admins see every request; regular users only see their own."""
    query = db.query(UserRequest)
    if not current_user.is_admin:
        query = query.filter(UserRequest.user_id == current_user.id)
    if updated_since is not None:
        query = query.filter(UserRequest.updated_at > updated_since)
    return query.all()


def get_by_id(db: Session, current_user: User, request_id: int) -> UserRequest:
    req = db.query(UserRequest).filter(UserRequest.id == request_id).first()
    if not req:
        raise RequestMissing()
    if not current_user.is_admin and req.user_id != current_user.id:
        raise NotRequestOwner()
    return req


def cancel(db: Session, current_user: User, request_id: int) -> None:
    """Delete a pending UserRequest. If the linked AdminRequest has no remaining
    siblings (and is still pending), drop it too so we don't leave orphans."""
    req = db.query(UserRequest).filter(UserRequest.id == request_id).first()
    if not req:
        raise RequestMissing()
    if not current_user.is_admin and req.user_id != current_user.id:
        raise NotRequestOwner()
    if req.status != "pending":
        raise RequestNotPending()

    admin_request_id = req.admin_request_id
    db.delete(req)
    db.flush()

    if admin_request_id:
        remaining = (
            db.query(UserRequest)
            .filter(UserRequest.admin_request_id == admin_request_id)
            .count()
        )
        if remaining == 0:
            admin_req = db.query(AdminRequest).filter(AdminRequest.id == admin_request_id).first()
            if admin_req and admin_req.status == "pending":
                db.delete(admin_req)

    safe_commit(db)
