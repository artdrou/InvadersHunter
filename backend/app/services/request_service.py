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
from ..core.geo_utils import compute_barycenter

AGGREGATION_THRESHOLD = 1  # minimum number of similar requests to trigger an AdminRequest


def aggregate_request(db: Session, new_request: UserRequest) -> None:
    """Called right after a new UserRequest is added (and flushed) to the session."""

    # Find all pending requests with same normalized name and type (including the new one)
    siblings = (
        db.query(UserRequest)
        .filter(
            UserRequest.normalized_name == new_request.normalized_name,
            UserRequest.request_type == new_request.request_type,
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

    # Pick the most common proposed_name (or the first one as fallback)
    name_counts: dict[str, int] = {}
    for r in siblings:
        if r.proposed_name:
            name_counts[r.proposed_name] = name_counts.get(r.proposed_name, 0) + 1
    best_name = max(name_counts, key=lambda k: name_counts[k]) if name_counts else new_request.proposed_name

    # Find existing AdminRequest for this normalized_name + type that is still pending
    admin_req = (
        db.query(AdminRequest)
        .filter(
            AdminRequest.normalized_name == new_request.normalized_name,
            AdminRequest.request_type == new_request.request_type,
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
            proposed_latitude=agg_lat,
            proposed_longitude=agg_lon,
            request_count=len(siblings),
        )
        db.add(admin_req)
        db.flush()  # get admin_req.id
    else:
        # Update aggregated data
        admin_req.proposed_name = best_name
        admin_req.proposed_latitude = agg_lat
        admin_req.proposed_longitude = agg_lon
        admin_req.request_count = len(siblings)

    # Link every sibling to this AdminRequest
    for req in siblings:
        req.admin_request_id = admin_req.id
