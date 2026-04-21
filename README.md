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
nginx reverse proxy (два поддомена)
├── hub.na-linii.com/
│   ├── /           → Hub SPA (frontend-hub, Vite)
│   ├── /api/*      → Hub API (FastAPI)
│   ├── /langfuse/* → Langfuse Web
│   └── /api/public/* → Langfuse API (for agents via ngrok)
└── app.na-linii.com/
    ├── /           → Admin Panel SPA (frontend-admin, Vite)
    └── /api/*      → hub-api `/admin/api/*` (internal namespace)
```

Containers: hub-api, nginx, langfuse-web, langfuse-worker, postgres, clickhouse,
redis, minio, minio-init, ngrok.

## Key Endpoints

| URL | Description |
|------|-------------|
| `hub.na-linii.com/api/clinics` | Clinic CRUD, health, config, deploy |
| `app.na-linii.com/api/*` | Admin login, dashboard, chats, actions, confirmations (проксируется на hub-api `/admin/api/*`) |
| `hub.na-linii.com/langfuse/*` | Langfuse UI (shared across all clinics) |

## Repos

- **dental-hub** (this) -- management platform
- **dental-core** -- clinic instance (agent + CRM + gateway)

## CI/CD

GitHub Actions -> SSH deploy to production (158.160.85.19).

## Details

See [CLAUDE.md](CLAUDE.md) for full architecture, API routes, database schema,
prompt details, and development rules.
