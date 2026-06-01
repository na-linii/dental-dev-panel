# PD-468: Confirmation Schedule Live Update — Implementation Plan

**Status:** Implemented (locally, not pushed).

**Goal:** Allow admin to change confirmation reminder hours at runtime without restarting the dental-core container.

**Architecture:** dental-core stores `ConfirmationConfig` in `app.state` at startup. The scheduler holds a reference to the same object and reads `config.schedule_hours` on each tick. The new PUT endpoint mutates the list in place — changes are visible to the scheduler immediately. dental-hub provides two proxy paths: admin-panel (`/admin/api/settings/...`) and Hub UI (`/api/clinics/{id}/...`).

**Spec:** `docs/specs/2026-05-27-PD-468-confirmation-schedule-live-update-design.md`

---

## File Map

### dental-core
- `agent/api.py` — store `confirm_config` in `app.state.confirmation_config` (lifespan)
- `agent/admin/settings.py` — GET + PUT `/confirmation-schedule` handlers, validation, mutation
- `agent/tests/test_confirmation_schedule_api.py` — 16 tests (GET/PUT, auth, validation, edge cases)

### dental-hub
- `hub/api.py` — three changes:
  1. `GET /admin/api/settings/confirmation-schedule` proxy (admin-panel auth)
  2. `PUT /admin/api/settings/confirmation-schedule` proxy (admin-panel auth)
  3. `PUT /api/clinics/{id}/confirmation-schedule` (existing, Hub UI GitHub PAT auth) — URL fixed from old `/confirmation-schedule` to new `/admin/api/settings/confirmation-schedule` + adds `X-Hub-Secret` header
- `frontend-admin/src/api/client.ts` — `ConfirmationSchedule` type, `getConfirmationSchedule`, `updateConfirmationSchedule`
- `frontend-admin/src/pages/admin/AdminSettingsPage.tsx` — `ConfirmationScheduleSection` component
- `frontend-hub/src/components/ReminderScheduleEditor.tsx` — already on main from earlier partial merge of PR #161
- `frontend-hub/src/pages/ClinicConfigTab.tsx` — already on main, wires up the editor

---

## Tasks (all completed locally)

### Task 1: Store ConfirmationConfig in app.state (dental-core)
Modify `agent/api.py` lifespan: after `confirm_config = ConfirmationConfig(...)`, add `app.state.confirmation_config = confirm_config`. In the `else` branch (when `confirmation_enabled` is False), set `app.state.confirmation_config = None`.

### Task 2: PUT /confirmation-schedule (dental-core)
In `agent/admin/settings.py`:
- Add `logging` import and `Request` to fastapi imports
- Add `logger = logging.getLogger(__name__)`
- Add `ConfirmationScheduleUpdate(BaseModel)` with `schedule_hours: list[int]`
- Add `@router.put("/confirmation-schedule")` with `require_role("admin", "superadmin")`
- Validate: 409 if `app.state.confirmation_config is None`, 422 for empty/out-of-range
- Mutate: `config.schedule_hours = sorted(set(req.schedule_hours))`
- Return `{"success": True, "schedule_hours": hours}`

### Task 3: Tests (dental-core)
Create `agent/tests/test_confirmation_schedule_api.py` with 16 tests:
- 12 PUT tests: 200 dedup/sort, side-effect mutation, 422×4, 403, 401, 409, superadmin, single hour, all 24 hours
- 4 GET tests: 200 enabled, 200 disabled (empty), operator can read, 401 no auth
- Mock DB connection (admin_users lookup) per test, prevent full app startup via fixture

### Task 4: GET /confirmation-schedule (dental-core)
Same file as Task 2:
- `@router.get("/confirmation-schedule")` with `get_current_user` (any role can read)
- Returns `{"enabled": false, "schedule_hours": []}` if `app.state.confirmation_config is None`
- Else returns `{"enabled": true, "schedule_hours": list(config.schedule_hours)}`

### Task 5: Hub proxies for admin-panel (dental-hub)
In `hub/api.py`, after `admin_clinic_settings`:
- `GET /admin/api/settings/confirmation-schedule` → proxy via `_proxy_to_clinic`
- `PUT /admin/api/settings/confirmation-schedule` → proxy via `_proxy_to_clinic`

### Task 6: Fix existing Hub UI endpoint (dental-hub)
In `hub/api.py:update_confirmation_schedule_endpoint`:
- Change agent URL from `/confirmation-schedule` (dead-code path) to `/admin/api/settings/confirmation-schedule`
- Add `X-Hub-Secret` header to the request (required by new endpoint's auth)

### Task 7: Admin-panel API client (dental-hub)
In `frontend-admin/src/api/client.ts`:
- Add `ConfirmationSchedule` interface (`enabled: boolean; schedule_hours: number[]`)
- Add `getConfirmationSchedule()` calling GET `/settings/confirmation-schedule`
- Add `updateConfirmationSchedule(schedule_hours)` calling PUT `/settings/confirmation-schedule`

### Task 8: Admin-panel UI component (dental-hub)
In `frontend-admin/src/pages/admin/AdminSettingsPage.tsx`:
- Import `Bell` from lucide-react
- Import `getConfirmationSchedule, updateConfirmationSchedule` from api/client
- Add `<ConfirmationScheduleSection />` between `RedButtonSection` and `BlocklistSection`
- New function `ConfirmationScheduleSection()`:
  - Loads schedule on mount via GET
  - Renders hour badges (HH:00) with trash-delete (min 1 hour enforced)
  - Hour picker (`<select>` 0..23) + Add button
  - Each change calls PUT, updates local state from response
  - Shows informational message when `enabled=false`
  - Toast errors via `TOAST_DURATION_MS`

---

## Verification

- `pytest agent/tests/test_confirmation_schedule_api.py -v` — **16/16 passing**
- `npx tsc --noEmit` (frontend-admin) — **no errors**
- `npm test` (frontend-admin) — **46/46 passing**

## Not verified (requires live infra)

- Visual preview of `ConfirmationScheduleSection` (auth flow needs running hub-api)
- Smoke on StarSmile DEV (8085): `PUT` → 200 → next scheduler tick uses new hours

## Conflict with PR #161

PR #161 is a different approach (PD-106) with different API contract (`schedule_times: ["09:00"]` strings, persists to hub.clinics.config JSONB, calls dead-code agent endpoint). Frontend pieces from PR #161 were partially merged earlier (`ReminderScheduleEditor.tsx` is on main now). PD-468 supersedes the agent side of PR #161 and reuses the existing Hub UI infrastructure with the URL fix.
