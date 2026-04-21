# Admin panel → app.na-linii.com Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Вынести админку с префикса `hub.na-linii.com/admin` на отдельный поддомен `app.na-linii.com/` с чистыми URL (без `/admin`) — разделить SPA на два независимых Vite-приложения, разделить nginx на два server-блока, убрать SPA fallback из hub-api.

**Architecture:** Два независимых Vite-проекта (`frontend-hub/`, `frontend-admin/`). Backend FastAPI один, admin-endpoints остаются в internal namespace `/admin/api/*`. Nginx на app.na-linii.com проксирует `/api/*` → `hub-api:8000/admin/api/*`. Раздача статики — только nginx, hub-api API-only.

**Tech Stack:** Vite 8, React 19, React Router 7, TypeScript 5.9, Tailwind 4, nginx, Docker Compose, GitHub Actions (SSH deploy на `158.160.85.19:/opt/dental-hub`).

**Spec:** `docs/superpowers/specs/2026-04-21-admin-app-subdomain-design.md`

---

## Chunk 0: Подготовка рабочей ветки

### Task 0: Feature branch

**Контекст:** CLAUDE.md запрещает коммиты в main напрямую. Вся работа — в feature-ветке, итог — через PR.

- [ ] **Step 1: Создать ветку**

```bash
cd /home/amorson/dental-hub
git checkout -b feat/admin-app-subdomain
```

- [ ] **Step 2: Убедиться, что ветка чистая и начинается с актуального main**

```bash
git status
git log -1 --oneline
```

Expected: `nothing to commit`, последний коммит соответствует `origin/main`.

---

## Chunk 1: Разделение frontend-react на два проекта

Цель: создать `frontend-hub/` и `frontend-admin/` как два независимых Vite-проекта. `frontend-react/` пока не удаляем — снимаем в самом конце.

### Task 1: Создать frontend-hub/ копированием

**Files:**
- Create: `frontend-hub/` (копия `frontend-react/` минус admin-файлы)

- [ ] **Step 1: Создать директорию и скопировать базу**

```bash
cd /home/amorson/dental-hub
cp -r frontend-react frontend-hub
```

- [ ] **Step 2: Удалить admin-файлы из frontend-hub**

```bash
cd /home/amorson/dental-hub/frontend-hub
rm -rf src/pages/admin
rm src/layouts/AdminLayout.tsx
rm -r src/layouts  # если пусто — проверить
rmdir src/layouts 2>/dev/null || true
rm src/api/adminClient.ts
rm src/config/adminStatuses.ts
rm src/hooks/useAdminQueries.ts
rm src/contexts/ThemeContext.tsx
rmdir src/contexts 2>/dev/null || true
rm src/utils/pluralize.ts
rmdir src/utils 2>/dev/null || true
rm -rf dist node_modules
```

- [ ] **Step 3: Обновить package.json — переименовать проект**

Modify: `frontend-hub/package.json:2`

Заменить `"name": "frontend-react"` → `"name": "frontend-hub"`.

- [ ] **Step 4: Проверить, что ничего лишнего не осталось**

Run:
```bash
cd /home/amorson/dental-hub/frontend-hub
ls src/
```

Expected: `App.tsx  api  assets  components  config  hooks  index.css  main.tsx  pages  types`  
(без `contexts`, `layouts`, `utils`, `pages/admin`)

- [ ] **Step 5: Commit**

```bash
cd /home/amorson/dental-hub
git add frontend-hub/
git commit -m "chore(frontend): создать frontend-hub/ (без admin-файлов)"
```

### Task 2: Создать frontend-admin/ копированием

**Files:**
- Create: `frontend-admin/` (копия `frontend-react/` минус hub-файлы)

- [ ] **Step 1: Создать директорию**

```bash
cd /home/amorson/dental-hub
cp -r frontend-react frontend-admin
```

- [ ] **Step 2: Удалить hub-файлы из frontend-admin**

```bash
cd /home/amorson/dental-hub/frontend-admin
# Удаляем hub-pages
rm src/pages/ClinicAdminsTab.tsx
rm src/pages/ClinicConfigTab.tsx
rm src/pages/ClinicCreatePage.tsx
rm src/pages/ClinicLayout.tsx
rm src/pages/ClinicVisualizerTab.tsx
rm src/pages/ClinicsPage.tsx
rm src/pages/QualityPage.tsx
rm src/pages/SettingsPage.tsx

# Удаляем hub-components
rm src/components/ChatPlayground.tsx
rm src/components/ClinicCard.tsx
rm src/components/ConfigField.tsx
rm src/components/ConfigSection.tsx
rm src/components/ErrorBoundary.tsx
rm src/components/ForceGraph3D.tsx
rm src/components/Layout.tsx
rm src/components/Login.tsx
rm src/components/ShapeIcon.tsx
rm src/components/TraceLog.tsx
rm src/components/VizLegend.tsx
rmdir src/components

# Удаляем hub-api и hub-hooks
rm src/api/client.ts
rm src/hooks/useAuth.ts

# Удаляем hub-config
rm src/config/viz.ts
rm src/config/design.ts

# Удаляем types (hub-only: Clinic, VizConfigEntry и т.д.)
rm -rf src/types

# Удаляем сборки
rm -rf dist node_modules
```

- [ ] **Step 3: Переименовать adminClient.ts → client.ts**

