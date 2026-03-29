# Live Trace Visualizer — Design Spec

**Date:** 2026-03-29
**Goal:** Visualizer shows real-time Langfuse traces for a clinic. Playground and TraceLog are independent panels. Animation reflects live agent activity with replay capability.

## Architecture

```
Langfuse (source of truth)
    ↓ polling every 5s
Hub API /api/clinics/{id}/traces?since=...
    ↓
React (VisualizerPage)
    ├── ForceGraph3D (LIVE mode: multi-color streams / REPLAY mode: single trace)
    ├── ChatPlayground (independent, sends messages, no trace logic)
    └── TraceLog (all clinic traces from Langfuse, replay buttons)
```

## Components

### Hub API — new endpoint
`GET /api/clinics/{id}/traces?limit=50&since=<ISO timestamp>`
- Proxies to Langfuse `GET /api/public/traces?limit=50&tags=<clinic_id>`
- Returns simplified trace list (id, name, startTime, endTime, latency, tags, userId)
- `since` param filters by timestamp for incremental polling

`GET /api/clinics/{id}/traces/{trace_id}`
- Proxies to Langfuse single trace with full observations
- Same filtering as current `/api/trace/{id}` but scoped to clinic

### VisualizerPage
- Top bar: ← Back | Clinic info | Speed controls (1x/2x/4x) | `Playground` btn | `Trace Log` btn
- Playground and TraceLog toggle independently
- If both open: Playground right (w-80), TraceLog bottom (h-280)
- If only Playground: takes full right height
- If only TraceLog: takes full bottom width
- If neither: graph fullscreen

### ForceGraph3D — two modes
- **LIVE**: poll traces, animate new ones automatically. Different colors per userId/sessionId.
- **REPLAY**: single trace animation from TraceLog button. After finish → back to LIVE.
- Indicator top-left: `🟢 LIVE` or `▶ REPLAY`

### TraceLog — Langfuse-powered
- Fetches all clinic traces via polling (React Query, refetchInterval 5s)
- Each row: time, agent name, latency, userId snippet, ▶ Replay button
- Newest on top
- Click row → expand to see observations/steps

### ChatPlayground — simplified
- Only sends messages via `/api/clinics/{id}/chat`
- No trace logic, no replay button
- Just chat UI with configurable channel/user/phone/name

### Animation colors
- Cycle through palette for different userIds: cyan, yellow, green, purple, orange
- REPLAY always uses cyan (#7dd3fc)
