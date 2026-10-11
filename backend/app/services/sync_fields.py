"""
Shared rule of the catalogue sync jobs (invader-spotter, InvaderQuest) for the
descriptive fields — points, pose date, photo: a source fills a field only when
it is empty, never overwrites it; a known value that differs from the source is
reported (warning in the job log) for a human to check.

Photos are only filled, not compared: the app's photo may be a community upload.
"""
from datetime import date
from typing import List, Optional, Tuple


def points_value(raw) -> Optional[int]:
    """Points as published (0 / missing = unknown)."""
    return raw if isinstance(raw, int) and not isinstance(raw, bool) and raw > 0 else None


def same_pose_date(current: date, source: date) -> bool:
    """A year-only date (YYYY-01-01, e.g. typed in the app) matches any day of that year."""
    if current.month == 1 and current.day == 1:
        return current.year == source.year
    return current == source


def fill_and_differences(
    name: str, current: dict, source: dict, source_label: str,
) -> Tuple[dict, List[str]]:
    """`current` / `source`: {"points", "date_pose", "image_url"} (missing keys = unknown).
    Returns (fields to fill, differences to report)."""
    fill: dict = {}
    differences: List[str] = []

    src_points = points_value(source.get("points"))
    if src_points is not None:
        if current.get("points") is None:
            fill["points"] = src_points
        elif current["points"] != src_points:
            differences.append(f"{name}: points app {current['points']} vs {source_label} {src_points}")

    src_date = source.get("date_pose")
    if src_date is not None:
        if current.get("date_pose") is None:
            fill["date_pose"] = src_date
        elif not same_pose_date(current["date_pose"], src_date):
            differences.append(f"{name}: pose date app {current['date_pose']} vs {source_label} {src_date}")

    if source.get("image_url") and not current.get("image_url"):
        fill["image_url"] = source["image_url"]

    return fill, differences