```bash
cd /home/amorson/dental-hub/frontend-admin
mv src/api/adminClient.ts src/api/client.ts
```

- [ ] **Step 4: Обновить package.json — переименовать проект**

Modify: `frontend-admin/package.json:2`

Заменить `"name": "frontend-react"` → `"name": "frontend-admin"`.

- [ ] **Step 5: Обновить index.html — title**

Modify: `frontend-admin/index.html:10`

Заменить `<title>НаЛинии — Личный кабинет</title>` → `<title>НаЛинии — Админ-панель</title>`.

- [ ] **Step 6: Проверить структуру**

Run:
```bash
cd /home/amorson/dental-hub/frontend-admin
ls src/ src/api src/pages
```

Expected:  
`src/`: `App.tsx  api  assets  config  contexts  hooks  index.css  layouts  main.tsx  pages  utils`  
`src/api/`: `client.ts`  
`src/pages/`: `admin/` (только)

- [ ] **Step 7: Commit**

```bash
cd /home/amorson/dental-hub
git add frontend-admin/
git commit -m "chore(frontend): создать frontend-admin/ (без hub-файлов)"
```

---

## Chunk 2: Frontend-admin — рефактор URL без /admin префикса

Цель: в `frontend-admin/` все роуты, navigate-вызовы, NAV_ITEMS и baseURL API-клиента — без `/admin`.

### Task 3: Переписать App.tsx в frontend-admin

**Files:**
- Rewrite: `frontend-admin/src/App.tsx`

- [ ] **Step 1: Полная замена содержимого файла**

Write:

```tsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AdminLayout } from './layouts/AdminLayout'
import { AdminLoginPage } from './pages/admin/AdminLoginPage'
import { AdminDashboardPage } from './pages/admin/AdminDashboardPage'
import { AdminChatsPage } from './pages/admin/AdminChatsPage'
import { AdminChatDetailPage } from './pages/admin/AdminChatDetailPage'
import { AdminActionsPage } from './pages/admin/AdminActionsPage'
import { AdminSettingsPage } from './pages/admin/AdminSettingsPage'
import { AdminConfirmationsPage } from './pages/admin/AdminConfirmationsPage'
import { AdminGuidePage } from './pages/admin/AdminGuidePage'
import { ThemeProvider } from './contexts/ThemeContext'

function SuperadminGuard({ children }: { children: React.ReactNode }) {
  try {
    const user = JSON.parse(localStorage.getItem('admin_user') || '{}')
    if (user.role === 'superadmin') return <>{children}</>
  } catch {}
  return <Navigate to="/dashboard" replace />
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5_000,
      gcTime: 120_000,
      retry: 3,
      retryDelay: (attemptIndex: number) => Math.min(1000 * 2 ** attemptIndex, 30_000),
      refetchOnWindowFocus: true,
    },
  },
})

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <ThemeProvider>
          <Routes>
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
          </Routes>
        </ThemeProvider>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
```

- [ ] **Step 2: Commit**

```bash
cd /home/amorson/dental-hub
git add frontend-admin/src/App.tsx
git commit -m "refactor(admin): App.tsx без /admin префикса — чистые роуты"
```

### Task 4: API клиент — baseURL '/api' и redirect '/login'

**Files:**
- Modify: `frontend-admin/src/api/client.ts:210`, `:225`

- [ ] **Step 1: Заменить baseURL**

Modify `frontend-admin/src/api/client.ts:210`:

Было:
```ts
const adminApi = axios.create({ baseURL: '/admin/api', timeout: 30_000 })
```

Стало:
```ts
const adminApi = axios.create({ baseURL: '/api', timeout: 30_000 })
```

- [ ] **Step 2: Заменить redirect в interceptor**

Modify `frontend-admin/src/api/client.ts:224-225`:

Было:
```ts
      if (!window.location.pathname.includes('/login')) {
        window.location.href = '/admin/login'
      }
```

Стало:
```ts
      if (!window.location.pathname.includes('/login')) {
        window.location.href = '/login'
      }
```

- [ ] **Step 3: Проверить**

Run:
```bash
cd /home/amorson/dental-hub/frontend-admin
grep -n "/admin" src/api/client.ts
```

Expected: ни одного вхождения `/admin` в путях (комментарии `// Backend: GET /admin/api/...` удалить для чистоты — они указывают на backend namespace, информативно, но могут ввести в заблуждение после рефакторинга).

- [ ] **Step 4: Удалить упоминания `/admin/api` в комментариях**

Modify: `frontend-admin/src/api/client.ts` — удалить все строки с комментариями `// Backend: GET /admin/api/...` (8 штук: строки 27, 37, 61, 115, 141, 157, 165).

- [ ] **Step 5: Повторная проверка**

Run:
```bash
grep -rn "/admin" frontend-admin/src/api/
```

Expected: ни одного вхождения.

- [ ] **Step 6: Commit**

```bash
cd /home/amorson/dental-hub
git add frontend-admin/src/api/client.ts
git commit -m "refactor(admin): API client baseURL '/api', logout → '/login'"
```

### Task 5: NAV_ITEMS без /admin префикса

**Files:**
- Modify: `frontend-admin/src/config/adminStatuses.ts:141-146`

- [ ] **Step 1: Заменить все `to: '/admin/X'` на `to: '/X'`**

Modify `frontend-admin/src/config/adminStatuses.ts:141-146`:

