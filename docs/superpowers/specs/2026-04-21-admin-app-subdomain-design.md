# Admin panel → app.na-linii.com (отдельный поддомен)

## Контекст

Сейчас админка живёт под префиксом `/admin/*` на общем домене `hub.na-linii.com`. Она — часть того же React SPA, что и Hub. API клиент админки использует `/admin/api/*`, роуты React Router — `/admin/dashboard`, `/admin/chats/:id`, и т.д.

DNS для `app.na-linii.com` привязан к тому же серверу. Задача — перенести админку на этот поддомен с **чистыми URL без префикса `/admin`**: `app.na-linii.com/login`, `app.na-linii.com/dashboard`, `app.na-linii.com/api/...`.

## Цели

- Админка доступна на `http://app.na-linii.com/` с URL без префикса.
- Hub и Langfuse остаются на `hub.na-linii.com` без изменений в пользовательских URL.
- Нет редиректов, костылей, хардкодов host-ов в коде.
- Архитектурно чистое разделение admin и hub на уровне фронтенда.

## Не-цели

- Разделять backend на два сервиса. FastAPI `hub-api` остаётся одним; admin- и hub-эндпоинты разделены внутренними namespace'ами (`/admin/api/*` и `/api/*`) как сейчас.
- Переименовывать внутренние backend endpoint-префиксы. `/admin/api/*` на backend — это internal contract, не публичный URL.
- Поддерживать старый URL `hub.na-linii.com/admin/*` (полный разрыв, без редиректа).

## Архитектурный принцип

**Admin — самостоятельное SPA** на отдельном поддомене со своим URL-пространством. Единственная точка соприкосновения с Hub — общий backend FastAPI.

```
                 ┌──────────────────────────────────────────┐
                 │                nginx                     │
                 │                                          │
 app.na-linii.com┼─ / ────────────────► html/app (admin)   │
                 │  /api/* ───────────► hub-api /admin/api/*│
                 │                                          │
 hub.na-linii.com┼─ / ────────────────► html/hub (hub)     │
                 │  /api/* ───────────► hub-api /api/*     │
                 │  /langfuse/* ──────► langfuse-web       │
                 │  /api/public/* ────► langfuse-web       │
                 │  ...                                     │
                 └──────────────────────────────────────────┘
```

## Компоненты

### 1. Backend (`hub/api.py`)

**Без изменений в endpoint-путях.** Префикс `/admin/api/*` остаётся как internal namespace на FastAPI.

**Удаления (единая когерентная правка):**
- `hub/api.py:844-845` — блок `frontend_dir = ...; if os.path.isdir(frontend_dir):`
- `hub/api.py:848` — `app.mount("/assets", StaticFiles(...), name="assets")`
- `hub/api.py:850-858` — `@app.get("/{path:path}")` SPA fallback
- `hub/api.py:15` — `from fastapi.staticfiles import StaticFiles` (перед удалением выполнить `grep -n "StaticFiles" hub/` — если нет других использований, удалить строку)
- `hub/api.py:846` — `from fastapi.responses import FileResponse` (локальный импорт, удаляется вместе с fallback)

Обоснование: теперь фронтендов два, оба раздаются nginx-ом как статика. Backend не знает про hostname клиента — только API.

### 2. Frontend — два независимых Vite-приложения

Текущий `frontend-react/` разделяем на два проекта. Ниже — **точное** распределение файлов (на основе текущего состояния `frontend-react/src/`).

**`frontend-hub/`** (Hub SPA):

| Путь | Источник |
|---|---|
| `src/App.tsx` | `src/App.tsx` — только hub routes (см. ниже) |
| `src/main.tsx` | `src/main.tsx` |
| `src/index.css` | `src/index.css` |
| `src/api/client.ts` | `src/api/client.ts` (без проверки `startsWith('/admin')`) |
| `src/hooks/useAuth.ts` | `src/hooks/useAuth.ts` |
| `src/config/viz.ts` | `src/config/viz.ts` |
| `src/config/design.ts` | `src/config/design.ts` (если используется; иначе удалить orphan) |
| `src/types/index.ts` | `src/types/index.ts` |
| `src/components/*` | `ChatPlayground`, `ClinicCard`, `ConfigField`, `ConfigSection`, `ErrorBoundary`, `ForceGraph3D`, `Layout`, `Login`, `ShapeIcon`, `TraceLog`, `VizLegend` |
| `src/pages/*` | `ClinicAdminsTab`, `ClinicConfigTab`, `ClinicCreatePage`, `ClinicLayout`, `ClinicVisualizerTab`, `ClinicsPage`, `QualityPage`, `SettingsPage` |
| `src/assets/*` | `src/assets/*` |
| `index.html` | копия текущего |
| `vite.config.ts` | без `'/admin/api'` proxy, только `'/api'` |
| `package.json`, `tsconfig*.json` | копия текущего |

