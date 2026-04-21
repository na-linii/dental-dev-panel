# frontend-admin

Admin Panel SPA (оператор клиники). Домен: `app.na-linii.com`.

## Dev

```bash
npm ci
npm run dev     # http://localhost:5174, proxy /api → http://localhost:8000/admin/api
```

## Build

```bash
npm run build   # dist/
```

Раздаётся nginx-ом из `/usr/share/nginx/html/app` на `app.na-linii.com`.

## Routes

- `/login` — форма логина
- `/dashboard` — главная
- `/chats`, `/chats/:id` — переписки
- `/confirmations` — подтверждения (superadmin only)
- `/actions` — действия
- `/settings` — настройки
- `/guide` — инструкция

## API

Клиент в `src/api/client.ts`, baseURL `/api`. Все endpoint-пути — без `/admin/api` префикса.
На проде nginx проксирует `/api/*` → `hub-api:8000/admin/api/*`.

Auth: username/password (bcrypt, Bearer token в `localStorage.admin_token`).
