import math
from typing import List, Tuple, Optional

# Points further than this from the centroid are considered outliers
OUTLIER_THRESHOLD_METERS = 300.0


def haversine_m(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Return distance in meters between two (lat, lon) points."""
    R = 6_371_000  # Earth radius in metres
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def _simple_centroid(points: List[Tuple[float, float]]) -> Tuple[float, float]:
    lats = [p[0] for p in points]
    lons = [p[1] for p in points]
    return sum(lats) / len(lats), sum(lons) / len(lons)


def compute_barycenter(
    coords: List[Tuple[float, float]],
    threshold_m: float = OUTLIER_THRESHOLD_METERS,
) -> Optional[Tuple[float, float]]:
    """
    Given a list of (lat, lon) tuples, filter outliers then return the centroid.

    Outlier filtering:
      1. Compute a raw centroid of all points.
      2. Discard points further than `threshold_m` metres from that centroid.
      3. Return the centroid of the remaining points, or None if no points survive.
    """
    valid = [(lat, lon) for lat, lon in coords if lat is not None and lon is not None]
    if not valid:
        return None

    raw_center = _simple_centroid(valid)
    filtered = [
        p for p in valid
        if haversine_m(p[0], p[1], raw_center[0], raw_center[1]) <= threshold_m
    ]

    if not filtered:
        # Fall back: keep the point closest to the raw centroid
        filtered = [min(valid, key=lambda p: haversine_m(p[0], p[1], raw_center[0], raw_center[1]))]

    return _simple_centroid(filtered)