Было:
```ts
  { to: '/admin/dashboard', label: 'Дашборд', icon: LayoutDashboard },
  { to: '/admin/chats', label: 'Переписка', icon: MessageCircle },
  { to: '/admin/confirmations', label: 'Подтверждения', icon: CalendarCheck, superadminOnly: true },
  { to: '/admin/actions', label: 'Действия', icon: ClipboardList },
  { to: '/admin/settings', label: 'Настройки', icon: Settings },
  { to: '/admin/guide', label: 'Инструкция', icon: BookOpen },
```

Стало:
```ts
  { to: '/dashboard', label: 'Дашборд', icon: LayoutDashboard },
  { to: '/chats', label: 'Переписка', icon: MessageCircle },
  { to: '/confirmations', label: 'Подтверждения', icon: CalendarCheck, superadminOnly: true },
  { to: '/actions', label: 'Действия', icon: ClipboardList },
  { to: '/settings', label: 'Настройки', icon: Settings },
  { to: '/guide', label: 'Инструкция', icon: BookOpen },
```

- [ ] **Step 2: Commit**

```bash
cd /home/amorson/dental-hub
git add frontend-admin/src/config/adminStatuses.ts
git commit -m "refactor(admin): NAV_ITEMS — чистые пути без /admin"
```

### Task 6: AdminLayout — navigate('/login') вместо '/admin/login'

**Files:**
- Modify: `frontend-admin/src/layouts/AdminLayout.tsx:22, 32, 39, 50`

- [ ] **Step 1: Заменить все 4 вхождения**

Run:
```bash
cd /home/amorson/dental-hub/frontend-admin
sed -i "s|navigate('/admin/login'|navigate('/login'|g" src/layouts/AdminLayout.tsx
```

- [ ] **Step 2: Проверка**

Run:
```bash
grep -n "/admin" src/layouts/AdminLayout.tsx
```

Expected: ни одного вхождения.

- [ ] **Step 3: Commit**

```bash
cd /home/amorson/dental-hub
git add frontend-admin/src/layouts/AdminLayout.tsx
git commit -m "refactor(admin): AdminLayout — navigate('/login')"
```

### Task 7: Admin pages — все navigate('/admin/X') → navigate('/X')

**Files:**
- Modify: `frontend-admin/src/pages/admin/AdminLoginPage.tsx:15, 26`
- Modify: `frontend-admin/src/pages/admin/AdminDashboardPage.tsx:106`
- Modify: `frontend-admin/src/pages/admin/AdminChatsPage.tsx:115, 166`
- Modify: `frontend-admin/src/pages/admin/AdminChatDetailPage.tsx:180`
- Modify: `frontend-admin/src/pages/admin/AdminActionsPage.tsx:52`
- Modify: `frontend-admin/src/pages/admin/AdminConfirmationsPage.tsx:93`

- [ ] **Step 1: Замена через sed во всех admin pages**

Run:
```bash
cd /home/amorson/dental-hub/frontend-admin/src/pages/admin
sed -i "s|'/admin/dashboard'|'/dashboard'|g" AdminLoginPage.tsx
sed -i "s|'/admin/chats?controller=operator'|'/chats?controller=operator'|g" AdminDashboardPage.tsx
sed -i "s|\`/admin/chats/|\`/chats/|g" AdminChatsPage.tsx AdminActionsPage.tsx AdminConfirmationsPage.tsx
sed -i "s|'/admin/chats'|'/chats'|g" AdminChatDetailPage.tsx
```

- [ ] **Step 2: Проверка — ноль `/admin` в admin pages**

Run:
```bash
cd /home/amorson/dental-hub
grep -rn "/admin" frontend-admin/src/pages/
```

Expected: ни одного вхождения.

- [ ] **Step 3: Проверка по всему frontend-admin**

Run:
```bash
grep -rn "/admin" frontend-admin/src
```

Expected: ни одного вхождения (только может быть имена файлов типа `pages/admin/` — ок, имя директории не URL).

- [ ] **Step 4: Commit**

```bash
cd /home/amorson/dental-hub
git add frontend-admin/src/pages/
git commit -m "refactor(admin): pages — navigate без /admin префикса"
```

### Task 8: vite.config.ts — dev proxy '/api' на hub-api /admin/api/

**Files:**
- Modify: `frontend-admin/vite.config.ts`

- [ ] **Step 1: Заменить proxy**

Было:
```ts
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:8000',
      '/admin/api': 'http://localhost:8000',
    },
  },
```

Стало:
```ts
  server: {
    port: 5174,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        rewrite: (path) => path.replace(/^\/api/, '/admin/api'),
      },
    },
  },
```

Порт 5174 — чтобы не конфликтовать с frontend-hub (5173).

- [ ] **Step 2: Commit**

```bash
cd /home/amorson/dental-hub
git add frontend-admin/vite.config.ts
git commit -m "chore(admin): dev proxy /api → hub-api /admin/api, port 5174"
```

### Task 9: Проверить, что frontend-admin билдится

- [ ] **Step 1: Установить зависимости и собрать**

Run:
```bash
cd /home/amorson/dental-hub/frontend-admin
npm ci
npm run build
```

Expected: build успешен, создан `dist/`.

- [ ] **Step 2: Проверить, что в dist нет /admin**

Run:
```bash
cd /home/amorson/dental-hub/frontend-admin
grep -rn "/admin" dist/assets/*.js | head -5
```

