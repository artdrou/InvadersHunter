"""
Auto-moderation of user-generated text via the OpenAI Moderation API
(`omni-moderation-latest` — free endpoint, multilingual incl. French).

Design decisions (2026-07-10):
- flagged        → comment stored as "hidden" + admin queue
- not flagged    → "visible"
- API unreachable / no key → returns None; callers must NEVER block the user
  on a third-party outage (comment stored as "pending_review" instead).
"""
import os
from typing import List, NamedTuple, Optional

import requests

OPENAI_MODERATION_URL = "https://api.openai.com/v1/moderations"
MODERATION_MODEL = "omni-moderation-latest"
TIMEOUT_SECONDS = 8


class ModerationResult(NamedTuple):
    flagged: bool
    categories: List[str]


def check_text(text: str) -> Optional[ModerationResult]:
    """Run `text` through the OpenAI moderation endpoint.

    Returns None when moderation is unavailable (missing OPENAI_API_KEY,
    network error, unexpected payload) — never raises.
    """
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        return None
    try:
        resp = requests.post(
            OPENAI_MODERATION_URL,
            json={"model": MODERATION_MODEL, "input": text},
            headers={"Authorization": f"Bearer {api_key}"},
            timeout=TIMEOUT_SECONDS,
        )
        resp.raise_for_status()
        result = resp.json()["results"][0]
        categories = [name for name, fired in result["categories"].items() if fired]
        return ModerationResult(flagged=bool(result["flagged"]), categories=categories)
    except Exception:
        return None
