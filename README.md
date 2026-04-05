# Dental Hub

Central management platform for dental-core clinic instances.

## What It Does

- Manages N dental-core clinic instances (register, deploy, configure, monitor)
- Shared Langfuse observability (tracing, prompt management, evals)
- Admin panel for clinic operators (chats, actions, confirmations)
- 3D visualization of agent architecture and live traces

## Quick Start

```bash
cp .env.example .env
# Fill in required vars: Langfuse secrets, NGROK_AUTHTOKEN, HUB_SERVICE_SECRET

docker compose up -d
```

Requires `.env` with Langfuse secrets (no weak defaults in docker-compose).

## Architecture

```
nginx reverse proxy (single domain)
├── /           → React SPA (Vite)
├── /api/*      → Hub API (FastAPI)
├── /admin/*    → Admin Panel
├── /langfuse/* → Langfuse Web
└── /api/public/* → Langfuse API (for agents via ngrok)
```

8 containers: hub-api, hub-frontend, nginx, langfuse-web, langfuse-worker,
postgres, clickhouse, redis, minio, ngrok.

## Key Endpoints

| Path | Description |
|------|-------------|
| `/api/clinics` | Clinic CRUD, health, config, deploy |
| `/admin/api/*` | Admin login, dashboard, chats, actions, confirmations |
| `/langfuse/*` | Langfuse UI (shared across all clinics) |

## Repos

- **dental-hub** (this) -- management platform
- **dental-core** -- clinic instance (agent + CRM + gateway)

## CI/CD

GitHub Actions -> SSH deploy to production (158.160.85.19).

## Details

See [CLAUDE.md](CLAUDE.md) for full architecture, API routes, database schema,
prompt details, and development rules.
