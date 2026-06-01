# PD-492 Restore Trace Log — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore the clinic Trace Log by time-windowing the Langfuse query (kills the 10s timeout) and filtering by the clinic's real `clinic_id` tag resolved server-side (survives PD-491's id-based URLs).

**Architecture:** Backend-only change in `hub/api.py::get_clinic_traces`. The pure query-param logic (tag, default `fromTimestamp` window, limit cap) is extracted into a new dependency-free module `hub/traces_query.py` so it is unit-testable without importing `hub.db` (which raises when `HUB_DATABASE_URL` is unset). The endpoint resolves the clinic via `get_clinic(id)` and filters Langfuse by `clinic["clinic_id"]`.

**Tech Stack:** Python 3.12, FastAPI, httpx, pytest 9. Langfuse v3 public API.

**Spec:** `docs/superpowers/specs/2026-06-01-pd-492-trace-log-restore-design.md`

**Pre-existing environment note:** `hub/test_sync_prompts.py` fails on this Windows host with a cp1251 `UnicodeDecodeError` (it opens a prompt `.md` without `encoding='utf-8'`). That is unrelated to this work — do not try to "fix" it here. The new test in this plan reads no files and must pass independently.

---

### Task 1: Pure query-param builder + unit tests

**Files:**
- Create: `hub/traces_query.py`
- Create: `hub/test_traces_query.py`

- [ ] **Step 1: Write the failing tests**

Create `hub/test_traces_query.py`:

```python
from datetime import datetime, timezone

from traces_query import build_traces_params, DEFAULT_TRACE_WINDOW_DAYS

NOW = datetime(2026, 6, 1, 12, 0, 0, tzinfo=timezone.utc)


def test_window_constant_is_seven_days():
    assert DEFAULT_TRACE_WINDOW_DAYS == 7


def test_filters_by_given_tag():
    params = build_traces_params("trent", since="", limit=10, now=NOW)
    assert params["tags"] == "trent"


def test_defaults_fromtimestamp_to_window_before_now():
    params = build_traces_params("trent", since="", limit=10, now=NOW)
    # 7 days before NOW
    assert params["fromTimestamp"] == "2026-05-25T12:00:00+00:00"


def test_explicit_since_overrides_default_window():
    params = build_traces_params("trent", since="2026-01-02T03:04:05Z", limit=10, now=NOW)
    assert params["fromTimestamp"] == "2026-01-02T03:04:05Z"


def test_limit_is_capped_at_100():
    assert build_traces_params("t", since="", limit=500, now=NOW)["limit"] == 100
    assert build_traces_params("t", since="", limit=10, now=NOW)["limit"] == 10
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd hub && python -m pytest test_traces_query.py -q`
Expected: FAIL — `ModuleNotFoundError: No module named 'traces_query'`.

- [ ] **Step 3: Implement the pure module**

Create `hub/traces_query.py`:

```python
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd hub && python -m pytest test_traces_query.py -q`
Expected: PASS — 5 passed.

- [ ] **Step 5: Commit**

```bash
git add hub/traces_query.py hub/test_traces_query.py
git commit -m "feat(hub): pure Langfuse traces query-param builder + tests (PD-492)"
```

---

### Task 2: Wire the traces endpoint to resolve clinic + window the query

**Files:**
- Modify: `hub/api.py` (function `get_clinic_traces`, currently around lines 340–380; import near line 18)

- [ ] **Step 1: Import the helper**

In `hub/api.py`, just after the existing `from hub.db import ...` line (line 18), add:

```python
from hub.traces_query import build_traces_params
```

(`datetime` and `timezone` are already imported on line 8; no other import change is needed.)

- [ ] **Step 2: Replace the body of `get_clinic_traces`**

Current code (around lines 340–380):

```python
@app.get("/api/clinics/{clinic_id}/traces")
async def get_clinic_traces(clinic_id: str, limit: int = 30, since: str = "", user=Depends(verify_github_token)):
    """Fetch recent traces for a clinic from Langfuse."""
    lf_pk = os.environ.get("LANGFUSE_PUBLIC_KEY", "")
    lf_sk = os.environ.get("LANGFUSE_SECRET_KEY", "")
    lf_host = os.environ.get("LANGFUSE_HOST", "http://localhost:3000")
    if not lf_pk or not lf_sk:
        return {"traces": [], "error": "Langfuse keys not configured"}

    try:
        params = {"limit": min(limit, 100), "tags": clinic_id}
        if since:
            params["fromTimestamp"] = since

        r = await _http_client.get(
            f"{lf_host}/api/public/traces",
            params=params,
            auth=(lf_pk, lf_sk),
            timeout=10,
        )
        data = r.json()
```

