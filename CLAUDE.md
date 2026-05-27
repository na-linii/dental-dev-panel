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
- **Visualizer:** 3D force graph + LIVE/REPLAY trace animation + Chat Playground + Trace Log
- **Architecture:** 3D diagram with node inspector sidebar (inputs, outputs, requires, conflicts_with)
- **Config:** Per-clinic configuration editor (OpenAI, Telegram, Google Sheets, booking rules)
- **Admins:** Per-clinic admin management (bcrypt passwords)
- **Edge Cases:** loaded from Langfuse dataset, run against agent (single + batch)
- **Quality:** LLM-as-Judge evaluation dashboard
- **Roadmap:** Jira integration (epics с progress bars, tasks с фильтром по статусу)
- **Settings:** Редактор цветов/форм для 3D визуализации (hub.viz_config)
- **Eval:** LLM-as-Judge (scripts/run_eval.py) — security, handoff, dialog evaluators
- **Admin Panel:** login/password auth, dashboard, chats, actions (visible for ALL roles), confirmations, guide, settings
- **Deploy:** SSH-based deployment (clone → config → build → start → health check)
- **Traces:** Langfuse trace viewer per clinic

## API (45 маршрутов)

Hub API (`hub/api.py`):
- **Clinics:** CRUD, health, config, chat proxy, graph, deploy (SSE), admins
- **Traces:** list + detail (через Langfuse API)
- **Edge Cases:** list, run, run-all (через Langfuse dataset)
- **Settings:** viz-config (GET/PUT)
- **Roadmap:** tasks + epics (через Jira REST API)
- **Quality:** summary + history
- **Admin Panel** (backend namespace `/admin/api/*`, публично — `app.na-linii.com/api/*`): login, dashboard, sessions, messages, actions, bot toggle, blocklist, confirmations
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

5 промптов в `prompts/{text,voice}/*.md` (YAML frontmatter + Markdown body):
- **dental-router** — классификация интентов (4 интента: booking/faq/confirm/social)
- **dental-booking** — запись на приём (slot_number system)
- **dental-faq** — FAQ (Tier 1 YAML + Tier 2 pgvector)
- **dental-confirmation** — подтверждение визитов (reschedule = cancel + new booking)
- **dental-social** — социальные сообщения (opt-in per clinic)

Layout: **10 файлов** = 5 промптов × 2 канала (text/voice). Один файл = одна правда; нет dev/prod дубликатов.

Sync: `hub/sync_prompts.py` — загрузка в Langfuse при старте hub-api (lifespan event).
Labels определяются `PROMPT_SYNC_ENV` env (PD-472), **не** frontmatter:
- `PROMPT_SYNC_ENV=prod` (default в `docker-compose.yml`) → text → `[text_prod]`, voice → `[voice_prod]`
- `PROMPT_SYNC_ENV=dev` (для dev-ветки деплоя) → text → `[text_dev]`, voice → `[voice_dev]`

То есть **git branch = environment**: push в `main` → prod labels, push в `dev` → dev labels. Drift между «параллельными» dev/prod файлами физически невозможен. Naming унифицирован по схеме `<channel>_<env>` (PD-473).

dental-core consumers pick labels by channel:
- text channels (telegram/whatsapp/max) → env `LANGFUSE_PROMPT_LABEL` (default `text_prod`)
- voice channel → env `LANGFUSE_VOICE_LABEL` (default `voice_prod`)

Legacy `voice` label — удалён в PD-473 (eval-контейнеры читают frozen-версии до отдельной миграции).

## Repos

- **dental-hub** (этот) — платформа управления
- **dental-core** — инстанс клиники (agent + CRM + gateway)
