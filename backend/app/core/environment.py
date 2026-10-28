"""
Which deployment (development / staging / production) a request reached,
from its Host header. The three Railway backends each have their own database,
but those databases were all copied from one original — so per-device data
(push tokens) must be checked against the app that actually talks to us.
"""
from typing import Optional

ENVIRONMENTS = ("development", "staging", "production")
# Custom domains in front of the production backend (Cloudflare DNS → Railway)
PUBLIC_DOMAINS = ("hintvaders.app", "www.hintvaders.app")


def environment_for_host(host: Optional[str]) -> Optional[str]:
    """`invader-hunter-staging.up.railway.app` → "staging", hintvaders.app →
    "production". None for anything else (localhost, tests): no check is
    possible there."""
    if not host:
        return None
    if host.split(":")[0].lower() in PUBLIC_DOMAINS:
        return "production"
    name = host.split(":")[0].split(".")[0].lower()
    for env in ENVIRONMENTS:
        if name.endswith(f"-{env}"):
            return env
    return None
