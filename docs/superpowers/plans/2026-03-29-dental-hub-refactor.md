# Dental Hub Refactor — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Переписать Dental Hub: nginx reverse proxy (единый домен), PostgreSQL вместо SQLite, React/TypeScript/Vite/Tailwind frontend с тем же дизайном.

**Architecture:** Nginx перед Hub API и Langfuse на одном домене. Hub API переходит на PostgreSQL (schema `hub` в langfuse-postgres). Frontend переписывается на React с сохранением визуального дизайна и 3D визуализаций.

**Tech Stack:** nginx, PostgreSQL 17 (asyncpg), React 18, TypeScript, Vite 6, Tailwind CSS, React Query, 3D Force Graph, Three.js

---

## Chunk 1: Nginx + Единый домен

### Task 1: Создать nginx.conf

**Files:**
- Create: `nginx/default.conf`

- [ ] **Step 1: Создать директорию и конфиг nginx**

```nginx
# nginx/default.conf
server {
    listen 80;
    client_max_body_size 10m;

    # Hub API + frontend
    location / {
        proxy_pass http://hub-api:8000;
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

    # Langfuse API (used by agents via ngrok)
    location /api/public/ {
        proxy_pass http://langfuse-web:3000/api/public/;
        proxy_set_header Host $host;
        proxy_read_timeout 30s;
    }

    # Reserved for future admin panel
    location /admin/ {
        return 503 '{"error":"Admin panel not yet deployed"}';
        add_header Content-Type application/json;
    }
}
```

- [ ] **Step 2: Commit**

```bash
git add nginx/default.conf
git commit -m "feat: nginx reverse proxy config for unified domain"
```

### Task 2: Обновить docker-compose.yml

**Files:**
- Modify: `docker-compose.yml`

- [ ] **Step 1: Добавить nginx сервис, переключить ngrok на nginx**

Добавить сервис `nginx` перед `hub-api`. Изменить `ngrok` command на `http nginx:80`. Убрать прямой порт 3000 у langfuse-web (доступ только через nginx). Убрать порт 8000 у hub-api.

- [ ] **Step 2: Обновить LANGFUSE_EXTERNAL_URL**

В `.env` и в `hub-api` environment:
`LANGFUSE_EXTERNAL_URL` → `https://axiomatic-aryana-hillocky.ngrok-free.dev/langfuse`

- [ ] **Step 3: Обновить NEXTAUTH_URL для Langfuse**

Langfuse environment: `NEXTAUTH_URL: ${LANGFUSE_EXTERNAL_URL:-http://localhost/langfuse}`

- [ ] **Step 4: docker compose up -d, проверить все маршруты**

```bash
docker compose up -d
curl -s http://localhost/health          # Hub API
curl -s http://localhost/langfuse/       # Langfuse UI
curl -s http://localhost/api/public/health  # Langfuse API
```

- [ ] **Step 5: Проверить ngrok**

```bash
curl -s http://localhost:4040/api/tunnels | python3 -c "import sys,json; print(json.load(sys.stdin)['tunnels'][0]['public_url'])"
```

- [ ] **Step 6: Обновить LANGFUSE_HOST на Yandex сервере**

```bash
ssh -l amorsonna-linii 158.160.240.47 "sudo sed -i 's|LANGFUSE_HOST=.*|LANGFUSE_HOST=https://axiomatic-aryana-hillocky.ngrok-free.dev|' /opt/dental-core/.env"
```

Langfuse API endpoints (`/api/public/*`) проксируются nginx напрямую, так что агенты на Yandex по-прежнему ходят на тот же ngrok URL.

- [ ] **Step 7: Commit**

```bash
git add docker-compose.yml .env
git commit -m "feat: nginx unified domain, ngrok tunnels nginx"
```

---

## Chunk 2: PostgreSQL миграция

### Task 3: Переписать hub/db.py на asyncpg

**Files:**
- Modify: `hub/db.py`
- Modify: `hub/Dockerfile` (добавить asyncpg)

- [ ] **Step 1: Обновить Dockerfile — добавить asyncpg**

В `hub/Dockerfile` заменить pip install: добавить `asyncpg`.

- [ ] **Step 2: Переписать db.py**