Expected: ни одного вхождения. Если есть — найти источник:
```bash
grep -rn "/admin" src/ --include="*.ts" --include="*.tsx"
```
и устранить.

- [ ] **Step 3: Commit lock-file (если изменился)**

```bash
cd /home/amorson/dental-hub
git add frontend-admin/package-lock.json 2>/dev/null || true
git diff --cached --quiet || git commit -m "chore(admin): обновить package-lock.json"
```

---

## Chunk 3: Frontend-hub — удалить admin-части из App.tsx и client.ts

### Task 10: Frontend-hub App.tsx — убрать admin routes и SuperadminGuard

**Files:**
- Rewrite: `frontend-hub/src/App.tsx`

- [ ] **Step 1: Полная замена содержимого**

Write:

```tsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useAuth } from './hooks/useAuth'
import { Layout } from './components/Layout'
import { Login } from './components/Login'
import { ClinicsPage } from './pages/ClinicsPage'
import { ClinicCreatePage } from './pages/ClinicCreatePage'
import { ClinicLayout } from './pages/ClinicLayout'
import { ClinicVisualizerTab } from './pages/ClinicVisualizerTab'
import { ClinicConfigTab } from './pages/ClinicConfigTab'
import { ClinicAdminsTab } from './pages/ClinicAdminsTab'
import { SettingsPage } from './pages/SettingsPage'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5_000,
      gcTime: 120_000,
      retry: 3,
      retryDelay: (attemptIndex: number) => Math.min(1000 * 2 ** attemptIndex, 30_000),
      refetchOnWindowFocus: true,
    },
  },
})

function AuthGate({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, loading } = useAuth()
  if (loading) return null
  return isAuthenticated ? <>{children}</> : <Login />
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthGate>
          <Routes>
            <Route element={<Layout />}>
              <Route path="/" element={<ClinicsPage />} />
              <Route path="/clinics/new" element={<ClinicCreatePage />} />
              <Route path="/clinic/:clinicId" element={<ClinicLayout />}>
                <Route index element={<ClinicVisualizerTab />} />
                <Route path="config" element={<ClinicConfigTab />} />
                <Route path="admins" element={<ClinicAdminsTab />} />
              </Route>
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/visualizer" element={<Navigate to="/" replace />} />
            </Route>
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </AuthGate>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
```

- [ ] **Step 2: Проверка**

Run:
```bash
cd /home/amorson/dental-hub
grep -n "/admin\|Admin" frontend-hub/src/App.tsx
```

Expected: ни одного вхождения.

- [ ] **Step 3: Commit**

```bash
git add frontend-hub/src/App.tsx
git commit -m "refactor(hub): убрать admin-роуты из App.tsx"
```

### Task 11: Frontend-hub api/client.ts — убрать проверку startsWith('/admin')

**Files:**
- Modify: `frontend-hub/src/api/client.ts:24-27`

- [ ] **Step 1: Точечная замена блока**

Было (строки 24–27):
```ts
      // Don't clear admin_token/admin_user — separate auth system
      if (!window.location.pathname.startsWith('/admin')) {
        window.location.reload()
      }
```

Стало (одна строка):
```ts
      window.location.reload()
```

Обоснование: admin теперь на отдельном домене (`app.na-linii.com`), localStorage изолирован по origin — нет риска затереть admin_token из hub-клиента.

- [ ] **Step 2: Проверка**

Run:
```bash
cd /home/amorson/dental-hub
grep -n "/admin" frontend-hub/src/api/client.ts
grep -n "admin_token\|admin_user" frontend-hub/src/api/client.ts
```

Expected:
- `/admin` — 0 вхождений.
- `admin_token`/`admin_user` — 0 вхождений (комментарий про них тоже удалён вместе с блоком).

- [ ] **Step 3: Commit**

```bash
git add frontend-hub/src/api/client.ts
git commit -m "refactor(hub): убрать startsWith('/admin') из api/client.ts"
```

### Task 12: Frontend-hub vite.config — убрать /admin/api proxy

**Files:**
- Modify: `frontend-hub/vite.config.ts:11`

- [ ] **Step 1: Удалить `'/admin/api'` из proxy**

Было:
```ts
    proxy: {
      '/api': 'http://localhost:8000',
      '/admin/api': 'http://localhost:8000',
    },
```

Стало:
```ts
    proxy: {
      '/api': 'http://localhost:8000',
    },
```

- [ ] **Step 2: Commit**

```bash
git add frontend-hub/vite.config.ts
git commit -m "chore(hub): убрать /admin/api из dev proxy"
```

### Task 13: Frontend-hub — проверить билд

- [ ] **Step 1: npm ci && npm run build**

Run:
```bash
cd /home/amorson/dental-hub/frontend-hub
npm ci
npm run build
```

Expected: build успешен.

- [ ] **Step 2: Проверка — ноль /admin в исходниках**

Run:
```bash
cd /home/amorson/dental-hub
grep -rn "/admin" frontend-hub/src --include="*.ts" --include="*.tsx"
```

Expected: ни одного вхождения (имена директорий типа `pages/admin/` уже удалены).

- [ ] **Step 3: Commit lock-file**

```bash
git add frontend-hub/package-lock.json 2>/dev/null || true
git diff --cached --quiet || git commit -m "chore(hub): обновить package-lock.json"
```

---

## Chunk 4: Nginx, docker-compose, backend cleanup