Replace it with (only the marked lines change — clinic resolution, and the `params=` source):

```python
@app.get("/api/clinics/{clinic_id}/traces")
async def get_clinic_traces(clinic_id: str, limit: int = 30, since: str = "", user=Depends(verify_github_token)):
    """Fetch recent traces for a clinic from Langfuse."""
    clinic = await get_clinic(clinic_id)
    if not clinic:
        raise HTTPException(404)
    lf_pk = os.environ.get("LANGFUSE_PUBLIC_KEY", "")
    lf_sk = os.environ.get("LANGFUSE_SECRET_KEY", "")
    lf_host = os.environ.get("LANGFUSE_HOST", "http://localhost:3000")
    if not lf_pk or not lf_sk:
        return {"traces": [], "error": "Langfuse keys not configured"}

    try:
        params = build_traces_params(
            clinic["clinic_id"], since, limit, datetime.now(timezone.utc)
        )

        r = await _http_client.get(
            f"{lf_host}/api/public/traces",
            params=params,
            auth=(lf_pk, lf_sk),
            timeout=10,
        )
        data = r.json()
```

Leave everything below `data = r.json()` (the trace mapping loop and `except` block) unchanged.

- [ ] **Step 3: Sanity-check imports compile**

Run: `cd hub && python -c "import ast; ast.parse(open('api.py',encoding='utf-8').read()); ast.parse(open('traces_query.py',encoding='utf-8').read()); print('parse-ok')"`
Expected: `parse-ok`. (A full `import hub.api` needs `HUB_DATABASE_URL`; an AST parse confirms there is no syntax error without requiring env/DB.)

- [ ] **Step 4: Re-run the unit tests**

Run: `cd hub && python -m pytest test_traces_query.py -q`
Expected: PASS — 5 passed. (Endpoint logic now delegates to the tested helper.)

- [ ] **Step 5: Commit**

```bash
git add hub/api.py
git commit -m "fix(hub): trace log — resolve clinic_id tag + default 7d window (PD-492)"
```

---

### Task 3: Verify against production Langfuse

**Files:** none (verification against the running Hub / deployed branch)

The windowed query is already proven against prod (with `fromTimestamp` = now−2d the
endpoint returns 200 + 10 real traces in ~1s; full-history times out at ~10.7s). After the
change is deployed (or run locally with `HUB_DATABASE_URL` + Langfuse env), confirm the
end-to-end UI.

- [ ] **Step 1: API contract (authenticated)**

`GET /api/clinics/starsmile_prod/traces?limit=10` (the post-PD-491 id-based URL).
Expected: **200**, non-empty `traces`, each with `tags` including `trent` and a numeric
`latency` (seconds). Confirms server-side tag resolution: the URL carries the hub `id`
(`starsmile_prod`) but results are the `trent`-tagged traces.

- [ ] **Step 2: UI smoke**

Open the clinic visualizer → click **Trace Log**. Expected: rows appear (agent, time,
`…ms` latency); expanding a row shows step input/output; **no** "No traces yet" for an
active clinic.

- [ ] **Step 3: Regression — unknown clinic**

`GET /api/clinics/does-not-exist/traces` → **404** (was previously an empty 200).

---

## Self-Review

**Spec coverage:**
- Performance fix (default 7d `fromTimestamp` window) → Task 1 helper + Task 2 wiring ✓
- Robustness (resolve clinic via `get_clinic`, filter by `clinic["clinic_id"]`) → Task 2 ✓
- `DEFAULT_TRACE_WINDOW_DAYS = 7` → Task 1 ✓
- 404 on unknown clinic → Task 2 + Task 3 Step 3 ✓
- No frontend change → honored (only `hub/` touched) ✓
- Out-of-scope (trace detail, deeper pagination, frontend) → not included ✓

**Placeholder scan:** No TBD/TODO; full code in every code step; exact commands with expected output. ✓

**Type consistency:** `build_traces_params(tag, since, limit, now)` signature identical in the module, the tests, and the endpoint call. `DEFAULT_TRACE_WINDOW_DAYS` named consistently. Endpoint passes `clinic["clinic_id"]` as `tag` and `datetime.now(timezone.utc)` as `now`. ✓
