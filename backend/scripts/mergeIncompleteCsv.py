"""
Re-extract whatever info we can from the incomplete CSV's raw_text/raw_html
columns, and merge those values into the main CSV.

- Reads main CSV (invaders_new.csv) and incomplete CSV (invaders_new.incomplete.csv)
- For each incomplete row, runs looser fallback extractors on raw_text and raw_html
- Only fills fields that are still empty — never overwrites existing values
- Writes a merged CSV (default: <main>.merged.csv) ready to feed to backfill

Run from /backend:
  venv/Scripts/python.exe scripts/mergeIncompleteCsv.py \
    -main migrations/invaders_new.csv \
    -incomplete migrations/invaders_new.incomplete.csv \
    -o migrations/invaders_new.merged.csv
"""
import argparse
import csv
import logging
import re
import sys
from pathlib import Path

from bs4 import BeautifulSoup

sys.path.insert(0, str(Path(__file__).parent))
from getInvadersCSV import CSV_FIELDS, SCRAPED_FIELDS, BASE_URL, _parseRow

# Allow huge HTML blobs in the incomplete CSV
csv.field_size_limit(sys.maxsize if sys.maxsize < 2**31 else 2**31 - 1)


def _fallbackFromText(text: str) -> dict:
    """Loose regex extraction over a flattened text blob."""
    out = {"state": None, "points": None, "date_pose": None, "state_date": None}
    if not text:
        return out

    m = re.search(r"\[(\d+)\s*pts\]", text)
    if m:
        out["points"] = int(m.group(1))

    m = re.search(r"Date\s+de\s+pose\s*:\s*([\d/]+)", text)
    if m:
        out["date_pose"] = m.group(1)

    m = re.search(r"Date\s+et\s+source\s*:\s*(.+?)(?:\s+Instagram|\s+hashtag|\s*$)", text)
    if m:
        v = m.group(1).strip()
        if v:
            out["state_date"] = v

    # State: between "Dernier <accent>tat connu :" and "Date et source"/"Instagram"/end
    m = re.search(
        r"Dernier\s+.{1,5}tat\s+connu\s*:\s*(.+?)(?:\s+Date\s+et\s+source|\s+Instagram|\s*$)",
        text, re.IGNORECASE | re.DOTALL,
    )
    if m:
        state = m.group(1).strip().rstrip("!").strip()
        # Strip stray HTML entity / image alt artifacts
        state = re.sub(r"\s+", " ", state)
        if state and len(state) < 80:
            out["state"] = state

    return out


def _fallbackFromHtml(html: str) -> dict:
    """Re-parse the raw <tr> HTML with the structured parser, then look for a
    grosplan image more aggressively."""
    out = {"state": None, "points": None, "date_pose": None, "state_date": None, "picture_url": None}
    if not html:
        return out
    soup = BeautifulSoup(html, "html.parser")
    row = soup.find("tr") or soup
    info = _parseRow(row) or {}
    for k in out:
        v = info.get(k)
        if v is not None:
            out[k] = v

    if not out["picture_url"]:
        img = soup.find("img", src=re.compile(r"grosplan", re.IGNORECASE))
        if img is None:
            img = soup.find("img", src=re.compile(r"\.(png|jpg|jpeg|gif)", re.IGNORECASE))
        if img and img.get("src"):
            src = img["src"]
            out["picture_url"] = src if src.startswith("http") else f"{BASE_URL}/{src.lstrip('/')}"

    return out


def merge(mainPath: Path, incompletePath: Path, outputPath: Path) -> None:
    # Load main CSV
    with open(mainPath, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        mainRows = list(reader)
    byName = {r["name"]: r for r in mainRows}
    logging.info(f"Loaded {len(mainRows)} rows from {mainPath}")

    # Load incomplete CSV and try harder
    filled = {f: 0 for f in SCRAPED_FIELDS}
    processed = 0
    if incompletePath.exists():
        with open(incompletePath, "r", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for inc in reader:
                processed += 1
                name = inc.get("name")
                target = byName.get(name)
                if target is None:
                    logging.warning(f"  {name}: present in incomplete CSV but not in main, skipping")
                    continue

                gathered = {}
                htmlInfo = _fallbackFromHtml(inc.get("raw_html") or "")
                textInfo = _fallbackFromText(inc.get("raw_text") or "")
                for src in (htmlInfo, textInfo):
                    for k, v in src.items():
                        if v is not None and not gathered.get(k):
                            gathered[k] = v

                changed = []
                for k, v in gathered.items():
                    if v is None or v == "":
                        continue
                    if target.get(k) in (None, ""):
                        target[k] = v if k != "points" else str(v)
                        filled[k] += 1
                        changed.append(f"{k}={v!r}")
                if changed:
                    logging.info(f"  {name}: filled {', '.join(changed)}")
        logging.info(f"Processed {processed} incomplete rows")
    else:
        logging.warning(f"Incomplete CSV not found at {incompletePath} — nothing to merge")

    # Stats
    stillMissing = 0
    for r in mainRows:
        if any(not r.get(f) for f in SCRAPED_FIELDS):
            stillMissing += 1

    outputPath.parent.mkdir(parents=True, exist_ok=True)
    with open(outputPath, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=CSV_FIELDS, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(mainRows)

    logging.info(f"Wrote merged CSV to {outputPath}")
    logging.info(f"Per-field fills from fallback: {filled}")
    logging.info(f"Rows still missing at least one field: {stillMissing}/{len(mainRows)}")


def getArgs():
    p = argparse.ArgumentParser(description="Merge incomplete-row fallback extractions into the main CSV")
    p.add_argument("-main", "--mainCsv", required=True, help="Main scraped CSV (e.g. migrations/invaders_new.csv)")
    p.add_argument("-incomplete", "--incompleteCsv", required=True, help="Incomplete CSV with raw_text/raw_html columns")
    p.add_argument("-o", "--output", required=True, help="Output merged CSV path")
    return p.parse_args()


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
    args = getArgs()
    merge(Path(args.mainCsv), Path(args.incompleteCsv), Path(args.output))
