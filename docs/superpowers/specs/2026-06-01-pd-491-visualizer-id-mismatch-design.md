---
date: 2026-06-01
jira: PD-491
status: design-approved
tags: [bugfix, frontend-hub, routing, visualizer]
---

# PD-491 — Hub Элайнер РФ (Trent) visualizer "Failed to load graph"

## Problem

Opening the Trent clinic visualizer (`https://hub.na-linii.com/clinic/trent`) shows
**"Failed to load graph"** and an **OFFLINE** badge. The 3D graph never renders.

## Root cause (verified live)

`hub.clinics` has two identifier columns:

- `id` — unique primary key (used in `ON CONFLICT (id)`, all backend lookups)
- `clinic_id` — a hub-side label, **not unique**

The frontend and backend disagree on which column keys a clinic URL.

Live data for the Trent record (from `GET /api/clinics`):

```json
{ "id": "starsmile_prod", "clinic_id": "trent", "name": "Элайнер РФ (Trent)",
  "server_host": "158.160.240.47", "server_port": 8081, "status": "active" }
```

Flow for URL `/clinic/trent`:

| Layer | File | Keys by | Result for Trent |
|---|---|---|---|
| Build clinic URL | `frontend-hub/src/pages/ClinicsPage.tsx:30` | `clinic_id` | URL = `/clinic/trent` |
| Resolve clinic for header | `frontend-hub/src/pages/ClinicLayout.tsx:13` | `clinic_id` | row found → name shown ✓ |
| Per-clinic API endpoints | `hub/db.py:129` `get_clinic` → `WHERE id=$1` | `id` | `id='trent'` → **no row → HTTP 404** ✗ |

Because `id` (`starsmile_prod`) ≠ `clinic_id` (`trent`), `proxy_graph` and the health
endpoint raise `HTTPException(404)`. The frontend's `.catch()`
(`ClinicVisualizerTab.tsx:61`) sets `graphError = "Failed to load graph"`, and the
failed health poll renders OFFLINE.

Confirmed via browser: `/api/clinics/trent/graph` → **404**,
`/api/clinics/trent/health` → **404**.

### Blast radius (class of bug, not one clinic)

Every per-clinic endpoint calls `get_clinic(clinic_id)` (lookup by `id`): health,
config, chat, deploy, deploy-status, graph, traces, admins (`hub/api.py`). So **any**
clinic whose URL (`clinic_id`) differs from its `id` is fully broken across all tabs.
From live data this currently also affects:

- `starsmile_dev` (id `starsmile_dev`, clinic_id `starsmile`) → URL `/clinic/starsmile` → 404
- Routing by `clinic_id` is also inherently ambiguous: `ClinicLayout`'s
  `.find()` returns the first row, and `clinic_id` is not unique.

Clinics work today only by coincidence, when `id == clinic_id`
(e.g. `starsmile_demo`, `starsmile_eval`).

## Decision

**Approach A — key clinic URLs by the unique `id` column on the frontend.** This aligns
the frontend with the unique PK that the backend already uses everywhere, fixing the
whole class in two one-line changes, with no data migration and no backend change.

Rejected alternatives:

- **B — backend `get_clinic` matches `id OR clinic_id`.** `clinic_id` is non-unique, so
  this can resolve the wrong clinic, and the display match in `ClinicLayout` stays
  ambiguous. Papers over the inconsistency.
- **C — data fix (rename Trent's `id` to `trent`).** Band-aid: leaves `starsmile_dev`
  broken, risks any FK referencing `id`, and needs a production DB write.

## Changes

1. `frontend-hub/src/pages/ClinicsPage.tsx:30`
   `navigate(`/clinic/${c.clinic_id}`)` → `navigate(`/clinic/${c.id}`)`

2. `frontend-hub/src/pages/ClinicLayout.tsx:13`
   `clinics.find((x) => x.clinic_id === clinicId)` → `clinics.find((x) => x.id === clinicId)`

The route param name (`:clinicId`) and the variable passed to the API client stay the
same; only the *value* carried in the URL changes from `clinic_id` to `id`. All
downstream tabs (Visualizer, Config, Admins) and API calls then resolve correctly,
because the backend already keys by `id`.

No backend or DB change.

## Out of scope

- Renaming the route param / API client args (cosmetic).
- Deduplicating or reconciling the `id` vs `clinic_id` data model.
- Old `/clinic/<clinic_id>` bookmarks: these already 404 today and remain dead;
  acceptable since navigation is via the Clinics grid.

## Verification

- Unit/render test: `ClinicsPage` builds `/clinic/<id>` links; `ClinicLayout` resolves a
  clinic by `id` (cover the `id ≠ clinic_id` case explicitly).
- Smoke (browser, authenticated): from the Clinics grid open Trent → URL becomes
  `/clinic/starsmile_prod`; `/api/clinics/starsmile_prod/graph` returns 200 with nodes;
  the 3D graph renders; health badge reflects real agent state (not 404-driven OFFLINE).
- Regression: open a clinic where `id == clinic_id` (e.g. `starsmile_demo`) and confirm
  it still loads.