```python
"""Hub database — clinic registry (PostgreSQL)."""
import os
import json
import asyncpg

DATABASE_URL = os.environ.get("HUB_DATABASE_URL",
    "postgresql://langfuse:langfuse@langfuse-postgres:5432/langfuse")

_pool = None

async def get_pool():
    global _pool
    if _pool is None:
        _pool = await asyncpg.create_pool(DATABASE_URL, min_size=2, max_size=10)
    return _pool

async def init_db():
    pool = await get_pool()
    async with pool.acquire() as conn:
        await conn.execute("CREATE SCHEMA IF NOT EXISTS hub")
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS hub.clinics (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                server_host TEXT NOT NULL,
                server_port INTEGER DEFAULT 8080,
                clinic_id TEXT NOT NULL,
                status TEXT DEFAULT 'active',
                config JSONB DEFAULT '{}',
                created_at TIMESTAMPTZ DEFAULT NOW(),
                updated_at TIMESTAMPTZ DEFAULT NOW()
            )
        """)

async def get_clinics():
    pool = await get_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch("SELECT * FROM hub.clinics ORDER BY created_at")
        return [dict(r) for r in rows]

async def get_clinic(clinic_id: str):
    pool = await get_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow("SELECT * FROM hub.clinics WHERE id = $1", clinic_id)
        return dict(row) if row else None

async def add_clinic(data: dict):
    pool = await get_pool()
    async with pool.acquire() as conn:
        await conn.execute("""
            INSERT INTO hub.clinics (id, name, server_host, server_port, clinic_id, status, config)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            ON CONFLICT (id) DO UPDATE SET
                name = EXCLUDED.name,
                server_host = EXCLUDED.server_host,
                server_port = EXCLUDED.server_port,
                clinic_id = EXCLUDED.clinic_id,
                config = EXCLUDED.config,
                updated_at = NOW()
        """, data["id"], data["name"], data["server_host"],
            data.get("server_port", 8080),
            data.get("clinic_id", data["id"]),
            "active",
            json.dumps(data.get("config", {})))
    return data

async def remove_clinic(clinic_id: str):
    pool = await get_pool()
    async with pool.acquire() as conn:
        await conn.execute("DELETE FROM hub.clinics WHERE id = $1", clinic_id)
```

- [ ] **Step 3: Обновить docker-compose — добавить HUB_DATABASE_URL**

```yaml
hub-api:
  environment:
    HUB_DATABASE_URL: postgresql://langfuse:langfuse@langfuse-postgres:5432/langfuse
```

- [ ] **Step 4: Засидить Зубатку в новую БД**

```bash
docker compose exec hub-api python -c "
import asyncio, json
from hub.db import init_db, add_clinic
async def seed():
    await init_db()
    await add_clinic({
        'id': 'zubatka', 'name': 'Зубатка',
        'server_host': '158.160.240.47', 'server_port': 8080,
        'clinic_id': 'zubatka',
        'config': {'CRM': 'Google Sheets', 'MODEL': 'gpt-5.4-mini'}
    })
    print('Seeded')
asyncio.run(seed())
"
```

- [ ] **Step 5: Проверить API**

```bash
curl -s http://localhost/api/clinics -H "Authorization: Bearer <token>"
```

- [ ] **Step 6: Удалить hub_data volume (SQLite больше не нужен)**

- [ ] **Step 7: Commit**

```bash
git add hub/db.py hub/Dockerfile docker-compose.yml
git commit -m "feat: migrate hub DB from SQLite to PostgreSQL (schema hub)"
```

---

## Chunk 3: React Frontend — Scaffold + Auth + Layout

### Task 4: Инициализировать Vite + React + TypeScript + Tailwind

**Files:**
- Create: `frontend-react/` (новая директория)

- [ ] **Step 1: Scaffold Vite проект**

```bash
cd /home/amorson/dental-hub
npm create vite@latest frontend-react -- --template react-ts
cd frontend-react
npm install
npm install -D tailwindcss @tailwindcss/vite
npm install react-router-dom @tanstack/react-query axios
npm install three 3d-force-graph three-spritetext
npm install -D @types/three
```

- [ ] **Step 2: Настроить Tailwind**

`frontend-react/src/index.css`:
```css
@import "tailwindcss";
```

`frontend-react/vite.config.ts`:
```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/api': 'http://localhost:8000',
    }
  }
})
```

- [ ] **Step 3: Настроить Tailwind theme (текущие цвета)**

