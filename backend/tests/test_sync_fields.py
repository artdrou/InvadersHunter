"""Shared sync rule: fill empty points / pose date / photo, report differences, never overwrite."""
from datetime import date

from app.services.sync_fields import fill_and_differences, same_pose_date


def test_fills_only_empty_fields():
    fill, diffs = fill_and_differences(
        "LAP_8", {"points": None, "date_pose": None, "image_url": None},
        {"points": 30, "date_pose": date(2026, 1, 10), "image_url": "https://x/LAP_8.png"}, "invader-spotter",
    )
    assert fill == {"points": 30, "date_pose": date(2026, 1, 10), "image_url": "https://x/LAP_8.png"}
    assert diffs == []


def test_reports_differences_and_never_overwrites():
    fill, diffs = fill_and_differences(
        "PA_10", {"points": 20, "date_pose": date(2004, 5, 1), "image_url": "https://r2/community.jpg"},
        {"points": 30, "date_pose": date(2005, 6, 2), "image_url": "https://spotter/PA_10.png"}, "InvaderQuest",
    )
    assert fill == {}
    assert diffs == [
        "PA_10: points app 20 vs InvaderQuest 30",
        "PA_10: pose date app 2004-05-01 vs InvaderQuest 2005-06-02",
    ]   # photos aren't compared: the app's may be a community upload


def test_unknown_source_values_are_ignored():
    fill, diffs = fill_and_differences("NY_75", {"points": None}, {"points": 0, "date_pose": None}, "x")
    assert (fill, diffs) == ({}, [])


def test_year_only_pose_date_matches_any_day_of_that_year():
    assert same_pose_date(date(2005, 1, 1), date(2005, 7, 20))
    assert not same_pose_date(date(2005, 1, 1), date(2006, 7, 20))
    assert not same_pose_date(date(2005, 3, 1), date(2005, 7, 20))
