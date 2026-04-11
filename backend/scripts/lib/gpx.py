import sys
import os
import gpxpy
import gpxpy.gpx
from pathlib import Path

sys.path.insert(0, os.path.dirname(__file__))
import colors


class WAYPOINT_PROPERTIES:
    ICON = "icon"
    COLOR = "color"
    BACKGROUND = "background"
    HIDDEN = "hidden"


def openGpx(gpxPath: Path) -> gpxpy.gpx.GPX:
    gpx_file = open(gpxPath, 'r')
    gpx = gpxpy.parse(gpx_file)
    return gpx


def saveGpx(gpx: gpxpy.gpx.GPX, path: Path) -> None:
    with open(path, "w") as f:
        f.write(gpx.to_xml())


def getWaypointProperty(waypoint: gpxpy.gpx.GPXWaypoint, property: WAYPOINT_PROPERTIES) -> str:
    waypointIcon = '#ffe808'
    for idx in waypoint.extensions:
        if property in idx.tag:
            waypointIcon = idx.text
    return waypointIcon


def replaceWaypointProperty(waypoint: gpxpy.gpx.GPXWaypoint, property: WAYPOINT_PROPERTIES, propertyText: str) -> gpxpy.gpx.GPXWaypoint:
    for idx in waypoint.extensions:
        if property in idx.tag:
            idx.text = propertyText
    return waypoint
