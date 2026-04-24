"""
Aggregation logic for user requests.

When a new UserRequest is saved, call `aggregate_request(db, new_request)`.
It will:
  1. Find all pending UserRequests with the same normalized_name + request_type.
  2. If there are 2+, upsert an AdminRequest (create if missing, update if exists).
  3. Link every matching UserRequest to that AdminRequest.
"""

from datetime import datetime
from sqlalchemy.orm import Session

from ..models.user_request import UserRequest
from ..models.admin_request import AdminRequest
from ..core.geo_utils import compute_barycenter, haversine_m, _simple_centroid

AGGREGATION_THRESHOLD = 1  # minimum number of similar requests to trigger an AdminRequest


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
