# PD-468: Confirmation Schedule Live Update — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `PUT /admin/api/settings/confirmation-schedule` to dental-core so the admin panel can update confirmation reminder hours at runtime without restarting the container, and add the corresponding proxy in dental-hub.

**Architecture:** dental-core stores the `ConfirmationConfig` object in `app.state` at startup. The new PUT endpoint validates the incoming `schedule_hours`, mutates the in-memory config. The confirmation scheduler already reads `config.schedule_hours` on each tick, so changes take effect immediately. dental-hub proxies the request through `_proxy_to_clinic` with `X-Hub-Secret` auth (core treats hub as `superadmin`).

**Tech Stack:** Python 3.12, FastAPI, Pydantic, pytest

**Spec:** `docs/specs/2026-05-27-PD-468-confirmation-schedule-live-update-design.md`

---

## File Map

| # | Repo | File | Action | Responsibility |
|---|------|------|--------|----------------|
| 1 | dental-core | `agent/api.py` | Modify (lines 252-263) | Store `confirm_config` in `app.state.confirmation_config` |
| 2 | dental-core | `agent/admin/settings.py` | Modify (append) | New `PUT /confirmation-schedule` handler |
| 3 | dental-core | `agent/tests/test_confirmation_schedule_api.py` | Create | Tests for the new endpoint |
| 4 | dental-hub | `hub/api.py` | Modify (after line 906) | Proxy handler `admin_update_confirmation_schedule` |

---

### Task 1: Store ConfirmationConfig in app.state (dental-core)

**Files:**
- Modify: `dental-core/agent/api.py:252-263`

**Context:** Currently `confirm_config` is a local variable in the `lifespan` function. The scheduler receives a reference to this object and checks `config.schedule_hours` each tick. But nothing else can access it. We need to store the same object in `app.state` so the PUT endpoint can mutate it.

- [ ] **Step 1: Add `app.state.confirmation_config` assignment in lifespan**

In `agent/api.py`, find the block (lines 252-263):

```python
        # Start confirmation scheduler if enabled
        if cfg.confirmation_enabled:
            confirm_config = ConfirmationConfig(
                enabled=cfg.confirmation_enabled,
                schedule_hours=cfg.confirmation_schedule_hours,
                interval_minutes=cfg.confirmation_interval_minutes,
                advance_days=cfg.confirmation_advance_days,
                message_template=cfg.confirmation_message_template,
                quiet_hours_start=cfg.confirmation_quiet_hours_start,
                quiet_hours_end=cfg.confirmation_quiet_hours_end,
            )
            start_confirmation_scheduler(clinic_id, confirm_config)
            print(f"[STARTUP] Confirmation scheduler started for {clinic_id}", flush=True)
```

Replace with:

```python
        # Start confirmation scheduler if enabled
        if cfg.confirmation_enabled:
            confirm_config = ConfirmationConfig(
                enabled=cfg.confirmation_enabled,
                schedule_hours=cfg.confirmation_schedule_hours,
                interval_minutes=cfg.confirmation_interval_minutes,
                advance_days=cfg.confirmation_advance_days,
                message_template=cfg.confirmation_message_template,
                quiet_hours_start=cfg.confirmation_quiet_hours_start,
                quiet_hours_end=cfg.confirmation_quiet_hours_end,
            )
            app.state.confirmation_config = confirm_config
            start_confirmation_scheduler(clinic_id, confirm_config)
            print(f"[STARTUP] Confirmation scheduler started for {clinic_id}", flush=True)
        else:
            app.state.confirmation_config = None
```

The key addition is `app.state.confirmation_config = confirm_config` (same object reference the scheduler holds) and the `else` branch setting it to `None` (used by the endpoint to return 409 when confirmations are disabled).

- [ ] **Step 2: Commit**

```bash
cd dental-core
git add agent/api.py
git commit -m "feat(PD-468): store ConfirmationConfig in app.state for live updates"
```

