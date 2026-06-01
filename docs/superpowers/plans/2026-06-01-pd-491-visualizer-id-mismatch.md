# PD-491 Visualizer id/clinic_id Mismatch — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Hub clinic visualizer load for the Trent clinic (and every clinic whose `id` differs from its `clinic_id`) by keying clinic URLs on the unique `id` column instead of the non-unique `clinic_id`.

**Architecture:** `hub.clinics` has `id` (unique PK, used by all backend per-clinic endpoints via `get_clinic` → `WHERE id=$1`) and `clinic_id` (non-unique label). The frontend currently builds and resolves clinic URLs by `clinic_id`, so for any clinic where `id ≠ clinic_id` the backend returns 404 and the visualizer shows "Failed to load graph". Fix: two one-line frontend changes so the URL carries `id`. No backend or DB change.

**Tech Stack:** React 19, TypeScript 5.9, Vite 8, React Router. Verification via `tsc -b` build + eslint + authenticated browser smoke (frontend-hub has no unit-test harness).

**Spec:** `docs/superpowers/specs/2026-06-01-pd-491-visualizer-id-mismatch-design.md`

---

### Task 1: Key clinic URLs by `id`

**Files:**
- Modify: `frontend-hub/src/pages/ClinicsPage.tsx:30`
- Modify: `frontend-hub/src/pages/ClinicLayout.tsx:13`

- [ ] **Step 1: Change the URL the Clinics grid navigates to**

In `frontend-hub/src/pages/ClinicsPage.tsx`, the card click handler currently is:

```tsx
onClick={() => navigate(`/clinic/${c.clinic_id}`)}
```

Change it to use the unique primary key:

```tsx
onClick={() => navigate(`/clinic/${c.id}`)}
```

- [ ] **Step 2: Change how ClinicLayout resolves the clinic from the URL param**

In `frontend-hub/src/pages/ClinicLayout.tsx`, the lookup currently is:

```tsx
clinicsApi.list().then((clinics) => {
  const c = clinics.find((x) => x.clinic_id === clinicId)
  if (c) setClinic(c)
})
```

Change the match to the `id` column so it agrees with the URL and the backend:

```tsx
clinicsApi.list().then((clinics) => {
  const c = clinics.find((x) => x.id === clinicId)
  if (c) setClinic(c)
})
```

Leave the `:clinicId` route param name and the value passed to `clinicsApi.*` unchanged — only the value carried in the URL changes from `clinic_id` to `id`. Every downstream tab (Visualizer/Config/Admins) and API call then resolves because the backend already keys by `id`.

- [ ] **Step 3: Type-check and lint**

Run from `frontend-hub/`:

```bash
npm run build
npm run lint
```

Expected: `tsc -b` completes with no type errors and Vite build succeeds; eslint reports no new errors. (`Clinic.id` and `Clinic.clinic_id` both exist on the `Clinic` type in `src/types/index.ts`, so switching the property is type-safe.)

- [ ] **Step 4: Commit**

```bash
git add frontend-hub/src/pages/ClinicsPage.tsx frontend-hub/src/pages/ClinicLayout.tsx
git commit -m "fix(hub): key clinic URLs by id, not non-unique clinic_id (PD-491)"
```

---

### Task 2: Verify the fix (authenticated browser smoke)

**Files:** none (manual/agent verification against a running Hub)

This replaces unit tests — frontend-hub has no test harness, and the change is pure
data-keying. Verify behavior directly. Use a build that contains Task 1's changes
(local `npm run dev`, or the deployed Hub once the branch is built there).

- [ ] **Step 1: Trent now loads (primary case, id ≠ clinic_id)**

From the Clinics grid, open the "Элайнер РФ (Trent)" card.
Expected:
- URL becomes `/clinic/starsmile_prod` (the clinic's `id`), not `/clinic/trent`.
- The 3D force graph renders nodes (no "Failed to load graph" overlay).
- `GET /api/clinics/starsmile_prod/graph` returns **200** with a non-empty `nodes` array.
- `GET /api/clinics/starsmile_prod/health` returns **200**; the badge reflects the real
  agent state (LIVE/OFFLINE based on the agent, not a 404).

- [ ] **Step 2: Regression — a clinic where id == clinic_id still works**

From the Clinics grid, open a clinic whose `id == clinic_id` (e.g. "Элайнер.РФ (Eval Shadow)" → `starsmile_eval`).
Expected: URL `/clinic/starsmile_eval`, graph renders, `/graph` and `/health` return 200. No regression.

- [ ] **Step 3: Spot-check a second mismatched clinic**

Open "Элайнер.РФ (DEV)" (`id=starsmile_dev`, `clinic_id=starsmile`).
Expected: URL `/clinic/starsmile_dev`, `/api/clinics/starsmile_dev/graph` returns 200 — confirming the whole class is fixed, not just Trent.

- [ ] **Step 4: Record results**

Capture the `/graph` status codes and a screenshot of the rendered Trent graph as proof
for the PD-491 ticket / PR description.

---

## Self-Review

**Spec coverage:**
- Root-cause fix (frontend keys by `id`) → Task 1 ✓
- Whole-class scope (Trent + starsmile_dev + others) → Task 2 Steps 1 & 3 ✓
- Verification (browser smoke, regression on id==clinic_id) → Task 2 ✓
- No backend/DB change → honored (only two frontend files touched) ✓
- Out-of-scope items (param rename, data-model reconciliation, old bookmarks) → not included ✓

**Placeholder scan:** No TBD/TODO; both code changes show exact before/after; commands have expected output. ✓

**Type consistency:** Uses `c.id` / `x.id`, which exist on the `Clinic` type alongside `clinic_id`. Property name consistent across both files. ✓