**`frontend-admin/`** (Admin SPA):

| Путь | Источник |
|---|---|
| `src/App.tsx` | новый — admin routes без префикса (см. ниже) |
| `src/main.tsx` | копия `src/main.tsx` |
| `src/index.css` | копия `src/index.css` |
| `src/api/client.ts` | `src/api/adminClient.ts` переименован, `baseURL: '/api'`, 401 → `/login` |
| `src/layouts/AdminLayout.tsx` | `src/layouts/AdminLayout.tsx` (внутренние navigate переведены на чистые пути) |
| `src/pages/*` (8 штук) | `AdminActionsPage`, `AdminChatDetailPage`, `AdminChatsPage`, `AdminConfirmationsPage`, `AdminDashboardPage`, `AdminGuidePage`, `AdminLoginPage`, `AdminSettingsPage` (все `navigate('/admin/X')` → `navigate('/X')`) |
| `src/contexts/ThemeContext.tsx` | `src/contexts/ThemeContext.tsx` |
| `src/config/adminStatuses.ts` | `src/config/adminStatuses.ts` (все `to: '/admin/X'` → `to: '/X'`) |
| `src/hooks/useAdminQueries.ts` | `src/hooks/useAdminQueries.ts` |
| `src/utils/pluralize.ts` | `src/utils/pluralize.ts` |
| `index.html` | копия текущего (title "Dental Admin") |
| `vite.config.ts` | proxy `'/api'` на `http://localhost:8000/admin/api` для dev |
| `package.json`, `tsconfig*.json` | копия текущего |

Файлы, **не мигрирующие в admin** (остаются только в hub): `api/client.ts`, `hooks/useAuth.ts`, `config/viz.ts`, `config/design.ts`, `types/index.ts`, все `components/*`, все hub-`pages/*`.

Файлы, **полностью удаляемые**: `frontend-react/` (целиком после успешного разделения), `admin-frontend/index.html`.

**Admin routes (`frontend-admin/src/App.tsx`):**

```tsx
<Route path="/login" element={<AdminLoginPage />} />
<Route path="/" element={<AdminLayout />}>
  <Route index element={<Navigate to="/dashboard" replace />} />
  <Route path="dashboard" element={<AdminDashboardPage />} />
  <Route path="chats" element={<AdminChatsPage />} />
  <Route path="chats/:sessionId" element={<AdminChatDetailPage />} />
  <Route path="confirmations" element={<SuperadminGuard><AdminConfirmationsPage /></SuperadminGuard>} />
  <Route path="actions" element={<AdminActionsPage />} />
  <Route path="settings" element={<AdminSettingsPage />} />
  <Route path="guide" element={<AdminGuidePage />} />
</Route>
<Route path="*" element={<Navigate to="/" />} />
```

**Admin API client (`frontend-admin/src/api/client.ts`):**

```tsx
const api = axios.create({ baseURL: '/api', timeout: 30_000 })
// 401 → window.location.href = '/login'
```

**SuperadminGuard и Navigate** в `App.tsx`: `Navigate to="/dashboard"` вместо `/admin/dashboard`.

**Hub App.tsx:**
- Удалить импорты `AdminLoginPage`, `AdminDashboardPage`, ...
- Удалить admin-роуты.
- Удалить `SuperadminGuard` (определён сейчас в `src/App.tsx:24-30` — переезжает в `frontend-admin/src/App.tsx`).
- Удалить проверку `location.pathname.startsWith('/admin')` в `AuthGate`.
- Удалить в `api/client.ts` проверку `if (!window.location.pathname.startsWith('/admin'))` (строки 24-25).

**Admin internal navigation:**

Все вызовы `navigate('/admin/X')` / `Link to="/admin/X"` → `/X`:

| Файл | Путь |
|---|---|
| `pages/AdminLoginPage.tsx` | `navigate('/admin/dashboard')` → `/dashboard` (×2) |
| `pages/AdminDashboardPage.tsx` | `navigate('/admin/chats?controller=operator')` → `/chats?controller=operator` |
| `pages/AdminChatsPage.tsx` | `navigate('/admin/chats/...')` → `/chats/...` (×2) |
| `pages/AdminChatDetailPage.tsx` | `navigate('/admin/chats')` → `/chats` |
| `pages/AdminActionsPage.tsx` | `navigate('/admin/chats/...')` → `/chats/...` |
| `pages/AdminConfirmationsPage.tsx` | `navigate('/admin/chats/...')` → `/chats/...` |
| `layouts/AdminLayout.tsx` | `navigate('/admin/login')` → `/login` (×4) |
| `config/adminStatuses.ts` | `NAV_ITEMS` — все `to: '/admin/X'` → `to: '/X'` (6 штук) |

