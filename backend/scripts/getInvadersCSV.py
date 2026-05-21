import argparse
import csv
import logging
import re
import sys
from pathlib import Path

import requests
from bs4 import BeautifulSoup

sys.path.insert(0, str(Path(__file__).parent))
from lib import invadersEditor

BASE_URL = "https://www.invader-spotter.art"
LISTING_URL = f"{BASE_URL}/listing.php"

CSV_FIELDS = ["name", "city", "number", "latitude", "longitude", "state", "points", "date_pose", "state_date", "picture_url"]
SCRAPED_FIELDS = ["state", "points", "date_pose", "state_date", "picture_url"]
INCOMPLETE_FIELDS = ["name", "city", "number", "missing", "state", "points", "date_pose", "state_date", "picture_url", "raw_text", "raw_html"]


def _splitByBr(font):
    segments, current = [], []
    for child in font.children:
        if getattr(child, "name", None) == "br":
            segments.append(current)
            current = []
        else:
            current.append(child)
    segments.append(current)
    return segments


def _segmentText(segment):
    parts = [c.get_text() if hasattr(c, "get_text") else str(c) for c in segment]
    return "".join(parts).strip()


def _parseRow(element):
    font = element.find("font", {"class": "normal"})
    if font is None:
        return None
    info = {"name": None, "points": None, "date_pose": None, "state": None, "state_date": None, "picture_url": None}

    for segment in _splitByBr(font):
        text = _segmentText(segment)
        if not text:
            continue

        for c in segment:
            if getattr(c, "name", None) == "b":
                bText = c.get_text()
                nameMatch = re.search(r"\b([A-Z]{1,4}_\d{1,4})\b", bText.upper())
                if nameMatch:
                    info["name"] = nameMatch.group(1)
                ptsMatch = re.search(r"\[(\d+)\s*pts\]", bText)
                if ptsMatch:
                    info["points"] = int(ptsMatch.group(1))

        if "Date de pose" in text:
            m = re.search(r"Date de pose\s*:\s*([\d/]+)", text)
            if m:
                info["date_pose"] = m.group(1)
            continue

        if "Date et source" in text:
            m = re.search(r"Date et source\s*:\s*(.+)", text)
            if m:
                info["state_date"] = m.group(1).strip() or None
            continue

        if re.search(r"Dernier\s+.{1,5}tat\s+connu", text, re.IGNORECASE):
            rawParts = []
            for c in segment:
                if getattr(c, "name", None) == "img":
                    continue
                rawParts.append(c.get_text() if hasattr(c, "get_text") else str(c))
            joined = "".join(rawParts)
            m = re.search(r":\s*(.+)$", joined, re.DOTALL)
            if m:
                state = m.group(1).strip().rstrip("!").strip()
                info["state"] = state or None
            continue

    imgTag = element.find("img", src=re.compile(r"grosplan", re.IGNORECASE))
    if imgTag is None:
        imgTag = element.find("img", src=re.compile(r"\.(png|jpg|jpeg|gif)", re.IGNORECASE))
    if imgTag is None:
        imgTag = element.find("img", class_=lambda c: c != "banniere")
    if imgTag and imgTag.get("src"):
        src = imgTag["src"]
        info["picture_url"] = src if src.startswith("http") else f"{BASE_URL}/{src.lstrip('/')}"

    return info


def _scrapeCity(session, city):
    """Returns {(city, intNumber): {info..., '_raw_text', '_raw_html'}}."""
    out = {}
    page = 0
    while True:
        data = {"ville": city, "arron": "00", "mode": "lst", "rang": "100"}
        if page > 0:
            data["page"] = str(page + 1)
        r = session.post(url=LISTING_URL, data=data, timeout=30)
        soup = BeautifulSoup(r.text, "html.parser")
        elements = soup.find_all("tr", {"class": "haut"})
        if not elements:
            break
        for element in elements:
            info = _parseRow(element)
            if info is None or not info.get("name"):
                continue
            cityPart = info["name"].split("_")[0]
            numInt = int(info["name"].split("_")[-1])
            payload = {k: v for k, v in info.items() if k != "name"}
            payload["_raw_text"] = element.get_text(" ", strip=True)
            payload["_raw_html"] = str(element)
            out[(cityPart, numInt)] = payload
            missing = _missingFields(payload)
            summary = f"state={payload.get('state')!r} points={payload.get('points')} date_pose={payload.get('date_pose')} state_date={payload.get('state_date')!r} picture={'yes' if payload.get('picture_url') else 'no'}"
            if missing:
                logging.warning(f"  {info['name']}: {summary} | MISSING {','.join(missing)}")
            else:
                logging.info(f"  {info['name']}: {summary}")
        page += 1
    return out


def _missingFields(info):
    return [k for k in SCRAPED_FIELDS if not info.get(k)]


def scrapeInvaderSpotterFullInfo(invadersDict: dict) -> dict:
    """Single-pass scrape of every city in invadersDict."""
    session = requests.Session()
    session.headers.update({"Referer": f"{BASE_URL}/villes.php", "Origin": BASE_URL})

    infoDict = {}
    for city in sorted(invadersDict.keys()):
        logging.info(f"Scraping {city}...")
        try:
            cityInfo = _scrapeCity(session, city)
        except requests.RequestException as e:
            logging.warning(f"  {city}: request failed ({e})")
            continue
        infoDict.update(cityInfo)
    return infoDict