---

### Task 2: Add PUT /confirmation-schedule endpoint (dental-core)

**Files:**
- Modify: `dental-core/agent/admin/settings.py` (append after line 143)

**Context:** The settings router is mounted at `/admin/api/settings` (via `admin/__init__.py` prefix `/admin/api` + `settings.py` prefix `/settings`). Auth: `require_role("admin", "superadmin")` — same pattern as `toggle_bot`. Hub proxy sends `X-Hub-Secret` header which `get_current_user` translates to `role="superadmin"`, so `require_role` passes.

- [ ] **Step 1: Add the Pydantic model and handler**

Append to the end of `agent/admin/settings.py` (after line 143):

```python


class ConfirmationScheduleUpdate(BaseModel):
    schedule_hours: list[int]


@router.put("/confirmation-schedule")
async def update_confirmation_schedule(
    req: ConfirmationScheduleUpdate,
    request: Request,
    user: UserInfo = Depends(require_role("admin", "superadmin")),
):
    """Update confirmation reminder schedule at runtime (no restart needed)."""
    config = getattr(request.app.state, "confirmation_config", None)
    if config is None:
        raise HTTPException(
            status_code=409,
            detail="Confirmation scheduler disabled for this clinic",
        )

    if len(req.schedule_hours) == 0:
        raise HTTPException(status_code=422, detail="schedule_hours не может быть пустым")

    for h in req.schedule_hours:
        if h < 0 or h > 23:
            raise HTTPException(status_code=422, detail="Каждый час должен быть от 0 до 23")

    hours = sorted(set(req.schedule_hours))
    config.schedule_hours = hours

    logger.info("Confirmation schedule updated by %s: %s", user.username, hours)
    return {"success": True, "schedule_hours": hours}
```

- [ ] **Step 2: Add missing imports**

At the top of `agent/admin/settings.py`, add `Request` to the fastapi import and add `logging`:

Current line 2-3:
```python
import os
from fastapi import APIRouter, Depends, HTTPException, Query
```

Change to:
```python
import logging
import os
from fastapi import APIRouter, Depends, HTTPException, Query, Request
```

And add after `router = APIRouter(...)` (line 9):

```python
logger = logging.getLogger(__name__)
```

- [ ] **Step 3: Commit**

```bash
cd dental-core
git add agent/admin/settings.py
git commit -m "feat(PD-468): add PUT /confirmation-schedule endpoint with validation"
```

---

### Task 3: Tests for the new endpoint (dental-core)

**Files:**
- Create: `dental-core/agent/tests/test_confirmation_schedule_api.py`

**Context:** Follow the pattern from `test_admin_api.py`: use `_patch_startup` fixture to prevent full app startup, `TestClient(app)` for sync tests, and `create_token` to generate JWT tokens. The endpoint reads from `app.state.confirmation_config`, so we need to set that in tests. Hub auth works via `X-Hub-Secret` header (tested separately). The `require_role` check is standard — operator gets 403, admin/superadmin get through.

- [ ] **Step 1: Write the test file**

Create `agent/tests/test_confirmation_schedule_api.py`:

