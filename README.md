# Dental Hub

Центральная платформа управления клиниками Dental Core.

## Что внутри

- **Hub API** (FastAPI :8000) — управление клиниками, проксирование chat/health
- **Langfuse** (:3000) — shared prompts, tracing, evals для всех клиник
- **Ngrok** — статический туннель для доступа к Langfuse с удалённых серверов
- **Frontend** — админ-панель с визуализатором

## Quick Start

```bash
cp .env.example .env
# Заполнить NGROK_AUTHTOKEN

docker compose up -d

# Hub API: http://localhost:8000
# Langfuse: http://localhost:3000
# Ngrok dashboard: http://localhost:4040
```

## Добавить клинику

```bash
curl -X POST http://localhost:8000/api/clinics \
  -H "Authorization: Bearer <github-pat>" \
  -H "Content-Type: application/json" \
  -d '{"id": "zubatka", "name": "Зубатка", "server_host": "158.160.240.47", "server_port": 8080, "clinic_id": "zubatka"}'
```

## Архитектура

```
dental-hub (этот проект)          dental-core (инстанс клиники)
├── Hub API :8000                 ├── Agent :8080
├── Langfuse :3000  ←─────────── ├── LANGFUSE_HOST=ngrok-url
├── Ngrok tunnel                  └── Agent PostgreSQL
└── Hub PostgreSQL
```
