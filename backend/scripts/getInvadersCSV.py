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

CSV_FIELDS = ["name", "city", "number", "latitude", "longitude", "state", "points", "date_pose", "picture_url"]


def scrapeInvaderSpotterFullInfo(invadersDict: dict) -> dict:
    """Scrapes invader-spotter.art listing pages and returns a flat dict
    keyed by (city, int_number) with state, points, date_pose and picture_url.

    Sample raw text from a row:
        '\\nAIX_01 [10 pts]Date de pose : 26/06/1999Dernier état connu :  OKDate et source : ...'
    """
    infoDict = {}
    session = requests.Session()
    session.headers.update({"Referer": f"{BASE_URL}/villes.php", "Origin": BASE_URL})

    for city in invadersDict.keys():
        logging.info(f"Scraping {city}...")
        page = 0
        i = 0
        while i != 1:
            data = {"ville": city, "arron": "00", "mode": "lst", "rang": "100"}
            if page > 0:
                data["page"] = str(page + 1)

            r = session.post(url=LISTING_URL, data=data)

            soup = BeautifulSoup(r.text, "html.parser")
            elements = soup.find_all("tr", {"class": "haut"})

            if elements:
                for element in elements:
                    # --- text container: <font class="normal">, fallback to whole td ---
                    font = element.find("font", {"class": "normal"})
                    textNode = font if font is not None else element.find("td")
                    if textNode is None:
                        continue
                    text = textNode.text

                    # --- name: from <b> tag, fallback to regex on raw text ---
                    name = None
                    bold = textNode.find("b")
                    if bold is not None:
                        candidate = bold.text.split(' ')[0].strip().upper()
                        if '_' in candidate:
                            name = candidate
                    if name is None:
                        name_match = re.search(r'\b([A-Z]{1,4}_\d{1,4})\b', text.upper())
                        if name_match:
                            name = name_match.group(1)
                    if name is None:
                        logging.warning("  could not extract name from row, skipping")
                        continue

                    # --- points: from <b> tag first, fallback to full text ---
                    points = None
                    boldText = bold.text if bold is not None else ""
                    pts_match = re.search(r'\[(\d+)\s*pts\]', boldText) or re.search(r'\[(\d+)\s*pts\]', text)
                    if pts_match:
                        points = int(pts_match.group(1))

                    # --- date de pose ---
                    date_pose = None
                    date_match = re.search(r'Date de pose\s*:\s*([\d/]+)', text)
                    if date_match:
                        date_pose = date_match.group(1)

                    # --- state ---
                    state = None
                    state_match = re.search(
                        r'Dernier\s+.{1,10}tat\s+connu\s*:\s{0,3}([^\n!]+?)(?:\s*!|Date|Instagram|\n)',
                        text, re.IGNORECASE
                    )
                    if state_match:
                        state = state_match.group(1).strip()
                    elif 'Date' in text:
                        state = text.split('Date')[1].split(':  ')[-1]
                        state = state.split('Date')[0]
                        if '!' in state:
                            state = state.split(' !')[0]
                        if 'Instagram' in state:
                            state = state.split('Instagram')[0]
                        state = state.strip() or None

                    # --- picture: grosplan src first, then any non-banniere img ---
                    picture_url = None
                    img_tag = element.find("img", src=re.compile(r'grosplan', re.IGNORECASE))
                    if img_tag is None:
                        img_tag = element.find("img", src=re.compile(r'\.(png|jpg|jpeg|gif)', re.IGNORECASE))
                    if img_tag is None:
                        img_tag = element.find("img", class_=lambda c: c != "banniere")
                    if img_tag and img_tag.get("src"):
                        src = img_tag["src"]
                        picture_url = src if src.startswith("http") else f"{BASE_URL}/{src.lstrip('/')}"

                    # Key by (city, int) — zero-padding never causes mismatches
                    cityPart = name.split('_')[0]
                    numInt = int(name.split('_')[-1])
                    infoDict[(cityPart, numInt)] = {"state": state, "points": points, "date_pose": date_pose, "picture_url": picture_url}
                    missing = [k for k, v in {"state": state, "points": points, "date_pose": date_pose, "picture_url": picture_url}.items() if v is None]
                    if missing:
                        logging.warning(f"  {cityPart}_{numInt}: missing {', '.join(missing)} | raw: {text.strip()[:80]!r}")
                    else:
                        logging.info(f"  {cityPart}_{numInt}: OK")

                page += 1
            else:
                i = 1

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
                "picture_url": info.get("picture_url"),
            })
    rows.sort(key=lambda r: (r["city"], r["number"]))
    return rows


def exportCsv(rows: list, outputPath: Path) -> None:
    outputPath.parent.mkdir(parents=True, exist_ok=True)
    with open(outputPath, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=CSV_FIELDS)
        writer.writeheader()
        writer.writerows(rows)
    logging.info(f"Exported {len(rows)} invaders to {outputPath}")


def getArgs():
    parser = argparse.ArgumentParser(
        description="Export Space Invaders data (GPX + invader-spotter.art) to CSV",
        formatter_class=lambda prog: argparse.HelpFormatter(prog, max_help_position=2000, width=1000),
    )
    parser.add_argument("-gpx", "--gpxPath", required=True, help="Path to the Space Invaders GPX file")
    parser.add_argument("-c", "--city", default=None, help="Filter by city prefix (e.g. PA)")
    parser.add_argument("-o", "--output", default="migrations/invaders.csv")
    return parser.parse_args()


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
    args = getArgs()

    logging.info("Parsing GPX...")
    invadersDict = invadersEditor.getGpxInvaders(gpxPath=args.gpxPath, cityFilter=args.city)
    logging.info(f"Found {sum(len(v) for v in invadersDict.values())} invaders in {len(invadersDict)} cities")

    logging.info("Scraping invader-spotter.art...")
    infoDict = scrapeInvaderSpotterFullInfo(invadersDict)
    logging.info(f"Scraped info for {len(infoDict)} invaders")

    rows = buildRows(invadersDict, infoDict)
    exportCsv(rows, Path(args.output))

    scraped_fields = ["state", "points", "date_pose", "picture_url"]
    incomplete = [(r["name"], [f for f in scraped_fields if not r.get(f)]) for r in rows if any(not r.get(f) for f in scraped_fields)]
    if incomplete:
        logging.warning(f"{len(incomplete)}/{len(rows)} incomplete invaders:")
        for name, missing in incomplete:
            logging.warning(f"  {name}: missing {', '.join(missing)}")
    else:
        logging.info(f"All {len(rows)} invaders complete")
