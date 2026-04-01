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

- **Frontend:** React 19, TypeScript 5.9, Vite 8, Tailwind CSS 4, React Query 5, Three.js, 3D Force Graph
- **Backend:** Python 3.12, FastAPI, asyncpg (PostgreSQL schema `hub` в langfuse-postgres)
- **Infra:** Docker Compose (8 контейнеров), nginx reverse proxy, ngrok (static domain)
- **Observability:** Langfuse v3 (self-hosted: web, worker, postgres, clickhouse, redis, minio)
- **CI/CD:** GitHub Actions → SSH deploy на nalinii-test (158.160.85.19)

## Frontend Structure

```
frontend-react/src/
├── api/
│   ├── client.ts          # typed axios client (clinics, traces, settings, roadmap, quality APIs)
│   └── adminClient.ts     # admin panel HTTP client
├── components/            # 12 компонентов
│   ├── ForceGraph3D.tsx   # 3D граф (3d-force-graph + Three.js)
│   ├── ChatPlayground.tsx # Чат-тестирование справа от графа
│   ├── TraceLog.tsx       # Список сообщений trace
│   ├── Layout.tsx         # Навигация + контейнер
│   ├── ClinicCard.tsx     # Карточка клиники (health, actions)
│   ├── Login.tsx          # GitHub PAT форма
│   ├── EdgeCaseCard.tsx   # Раскрываемый тестовый кейс
│   ├── VizLegend.tsx      # Легенда для 3D
│   ├── ConfigSection.tsx  # Секция конфига клиники
│   ├── ConfigField.tsx    # Поле конфига (text, checkbox, array)
│   ├── ShapeIcon.tsx      # Иконка формы узла
│   └── ErrorBoundary.tsx  # Error fallback
├── pages/                 # 18 страниц
│   ├── ClinicsPage.tsx            # Грид клиник с health polling
│   ├── ClinicCreatePage.tsx       # Форма регистрации клиники
│   ├── ClinicLayout.tsx           # Табы (Visualizer, Config, Admins)
│   ├── ClinicVisualizerTab.tsx    # 3D граф + чат + трейсы
│   ├── ClinicConfigTab.tsx        # Редактор конфига клиники
│   ├── ClinicAdminsTab.tsx        # Управление админами
│   ├── ArchitecturePage.tsx       # 3D диаграмма системы + инспектор
│   ├── EdgeCasesPage.tsx          # Тесты из Langfuse dataset
│   ├── RoadmapPage.tsx            # Jira таймлайн + прогресс
│   ├── SettingsPage.tsx           # Редактор цветов/форм для 3D
│   ├── QualityPage.tsx            # Оценка качества
│   └── admin/                     # Admin Panel (7 страниц)
│       ├── AdminLoginPage.tsx
│       ├── AdminDashboardPage.tsx
│       ├── AdminChatsPage.tsx
│       ├── AdminChatDetailPage.tsx
│       ├── AdminActionsPage.tsx
│       ├── AdminConfirmationsPage.tsx
│       └── AdminSettingsPage.tsx
├── layouts/AdminLayout.tsx  # Layout для админки
├── hooks/useAuth.ts         # GitHub PAT auth
├── config/viz.ts            # 3D colors/shapes/labels
└── types/index.ts           # TypeScript interfaces (~289 строк)
```

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
- **Admin Panel:** login/password auth, dashboard, chats, actions, confirmations, settings
- **Deploy:** SSH-based deployment (clone → config → build → start → health check)
- **Traces:** Langfuse trace viewer per clinic

## API (42 маршрута)

Hub API (`hub/api.py`):
- **Clinics:** CRUD, health, config, chat proxy, graph, deploy (SSE), admins
- **Traces:** list + detail (через Langfuse API)
- **Edge Cases:** list, run, run-all (через Langfuse dataset)
- **Settings:** viz-config (GET/PUT)
- **Roadmap:** tasks + epics (через Jira REST API)
- **Quality:** summary + history
- **Admin Panel** (`/admin/api/`): login, dashboard, sessions, messages, actions, bot toggle, blocklist

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

4 промпта в `prompts/*.md` (YAML frontmatter + Markdown body):
- **dental-router** — классификация интентов (booking/faq/handoff)
- **dental-booking** — запись на приём (7 шагов, slot_number system)
- **dental-faq** — FAQ (Tier 1 YAML + Tier 2 pgvector)
- **dental-confirmation** — подтверждение визитов

Sync: `hub/sync_prompts.py` — загрузка в Langfuse при старте hub-api (lifespan event).

## Repos

- **dental-hub** (этот) — платформа управления
- **dental-core** — инстанс клиники (agent + CRM + gateway)

## Development Rules

- Промпты ТОЛЬКО через Langfuse, НОЛЬ хардкода
- Ветки + PR, не в main
- Тесты вместе с кодом
- НЕ трогать production без подтверждения
- Язык: русский
