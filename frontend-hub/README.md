# Dental Hub Frontend

React SPA for the Dental Hub platform -- admin panel and management UI for dental clinics.

## Stack

- React 19, TypeScript 5.9, Vite 8
- Tailwind CSS 4, React Query 5
- Three.js + 3D Force Graph (visualization)

## Pages

- **Dashboard** -- clinic overview, health status
- **Clinics** -- register, deploy, configure clinic instances
- **Visualizer** -- 3D force graph with live/replay trace animation
- **Admin Panel** -- chats, chat detail, actions, confirmations, settings
- **Edge Cases** -- test scenarios from Langfuse datasets
- **Quality** -- LLM-as-Judge evaluation dashboard
- **Roadmap** -- Jira integration (epics + tasks)
- **Settings** -- 3D visualization config editor

## Development

```bash
npm install
npm run dev     # http://localhost:5173
```

## Build

```bash
npm run build   # output in dist/
```

## API

Connects to Hub API:
- `/api/*` -- clinics, traces, settings, roadmap, quality
- `/admin/api/*` -- admin panel (login, dashboard, sessions, messages, actions)

Auth: GitHub PAT (main UI) or username/password (admin panel).
