"""Canonical invader states and conversion from invader-spotter.art's French labels."""
from typing import Optional

# Valid state values — must match the frontend STATE_OPTIONS list
VALID_STATES = {
    "Good",
    "Slightly degraded",
    "Degraded",
    "Badly degraded",
    "Destroyed",
    "Not visible",
    "Unknown",
}

# Maps invader-spotter.art French values to canonical English states.
# Prefix matches are used for entries like "Détruit !Instagram: ..." and "OKInstagram: ..."
STATE_MAP = [
    ("OK",              "Good"),
    ("Un peu dégradé",  "Slightly degraded"),
    ("Dégradé",         "Degraded"),
    ("Très dégradé",    "Badly degraded"),
    ("Détruit !",       "Destroyed"),
    ("Détruit",         "Destroyed"),
    ("Non visible",     "Not visible"),
    ("Inconnu",         "Unknown"),
]

# Legacy lowercase values that were stored in the DB before the rename — map to new canonical
LEGACY_LOWERCASE_MAP = {
    "pristine": "Good",
    "slightly degraded": "Slightly degraded",
    "degraded": "Degraded",
    "badly degraded": "Badly degraded",
    "destroyed": "Destroyed",
    "not visible": "Not visible",
}


def normalize_state(raw: str) -> Optional[str]:
    """Convert any state value (French scraped label / legacy lowercase / already-canonical)
    to the canonical capitalized state, or None if unknown."""
    raw = raw.strip()
    if raw in VALID_STATES:
        return raw
    if raw.lower() in LEGACY_LOWERCASE_MAP:
        return LEGACY_LOWERCASE_MAP[raw.lower()]
    for prefix, canonical in STATE_MAP:
        if raw.startswith(prefix):
            return canonical
    return None