def buildRows(invadersDict: dict, infoDict: dict) -> list:
    rows = []
    for city, numbers in invadersDict.items():
        numberFormat = invadersEditor.findCityNumberingFormat(numbers)
        for number, waypoint in numbers.items():
            formattedNumber = invadersEditor.convertToNumberingFormat(number, numberFormat)
            name = f"{city}_{formattedNumber}"
            info = infoDict.get((city, int(number)), {})
            rows.append({
                "name": name,
                "city": city,
                "number": formattedNumber,
                "latitude": waypoint.latitude,
                "longitude": waypoint.longitude,
                "state": info.get("state"),
                "points": info.get("points"),
                "date_pose": info.get("date_pose"),
                "state_date": info.get("state_date"),
                "picture_url": info.get("picture_url"),
                "_raw_text": info.get("_raw_text"),
                "_raw_html": info.get("_raw_html"),
            })
    rows.sort(key=lambda r: (r["city"], r["number"]))
    return rows


def exportCsv(rows: list, outputPath: Path) -> None:
    outputPath.parent.mkdir(parents=True, exist_ok=True)
    with open(outputPath, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=CSV_FIELDS, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(rows)
    logging.info(f"Exported {len(rows)} invaders to {outputPath}")


def exportIncompleteCsv(rows: list, outputPath: Path) -> int:
    incomplete = []
    for r in rows:
        missing = _missingFields(r)
        if not missing:
            continue
        incomplete.append({
            "name": r["name"],
            "city": r["city"],
            "number": r["number"],
            "missing": ",".join(missing),
            "state": r.get("state"),
            "points": r.get("points"),
            "date_pose": r.get("date_pose"),
            "state_date": r.get("state_date"),
            "picture_url": r.get("picture_url"),
            "raw_text": r.get("_raw_text"),
            "raw_html": r.get("_raw_html"),
        })
    outputPath.parent.mkdir(parents=True, exist_ok=True)
    with open(outputPath, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=INCOMPLETE_FIELDS)
        writer.writeheader()
        writer.writerows(incomplete)
    logging.info(f"Exported {len(incomplete)} incomplete invaders to {outputPath}")
    return len(incomplete)


class _Waypoint:
    __slots__ = ("latitude", "longitude")

    def __init__(self, lat, lon):
        self.latitude = lat
        self.longitude = lon


def loadInvadersFromCsv(csvPath: Path, cityFilter: str | None = None) -> dict:
    invadersDict: dict = {}
    with open(csvPath, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            city = row["city"]
            if cityFilter and not city.startswith(cityFilter):
                continue
            number = row["number"]
            invadersDict.setdefault(city, {})[number] = _Waypoint(float(row["latitude"]), float(row["longitude"]))
    return invadersDict


def getArgs():
    parser = argparse.ArgumentParser(
        description="Export Space Invaders data (GPX or existing CSV + invader-spotter.art) to CSV",
        formatter_class=lambda prog: argparse.HelpFormatter(prog, max_help_position=2000, width=1000),
    )
    src = parser.add_mutually_exclusive_group(required=True)
    src.add_argument("-gpx", "--gpxPath", help="Path to the Space Invaders GPX file")
    src.add_argument("-csv", "--csvPath", help="Path to an existing invaders CSV (uses its name/city/number/lat/lon)")
    parser.add_argument("-c", "--city", default=None, help="Filter by city prefix (e.g. PA)")
    parser.add_argument("-o", "--output", default="migrations/invaders.csv")
    parser.add_argument("--incompleteOutput", default=None, help="Path for the incomplete-rows CSV (default: alongside output, '<output>.incomplete.csv')")
    return parser.parse_args()


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
    args = getArgs()

    if args.csvPath:
        logging.info(f"Loading invaders from {args.csvPath}...")
        invadersDict = loadInvadersFromCsv(Path(args.csvPath), cityFilter=args.city)
    else:
        logging.info("Parsing GPX...")
        invadersDict = invadersEditor.getGpxInvaders(gpxPath=args.gpxPath, cityFilter=args.city)
    logging.info(f"Found {sum(len(v) for v in invadersDict.values())} invaders in {len(invadersDict)} cities")

    logging.info("Scraping invader-spotter.art...")
    infoDict = scrapeInvaderSpotterFullInfo(invadersDict)
    logging.info(f"Scraped info for {len(infoDict)} invaders")

    rows = buildRows(invadersDict, infoDict)
    outputPath = Path(args.output)
    exportCsv(rows, outputPath)

    incompletePath = Path(args.incompleteOutput) if args.incompleteOutput else outputPath.with_name(outputPath.stem + ".incomplete.csv")
    nIncomplete = exportIncompleteCsv(rows, incompletePath)
    if nIncomplete == 0:
        logging.info(f"All {len(rows)} invaders complete")
    else:
        logging.warning(f"{nIncomplete}/{len(rows)} incomplete invaders written to {incompletePath} for tuning")