### Task 14: Nginx — два server-блока

**Files:**
- Rewrite: `nginx/default.conf`

- [ ] **Step 1: Полная замена файла**

Write:

```nginx
# Hub + Langfuse
server {
    listen 80 default_server;
    server_name hub.na-linii.com _;
    client_max_body_size 10m;

    location / {
        root /usr/share/nginx/html/hub;
        try_files $uri /index.html;
    }

    # Hub API
    location /api/ {
        proxy_pass http://hub-api:8000/api/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 120s;
    }

    # Langfuse UI
    location /langfuse/ {
        proxy_pass http://langfuse-web:3000/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }

    # Langfuse public API (для удалённых агентов через ngrok)
    location /api/public/ {
        proxy_pass http://langfuse-web:3000/api/public/;
        proxy_set_header Host $host;
        proxy_read_timeout 30s;
    }

    # Langfuse next-auth API
    location /api/auth/ {
        proxy_pass http://langfuse-web:3000/api/auth/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Langfuse Next.js static + internal
    location /_next/ {
        proxy_pass http://langfuse-web:3000/_next/;
        proxy_set_header Host $host;
    }

    # Langfuse trpc
    location /api/trpc/ {
        proxy_pass http://langfuse-web:3000/api/trpc/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Agent gateway (Telegram webhook)
    location /gateway/ {
        proxy_pass http://172.17.0.1:8080/gateway/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 60s;
    }
}

# Admin (app.na-linii.com)
server {
    listen 80;
    server_name app.na-linii.com;
    client_max_body_size 10m;

    # Admin API: публичный /api/ → internal /admin/api/
    location /api/ {
        proxy_pass http://hub-api:8000/admin/api/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Admin SPA
    location / {
        root /usr/share/nginx/html/app;
        try_files $uri /index.html;
    }
}
```

- [ ] **Step 2: Проверить синтаксис**

Run (если nginx установлен):
```bash
docker run --rm -v /home/amorson/dental-hub/nginx/default.conf:/etc/nginx/conf.d/default.conf:ro nginx:alpine nginx -t
```

Expected: `syntax is ok` и `test is successful`.

- [ ] **Step 3: Commit**

```bash
cd /home/amorson/dental-hub
git add nginx/default.conf
git commit -m "feat(nginx): два server-блока — hub.na-linii.com и app.na-linii.com"
```

### Task 15: docker-compose.yml — два mount для статики, удалить admin-frontend

**Files:**
- Modify: `docker-compose.yml:5-14`

- [ ] **Step 1: Заменить nginx volumes**

Было:
```yaml
  nginx:
    image: nginx:alpine
    ports: ["80:80"]
    volumes:
      - ./nginx/default.conf:/etc/nginx/conf.d/default.conf:ro
      - ./admin-frontend:/usr/share/nginx/html/admin:ro
    depends_on:
      - hub-api
      - langfuse-web
    restart: unless-stopped
```

Стало:
```yaml
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

- [ ] **Step 2: Commit**

```bash
git add docker-compose.yml
git commit -m "chore(compose): nginx mounts — frontend-hub/dist, frontend-admin/dist"
```

### Task 16: Удалить admin-frontend/ директорию

**Files:**
- Delete: `admin-frontend/`

- [ ] **Step 1: Удалить директорию**

```bash
cd /home/amorson/dental-hub
git rm -rf admin-frontend
```

- [ ] **Step 2: Commit**

```bash
git commit -m "chore: удалить legacy admin-frontend/ (заменён frontend-admin/)"
```

---

## Chunk 5: Backend cleanup

### Task 17: hub/api.py — удалить SPA fallback + /assets mount

**Files:**
- Modify: `hub/api.py:842-858`, возможно `:15`

- [ ] **Step 1: Удалить блок SPA fallback**

Modify `hub/api.py`: удалить строки 842-858 (от комментария `# --- Frontend (React SPA with fallback) ---` до конца файла):

```python
# --- Frontend (React SPA with fallback) ---

frontend_dir = os.path.join(os.path.dirname(__file__), "..", "frontend")
if os.path.isdir(frontend_dir):
    from fastapi.responses import FileResponse

    app.mount("/assets", StaticFiles(directory=os.path.join(frontend_dir, "assets")), name="assets")

    @app.get("/{path:path}")
    async def spa_fallback(path: str):
        """Serve React SPA — all non-API routes return index.html (includes /admin/*)."""
        if path.startswith("langfuse"):
            raise HTTPException(404)
        file_path = os.path.join(frontend_dir, path)
        if os.path.isfile(file_path):
            return FileResponse(file_path)
        return FileResponse(os.path.join(frontend_dir, "index.html"))
```

Всё, целиком.

- [ ] **Step 2: Проверить используемые импорты**

Run:
```bash
cd /home/amorson/dental-hub
grep -n "StaticFiles\b" hub/
grep -n "FileResponse\b" hub/
grep -n "^import os\|^from os\b\| os\." hub/api.py | head -10
```

Expected:
- `StaticFiles` — только в `hub/api.py:15` (import-строка). Удалить import.
- `FileResponse` — только в удалённом блоке (локальный import строка 846). Уже удалён вместе с блоком.
- `os` — используется в других местах `hub/api.py` (env vars и прочее). Оставить импорт.

- [ ] **Step 3: Удалить неиспользуемый import StaticFiles**