`frontend-react/tailwind.config.js`:
```javascript
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#0a0a1a',
        card: '#111127',
        border: '#1e293b',
        muted: '#64748b',
        accent: '#7dd3fc',
      }
    }
  }
}
```

- [ ] **Step 4: Commit**

```bash
git add frontend-react/
git commit -m "feat: scaffold React/TypeScript/Vite/Tailwind frontend"
```

### Task 5: API client + TypeScript types

**Files:**
- Create: `frontend-react/src/api/client.ts`
- Create: `frontend-react/src/types/index.ts`

- [ ] **Step 1: Типы**

```typescript
// types/index.ts
export interface Clinic {
  id: string
  name: string
  server_host: string
  server_port: number
  clinic_id: string
  status: string
  config: Record<string, unknown>
  created_at: string
}

export interface HealthResponse {
  status: string
  error?: string
}

export interface ChatResponse {
  response: string
  trace_id?: string
  thread_id: string
  error?: boolean
}

export interface GraphNode {
  id: string
  name: string
  group: string
  val: number
  shape: string
  planned?: boolean
  description?: string
  connects_to?: string[]
}

export interface GraphLink {
  source: string
  target: string
}

export interface GraphData {
  nodes: GraphNode[]
  links: GraphLink[]
}

export interface EdgeCaseItem {
  id: string
  category: string
  message: string
  expected: string
  patient_name?: string
  patient_phone?: string
  is_identified: boolean
  history: Array<{ role: string; content: string }>
}

export interface TraceFlow {
  name: string
  type: string
  model?: string
  startTime?: string
  endTime?: string
  input?: unknown
  output?: unknown
  id: string
  parentId?: string
}
```

- [ ] **Step 2: API client**

```typescript
// api/client.ts
import axios from 'axios'
import type { Clinic, ChatResponse, GraphData, EdgeCaseItem, HealthResponse, TraceFlow } from '../types'

const api = axios.create({ baseURL: '/api' })

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('dp_token')
  if (token) {
    config.headers.Authorization = `Bearer ${atob(token)}`
  }
  return config
})

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.clear()
      window.location.reload()
    }
    return Promise.reject(err)
  }
)

export const clinicsApi = {
  list: () => api.get<{ clinics: Clinic[] }>('/clinics').then(r => r.data.clinics),
  health: (id: string) => api.get<HealthResponse>(`/clinics/${id}/health`).then(r => r.data),
  config: (id: string) => api.get(`/clinics/${id}/config`).then(r => r.data),
  chat: (id: string, body: Record<string, unknown>) =>
    api.post<ChatResponse>(`/clinics/${id}/chat`, body).then(r => r.data),
  graph: (id: string, params?: Record<string, string>) =>
    api.get<GraphData>(`/clinics/${id}/graph`, { params }).then(r => r.data),
}

export const edgeCasesApi = {
  list: () => api.get<{ items: EdgeCaseItem[] }>('/edge-cases').then(r => r.data.items),
}

export const traceApi = {
  get: (traceId: string) =>
    api.get<{ flow: TraceFlow[] }>(`/trace/${traceId}`).then(r => r.data),
}

export const langfuseApi = {
  url: () => api.get<{ url: string }>('/langfuse-url').then(r => r.data.url),
}
```

- [ ] **Step 3: Commit**

### Task 6: Auth + Layout + Router

**Files:**
- Create: `frontend-react/src/hooks/useAuth.ts`
- Create: `frontend-react/src/components/Layout.tsx`
- Create: `frontend-react/src/components/Login.tsx`
- Modify: `frontend-react/src/App.tsx`
- Modify: `frontend-react/src/main.tsx`

- [ ] **Step 1: useAuth hook**

```typescript
// hooks/useAuth.ts
import { useState, useEffect, useCallback } from 'react'
import { clinicsApi } from '../api/client'

interface User {
  login: string
  avatar: string
  name: string
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const stored = localStorage.getItem('dp_user')
    const token = localStorage.getItem('dp_token')
    if (stored && token) {
      setUser(JSON.parse(stored))
    }
    setLoading(false)
  }, [])

  const login = useCallback(async (token: string) => {
    localStorage.setItem('dp_token', btoa(token))
    // Verify via backend
    await clinicsApi.list()
    // Get user info
    const r = await fetch('https://api.github.com/user', {
      headers: { Authorization: `Bearer ${token}` }
    })
    const gh = await r.json()
    const u: User = { login: gh.login, avatar: gh.avatar_url, name: gh.name || gh.login }
    localStorage.setItem('dp_user', JSON.stringify(u))
    setUser(u)
  }, [])

  const logout = useCallback(() => {
    localStorage.clear()
    setUser(null)
  }, [])

  return { user, loading, login, logout, isAuthenticated: !!user }
}
```

