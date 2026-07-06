import logging
import re
import sys
import os

import gpxpy
import gpxpy.gpx

sys.path.insert(0, os.path.dirname(__file__))
import gpx as gpxLib


def findCityNameAndNumber(waypoint: gpxpy.gpx.GPXWaypoint):
    pattern = r'^[A-Za-z]{1,4}_\d{1,4}$'
    if waypoint.name is not None:
        match = re.match(pattern, waypoint.name)
        if match is not None:
            invaderName = match.string
            cityName = invaderName.split('_')[0]
            if not cityName.isupper():
                cityName = cityName.upper()
            number = invaderName.split('_')[1]
        else:
            cityName = None
            number = None
    else:
        cityName = None
        number = None
    return cityName, number


def findCityNumberingFormat(cityDict: dict) -> int:
    strNumberList = list(cityDict.keys())
    lenList = [len(s) for s in strNumberList]
    return max(set(lenList))


def convertToNumberingFormat(number, nNumber):
    if len(number) < nNumber:
        number = number.zfill(nNumber)
    elif len(number) > nNumber:
        logging.error("number len is exceeding number format.")
        number = number[len(number) - nNumber:]
    return number


def getGpxInvaders(gpxPath, cityFilter=None) -> dict:
    gpx = gpxLib.openGpx(gpxPath)
    filesDict = {}
    invadersDict = {}
    for waypoint in gpx.waypoints:
        cityName, number = findCityNameAndNumber(waypoint)
        if ((cityFilter is not None and cityFilter == cityName) or cityFilter is None) and cityName is not None:
            if cityName not in filesDict:
                filesDict[cityName] = {number: waypoint}
            else:
                filesDict[cityName][number] = waypoint
    for city in filesDict:
        invadersDict[city] = {}
        nNumber = findCityNumberingFormat(filesDict[city])
        for number in filesDict[city]:
            newNumber = convertToNumberingFormat(number, nNumber)
            invadersDict[city][newNumber] = filesDict[city][number]
    return invadersDict
