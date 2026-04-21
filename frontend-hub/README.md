# frontend-hub

Hub SPA — управление клиниками, мониторинг, 3D визуализация. Домен: `hub.na-linii.com`.

## Stack

- React 19, TypeScript 5.9, Vite 8
- Tailwind CSS 4, React Query 5
- Three.js + 3D Force Graph

## Pages

- **Clinics** — реестр клиник, health polling, регистрация/деплой
- **Clinic Layout** — Visualizer, Config, Admins (per-clinic)
- **Visualizer** — 3D граф + LIVE/REPLAY trace + Chat Playground
- **Settings** — редактор 3D колоризации
- **Quality** — LLM-as-Judge dashboard

## Dev

```bash
npm ci
npm run dev     # http://localhost:5173, proxy /api → http://localhost:8000
```

## Build

```bash
npm run build   # dist/
```

Раздаётся nginx-ом из `/usr/share/nginx/html/hub` на `hub.na-linii.com`.

## API

- `/api/*` — Hub API (clinics, traces, settings, quality, и т.д.)

Auth: GitHub PAT.