### 3. Nginx (`nginx/default.conf`)

Два server-блока:

**Hub + Langfuse (текущий домен):**

```nginx
server {
    listen 80 default_server;
    server_name hub.na-linii.com _;
    client_max_body_size 10m;

    location / {
        root /usr/share/nginx/html/hub;
        try_files $uri /index.html;
    }

    location /api/ {
        proxy_pass http://hub-api:8000/api/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 120s;
    }

    location /langfuse/ { ... }      # без изменений
    location /api/public/ { ... }    # без изменений
    location /api/auth/ { ... }      # без изменений
    location /api/trpc/ { ... }      # без изменений
    location /_next/ { ... }         # без изменений
    location /gateway/ { ... }       # без изменений
}
```

**Admin (новый домен):**

```nginx
server {
    listen 80;
    server_name app.na-linii.com;
    client_max_body_size 10m;

    location /api/ {
        proxy_pass http://hub-api:8000/admin/api/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location / {
        root /usr/share/nginx/html/app;
        try_files $uri /index.html;
    }
}
```

Удаляем из hub-блока: `location /admin`, `location /admin/api/`.

Rewrite `/api/` → `/admin/api/` на app-блоке — это единственное преобразование URL и оно обосновано: разные public namespace'ы на двух доменах, общий backend со своим internal namespace.

### 4. Docker / Deploy

**`docker-compose.yml`:**

```yaml
services:
  nginx:
    image: nginx:alpine
    ports: ["80:80"]
    volumes:
      - ./nginx/default.conf:/etc/nginx/conf.d/default.conf:ro
      - ./frontend-hub/dist:/usr/share/nginx/html/hub:ro
      - ./frontend-admin/dist:/usr/share/nginx/html/app:ro
    depends_on:
      - hub-api
      - langfuse-web
    restart: unless-stopped
```

Убрать: `- ./admin-frontend:/usr/share/nginx/html/admin:ro`.

**`hub/Dockerfile`:**

Убрать copy `frontend/` внутрь образа. Hub-api не нуждается в фронтенде.

**`.github/workflows/*`:**

- Шаг билда: `cd frontend-hub && npm ci && npm run build`, затем `cd frontend-admin && npm ci && npm run build`.
- Artifacts (имена — контракт с deploy-скриптом):
  - `frontend-hub/dist/` → на сервере `~/dental-hub/frontend-hub/dist/`
  - `frontend-admin/dist/` → на сервере `~/dental-hub/frontend-admin/dist/`
- Deploy-скрипт копирует обе директории через rsync или scp до `docker-compose up -d`.
- В CI удалить старые шаги, связанные со сборкой и копированием `frontend-react/` (если были).

### 5. Удаляемые артефакты

| Артефакт | Причина |
|---|---|
| `admin-frontend/index.html` | Legacy mini-SPA (до React-версии), уже не обслуживается |
| SPA fallback в `hub/api.py` (строки ~842–858) | Nginx теперь раздаёт SPA как статику |
| `frontend-react/` как единый проект | Разделён на `frontend-hub/` и `frontend-admin/` |
| В `hub/api.py`: `app.mount("/assets", ...)` | Ассеты раздаёт nginx |

### 6. Обновление документации

| Файл | Правки |
|---|---|
| `README.md` | Новая схема: `app.na-linii.com` → Admin, `hub.na-linii.com` → Hub+Langfuse |
| `CLAUDE.md` (в `dental-hub/`) | Обновить архитектурный раздел |
| `frontend-react/README.md` | Удалить; написать отдельные README в `frontend-hub/` и `frontend-admin/` |

## Data flow

**Логин в админку:**

1. Пользователь открывает `http://app.na-linii.com/`.
2. Nginx отдаёт `/usr/share/nginx/html/app/index.html` (admin SPA).
3. React Router видит `/`, перенаправляет на `/dashboard`.
4. `AdminLayout` проверяет токен — нет → `navigate('/login')`.
5. Пользователь заполняет форму → `POST /api/login`.
6. Nginx проксирует `POST /api/login` → `hub-api:8000/admin/api/login`.
7. Hub-api отвечает токеном, сохраняется в localStorage.
8. Navigate на `/dashboard`.