- [ ] **Step 2: Login component**

```typescript
// components/Login.tsx
import { useState } from 'react'
import { useAuth } from '../hooks/useAuth'

export function Login() {
  const { login } = useAuth()
  const [token, setToken] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async () => {
    if (!token.trim()) { setError('Вставь токен'); return }
    setLoading(true); setError('')
    try {
      await login(token.trim())
    } catch (e: any) {
      setError(e.response?.status === 403 ? 'Not a member of the org' : 'Invalid token')
    } finally { setLoading(false) }
  }

  return (
    <div className="fixed inset-0 bg-bg flex items-center justify-center flex-col gap-4">
      <h1 className="text-accent text-2xl font-bold">Dental Hub</h1>
      <p className="text-muted text-sm max-w-md text-center">
        Вставь GitHub Personal Access Token с доступом к организации
      </p>
      <input
        value={token} onChange={e => setToken(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && handleSubmit()}
        placeholder="ghp_..."
        className="w-96 px-3 py-2 rounded-md border border-border bg-card text-white text-sm outline-none focus:border-accent text-center"
      />
      <button onClick={handleSubmit} disabled={loading}
        className="px-6 py-2 rounded-lg bg-accent text-bg font-semibold text-sm cursor-pointer disabled:opacity-50">
        {loading ? 'Проверяю...' : 'Войти'}
      </button>
      {error && <div className="text-red-400 text-sm">{error}</div>}
    </div>
  )
}
```

- [ ] **Step 3: Layout с навигацией (точная копия текущего дизайна)**

```typescript
// components/Layout.tsx
import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

const tabs = [
  { to: '/', label: 'Clinics' },
  { to: '/visualizer', label: 'Visualizer' },
  { to: '/architecture', label: 'Architecture' },
  { to: '/edge-cases', label: 'Edge Cases' },
  { to: '/roadmap', label: 'Roadmap' },
]

export function Layout() {
  const { user, logout } = useAuth()

  return (
    <div className="min-h-screen bg-bg text-white">
      <nav className="bg-card border-b border-border px-6 flex items-center h-12 gap-6">
        <span className="font-bold text-accent text-base">Dental Hub</span>
        <div className="flex">
          {tabs.map(t => (
            <NavLink key={t.to} to={t.to} end={t.to === '/'}
              className={({ isActive }) =>
                `px-4 py-2.5 text-sm border-b-2 transition-colors ${
                  isActive ? 'text-accent border-accent' : 'text-muted border-transparent hover:text-white'
                }`
              }>
              {t.label}
            </NavLink>
          ))}
        </div>
        {user && (
          <div className="ml-auto flex items-center gap-2 text-xs text-muted">
            <img src={user.avatar} className="w-6 h-6 rounded-full" />
            <span className="text-white">{user.name}</span>
            <button onClick={logout} className="text-muted hover:text-white ml-2">Logout</button>
          </div>
        )}
      </nav>
      <Outlet />
    </div>
  )
}
```

- [ ] **Step 4: App.tsx с роутингом**

```typescript
// App.tsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useAuth } from './hooks/useAuth'
import { Layout } from './components/Layout'
import { Login } from './components/Login'
import { ClinicsPage } from './pages/ClinicsPage'
import { EdgeCasesPage } from './pages/EdgeCasesPage'

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, retry: 1 } }
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
              <Route path="/edge-cases" element={<EdgeCasesPage />} />
              {/* Visualizer, Architecture, Roadmap — добавляются в следующих задачах */}
              <Route path="*" element={<Navigate to="/" />} />
            </Route>
          </Routes>
        </AuthGate>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
```

- [ ] **Step 5: Commit**

---

## Chunk 4: React Pages — Clinics + Edge Cases

### Task 7: ClinicsPage

**Files:**
- Create: `frontend-react/src/pages/ClinicsPage.tsx`
- Create: `frontend-react/src/components/ClinicCard.tsx`

- [ ] **Step 1: ClinicCard component**

Карточка клиники с health indicator (зелёная/красная точка), кнопками Config и Open Visualizer. Используем `useQuery` для health polling каждые 30 сек.

