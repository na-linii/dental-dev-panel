# Dental Hub — Platform for Managing Dental Core Clinics

## Project

Центральная платформа: Langfuse (shared), API управления клиниками, мониторинг, 3D визуализация, LLM-as-Judge eval.
Dental-core инстансы подключаются к hub для tracing и prompt management.
1 Hub = N клиник. Масштаб: 1000+ клиник.

## Architecture

nginx reverse proxy — единый домен:
- `/` → Hub React SPA (Vite)
- `/api/*` → Hub API (FastAPI)
- `/langfuse/*` → Langfuse Web
- `/api/public/*` → Langfuse API (для агентов через ngrok)
- `/admin/*` → Admin Panel (stub, login/password)

## Stack

- **Frontend:** React 18, TypeScript, Vite, Tailwind CSS, React Query, Three.js, 3D Force Graph
- **Backend:** Python 3.12, FastAPI, asyncpg (PostgreSQL schema `hub` в langfuse-postgres)
- **Infra:** Docker Compose, nginx, ngrok (static domain)
- **Observability:** Langfuse v3 (self-hosted)

## Frontend Structure

```
frontend-react/src/
├── api/client.ts          # typed axios client
├── components/            # ForceGraph3D, ChatPlayground, TraceLog, Layout, Login, etc.
├── pages/                 # ClinicsPage, VisualizerPage, ArchitecturePage, EdgeCasesPage, RoadmapPage
├── hooks/useAuth.ts       # GitHub PAT auth
├── config/viz.ts          # 3D colors/shapes/labels
└── types/index.ts         # all TypeScript interfaces
```

## Key Features

- **Clinics Page:** grid with health polling, Open Visualizer per clinic
- **Visualizer:** 3D force graph + LIVE/REPLAY trace animation + Chat Playground + Trace Log
- **Architecture:** 3D diagram with node inspector sidebar
- **Edge Cases:** loaded from Langfuse dataset, run against agent
- **Eval:** LLM-as-Judge (scripts/run_eval.py) — security, handoff, dialog evaluators
- **Admin:** login/password, Under Construction (future admin panel)

## Repos

- **dental-hub** (этот) — платформа управления
- **dental-core** — инстанс клиники (agent + CRM + gateway)

## Development Rules

- Промпты ТОЛЬКО через Langfuse, НОЛЬ хардкода
- Ветки + PR, не в main
- Тесты вместе с кодом
- НЕ трогать production без подтверждения
- Язык: русский
