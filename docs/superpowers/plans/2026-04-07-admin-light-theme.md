# Admin Panel Light Theme — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add light/dark theme switching to the admin panel with light as default, colors from the previous admin-panel-frontend project.

**Architecture:** Semantic CSS color tokens via Tailwind v4 `@theme inline` + CSS custom properties switched by `dark` class on `<html>`. ThemeContext provides toggle. Sidebar stays dark in both themes.

**Tech Stack:** React 19, Tailwind CSS 4, Lucide React icons, localStorage

**Spec:** `docs/superpowers/specs/2026-04-07-admin-light-theme-design.md`

**Reference project (colors):** `/tmp/admin-panel-frontend/frontend/src/` (cloned from `na-linii/admin-panel-frontend`)

---

## Chunk 1: Theme Infrastructure

### Task 1: CSS foundation — tokens, dark mode variant, scrollbar, autofill

**Files:**
- Modify: `frontend-react/src/index.css`

- [ ] **Step 1: Add `@custom-variant dark` and CSS color tokens to `index.css`**

Replace the entire `index.css` with:

```css
@import "tailwindcss";

/* ── Class-based dark mode ─────────────────────────── */
@custom-variant dark (&:where(.dark, .dark *));

/* ── Light theme (default) ─────────────────────────── */
:root {
  --color-surface: #ffffff;
  --color-surface-secondary: #f9fafb;
  --color-surface-tertiary: #f3f4f6;
  --color-text-primary: #111827;
  --color-text-secondary: #4b5563;
  --color-text-tertiary: #6b7280;
  --color-text-muted: #9ca3af;
  --color-border: #e5e7eb;
  --color-border-light: #f3f4f6;
  --color-accent: #059669;
  --color-accent-soft: rgba(5, 150, 105, 0.1);
  --color-sidebar-bg: #121429;
  --color-sidebar-border: #e5e7eb;
}

/* ── Dark theme ────────────────────────────────────── */
.dark {
  --color-surface: #0d0d1a;
  --color-surface-secondary: #111127;
  --color-surface-tertiary: rgba(255, 255, 255, 0.04);
  --color-text-primary: #e0e0e0;
  --color-text-secondary: #94a3b8;
  --color-text-tertiary: #64748b;
  --color-text-muted: #475569;
  --color-border: rgba(255, 255, 255, 0.08);
  --color-border-light: rgba(255, 255, 255, 0.04);
  --color-accent: #51ff97;
  --color-accent-soft: rgba(81, 255, 151, 0.1);
  --color-sidebar-bg: #121429;
  --color-sidebar-border: rgba(255, 255, 255, 0.06);
}

/* ── Tailwind theme tokens ─────────────────────────── */
@theme inline {
  --font-sans: 'Mulish', ui-sans-serif, system-ui, -apple-system, sans-serif;
  --color-surface: var(--color-surface);
  --color-surface-secondary: var(--color-surface-secondary);
  --color-surface-tertiary: var(--color-surface-tertiary);
  --color-text-primary: var(--color-text-primary);
  --color-text-secondary: var(--color-text-secondary);
  --color-text-tertiary: var(--color-text-tertiary);
  --color-text-muted: var(--color-text-muted);
  --color-border: var(--color-border);
  --color-border-light: var(--color-border-light);
  --color-accent: var(--color-accent);
  --color-accent-soft: var(--color-accent-soft);
  --color-sidebar-bg: var(--color-sidebar-bg);
  --color-sidebar-border: var(--color-sidebar-border);
  --color-brand-green: #51ff97;
  --color-brand-green-hover: #66ffaa;
  --color-brand-dark: #121429;
  --color-brand-darker: #0c0e1a;
}

body {
  margin: 0;
  font-family: var(--font-sans);
  background: var(--color-surface);
  color: var(--color-text-primary);
  min-height: 100vh;
}

#root {
  min-height: 100vh;
}

/* ── Scrollbar (light) ──────────────────────────────── */
::-webkit-scrollbar { width: 6px; height: 6px; }
::-webkit-scrollbar-track { background: rgba(0, 0, 0, 0.02); }
::-webkit-scrollbar-thumb { background: rgba(0, 0, 0, 0.12); border-radius: 3px; }
::-webkit-scrollbar-thumb:hover { background: rgba(0, 0, 0, 0.22); }

/* ── Scrollbar (dark) ───────────────────────────────── */
.dark ::-webkit-scrollbar-track { background: rgba(255, 255, 255, 0.02); }
.dark ::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.12); }
.dark ::-webkit-scrollbar-thumb:hover { background: rgba(255, 255, 255, 0.22); }

html { scroll-behavior: smooth; }
::selection { background-color: rgba(81, 255, 151, 0.25); color: white; }

/* ── Autofill (light) ───────────────────────────────── */
input:-webkit-autofill,
input:-webkit-autofill:hover,
input:-webkit-autofill:focus {
  -webkit-box-shadow: 0 0 0 1000px white inset;
  -webkit-text-fill-color: #111827;
  transition: background-color 5000s ease-in-out 0s;
}

/* ── Autofill (dark) ────────────────────────────────── */
.dark input:-webkit-autofill,
.dark input:-webkit-autofill:hover,
.dark input:-webkit-autofill:focus {
  -webkit-box-shadow: 0 0 0 1000px #161830 inset;
  -webkit-text-fill-color: white;
  transition: background-color 5000s ease-in-out 0s;
}

/* ── Reduced motion ──────────────────────────────────── */
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

- [ ] **Step 2: Verify build compiles**

Run: `cd frontend-react && npx vite build 2>&1 | tail -5`
Expected: Build succeeds without errors

- [ ] **Step 3: Commit**

```bash
git add frontend-react/src/index.css
git commit -m "feat(admin): add CSS theme tokens, dark mode variant, scrollbar and autofill styles"
```

---

### Task 2: ThemeContext

**Files:**
- Create: `frontend-react/src/contexts/ThemeContext.tsx`

- [ ] **Step 1: Create ThemeContext**

```tsx
import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import type { ReactNode } from 'react'

