"""Pure helpers for building Langfuse trace-list query params.

Kept dependency-free (stdlib only) so it is unit-testable without importing
hub.db / hub.auth, which require env vars at import time.
"""
from datetime import datetime, timedelta

DEFAULT_TRACE_WINDOW_DAYS = 7


def build_traces_params(tag: str, since: str, limit: int, now: datetime) -> dict:
    """Build query params for Langfuse GET /api/public/traces.

    - tags: the clinic's dental-core clinic_id (what the agent writes to Langfuse).
    - fromTimestamp: explicit `since` if provided, else now - DEFAULT_TRACE_WINDOW_DAYS
      (bounds the scan so the query stays well under the request timeout).
    - limit: capped at 100 (Langfuse page size).
    """
    from_ts = since or (now - timedelta(days=DEFAULT_TRACE_WINDOW_DAYS)).isoformat()
    return {"limit": min(limit, 100), "tags": tag, "fromTimestamp": from_ts}
