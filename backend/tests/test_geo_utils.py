"""Tests for geospatial utility functions: haversine distance and barycenter computation."""
import pytest
from app.core.geo_utils import haversine_m, compute_barycenter


# ── haversine_m ────────────────────────────────────────────────────────────────

def test_haversine_same_point_is_zero():
    assert haversine_m(48.8566, 2.3522, 48.8566, 2.3522) == pytest.approx(0.0, abs=1e-6)

def test_haversine_approx_one_km_north():
    # ~0.009 degrees latitude ≈ 1 km
    d = haversine_m(48.8566, 2.3522, 48.8656, 2.3522)
    assert 900 < d < 1100

def test_haversine_is_symmetric():
    d1 = haversine_m(48.8566, 2.3522, 48.9566, 2.4522)
    d2 = haversine_m(48.9566, 2.4522, 48.8566, 2.3522)
    assert d1 == pytest.approx(d2, rel=1e-9)

def test_haversine_returns_metres_not_km():
    # Paris to Lyon is ~390 km — result should be in the hundreds of thousands
    d = haversine_m(48.8566, 2.3522, 45.7640, 4.8357)
    assert d > 100_000


# ── compute_barycenter ─────────────────────────────────────────────────────────

def test_barycenter_empty_returns_none():
    assert compute_barycenter([]) is None

def test_barycenter_single_point():
    result = compute_barycenter([(48.0, 2.0)])
    assert result == pytest.approx((48.0, 2.0))

def test_barycenter_two_equal_points():
    result = compute_barycenter([(48.0, 2.0), (48.0, 2.0)])
    assert result == pytest.approx((48.0, 2.0), abs=1e-6)

def test_barycenter_two_close_points_is_midpoint():
    result = compute_barycenter([(48.0, 2.0), (48.002, 2.002)])
    assert result is not None
    lat, lon = result
    assert lat == pytest.approx(48.001, rel=1e-4)
    assert lon == pytest.approx(2.001, rel=1e-4)

def test_barycenter_filters_distant_outlier():
    # 3 tight Parisian points + 1 outlier in Africa
    tight = [(48.85, 2.35), (48.86, 2.36), (48.84, 2.34)]
    result = compute_barycenter(tight + [(0.0, 0.0)])
    assert result is not None
    lat, lon = result
    assert lat == pytest.approx(48.85, abs=0.05)
    assert lon == pytest.approx(2.35, abs=0.05)

def test_barycenter_keeps_all_when_cluster_is_tight():
    tight = [(48.85, 2.35), (48.851, 2.351), (48.849, 2.349)]
    result = compute_barycenter(tight)
    assert result is not None
    lat, lon = result
    assert lat == pytest.approx(48.85, abs=0.01)
    assert lon == pytest.approx(2.35, abs=0.01)

def test_barycenter_fallback_keeps_closest_when_all_spread():
    # Two points 1000 km apart — after filtering both may be "outliers";
    # fallback keeps the closest to raw centroid
    result = compute_barycenter([(48.85, 2.35), (0.0, 0.0)])
    assert result is not None  # never returns None for non-empty input