type Theme = 'light' | 'dark'

interface ThemeContextType {
  theme: Theme
  toggleTheme: () => void
}

const ThemeContext = createContext<ThemeContextType | null>(null)

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => {
    const saved = localStorage.getItem('admin_theme')
    if (saved === 'light' || saved === 'dark') return saved
    return 'light'
  })

  useEffect(() => {
    const root = document.documentElement
    if (theme === 'dark') {
      root.classList.add('dark')
    } else {
      root.classList.remove('dark')
    }
    localStorage.setItem('admin_theme', theme)

    // Cleanup: remove dark class when provider unmounts (navigating away from admin)
    return () => {
      root.classList.remove('dark')
    }
  }, [theme])

  const toggleTheme = useCallback(() => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light')
  }, [])

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme(): ThemeContextType {
  const context = useContext(ThemeContext)
  if (!context) throw new Error('useTheme must be used within ThemeProvider')
  return context
}
```

- [ ] **Step 2: Verify build compiles**

Run: `cd frontend-react && npx vite build 2>&1 | tail -5`

- [ ] **Step 3: Commit**

```bash
git add frontend-react/src/contexts/ThemeContext.tsx
git commit -m "feat(admin): add ThemeContext with localStorage persistence"
```

---

### Task 3: Wrap admin routes with ThemeProvider

**Files:**
- Modify: `frontend-react/src/App.tsx`

- [ ] **Step 1: Add ThemeProvider import and wrap admin routes**

Add import at top:
```tsx
import { ThemeProvider } from './contexts/ThemeContext'
```

Wrap admin login route:
```tsx
<Route path="/admin/login" element={<ThemeProvider><AdminLoginPage /></ThemeProvider>} />
```

Wrap admin layout route:
```tsx
<Route path="/admin" element={<ThemeProvider><AdminLayout /></ThemeProvider>}>
```

- [ ] **Step 2: Verify build compiles**

Run: `cd frontend-react && npx vite build 2>&1 | tail -5`

- [ ] **Step 3: Commit**

```bash
git add frontend-react/src/App.tsx
git commit -m "feat(admin): wrap admin routes with ThemeProvider"
```

---

### Task 4: AdminLayout — theme toggle + semantic colors

**Files:**
- Modify: `frontend-react/src/layouts/AdminLayout.tsx`

- [ ] **Step 1: Add theme toggle and update all colors**

Key changes:
1. Import `Sun, Moon` from lucide-react and `useTheme` from ThemeContext
2. Add `const { theme, toggleTheme } = useTheme()` in component
3. Add theme toggle button above logout button in sidebar user section
4. Replace all hardcoded colors with semantic tokens + `dark:` overrides
5. Sidebar stays dark (uses `bg-sidebar-bg` which is `#121429` in both themes)

