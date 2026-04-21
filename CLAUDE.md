# Dental Hub — Platform for Managing Dental Core Clinics

## Project

Центральная платформа: Langfuse (shared), API управления клиниками, мониторинг, 3D визуализация, LLM-as-Judge eval.
Dental-core инстансы подключаются к hub для tracing и prompt management.
1 Hub = N клиник. Масштаб: 1000+ клиник.

## Architecture

nginx reverse proxy — два поддомена:
- `hub.na-linii.com/` → Hub React SPA (frontend-hub, Vite)
- `hub.na-linii.com/api/*` → Hub API (FastAPI)
- `hub.na-linii.com/langfuse/*` → Langfuse Web
- `hub.na-linii.com/api/public/*` → Langfuse API (для агентов через ngrok)
- `app.na-linii.com/` → Admin Panel SPA (frontend-admin, Vite)
- `app.na-linii.com/api/*` → hub-api `/admin/api/*` (internal namespace, login/password auth)

## Stack

- **Frontend:** React 19, TypeScript 5.9, Vite 8, Tailwind CSS 4, React Query 5, Three.js, 3D Force Graph
- **Backend:** Python 3.12, FastAPI, asyncpg (PostgreSQL schema `hub` в langfuse-postgres)
- **Infra:** Docker Compose (10 контейнеров), nginx reverse proxy, ngrok (static domain)
- **Observability:** Langfuse v3 (self-hosted: web, worker×3, postgres, clickhouse, redis, minio, minio-init)
- **CI/CD:** GitHub Actions → SSH deploy на nalinii-test (158.160.85.19)
- **Security:** HUB_SERVICE_SECRET required via env var (no hardcoded fallback), Langfuse secrets required via env vars

## Frontend Structure

Два независимых Vite-приложения:

### frontend-hub/ — Hub SPA (hub.na-linii.com)

```
frontend-hub/src/
├── api/client.ts          # axios client для /api (clinics, traces, settings, quality)
├── components/            # ChatPlayground, ClinicCard, ConfigField, ConfigSection,
│                          # ErrorBoundary, ForceGraph3D, Layout, Login, ShapeIcon,
│                          # TraceLog, VizLegend
├── pages/                 # ClinicsPage, ClinicCreatePage, ClinicLayout,
│                          # ClinicVisualizerTab, ClinicConfigTab, ClinicAdminsTab,
│                          # SettingsPage, QualityPage
├── hooks/useAuth.ts       # GitHub PAT auth
├── config/viz.ts          # 3D colors/shapes/labels
└── types/index.ts
```

### frontend-admin/ — Admin Panel SPA (app.na-linii.com)

```
frontend-admin/src/
├── api/client.ts          # axios client для /api (проксируется на /admin/api/*)
├── layouts/AdminLayout.tsx
├── pages/admin/           # AdminLoginPage, AdminDashboardPage, AdminChatsPage,
│                          # AdminChatDetailPage, AdminActionsPage,
│                          # AdminConfirmationsPage, AdminSettingsPage, AdminGuidePage
├── config/adminStatuses.ts
├── contexts/ThemeContext.tsx
├── hooks/useAdminQueries.ts
└── utils/pluralize.ts
```

Admin routes — чистые, без `/admin` префикса: `/login`, `/dashboard`, `/chats/:id`, и т.д.

## Key Features

- **Clinics Page:** grid with health polling, create/deploy/manage clinics
- **Visualizer:** 3D force graph + LIVE/REPLAY trace animation + Chat Playground + Trace Log + node inspector sidebar (clinic architecture graph)
- **Config:** Per-clinic configuration editor (OpenAI, Telegram, Google Sheets, booking rules)
- **Admins:** Per-clinic admin management (bcrypt passwords)
- **Quality:** LLM-as-Judge evaluation dashboard
- **Settings:** Редактор цветов/форм для 3D визуализации (hub.viz_config)
- **Eval:** LLM-as-Judge (scripts/run_eval.py) — security, handoff, dialog evaluators. Edge cases хранятся в Langfuse dataset (UI-экран удалён, запуск через скрипт)
- **Admin Panel:** login/password auth, dashboard, chats, actions (visible for ALL roles), confirmations, guide, settings
- **Deploy:** SSH-based deployment (clone → config → build → start → health check)
- **Traces:** Langfuse trace viewer per clinic

## API (43 маршрута)

Hub API (`hub/api.py`):
- **Clinics:** CRUD, health, config, chat proxy, graph, deploy (SSE), admins
- **Traces:** list + detail (через Langfuse API)
- **Settings:** viz-config (GET/PUT)
- **Quality:** summary + history
- **Admin Panel** (backend namespace `/admin/api/*`, публично — `app.na-linii.com/api/*`): login, dashboard, sessions, messages, actions, bookings, bot toggle, blocklist, confirmations
- **Telegram Import** (`/admin/api/telegram/import`): proxy to dental-core for chat import (start, cancel, status, history)

Auth: `hub/auth.py` — GitHub PAT + org membership check (na-linii).
Admin auth: username/password (bcrypt).

## Database

PostgreSQL schema `hub` (в langfuse-postgres):

| Таблица | Назначение |
|---------|-----------|
| hub.clinics | Реестр клиник (host, port, config JSONB, deploy_status, deploy_log) |
| hub.viz_config | Конфиг 3D визуализации (config JSONB) |
| hub.admin_users | Админы клиник (username, password_hash bcrypt, role, clinic_id) |

## Prompts

5 промптов в `prompts/dev/*.md` и `prompts/prod/*.md` (YAML frontmatter + Markdown body):
- **dental-router** — классификация интентов (4 интента: booking/faq/confirm/social)
- **dental-booking** — запись на приём (slot_number system)
- **dental-faq** — FAQ (Tier 1 YAML + Tier 2 pgvector)
- **dental-confirmation** — подтверждение визитов (reschedule = cancel + new booking)
- **dental-social** — социальные сообщения (opt-in per clinic)

Sync: `hub/sync_prompts.py` — загрузка в Langfuse при старте hub-api (lifespan event).
Labels: `production` (prod) / `dev` (dev) — управляется через `LANGFUSE_PROMPT_LABEL`.

## Repos

- **dental-hub** (этот) — платформа управления
- **dental-core** — инстанс клиники (agent + CRM + gateway)