Modify `hub/api.py:15` — удалить строку:
```python
from fastapi.staticfiles import StaticFiles
```

- [ ] **Step 4: Убедиться, что модуль импортируется**

Run:
```bash
cd /home/amorson/dental-hub
python -c "import sys; sys.path.insert(0, '.'); import hub.api" 2>&1 | head -5
```

Expected: либо успех, либо ошибка импорта не связана с нашими правками (например, отсутствующие env vars — это ок).

- [ ] **Step 5: Commit**

```bash
git add hub/api.py
git commit -m "refactor(hub-api): удалить SPA fallback и /assets mount — nginx раздаёт статику"
```

### Task 18: hub/Dockerfile — убрать copy frontend

**Files:**
- Modify: `hub/Dockerfile:7`

- [ ] **Step 1: Удалить строку с копированием frontend**

Было:
```dockerfile
COPY frontend-react/dist/ /app/frontend/
```

Удалить эту строку целиком.

- [ ] **Step 2: Commit**

```bash
git add hub/Dockerfile
git commit -m "chore(hub-api): убрать COPY frontend — nginx раздаёт статику"
```

---

## Chunk 6: CI/CD

### Task 19: .github/workflows/deploy.yml — собрать два фронта, скопировать две dist

**Files:**
- Rewrite: `.github/workflows/deploy.yml`

- [ ] **Step 1: Полная замена**

Write:

```yaml
name: Deploy Dental Hub

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: '22'

      - name: Build frontend-hub
        run: |
          cd frontend-hub
          npm ci
          npm run build

      - name: Build frontend-admin
        run: |
          cd frontend-admin
          npm ci
          npm run build

      - name: Deploy repo to server
        uses: appleboy/ssh-action@v1
        with:
          host: 158.160.85.19
          username: ${{ secrets.SSH_USER }}
          key: ${{ secrets.SSH_PRIVATE_KEY }}
          script: |
            cd /opt/dental-hub
            git fetch origin main
            git reset --hard FETCH_HEAD

      - name: Copy frontend-hub build
        uses: appleboy/scp-action@v0.1.7
        with:
          host: 158.160.85.19
          username: ${{ secrets.SSH_USER }}
          key: ${{ secrets.SSH_PRIVATE_KEY }}
          source: "frontend-hub/dist/"
          target: "/opt/dental-hub/"
          overwrite: true

      - name: Copy frontend-admin build
        uses: appleboy/scp-action@v0.1.7
        with:
          host: 158.160.85.19
          username: ${{ secrets.SSH_USER }}
          key: ${{ secrets.SSH_PRIVATE_KEY }}
          source: "frontend-admin/dist/"
          target: "/opt/dental-hub/"
          overwrite: true

      - name: Rebuild and restart
        uses: appleboy/ssh-action@v1
        with:
          host: 158.160.85.19
          username: ${{ secrets.SSH_USER }}
          key: ${{ secrets.SSH_PRIVATE_KEY }}
          script: |
            cd /opt/dental-hub
            docker compose build hub-api
            docker compose up -d hub-api nginx
            sleep 5
            curl -sf http://localhost:8880/ > /dev/null && echo "Hub healthy" || echo "Hub unhealthy"
```

