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
from typing import List, Optional
from sqlalchemy.orm import Session

from ..models.user import User
from ..models.user_request import UserRequest
from ..models.admin_request import AdminRequest
from ..core.geo_utils import compute_barycenter, haversine_m, _simple_centroid
from ..core.name_utils import normalize_name
from ..core.db_utils import safe_commit

AGGREGATION_THRESHOLD = 1  # minimum number of similar requests to trigger an AdminRequest


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

    vote_score = min(n / 5, 1.0)

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
        location_score: float | None = max(0.0, 1.0 - avg_dist / 300.0)
    elif len(coords) == 1:
        location_score = 1.0
    else:
        location_score = None

    factors = [vote_score, state_score]
    if location_score is not None:
        factors.append(location_score)

    return round(sum(factors) / len(factors) * 100)


def aggregate_request(db: Session, new_request: UserRequest) -> None:
    """Called right after a new UserRequest is added (and flushed) to the session."""

    named = new_request.normalized_name is not None

    # Group by normalized_name when present; by invader_id for nameless modify requests.
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
                UserRequest.normalized_name.is_(None),
                UserRequest.request_type == "modify",
                UserRequest.status == "pending",
            )
            .all()
        )

    if len(siblings) < AGGREGATION_THRESHOLD:
        return

    # Compute aggregated coordinates from siblings that have coordinates
    coords = [
        (r.proposed_latitude, r.proposed_longitude)
        for r in siblings
        if r.proposed_latitude is not None and r.proposed_longitude is not None
    ]
    center = compute_barycenter(coords) if coords else None
    agg_lat = center[0] if center else None
    agg_lon = center[1] if center else None

    # Pick most common proposed_state across siblings (for nameless modify requests)
    state_counts: dict[str, int] = {}
    for r in siblings:
        if r.proposed_state:
            state_counts[r.proposed_state] = state_counts.get(r.proposed_state, 0) + 1
    best_state = max(state_counts, key=lambda k: state_counts[k]) if state_counts else new_request.proposed_state

    # Pick the most common proposed_name (or the first one as fallback)
    name_counts: dict[str, int] = {}
    for r in siblings:
        if r.proposed_name:
            name_counts[r.proposed_name] = name_counts.get(r.proposed_name, 0) + 1
    best_name = max(name_counts, key=lambda k: name_counts[k]) if name_counts else new_request.proposed_name

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
                AdminRequest.normalized_name.is_(None),
                AdminRequest.request_type == "modify",
                AdminRequest.status == "pending",
            )
            .first()
        )

    # For fields without a meaningful aggregation strategy, use the first non-null value
    first = next((r for r in siblings if r.proposed_description is not None), None)
    agg_description = first.proposed_description if first else new_request.proposed_description
    first_pts = next((r for r in siblings if r.proposed_points is not None), None)
    agg_points = first_pts.proposed_points if first_pts else new_request.proposed_points
    first_img = next((r for r in siblings if r.proposed_image_url is not None), None)
    agg_image_url = first_img.proposed_image_url if first_img else new_request.proposed_image_url

    confidence = compute_confidence(siblings)

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
            request_count=len(siblings),
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
        admin_req.request_count = len(siblings)
        admin_req.confidence = confidence

    # Link every sibling to this AdminRequest
    for req in siblings:
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

    norm = normalize_name(data.proposed_name) if data.proposed_name else None

    # Duplicate check: by normalized name when present, otherwise by invader_id
    if norm:
        duplicate = (
            db.query(UserRequest)
            .filter(
                UserRequest.user_id == current_user.id,
                UserRequest.normalized_name == norm,
                UserRequest.request_type == data.request_type,
                UserRequest.status == "pending",
            )
            .first()
        )
    else:
        duplicate = (
            db.query(UserRequest)
            .filter(
                UserRequest.user_id == current_user.id,
                UserRequest.invader_id == data.invader_id,
                UserRequest.request_type == "modify",
                UserRequest.status == "pending",
            )
            .first()
        )
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