```python
"""Tests for PUT /admin/api/settings/confirmation-schedule."""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import pytest
from unittest.mock import patch, AsyncMock
from fastapi.testclient import TestClient
from admin.auth import create_token
from agents.confirmation import ConfirmationConfig


@pytest.fixture
def _patch_startup():
    """Prevent full app startup (DB, CRM, etc.)."""
    with patch("db.migrate.run_migrations", new_callable=AsyncMock), \
         patch("db.connection.close_pool", new_callable=AsyncMock), \
         patch("graph._init_checkpointer", new_callable=AsyncMock), \
         patch("config.load_prompts"), \
         patch("clinic_loader.list_clinics", return_value=[]):
        yield


@pytest.fixture
def client(_patch_startup):
    from api import app
    with TestClient(app) as c:
        yield c


@pytest.fixture
def app_instance(_patch_startup):
    from api import app
    return app


def _admin_token():
    return create_token(user_id="u1", clinic_id="test", role="admin")


def _operator_token():
    return create_token(user_id="u2", clinic_id="test", role="operator")


def _auth(token):
    return {"Authorization": f"Bearer {token}"}


class TestConfirmationScheduleUpdate:
    """PUT /admin/api/settings/confirmation-schedule."""

    def test_200_dedup_and_sort(self, client, app_instance):
        app_instance.state.confirmation_config = ConfirmationConfig(enabled=True)
        resp = client.put(
            "/admin/api/settings/confirmation-schedule",
            json={"schedule_hours": [17, 9, 9]},
            headers=_auth(_admin_token()),
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["success"] is True
        assert data["schedule_hours"] == [9, 17]

    def test_side_effect_updates_config(self, client, app_instance):
        config = ConfirmationConfig(enabled=True, schedule_hours=[11, 17])
        app_instance.state.confirmation_config = config
        client.put(
            "/admin/api/settings/confirmation-schedule",
            json={"schedule_hours": [8, 14, 20]},
            headers=_auth(_admin_token()),
        )
        assert config.schedule_hours == [8, 14, 20]

    def test_422_empty_list(self, client, app_instance):
        app_instance.state.confirmation_config = ConfirmationConfig(enabled=True)
        resp = client.put(
            "/admin/api/settings/confirmation-schedule",
            json={"schedule_hours": []},
            headers=_auth(_admin_token()),
        )
        assert resp.status_code == 422
        assert "пустым" in resp.json()["detail"]

    def test_422_hour_out_of_range(self, client, app_instance):
        app_instance.state.confirmation_config = ConfirmationConfig(enabled=True)
        resp = client.put(
            "/admin/api/settings/confirmation-schedule",
            json={"schedule_hours": [9, 25]},
            headers=_auth(_admin_token()),
        )
        assert resp.status_code == 422
        assert "0 до 23" in resp.json()["detail"]

    def test_422_negative_hour(self, client, app_instance):
        app_instance.state.confirmation_config = ConfirmationConfig(enabled=True)
        resp = client.put(
            "/admin/api/settings/confirmation-schedule",
            json={"schedule_hours": [-1, 9]},
            headers=_auth(_admin_token()),
        )
        assert resp.status_code == 422

    def test_422_invalid_type(self, client, app_instance):
        app_instance.state.confirmation_config = ConfirmationConfig(enabled=True)
        resp = client.put(
            "/admin/api/settings/confirmation-schedule",
            json={"schedule_hours": "not-a-list"},
            headers=_auth(_admin_token()),
        )
        assert resp.status_code == 422

    def test_403_operator_role(self, client, app_instance):
        app_instance.state.confirmation_config = ConfirmationConfig(enabled=True)
        resp = client.put(
            "/admin/api/settings/confirmation-schedule",
            json={"schedule_hours": [9, 17]},
            headers=_auth(_operator_token()),
        )
        assert resp.status_code == 403

    def test_401_no_auth(self, client, app_instance):
        app_instance.state.confirmation_config = ConfirmationConfig(enabled=True)
        resp = client.put(
            "/admin/api/settings/confirmation-schedule",
            json={"schedule_hours": [9, 17]},
        )
        assert resp.status_code == 401

    def test_409_confirmation_disabled(self, client, app_instance):
        app_instance.state.confirmation_config = None
        resp = client.put(
            "/admin/api/settings/confirmation-schedule",
            json={"schedule_hours": [9, 17]},
            headers=_auth(_admin_token()),
        )
        assert resp.status_code == 409
        assert "disabled" in resp.json()["detail"]

    def test_superadmin_allowed(self, client, app_instance):
        app_instance.state.confirmation_config = ConfirmationConfig(enabled=True)
        token = create_token(user_id="u3", clinic_id="test", role="superadmin")
        resp = client.put(
            "/admin/api/settings/confirmation-schedule",
            json={"schedule_hours": [10]},
            headers=_auth(token),
        )
        assert resp.status_code == 200
        assert resp.json()["schedule_hours"] == [10]

    def test_single_hour(self, client, app_instance):
        app_instance.state.confirmation_config = ConfirmationConfig(enabled=True)
        resp = client.put(
            "/admin/api/settings/confirmation-schedule",
            json={"schedule_hours": [0]},
            headers=_auth(_admin_token()),
        )
        assert resp.status_code == 200
        assert resp.json()["schedule_hours"] == [0]

    def test_all_24_hours(self, client, app_instance):
        app_instance.state.confirmation_config = ConfirmationConfig(enabled=True)
        resp = client.put(
            "/admin/api/settings/confirmation-schedule",
            json={"schedule_hours": list(range(24))},
            headers=_auth(_admin_token()),
        )
        assert resp.status_code == 200
        assert resp.json()["schedule_hours"] == list(range(24))
```

