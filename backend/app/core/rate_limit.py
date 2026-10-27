"""
In-memory sliding-window rate limits, per key (user id, IP…). One backend instance,
so a restart forgets them — enough to stop spam from one account, not a substitute
for the API-wide limits planned in issue #61.
"""
import time
from collections import defaultdict, deque


class RateLimited(Exception): ...


class SlidingWindowLimiter:
    """At most `max_hits` per `window_s` seconds for each key."""

    def __init__(self, max_hits: int, window_s: float):
        self.max_hits = max_hits
        self.window_s = window_s
        self._hits: dict[str, deque] = defaultdict(deque)

    def hit(self, key: str) -> None:
        """Count one hit for `key`; raise RateLimited (without counting it) when over the limit."""
        now = time.monotonic()
        hits = self._hits[key]
        while hits and now - hits[0] > self.window_s:
            hits.popleft()
        if len(hits) >= self.max_hits:
            raise RateLimited()
        hits.append(now)

    def clear(self) -> None:
        self._hits.clear()
