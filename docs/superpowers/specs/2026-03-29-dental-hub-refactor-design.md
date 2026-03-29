# Dental Hub Refactor — Design Spec

**Date:** 2026-03-29
**Goal:** Переписать Dental Hub frontend на React/TypeScript/Vite/Tailwind, backend на PostgreSQL, единый домен через nginx reverse proxy. Визуальный дизайн без изменений. Масштаб: 1000+ клиник.

## Architecture

```
                    axiomatic-aryana-hillocky.ngrok-free.dev (dev)
                    dental-hub.example.com (prod)
                                    │
                                  nginx
                           ┌───────┼───────────┐
                           │       │           │
                     /hub/*     /langfuse/*   /admin/*
                        │          │            │
                   Hub API    Langfuse Web   (future)
                   :8000       :3000         Admin API
                        │
                   PostgreSQL (shared langfuse-postgres)
```

### Единый домен — nginx reverse proxy

- `/` → Hub frontend (SPA)
- `/api/*` → Hub API (FastAPI :8000)
- `/langfuse/*` → Langfuse Web (:3000) — strip prefix
- `/admin/*` → зарезервировано для админки
- ngrok туннелит nginx (:80), не Langfuse напрямую

### Frontend — React + TypeScript + Vite + Tailwind

**Стек:** тот же что в admin-panel-frontend (React 18, Vite, Tailwind, TypeScript, React Router v6).

**Страницы (сохраняем текущие):**
1. **Clinics** — грид карточек с health status, конфигом
2. **Visualizer** — 3D force graph + chat playground + trace log
3. **Architecture** — 3D архитектурная диаграмма + sidebar
4. **Edge Cases** — тест-кейсы из Langfuse dataset
5. **Roadmap** — timeline + progress bars

**Принципы:**
- Компоненты вместо DOM-манипуляций
- React Query для data fetching (кеширование, refetch, polling)
- Типизация всех API ответов
- 3D визуализации — оборачиваем Three.js/3D-Force-Graph в React-компоненты
- Tailwind для стилей — воспроизводим текущую dark theme через конфиг
- Без хардкода — клиники, Langfuse URL, всё через API

**Структура:**
```
frontend/
├── src/
│   ├── api/
│   │   └── client.ts          # axios instance + typed endpoints
│   ├── components/
│   │   ├── Layout.tsx          # nav + page container
│   │   ├── ClinicCard.tsx      # карточка клиники
│   │   ├── ForceGraph3D.tsx    # обёртка над 3d-force-graph
│   │   ├── ChatPlayground.tsx  # чат справа от графа
│   │   ├── TraceLog.tsx        # trace panel внизу
│   │   ├── EdgeCaseCard.tsx    # раскрываемая карточка edge case
│   │   └── StatusBadge.tsx     # health/status индикатор
│   ├── pages/
│   │   ├── ClinicsPage.tsx
│   │   ├── VisualizerPage.tsx
│   │   ├── ArchitecturePage.tsx
│   │   ├── EdgeCasesPage.tsx
│   │   └── RoadmapPage.tsx
│   ├── hooks/
│   │   ├── useClinics.ts       # React Query для /api/clinics
│   │   ├── useEdgeCases.ts     # React Query для /api/edge-cases
│   │   └── useAuth.ts          # auth context + GitHub login
│   ├── types/
│   │   └── index.ts            # все TypeScript интерфейсы
│   ├── config/
│   │   └── viz.ts              # цвета, формы, метки для 3D (из viz-config.js)
│   ├── App.tsx
│   └── main.tsx
├── index.html
├── package.json
├── vite.config.ts
├── tailwind.config.js
├── tsconfig.json
└── postcss.config.js
```

### Backend — PostgreSQL вместо SQLite

**Миграция:** `clinics` таблица переезжает в langfuse-postgres (уже работает).

**Новая схема:**
```sql
-- Hub's own schema in shared postgres
CREATE SCHEMA IF NOT EXISTS hub;

CREATE TABLE hub.clinics (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    server_host TEXT NOT NULL,
    server_port INTEGER DEFAULT 8080,
    clinic_id TEXT NOT NULL,
    status TEXT DEFAULT 'active',
    config JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Драйвер:** asyncpg (быстрый async PostgreSQL).
**Подключение:** `DATABASE_URL=postgresql://langfuse:langfuse@langfuse-postgres:5432/langfuse` — отдельная schema `hub` в том же postgres.

### Docker Compose — добавляем nginx

```yaml
services:
  nginx:
    image: nginx:alpine
    ports: ["80:80"]
    volumes:
      - ./nginx.conf:/etc/nginx/conf.d/default.conf:ro
    depends_on: [hub-api, langfuse-web]

  ngrok:
    command: http nginx:80 --domain=axiomatic-aryana-hillocky.ngrok-free.dev --log stdout
    # Туннелит nginx, не langfuse напрямую
```

**nginx.conf:**
```nginx
server {
    listen 80;

    # Hub frontend (SPA) — Vite dev or built static
    location / {
        proxy_pass http://hub-api:8000;
    }

    # Hub API
    location /api/ {
        proxy_pass http://hub-api:8000;
    }

    # Langfuse
    location /langfuse/ {
        proxy_pass http://langfuse-web:3000/;
        proxy_set_header Host $host;
    }

    # Future: admin panel
    location /admin/ {
        return 503 '{"error": "Admin panel not yet deployed"}';
    }
}
```

### Hub API — минимальные изменения

- Заменить aiosqlite на asyncpg
- Обновить db.py для PostgreSQL
- Все endpoints остаются такими же
- Frontend теперь отдаётся через Vite dev server или nginx

### Что НЕ меняется

- Визуальный дизайн (dark theme, цвета, формы)
- 3D визуализации (Three.js, 3D Force Graph)
- API контракты (endpoints, request/response format)
- Промпты в Langfuse
- Langfuse dataset для edge cases
- Docker compose сервисы (Langfuse stack)

## Implementation Order

1. nginx + единый домен (ngrok → nginx → hub/langfuse)
2. PostgreSQL миграция (db.py: aiosqlite → asyncpg)
3. Frontend: Vite + React scaffold
4. Перенос страниц по одной (Clinics → Edge Cases → Visualizer → Architecture → Roadmap)
5. Удаление старого plain JS frontend