Ключевое:
- Собираем оба фронта параллельно (два шага `npm run build`).
- Копируем две dist отдельными SCP шагами.
- `docker compose up -d hub-api nginx` — перезапускаем и nginx (для применения нового `default.conf` и монтажей).

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/deploy.yml
git commit -m "ci: билд frontend-hub и frontend-admin, перезапуск nginx"
```

---

## Chunk 7: Документация и финальный cleanup

### Task 20: Обновить README.md

**Files:**
- Modify: `README.md:29`, `:42`

- [ ] **Step 1: Прочитать и обновить разделы архитектуры**

Modify `README.md`: заменить
- `/admin/*    → Admin Panel` на `app.na-linii.com → Admin Panel`
- строку про `/admin/api/*` в таблице: `hub.na-linii.com/api/*` для hub; `app.na-linii.com/api/*` для admin (отражая backend internal namespace `/admin/api/*`).

(Точная формулировка — по стилю README, сохраняя таблицу.)

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs(readme): обновить архитектуру — admin на app.na-linii.com"
```

### Task 21: Обновить CLAUDE.md

**Files:**
- Modify: `/home/amorson/dental-hub/CLAUDE.md:16`, `:99-100`

- [ ] **Step 1: Обновить раздел архитектуры**

Modify `CLAUDE.md:13-17` — блок про nginx routing:

Было:
```
- `/` → Hub React SPA (Vite)
- `/api/*` → Hub API (FastAPI)
- `/langfuse/*` → Langfuse Web
- `/api/public/*` → Langfuse API (для агентов через ngrok)
- `/admin/*` → Admin Panel (login/password)
```

Стало:
```
- `hub.na-linii.com/` → Hub React SPA (frontend-hub)
- `hub.na-linii.com/api/*` → Hub API (FastAPI)
- `hub.na-linii.com/langfuse/*` → Langfuse Web
- `hub.na-linii.com/api/public/*` → Langfuse API (для агентов через ngrok)
- `app.na-linii.com/` → Admin Panel SPA (frontend-admin)
- `app.na-linii.com/api/*` → hub-api `/admin/api/*` (internal namespace)
```

- [ ] **Step 2: Обновить раздел Frontend Structure**

Заменить блок `Frontend Structure` — описать две отдельные директории `frontend-hub/` и `frontend-admin/`.

- [ ] **Step 3: Обновить раздел API**

Строки `:99-100` — оставить как internal-endpoints, но добавить пометку, что публично доступны как `app.na-linii.com/api/*`.

- [ ] **Step 4: Commit**

```bash
git add CLAUDE.md
git commit -m "docs(claude): обновить архитектуру — раздельные SPA и поддомены"
```

### Task 22: Удалить frontend-react/

**Files:**
- Delete: `frontend-react/`

- [ ] **Step 1: Последняя проверка — весь новый функционал работает**

Run:
```bash
cd /home/amorson/dental-hub
grep -rn "frontend-react" --include="*.yml" --include="*.yaml" --include="Dockerfile*" --include="*.md" --include="*.conf" | grep -v "^docs/superpowers/"
```

Expected: ни одного вхождения (всё перетащено на frontend-hub/frontend-admin).

- [ ] **Step 2: Удалить директорию**

```bash
cd /home/amorson/dental-hub
git rm -rf frontend-react
```

- [ ] **Step 3: Commit**

```bash
git commit -m "chore: удалить frontend-react/ — разделён на frontend-hub/ и frontend-admin/"
```

### Task 23: Обновить frontend-hub/README.md и создать frontend-admin/README.md

**Files:**
- Modify: `frontend-hub/README.md`
- Create: `frontend-admin/README.md`

- [ ] **Step 1: frontend-hub/README.md — заменить /admin/api упоминания**

Run:
```bash
cd /home/amorson/dental-hub
sed -i "s|/admin/api/\*|admin API (на app.na-linii.com)|g" frontend-hub/README.md
```

- [ ] **Step 2: Создать frontend-admin/README.md**

Write `frontend-admin/README.md`:

```markdown
# frontend-admin

Admin Panel SPA (оператор клиники).

## Dev

```bash
npm ci
npm run dev
```

Откроется на `http://localhost:5174` с proxy `/api/*` → `http://localhost:8000/admin/api/*` (hub-api).

## Build

```bash
npm run build
```

Output в `dist/`. Раздаётся nginx-ом из `/usr/share/nginx/html/app` на `app.na-linii.com`.

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
```

- [ ] **Step 3: Commit**

```bash
git add frontend-hub/README.md frontend-admin/README.md
git commit -m "docs: README для frontend-hub и frontend-admin"
```

---

## Chunk 8: Локальное smoke-тестирование

### Task 24: Локальный smoke test

- [ ] **Step 1: Собрать оба фронта**

Run:
```bash
cd /home/amorson/dental-hub
cd frontend-hub && npm run build && cd ..
cd frontend-admin && npm run build && cd ..
```

Expected: оба build успешны.

- [ ] **Step 2: Добавить hosts**

Run (требует sudo):
```bash
echo "127.0.0.1 app.na-linii.com hub.na-linii.com" | sudo tee -a /etc/hosts
```

(Если уже есть — пропустить.)

- [ ] **Step 3: Поднять compose**

Run:
```bash
cd /home/amorson/dental-hub
docker compose up -d --build nginx hub-api
sleep 5
docker compose ps
```

Expected: nginx и hub-api — Up.

- [ ] **Step 4: Проверить hub**

Run:
```bash
curl -sI http://hub.na-linii.com/ | head -3
curl -sI http://hub.na-linii.com/langfuse/ | head -3
```

Expected: `HTTP/1.1 200 OK` для обоих.

- [ ] **Step 5: Проверить admin**

Run:
```bash
curl -sI http://app.na-linii.com/ | head -3
curl -s http://app.na-linii.com/ | grep -o "<title>[^<]*</title>"
curl -sI http://app.na-linii.com/api/login | head -3
```

Expected:
- `HTTP/1.1 200 OK` на `/`
- `<title>НаЛинии — Админ-панель</title>`
- `401` или `405` (login требует POST) на `/api/login`

- [ ] **Step 6: Проверить ручной flow в браузере**

- Открыть `http://app.na-linii.com/`
- Должен отрисоваться login (URL: `/login`)
- Войти: после логина URL `/dashboard`
- Пройти все разделы: `/chats`, `/actions`, `/settings`, `/guide`
- URL ни разу не содержит `/admin`

- [ ] **Step 7: Проверить, что старый URL не работает**

Run:
```bash
curl -sL http://hub.na-linii.com/admin -o /dev/null -w "%{http_code} %{url_effective}\n"
```

Expected: hub SPA загружается, React Router редиректит на `/` (код 200, контент — главная hub).

- [ ] **Step 8: Остановить compose**

```bash
docker compose down
```

### Task 25: Pre-deploy DNS + SSL check

- [ ] **Step 1: Проверить резолвинг**

Run:
```bash
dig +short app.na-linii.com
```

Expected: `158.160.85.19` (или другой актуальный IP сервера nalinii-test).

Если не резолвится — пользователю нужно проверить DNS у регистратора. Останавливаем деплой.

- [ ] **Step 2: Проверить TLS/HTTPS setup**

Run (на сервере или удалённо):
```bash
ssh amorsonna-linii@158.160.85.19 "ss -tlnp | grep -E ':(80|443|8880)\b'"
```

Ожидание: на сервере `:80` слушает docker nginx. Если есть `:443` — значит где-то terminate-ится TLS (Cloudflare/LB/certbot). В этом случае перед деплоем убедиться, что `app.na-linii.com` добавлен в sertifikat/Cloudflare rule. Если только `:80` — вопрос HTTPS откладывается, app.na-linii.com будет доступен по HTTP.

Если HTTPS настроен через certbot + nginx-standalone (не docker nginx): дополнительно обновить certbot-конфиг с новым доменом.

---

## Chunk 9: Deploy на prod

### Task 26: Создать PR и замёрджить

- [ ] **Step 1: Убедиться, что всё закоммичено**

```bash
cd /home/amorson/dental-hub
git status
```

Expected: `nothing to commit`.

- [ ] **Step 2: Запушить ветку и создать PR**

```bash
git push -u origin feat/admin-app-subdomain
gh pr create --title "Перенос админки на app.na-linii.com" \
             --body "$(cat <<'EOF'
## Summary
- Админка переехала с `hub.na-linii.com/admin` на `app.na-linii.com/` (чистые URL без префикса).
- `frontend-react/` разделён на два независимых Vite-приложения: `frontend-hub/` и `frontend-admin/`.
- Nginx теперь отдаёт статику; hub-api — только API.

## Spec & Plan
- Spec: `docs/superpowers/specs/2026-04-21-admin-app-subdomain-design.md`
- Plan: `docs/superpowers/plans/2026-04-21-admin-app-subdomain.md`

## Test plan
- [ ] Pre-deploy: `dig +short app.na-linii.com` совпадает с IP сервера.
- [ ] Local smoke (Task 24) пройден.
- [ ] Prod smoke (Task 27): `app.na-linii.com` открывается, login → dashboard, все разделы.
- [ ] `hub.na-linii.com` и `hub.na-linii.com/langfuse` работают.
- [ ] `hub.na-linii.com/admin` деградирует корректно (SPA catch-all на `/`).
EOF
)"
```

- [ ] **Step 3: Review + merge**

После approval — merge в main. GitHub Actions запустит deploy.yml.

### Task 27: Пост-деплой smoke test на prod

- [ ] **Step 1: После deploy — убедиться, что workflow прошёл**

Run:
```bash
gh run list --workflow=deploy.yml --limit=1
```

Expected: `completed success`.

- [ ] **Step 2: Проверить оба домена**

Run:
```bash
curl -sI http://app.na-linii.com/ | head -3
curl -sI http://app.na-linii.com/api/dashboard/stats | head -3
curl -sI http://hub.na-linii.com/ | head -3
curl -sI http://hub.na-linii.com/langfuse/ | head -3
```

Expected:
- `app.na-linii.com/` → 200
- `app.na-linii.com/api/dashboard/stats` → 401 (требует токен) или 403
- `hub.na-linii.com/` → 200
- `hub.na-linii.com/langfuse/` → 200

- [ ] **Step 3: Проверить, что старый путь `hub.na-linii.com/admin` деградирует корректно**

Run:
```bash
curl -sL http://hub.na-linii.com/admin -o /dev/null -w "%{http_code} %{url_effective}\n"
```

Expected: 200, контент — hub SPA (React Router сделает client-side редирект на `/`). Никаких ошибок nginx.

- [ ] **Step 4: Ручной прогон**

Войти через `http://app.na-linii.com/` (оператор либо самостоятельно) и пройти основные сценарии: login → dashboard → chats → chat detail → actions → confirmations → settings → guide. URL ни разу не содержит `/admin`.

- [ ] **Step 5: Rollback план**

Если smoke-test провален:

```bash
# на сервере
cd /opt/dental-hub
git log --oneline -5                     # найти коммит до PR
git reset --hard <pre-merge-commit>      # откатить репо
docker compose up -d --build hub-api nginx
```

Затем revert PR на GitHub: `gh pr revert <PR_NUMBER>`.

Важно: админка будет недоступна до отката или фикса. Время простоя = 1 deploy cycle (~3 мин).

---

## Справочник: возможные точки отказа

| Симптом | Причина | Что делать |
|---|---|---|
| `app.na-linii.com/` → nginx welcome page | mount не сработал, пустой `frontend-admin/dist` | Проверить, что `npm run build` прошёл и dist скопирован на сервер |
| `app.na-linii.com/api/login` → 404 | nginx не переписывает на `/admin/api/login` | Проверить `proxy_pass` в app-блоке — должен быть `http://hub-api:8000/admin/api/` со слэшем в конце |
| `app.na-linii.com/dashboard` → 404 | try_files не отрабатывает | Проверить `try_files $uri /index.html` и что `index.html` в `dist/` |
| Админка редиректит в бесконечный цикл на `/login` | токен не прокидывается | Проверить baseURL в `src/api/client.ts` = `/api` |
| hub.na-linii.com — 404 | default_server не указан | Убедиться, что в hub-блоке `listen 80 default_server` |
| Langfuse перестал быть доступен агентам через ngrok | ngrok попал не в default_server | Проверить, что default_server = hub |

---

## Итого

- Коммитов: ~22 (по одному на таск).
- Изменяемых файлов: ~30.
- Удаляемых файлов/директорий: `admin-frontend/`, `frontend-react/`.
- Новых директорий: `frontend-hub/`, `frontend-admin/`.
- Пользовательские URL: чистые без `/admin`. Backend internal namespace `/admin/api/*` не трогаем.
