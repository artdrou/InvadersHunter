"""
Which deployment (development / staging / production) a request reached,
from its Host header. The three Railway backends each have their own database,
but those databases were all copied from one original — so per-device data
(push tokens) must be checked against the app that actually talks to us.
"""
from typing import Optional

ENVIRONMENTS = ("development", "staging", "production")


def environment_for_host(host: Optional[str]) -> Optional[str]:
    """`invader-hunter-staging.up.railway.app` → "staging". None for anything
    else (localhost, tests): no check is possible there."""
    if not host:
        return None
    name = host.split(":")[0].split(".")[0].lower()
    for env in ENVIRONMENTS:
        if name.endswith(f"-{env}"):
            return env
    return None
