"""
Auto-moderation of user-generated text via the OpenAI Moderation API
(`omni-moderation-latest` — free endpoint, multilingual incl. French).

Design decisions (2026-07-10):
- flagged        → comment stored as "hidden" + admin queue
- not flagged    → "visible"
- API unreachable / no key → returns None; callers must NEVER block the user
  on a third-party outage (comment stored as "pending_review" instead).
"""
import logging
import os
from typing import List, NamedTuple, Optional

import requests

log = logging.getLogger("moderation")

OPENAI_MODERATION_URL = "https://api.openai.com/v1/moderations"
MODERATION_MODEL = "omni-moderation-latest"
TIMEOUT_SECONDS = 8


class ModerationResult(NamedTuple):
    flagged: bool
    categories: List[str]


def check_text(text: str) -> Optional[ModerationResult]:
    """Run `text` through the OpenAI moderation endpoint.

    Returns None when moderation is unavailable (missing OPENAI_API_KEY,
    network error, unexpected payload) — never raises. Logs the reason so a
    silent slide to "pending_review" is diagnosable from the server logs
    (e.g. a 429 means the OpenAI account has no billing/credit set up — the
    moderation call itself is free but the API requires an activated account).
    """
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        log.warning("OPENAI_API_KEY not set — comments stored as pending_review")
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
    except requests.HTTPError as exc:
        # Surface OpenAI's status + body (401 = bad key, 429 = quota/billing, …).
        # Never logs the Authorization header, so the key stays out of the logs.
        status = exc.response.status_code if exc.response is not None else "?"
        body = exc.response.text[:300] if exc.response is not None else ""
        log.warning("OpenAI moderation HTTP %s: %s — comment pending_review", status, body)
        return None
    except Exception as exc:
        log.warning("OpenAI moderation call failed (%r) — comment pending_review", exc)
        return None