- [ ] **Step 2: Run the tests**

```bash
cd dental-core/agent
python -m pytest tests/test_confirmation_schedule_api.py -v
```

Expected: all 12 tests pass.

- [ ] **Step 3: Commit**

```bash
cd dental-core
git add agent/tests/test_confirmation_schedule_api.py
git commit -m "test(PD-468): add tests for confirmation schedule update endpoint"
```

---

### Task 4: Add proxy in dental-hub

**Files:**
- Modify: `dental-hub/hub/api.py` (after line 906)

**Context:** Follow the exact pattern of `admin_bot_toggle` (line 896-900). The hub's `_proxy_to_clinic` sends `X-Hub-Secret` header. dental-core's `get_current_user` recognizes this and returns `role="superadmin"`, which passes `require_role("admin", "superadmin")`.

- [ ] **Step 1: Add the proxy handler**

In `hub/api.py`, find (lines 903-907):

```python
@app.get("/admin/api/settings/clinic")
async def admin_clinic_settings(admin_user=Depends(_get_admin_user)):
    clinic = await _get_clinic_for_admin(admin_user)
    return await _proxy_to_clinic(clinic, "GET", "/admin/api/settings/clinic")


# --- Blocklist ---
```

Insert between the `admin_clinic_settings` handler and the `# --- Blocklist ---` comment:

```python

@app.put("/admin/api/settings/confirmation-schedule")
async def admin_update_confirmation_schedule(request: Request, admin_user=Depends(_get_admin_user)):
    clinic = await _get_clinic_for_admin(admin_user)
    body = await request.json()
    return await _proxy_to_clinic(clinic, "PUT", "/admin/api/settings/confirmation-schedule", body=body)

```

- [ ] **Step 2: Verify `Request` is already imported**

`Request` is already imported in `hub/api.py` (used by other handlers like `admin_bot_toggle`). No new imports needed.

- [ ] **Step 3: Commit**

```bash
cd dental-hub
git add hub/api.py
git commit -m "feat(PD-468): add proxy for PUT /admin/api/settings/confirmation-schedule"
```

---

## Verification

After all tasks are complete:

1. **Run dental-core tests:**
   ```bash
   cd dental-core/agent && python -m pytest tests/test_confirmation_schedule_api.py tests/test_admin_api.py -v
   ```
   Expected: all tests green, no regressions in existing admin tests.

2. **Run full dental-core test suite:**
   ```bash
   cd dental-core/agent && python -m pytest tests/ -x -q
   ```
   Expected: no regressions.

3. **Manual smoke (optional):** Start dental-core agent locally with `confirmation_enabled=true`, call `PUT /admin/api/settings/confirmation-schedule` with a valid admin JWT, verify 200 response with sorted/deduped hours.