**API запрос из админки:**

- `GET /api/dashboard/stats` (из adminClient) → nginx → `hub-api:8000/admin/api/dashboard/stats`.

## Error handling

- **401 на app.na-linii.com** → `window.location.href = '/login'` (adminClient interceptor).
- **401 на hub.na-linii.com** → без изменений.
- **502/503/504** — без изменений (текущая логика retry в React Query).
- **Logout flow:** кнопка выхода в `AdminLayout.tsx` очищает `localStorage.admin_token` / `admin_user` и вызывает `navigate('/login', { replace: true })` (уже работает, только с новым чистым URL).
- **Удалённый путь `hub.na-linii.com/admin/*`:** nginx-блок hub не содержит специального `location /admin` — путь падает в `location /` и отдаётся hub SPA. React Router хаба имеет catch-all `<Route path="*" element={<Navigate to="/" />} />`, который редиректит на `/`. Никаких специальных правил для удалённого пути не добавляется — архитектурно чистое поведение: несуществующий роут → главная.

## Testing

**Pre-deploy:**

- `dig +short app.na-linii.com` — проверить, что резолвится в IP сервера nalinii-test: `[ "$(dig +short app.na-linii.com)" = "158.160.85.19" ]`.
- `grep frontend /home/amorson/dental-hub/docker-compose.yml` — убедиться, что mount-ы ссылаются на существующие `frontend-hub/dist` и `frontend-admin/dist`.

**Локально:**

- `cd frontend-hub && npm ci && npm run build`.
- `cd frontend-admin && npm ci && npm run build`.
- `docker-compose up --build`.
- Добавить в `/etc/hosts`: `127.0.0.1 app.na-linii.com hub.na-linii.com`.
- Открыть `http://app.na-linii.com/` — должна грузиться админка (без /admin в URL).
- Открыть `http://hub.na-linii.com/` — должен грузиться hub.
- Проверить все admin-разделы (login → dashboard → chats → chat detail → actions → confirmations → settings → guide), API-вызовы через DevTools.
- Проверить logout.
- Проверить, что `http://hub.na-linii.com/admin` редиректит на `/` (hub SPA catch-all).
- `grep -rn "/admin" frontend-admin/src` → ни одного совпадения.
- `grep -rn "/admin" frontend-hub/src` → ни одного совпадения (кроме возможных комментариев).

**Prod (после deploy):**

- `curl -I http://app.na-linii.com/` → 200.
- `curl http://app.na-linii.com/api/dashboard/stats` (без токена) → 401.
- Ручной smoke-test: логин, дашборд, чат, actions, confirmations, settings, guide.
- Убедиться, что `hub.na-linii.com` и `hub.na-linii.com/langfuse` работают как раньше.
- Убедиться, что ngrok endpoint (для агентов) продолжает проксировать на Langfuse — попадает на default_server (hub-блок).

## Migration order (чтобы prod не сломался)

1. Разделить фронтенд (`frontend-hub/`, `frontend-admin/`) + admin: чистые URL. Локальная проверка.
2. Обновить nginx.conf и docker-compose. Локальная проверка.
3. Удалить SPA fallback в `hub/api.py` и `admin-frontend/`.
4. Обновить CI/CD workflow.
5. Deploy на prod.
6. После успешного deploy — удалить legacy артефакты.

## Open questions / риски

- **SSL/HTTPS:** сейчас nginx на :80. Если прод за Yandex Cloud LB / Cloudflare с TLS termination — добавить app.na-linii.com в сертификат. Если прямой :80 — это остаётся как есть до введения TLS.
- **Ngrok tunnel:** сейчас `ngrok → nginx:80` без указания Host. После добавления нового server_name ngrok будет попадать на default_server (hub). Это ок, т.к. ngrok используется для Langfuse API, которое под hub-доменом.
- **Общий код между frontend-hub и frontend-admin:** малый. Общие — axios, React Query, некоторые типы. Для первой итерации — дублирование (несколько сот строк) приемлемо; shared-пакет добавим, если возникнет реальное дублирование (YAGNI).
- **Deploy конфигурация путей:** SSH-deploy копирует файлы в конкретные пути на сервере. Нужно обновить скрипты deploy под новую структуру.
- **Cross-subdomain auth:** admin использует `localStorage.admin_token` и `admin_user` — эти ключи привязаны к origin (`app.na-linii.com`), поэтому hub auth (`hub.na-linii.com`, GitHub PAT в своём localStorage) изолирован автоматически. Никаких дополнительных мер не нужно.