Full replacement for `AdminLayout.tsx`:

```tsx
import { useState, useEffect } from 'react'
import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { LayoutDashboard, MessageCircle, CalendarCheck, ClipboardList, Settings, LogOut, Menu, Sun, Moon } from 'lucide-react'

function NaLiniiLogo({ className = 'w-8 h-8' }: { className?: string }) {
  return <img src="/logo.svg" alt="НаЛинии" className={className} />
}
import { adminMe } from '../api/adminClient'
import type { AdminUser } from '../api/adminClient'
import { useTheme } from '../contexts/ThemeContext'

const navItems = [
  { to: '/admin/dashboard', label: 'Дашборд', icon: LayoutDashboard },
  { to: '/admin/chats', label: 'Чаты', icon: MessageCircle },
  { to: '/admin/confirmations', label: 'Подтверждения', icon: CalendarCheck },
  { to: '/admin/actions', label: 'Действия', icon: ClipboardList },
  { to: '/admin/settings', label: 'Настройки', icon: Settings },
]

export function AdminLayout() {
  const [user, setUser] = useState<AdminUser | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const navigate = useNavigate()
  const { theme, toggleTheme } = useTheme()

  useEffect(() => {
    const token = localStorage.getItem('admin_token')
    if (!token) {
      navigate('/admin/login', { replace: true })
      return
    }
    const stored = localStorage.getItem('admin_user')
    if (stored) {
      setUser(JSON.parse(stored))
    }
    adminMe().then(setUser).catch(() => {
      localStorage.removeItem('admin_token')
      localStorage.removeItem('admin_user')
      navigate('/admin/login', { replace: true })
    })
  }, [navigate])

  const handleLogout = () => {
    localStorage.removeItem('admin_token')
    localStorage.removeItem('admin_user')
    navigate('/admin/login', { replace: true })
  }

  // Session inactivity timeout (4 hours)
  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>
    const resetTimer = () => {
      clearTimeout(timeout)
      timeout = setTimeout(() => {
        localStorage.removeItem('admin_token')
        localStorage.removeItem('admin_user')
        navigate('/admin/login', { replace: true })
      }, 4 * 60 * 60 * 1000)
    }
    const events = ['mousedown', 'keydown', 'scroll', 'touchstart']
    events.forEach((e) => document.addEventListener(e, resetTimer))
    resetTimer()
    return () => {
      clearTimeout(timeout)
      events.forEach((e) => document.removeEventListener(e, resetTimer))
    }
  }, [navigate])

  if (!user) return null

  return (
    <div className="min-h-screen bg-surface text-text-primary flex">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar — always dark */}
      <aside className={`fixed lg:static inset-y-0 left-0 z-50 w-64 bg-sidebar-bg border-r border-sidebar-border flex flex-col transition-transform duration-200 lg:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        {/* Clinic name */}
        <div className="px-5 py-4 border-b border-white/[0.06]">
          <div className="flex items-center gap-2.5">
            <NaLiniiLogo className="w-8 h-8 shrink-0" />
            <div className="min-w-0">
              <p className="text-xs text-gray-500 uppercase tracking-wider">Личный кабинет</p>
              <p className="text-sm font-semibold text-white mt-0.5 truncate">{user.clinic_id}</p>
            </div>
          </div>
        </div>

        {/* Nav links */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 ${
                  isActive
                    ? 'bg-brand-green/10 text-brand-green'
                    : 'text-gray-400 hover:text-white hover:bg-white/[0.04]'
                }`
              }
            >
              <item.icon className="w-[18px] h-[18px]" />
              {item.label}
            </NavLink>
          ))}
        </nav>

        {/* User section */}
        <div className="px-3 py-4 border-t border-white/[0.06]">
          <div className="flex items-center gap-3 px-3 py-2">
            <div className="w-8 h-8 rounded-full bg-brand-green/20 flex items-center justify-center text-brand-green text-xs font-bold">
              {user.full_name?.charAt(0) || user.username.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-white truncate">{user.full_name || user.username}</p>
              <p className="text-xs text-gray-500">{user.role}</p>
            </div>
          </div>
          <div className="space-y-0.5 mt-1">
            <button
              onClick={toggleTheme}
              className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm text-gray-400 hover:text-white hover:bg-white/[0.04] transition-all duration-200"
            >
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              <span>{theme === 'dark' ? 'Светлая тема' : 'Тёмная тема'}</span>
            </button>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-all duration-200"
            >
              <LogOut className="w-4 h-4" />
              <span>Выйти</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-h-screen min-w-0 overflow-hidden">
        {/* Top bar (mobile) */}
        <header className="lg:hidden flex items-center justify-between px-4 py-3 bg-surface-secondary dark:bg-surface-secondary border-b border-border">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 rounded-lg text-text-secondary hover:text-text-primary hover:bg-surface-tertiary transition-colors"
          >
            <Menu className="w-5 h-5" />
          </button>
          <span className="text-sm font-medium text-text-secondary">{user.clinic_id}</span>
          <button
            onClick={handleLogout}
            className="p-2 rounded-lg text-text-tertiary hover:text-red-500 dark:hover:text-red-400 transition-colors"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </header>

        {/* Page content */}
        <main className="flex-1 p-4 md:p-6 lg:p-8 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify build compiles**

Run: `cd frontend-react && npx vite build 2>&1 | tail -5`

- [ ] **Step 3: Commit**

```bash
git add frontend-react/src/layouts/AdminLayout.tsx
git commit -m "feat(admin): add theme toggle to sidebar, use semantic color tokens"
```

---

## Chunk 2: Login + Dashboard + Chats pages

### Task 5: AdminLoginPage — light theme colors

**Files:**
- Modify: `frontend-react/src/pages/admin/AdminLoginPage.tsx`

- [ ] **Step 1: Update all hardcoded colors to semantic tokens + dark: overrides**

Key changes:
- Page bg: `bg-surface` instead of `bg-[#0d0d1a]`
- Ambient blobs: use `bg-accent-soft` with larger opacity, add `dark:bg-brand-green/[0.05]`
- Card: `bg-white dark:bg-white/[0.04]`, `border-border dark:border-white/[0.08]`
- Title: `text-text-primary` instead of `text-white`
- Labels: `text-text-secondary` instead of `text-[#94a3b8]`
- Inputs: `bg-surface-secondary dark:bg-white/[0.04]`, `border-border dark:border-white/[0.08]`, `text-text-primary dark:text-white`, `placeholder-text-muted dark:placeholder-[#475569]`
- Focus: `focus:border-accent/40`
- Button: `bg-accent text-white` (accent is theme-aware)
- Error: `bg-red-50 dark:bg-red-500/10`, `border-red-200 dark:border-red-500/20`, `text-red-600 dark:text-red-400`
- Spinner: `border-accent border-t-transparent`
- Footer: `text-text-muted`
- Icon colors: `text-text-muted dark:text-[#475569]`

Write the full updated file.

- [ ] **Step 2: Verify build compiles**

- [ ] **Step 3: Commit**

```bash
git add frontend-react/src/pages/admin/AdminLoginPage.tsx
git commit -m "feat(admin): light theme for AdminLoginPage"
```

---

### Task 6: AdminDashboardPage — light theme colors

**Files:**
- Modify: `frontend-react/src/pages/admin/AdminDashboardPage.tsx`

- [ ] **Step 1: Update all hardcoded colors**

Key changes:
- cardBase: `bg-white dark:bg-white/[0.03] border border-gray-200 dark:border-white/[0.06] shadow-sm dark:shadow-none` + hover
- Title: `text-text-primary` instead of `text-white`
- Subtitle: `text-text-tertiary` instead of `text-[#64748b]`
- Stat numbers: `text-text-primary` instead of `text-white`
- Spinner: `border-accent border-t-transparent`
- Error text: `text-text-secondary`
- Retry button: `bg-surface-secondary dark:bg-white/[0.04] border border-border dark:border-white/[0.08]`
- Accent icon bg: `bg-accent-soft text-accent`
- Existing `dark:text-amber-400` classes — keep, add light: `text-amber-600`
- "Prev month" stat colors: `text-emerald-600 dark:text-emerald-400`, `text-blue-600 dark:text-blue-400`, `text-red-600 dark:text-red-400`

Write the full updated file.

- [ ] **Step 2: Verify build**
- [ ] **Step 3: Commit**

```bash
git add frontend-react/src/pages/admin/AdminDashboardPage.tsx
git commit -m "feat(admin): light theme for AdminDashboardPage"
```

---

### Task 7: AdminChatsPage — light theme colors

**Files:**
- Modify: `frontend-react/src/pages/admin/AdminChatsPage.tsx`

- [ ] **Step 1: Update STATUS_CONFIG badges for dual theme**

Replace each badge string with light + dark variants:
- `sent`: `'bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-500/25'`
- `awaiting_*`: `'bg-orange-50 dark:bg-orange-500/15 text-orange-700 dark:text-orange-300 border-orange-200 dark:border-orange-500/25'`
- `confirmed/cancelled/rescheduled/no_response`: `'bg-gray-100 dark:bg-gray-500/15 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-500/25'`
- `bot`: `'bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-500/25'`
- `operator`: `'bg-red-50 dark:bg-red-500/15 text-red-700 dark:text-red-300 border-red-200 dark:border-red-500/25'`
- `operator_active`: `'bg-blue-50 dark:bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-500/25'`
- `closed`: `'bg-gray-100 dark:bg-gray-500/15 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-500/25'`

Also update dot colors: `'bg-emerald-500 dark:bg-emerald-400'`, etc.

- [ ] **Step 2: Update page structure colors**

- Header text: `text-text-primary`, `text-text-tertiary`
- Search input: semantic tokens
- Filter tags: `bg-accent-soft text-accent border-accent/20` (active) / `bg-surface-secondary dark:bg-white/[0.03] text-text-tertiary border-border dark:border-white/[0.06]`
- Table: `bg-white dark:bg-white/[0.02] border-gray-200 dark:border-white/[0.06]`
- Table headers: `text-text-tertiary`
- Row hover: `hover:bg-gray-50 dark:hover:bg-white/[0.03]`
- Operator row: `bg-red-50 dark:bg-red-500/[0.04] border-l-red-400`
- Mobile cards: similar adaptations
- Channel pills: `bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400`

Write the full updated file.

- [ ] **Step 3: Verify build**
- [ ] **Step 4: Commit**

```bash
git add frontend-react/src/pages/admin/AdminChatsPage.tsx
git commit -m "feat(admin): light theme for AdminChatsPage"
```

---

## Chunk 3: ChatDetail + Confirmations pages

### Task 8: AdminChatDetailPage — light theme colors

**Files:**
- Modify: `frontend-react/src/pages/admin/AdminChatDetailPage.tsx`

- [ ] **Step 1: Update CONTROLLER_COLORS for dual theme**

```tsx
const CONTROLLER_COLORS: Record<string, string> = {
  bot: 'bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-500/25',
  operator: 'bg-blue-50 dark:bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-500/25',
  closed: 'bg-gray-100 dark:bg-gray-500/15 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-500/25',
}
```

- [ ] **Step 2: Update header, tabs, input, and structural colors**

Key mappings:
- Back button: `bg-surface-secondary dark:bg-white/[0.04] border-border dark:border-white/[0.08]`
- Header title: `text-text-primary`
- Header border: `border-border dark:border-white/[0.06]`
- Controller dropdown: `bg-white dark:bg-[#1a1a2e] border-gray-200 dark:border-white/[0.1]`, options hover: `hover:bg-gray-50 dark:hover:bg-white/[0.06]`
- Active controller text: `text-accent`
- Confirmation status badges: same pattern as ChatsPage
- Channel pills: same pattern
- Phone editor input: `bg-surface-secondary dark:bg-white/[0.04]`
- Tab active: `bg-accent-soft text-accent border border-accent/20`
- Tab inactive: `text-text-tertiary hover:text-text-secondary`
- Message input: `bg-surface-secondary dark:bg-white/[0.04] border-border dark:border-white/[0.08]`
- Send button: `bg-accent text-white`
- Error toast: `bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/20 text-red-600 dark:text-red-300`
- Load older button: `text-accent`
- Date separator line: `bg-border dark:bg-white/[0.06]`
- Date separator text: `text-text-muted`

- [ ] **Step 3: Update MessageBubble colors**

```tsx
if (isPatient) {
  bubble = 'bg-gray-100 dark:bg-white/[0.04] border-gray-200 dark:border-white/[0.06]'
  authorColor = 'text-text-tertiary'
} else if (isAgent) {
  bubble = 'bg-emerald-50 dark:bg-brand-green/[0.08] border-emerald-200 dark:border-brand-green/15'
  authorColor = 'text-emerald-600/60 dark:text-brand-green/60'
} else if (isOperator) {
  bubble = 'bg-blue-50 dark:bg-indigo-500/[0.08] border-blue-200 dark:border-indigo-500/15'
  authorColor = 'text-blue-600/60 dark:text-indigo-400/60'
}
```

Message text: `text-gray-800 dark:text-gray-200`
Time text: `text-text-muted`

- [ ] **Step 4: Update BOOKING_STATUS_STYLES and AppointmentsTab**

```tsx
const BOOKING_STATUS_STYLES: Record<string, string> = {
  'подтверждён': 'bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-500/25',
  'отменён': 'bg-red-50 dark:bg-red-500/15 text-red-700 dark:text-red-300 border-red-200 dark:border-red-500/25',
  'завершён': 'bg-gray-100 dark:bg-gray-500/15 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-500/25',
}
```

Table headers: `text-text-tertiary`
Table borders: `border-border dark:border-white/[0.06]`, row borders: `border-border-light dark:border-white/[0.04]`
Cell text: `text-text-primary`, `text-text-secondary`, `text-text-tertiary`

Write the full updated file.

- [ ] **Step 5: Verify build**
- [ ] **Step 6: Commit**

```bash
git add frontend-react/src/pages/admin/AdminChatDetailPage.tsx
git commit -m "feat(admin): light theme for AdminChatDetailPage"
```

---

### Task 9: AdminConfirmationsPage — light theme colors

**Files:**
- Modify: `frontend-react/src/pages/admin/AdminConfirmationsPage.tsx`

- [ ] **Step 1: Update STATUS_COLORS for dual theme**

Same pattern as ChatsPage badges — add light colors + `dark:` overrides.

- [ ] **Step 2: Update page structure colors**

- Header: `text-text-primary`, `text-text-tertiary`
- Refresh button: semantic tokens
- Filter tags: active `bg-accent-soft text-accent border-accent/20`, inactive `bg-surface-secondary dark:bg-white/[0.03] text-text-tertiary border-border dark:border-white/[0.06]`
- Timeline cards: `bg-white dark:bg-white/[0.02] border-gray-200 dark:border-white/[0.06] shadow-sm dark:shadow-none hover:bg-gray-50 dark:hover:bg-white/[0.03]`
- Day text: `text-text-primary`
- Month text: `text-text-tertiary`
- Name/time text: `text-text-primary`, `text-text-tertiary`
- Empty state icon: `text-text-muted`
- Footer text: `text-text-muted`
- Spinners: `border-accent border-t-transparent`
- Error: `bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/20 text-amber-700 dark:text-amber-300`

Write the full updated file.

- [ ] **Step 3: Verify build**
- [ ] **Step 4: Commit**

```bash
git add frontend-react/src/pages/admin/AdminConfirmationsPage.tsx
git commit -m "feat(admin): light theme for AdminConfirmationsPage"
```

---

## Chunk 4: Actions + Settings pages

### Task 10: AdminActionsPage — light theme colors

**Files:**
- Modify: `frontend-react/src/pages/admin/AdminActionsPage.tsx`

- [ ] **Step 1: Update all hardcoded colors**

- Header: `text-text-primary`, `text-text-tertiary`
- Refresh button: semantic tokens
- Error: `bg-amber-50 dark:bg-amber-500/10` pattern
- Mobile cards: `bg-white dark:bg-white/[0.02] border-gray-200 dark:border-white/[0.06] shadow-sm dark:shadow-none`
- Type label: `text-accent`
- Patient text: `text-text-primary`, phone: `text-text-tertiary`
- Appointment text: `text-text-primary`, doctor: `text-text-tertiary`
- "Готово" button: `bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20 text-emerald-600 dark:text-emerald-400`
- Desktop table: `bg-white dark:bg-white/[0.02] border-gray-200 dark:border-white/[0.06]`
- Table headers: `text-text-tertiary`
- Row hover: `hover:bg-gray-50 dark:hover:bg-white/[0.03]`
- Row borders: `border-border-light dark:border-white/[0.04]`
- Created date: `text-text-tertiary`
- Spinners: `border-accent border-t-transparent`

Write the full updated file.

- [ ] **Step 2: Verify build**
- [ ] **Step 3: Commit**

```bash
git add frontend-react/src/pages/admin/AdminActionsPage.tsx
git commit -m "feat(admin): light theme for AdminActionsPage"
```

---

### Task 11: AdminSettingsPage — light theme colors

**Files:**
- Modify: `frontend-react/src/pages/admin/AdminSettingsPage.tsx`

- [ ] **Step 1: Update RedButtonSection colors**

- Card: `bg-white dark:bg-white/[0.03] border-gray-200 dark:border-white/[0.06] shadow-sm dark:shadow-none`
- Section borders: `border-border-light dark:border-white/[0.04]`
- Title: `text-text-primary`, subtitle: `text-text-tertiary`
- Status badges: same emerald/red pattern as other pages
- Reason box: `bg-red-50 dark:bg-red-500/5`
- Reason text: `text-text-primary`
- Time text: `text-text-muted`
- Confirm dialog: `bg-surface-secondary dark:bg-white/[0.02] border-border dark:border-white/[0.06]`
- Confirm text: `text-text-primary`, description: `text-text-tertiary`
- Input: semantic tokens
- Toggle buttons: keep emerald/red split with light variants
- Cancel button: `bg-surface-secondary dark:bg-white/[0.04] border-border dark:border-white/[0.08] text-text-secondary`
- Error: amber pattern

- [ ] **Step 2: Update BlocklistSection colors**

- Same card pattern
- "Добавить" button: `bg-accent-soft text-accent border-accent/20`
- Tab switcher active: `bg-accent text-white`, inactive: `bg-surface-secondary dark:bg-white/[0.04] text-text-tertiary`
- Inputs: semantic tokens
- "Добавить" submit button: `bg-accent text-white`
- "Отмена" button: semantic tokens
- List items hover: `hover:bg-gray-50 dark:hover:bg-white/[0.03]`
- Phone icon: `text-text-tertiary`
- TG icon: `text-blue-500 dark:text-blue-400`
- Item text: `text-text-primary`
- Reason/created_by: `text-text-muted`
- Delete button: same hover pattern
- Footer count: `text-text-muted`
- Error: red pattern
- Spinners: accent

Write the full updated file.

- [ ] **Step 3: Verify build**
- [ ] **Step 4: Commit**

```bash
git add frontend-react/src/pages/admin/AdminSettingsPage.tsx
git commit -m "feat(admin): light theme for AdminSettingsPage"
```

---

## Chunk 5: Verification and deploy

### Task 12: Full build verification

- [ ] **Step 1: Full build**

Run: `cd frontend-react && npx vite build`
Expected: Clean build, no errors

- [ ] **Step 2: Visual verification checklist**

Run dev server and check each page in both themes:
```bash
cd frontend-react && npx vite --host 0.0.0.0 &
```

Check manually:
- [ ] Login page: light (default) and dark
- [ ] Dashboard: light and dark
- [ ] Chats list: light and dark
- [ ] Chat detail: light and dark
- [ ] Confirmations: light and dark
- [ ] Actions: light and dark
- [ ] Settings: light and dark
- [ ] Sidebar: stays dark in both themes
- [ ] Theme toggle: icon switches correctly
- [ ] Theme persistence: switch to dark, refresh → stays dark
- [ ] Mobile responsive: both themes

- [ ] **Step 3: Push and deploy**

```bash
git push origin main
```

Wait for CI deploy, then verify on production.
