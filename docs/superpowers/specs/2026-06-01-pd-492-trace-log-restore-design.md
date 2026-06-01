---
date: 2026-06-01
jira: PD-492
status: design-approved
tags: [bugfix, hub-api, traces, langfuse, performance]
---

# PD-492 — Restore trace log

## Problem

The clinic visualizer's **Trace Log** ("раньше отображалось по миллисекундам") no longer
shows anything. The panel stays empty / "No traces yet" for active clinics.

## Root cause (verified live)

The hub endpoint `GET /api/clinics/{clinic_id}/traces` (`hub/api.py`,
`get_clinic_traces`) proxies Langfuse `GET /api/public/traces`, filtered by
`tags = <url param>`, over the **entire trace history**, with a hard **10s** httpx
timeout. For a busy clinic this Langfuse v3 query (which computes per-trace
latency/cost) takes **> 10s**, so it times out and the handler returns
`{traces: [], error: "Failed to fetch traces"}` → empty log.

Measured against production (clinic `trent`):

| Query | Time | Result |
|---|---|---|
| no `fromTimestamp` (full history), `limit=10` | **10708 ms** | timeout → error, 0 traces |
| `fromTimestamp` = now − 2d, `limit=10` | **1054 ms** | 200, 10 traces (real `latency`) |
| `fromTimestamp` = now − 30d, `limit=50` | **5059 ms** | 200, 50 traces |

The slowness scales with the time window scanned; any reasonable `fromTimestamp`
keeps the query well under the timeout. Trace objects carry `latency` in **seconds**;
the frontend renders `Math.round(latency * 1000)` ms — matching the original behavior.

### Secondary issue — identifier mismatch (PD-491 interaction)

The Langfuse trace tag is the **dental-core `CLINIC_ID`** (dental-core
`agent/graph.py` sets `langfuse_tags = [clinic.clinic_id, channel, env:…]`). For Trent
that tag is `trent`, which equals the hub `clinic_id` column — **not** the hub `id`
(`starsmile_prod`). The traces endpoint currently filters by the raw URL param:

- Today the URL carries `clinic_id` (`trent`) → tag matches (once the timeout is fixed).
- After **PD-491** the URL carries the hub `id` (`starsmile_prod`) → tag `starsmile_prod`
  does **not** match `trent` → trace log silently returns 0 again.

So a durable fix must resolve the clinic and filter by its `clinic_id` field, not by the
raw URL param.

## Decision

**Backend-only fix** in `get_clinic_traces`, two parts:

1. **Performance:** when the caller does not pass `since`, default
   `fromTimestamp = now_utc − DEFAULT_TRACE_WINDOW_DAYS` (7 days). An explicit `since`
   still overrides.
2. **Robustness:** resolve `clinic = await get_clinic(clinic_id)` (404 if missing) and
   filter Langfuse by `clinic["clinic_id"]` instead of the raw URL param. Correct whether
   the URL carries `id` or `clinic_id`; survives PD-491.

Window default = **7 days** (≈1–2s queries; best speed/coverage balance for a live
recent-activity log). `DEFAULT_TRACE_WINDOW_DAYS = 7` constant.

Rejected alternatives:
- **Only bump the timeout** — full-history query can take 30s+; slow UX and still fragile
  as volume grows. The window addresses the actual cost.
- **Only add the window (keep raw-param tag)** — restores the log today but PD-491's
  `id`-based URLs re-break it.

## Changes

`hub/api.py` — `get_clinic_traces` only:

```python
DEFAULT_TRACE_WINDOW_DAYS = 7  # module-level constant

async def get_clinic_traces(clinic_id: str, limit: int = 30, since: str = "", user=Depends(verify_github_token)):
    clinic = await get_clinic(clinic_id)
    if not clinic:
        raise HTTPException(404)
    lf_pk = os.environ.get("LANGFUSE_PUBLIC_KEY", "")
    lf_sk = os.environ.get("LANGFUSE_SECRET_KEY", "")
    lf_host = os.environ.get("LANGFUSE_HOST", "http://localhost:3000")
    if not lf_pk or not lf_sk:
        return {"traces": [], "error": "Langfuse keys not configured"}
    try:
        params = {"limit": min(limit, 100), "tags": clinic["clinic_id"]}
        params["fromTimestamp"] = since or (
            datetime.now(timezone.utc) - timedelta(days=DEFAULT_TRACE_WINDOW_DAYS)
        ).isoformat()
        # ... existing Langfuse GET + response mapping unchanged ...
```

No frontend change: `TraceLog` and `ClinicVisualizerTab` already call
`tracesApi.list(clinicId, undefined, limit)`; the backend now defaults the window and
resolves the tag. "Load more" keeps growing `limit` within the window.

## Data flow

`TraceLog` / `ClinicVisualizerTab` → `GET /api/clinics/{id}/traces?limit=N`
→ `get_clinic(id)` → Langfuse `traces?tags={clinic_id}&fromTimestamp={now−7d}&limit=N`
→ list with `latency` (seconds) → frontend renders `×1000` ms.

## Error handling

- Unknown clinic → `404` (new; previously returned empty).
- Missing Langfuse keys → `{traces: [], error: "Langfuse keys not configured"}` (unchanged).
- Langfuse failure/timeout → `{traces: [], error: "Failed to fetch traces"}` (unchanged).
- Timeout stays 10s; windowed query is ~1–2s.

## Testing

- Unit test `get_clinic_traces` with `get_clinic` and the Langfuse HTTP client mocked:
  - asserts outgoing Langfuse params use `tags == clinic["clinic_id"]` (not the URL param)
    and include a `fromTimestamp` ≈ 7 days before now;
  - asserts an explicit `since` overrides the default window;
  - asserts unknown clinic → 404.
- Live behavior already proven (windowed prod query → 200 + real traces in ~1s).
- Post-deploy UI smoke: open a clinic's Trace Log → rows appear with `…ms` latency.

## Out of scope

- Trace **detail** endpoint (`/traces/{trace_id}`) — works by `trace_id`, no tag.
- Deeper Langfuse pagination beyond the default window (frontend grows `limit`, capped 100).
- Any frontend redesign.