- [ ] **Step 2: ClinicsPage**

Грид карточек через `useQuery` к `/api/clinics`. Auto-refetch.

- [ ] **Step 3: Commit**

### Task 8: EdgeCasesPage

**Files:**
- Create: `frontend-react/src/pages/EdgeCasesPage.tsx`
- Create: `frontend-react/src/components/EdgeCaseCard.tsx`

- [ ] **Step 1: EdgeCaseCard**

Раскрываемая карточка с параметрами пациента, историей, кнопкой Run. Ответ агента + ссылка на trace в Langfuse.

- [ ] **Step 2: EdgeCasesPage**

Загрузка из `useQuery('/api/edge-cases')`, группировка по category, селектор клиники, кнопка Run All.

- [ ] **Step 3: Commit**

---

## Chunk 5: React Pages — Visualizer + Architecture + Roadmap

### Task 9: ForceGraph3D React wrapper

**Files:**
- Create: `frontend-react/src/components/ForceGraph3D.tsx`
- Create: `frontend-react/src/config/viz.ts`

- [ ] **Step 1: viz.ts — портировать viz-config.js**

Цвета, формы, метки — те же значения, TypeScript типы.

- [ ] **Step 2: ForceGraph3D.tsx**

React ref-based обёртка над `3d-force-graph`. Props: `data: GraphData`, `onNodeClick`, `animateFlow`. Cleanup на unmount.

- [ ] **Step 3: Commit**

### Task 10: VisualizerPage

**Files:**
- Create: `frontend-react/src/pages/VisualizerPage.tsx`
- Create: `frontend-react/src/components/ChatPlayground.tsx`
- Create: `frontend-react/src/components/TraceLog.tsx`

- [ ] **Step 1: ChatPlayground**

Форма отправки: channel, user_id, phone, name. Отображение ответа бота. Ссылка на trace animation.

- [ ] **Step 2: TraceLog**

Коллапсируемые строки с observations, expandable input/output.

- [ ] **Step 3: VisualizerPage**

Layout: 3D граф слева, чат справа, trace log внизу. Загрузка графа по выбранной клинике.

- [ ] **Step 4: Commit**

### Task 11: ArchitecturePage

**Files:**
- Create: `frontend-react/src/pages/ArchitecturePage.tsx`

- [ ] **Step 1: ArchitecturePage**

3D граф с planned nodes (прозрачные), sidebar с деталями ноды. Click → sidebar update. Портировать логику из arch-viz.js.

- [ ] **Step 2: Commit**

### Task 12: RoadmapPage

**Files:**
- Create: `frontend-react/src/pages/RoadmapPage.tsx`

- [ ] **Step 1: RoadmapPage**

Статичный timeline + component status matrix. Данные из массива в компоненте (как сейчас в index.html).

- [ ] **Step 2: Commit**

---

## Chunk 6: Интеграция + чистка

### Task 13: Hub API — отдавать React SPA

**Files:**
- Modify: `hub/api.py`
- Modify: `hub/Dockerfile`

- [ ] **Step 1: Build React frontend**

```bash
cd frontend-react && npm run build
```

Output: `frontend-react/dist/`

- [ ] **Step 2: Обновить Dockerfile — копировать dist/**

```dockerfile
COPY frontend-react/dist/ /app/frontend/
```

- [ ] **Step 3: Обновить api.py — SPA fallback**

StaticFiles mount + SPA fallback для React Router.

- [ ] **Step 4: Commit**

### Task 14: Удалить старый plain JS frontend

**Files:**
- Delete: `frontend/js/*.js` (8 файлов)
- Delete: `frontend/css/style.css`
- Delete: `frontend/index.html`

- [ ] **Step 1: Удалить директорию frontend/**

- [ ] **Step 2: Обновить docker-compose — убрать volume mount для frontend**

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "chore: remove old plain JS frontend, replaced by React"
```

### Task 15: End-to-end проверка

- [ ] **Step 1: docker compose up -d --build**
- [ ] **Step 2: Проверить все маршруты через nginx**
- [ ] **Step 3: Проверить Langfuse доступен через /langfuse/**
- [ ] **Step 4: Проверить edge cases загружаются из dataset**
- [ ] **Step 5: Проверить 3D визуализация работает**
- [ ] **Step 6: Проверить агент на Yandex подключается к Langfuse через ngrok**
