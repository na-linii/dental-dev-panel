# Admin Panel Light Theme — Design Spec

## Summary

Add light/dark theme switching to the admin panel. Light theme is the default. Colors are taken from the previous admin panel project (`na-linii/admin-panel-frontend`). Implementation uses semantic CSS color tokens via Tailwind v4 `@theme inline` + CSS custom properties, switched by a `dark` class on `<html>`.

## Architecture

### Theme Infrastructure

**ThemeContext** (`frontend-react/src/contexts/ThemeContext.tsx`):
- React Context providing `{ theme: 'light' | 'dark', toggleTheme: () => void }`
- Default: `'light'`
- Persists to `localStorage.admin_theme` (deliberately different from the reference project's `theme` key to avoid collision with the main Hub app)
- On change: adds/removes `dark` class on `document.documentElement`
- On unmount: removes `dark` class to prevent leaking into the main Hub app

**ThemeProvider** wraps admin routes only (not the main Hub app which stays dark). When navigating away from admin routes, the provider's cleanup effect removes the `dark` class from `<html>` so the main Hub app is unaffected.

### Tailwind v4 Dark Mode Configuration

Add class-based dark mode variant in `index.css`:

```css
@custom-variant dark (&:where(.dark, .dark *));
```

This is required in Tailwind v4 to enable `dark:` prefixed utilities via class toggle (instead of the default `prefers-color-scheme` media query).

### Existing `dark:` Classes

The codebase already has some `dark:` prefixed classes (e.g., in `AdminDashboardPage.tsx`). Currently these do nothing because no dark mode configuration exists. Once `@custom-variant dark` is added, these will activate. During implementation, audit each file for existing `dark:` classes and verify they produce correct results, adjusting as needed.

### Color Token System

All colors defined as CSS custom properties in `index.css`, with light values in `:root` and dark overrides in `.dark`. Registered as Tailwind utilities via `@theme inline` (the `inline` keyword tells Tailwind v4 to treat these as dynamic runtime values rather than trying to statically resolve them at build time).

#### Semantic Tokens

| Token | Light | Dark | Usage |
|-------|-------|------|-------|
| `--color-surface` | `#ffffff` | `#0d0d1a` | Page background |
| `--color-surface-secondary` | `#f9fafb` (gray-50) | `#111127` | Cards, inputs |
| `--color-surface-tertiary` | `#f3f4f6` (gray-100) | `rgba(255,255,255,0.04)` | Hover backgrounds, nested cards |
| `--color-text-primary` | `#111827` (gray-900) | `#e0e0e0` | Main text |
| `--color-text-secondary` | `#4b5563` (gray-600) | `#94a3b8` | Secondary text |
| `--color-text-tertiary` | `#6b7280` (gray-500) | `#64748b` | Labels, placeholders |
| `--color-text-muted` | `#9ca3af` (gray-400) | `#475569` | Disabled, hints |
| `--color-border` | `#e5e7eb` (gray-200) | `rgba(255,255,255,0.08)` | Borders |
| `--color-border-light` | `#f3f4f6` (gray-100) | `rgba(255,255,255,0.04)` | Subtle borders |
| `--color-accent` | `#059669` (emerald-600) | `#51ff97` | Primary accent |
| `--color-accent-soft` | `rgba(5,150,105,0.1)` | `rgba(81,255,151,0.1)` | Accent backgrounds |
| `--color-sidebar-bg` | `#121429` | `#121429` | Sidebar background (always dark) |
| `--color-sidebar-border` | `#e5e7eb` | `rgba(255,255,255,0.06)` | Sidebar/content border |

#### Tailwind v4 Registration

```css
@theme inline {
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
```

This enables usage like `bg-surface`, `text-text-primary`, `border-border`, `bg-accent` as native Tailwind utilities. The accent color is defined as a full color value (not RGB triplet), and Tailwind v4 handles opacity modifiers natively.

### Status Badge Colors

Status badges use standard Tailwind color classes with `dark:` prefix overrides, matching the previous project:

| Status type | Light bg | Light text | Dark bg | Dark text |
|-------------|----------|------------|---------|-----------|
| Success (confirmed) | `bg-emerald-50` | `text-emerald-700` | `dark:bg-emerald-500/15` | `dark:text-emerald-300` |
| Warning (pending) | `bg-orange-50` | `text-orange-700` | `dark:bg-orange-500/15` | `dark:text-orange-300` |
| Error (cancelled) | `bg-red-50` | `text-red-700` | `dark:bg-red-500/10` | `dark:text-red-400` |
| Info (operator) | `bg-blue-50` | `text-blue-700` | `dark:bg-blue-500/10` | `dark:text-blue-300` |
| Neutral (closed) | `bg-gray-100` | `text-gray-600` | `dark:bg-gray-500/15` | `dark:text-gray-300` |
| Purple (business) | `bg-purple-50` | `text-purple-700` | `dark:bg-purple-500/10` | `dark:text-purple-400` |

### Additional CSS

From previous project, port into `index.css`:
- Scrollbar styles (light default + `.dark` variants)
- Autofill styles (light default + `.dark` variants)
- Selection color: `rgba(81,255,151,0.25)`
- `prefers-reduced-motion` media query

### Body Background

The current `index.css` sets `body { background: #0a0a1a; }` globally. Both `background` and `color` must be changed to use tokens: `body { background: var(--color-surface); color: var(--color-text-primary); }`. This prevents the dark body styles from bleeding through during page transitions or behind modals in light mode.

### Sidebar

Sidebar keeps dark background (`#121429` / `brand-dark`) in BOTH themes — this is a deliberate design choice by the user (option B during brainstorming) to maintain visual contrast between navigation and content. The sidebar text, icons, and interactive states remain the same in both themes (white/gray text on dark background).

Border between sidebar and content area adapts: `border-gray-200` in light, `border-white/[0.06]` in dark.

### Theme Toggle

Location: sidebar bottom section, above the "Выйти" button.

Appearance (from previous project `Sidebar.tsx` lines 66-69):
- Button with icon + text label
- Dark theme active: `Sun` icon + "Светлая тема"
- Light theme active: `Moon` icon + "Тёмная тема"
- Style: same as "Выйти" button — gray text, hover highlight
- Icons from `lucide-react` (Sun, Moon)

### Login Page

The login page has decorative gradient blobs (`bg-[#51ff97]/[0.05]`) designed for the dark background. In light mode, these should adapt: use `bg-accent-soft` for subtle green tinting on the light background, or hide them entirely since the light background doesn't need ambient effects. The login card itself follows the standard card styling (white bg, gray border, shadow).

### Chat Messages (ChatDetailPage)

| Message type | Light | Dark |
|-------------|-------|------|
| Patient | `bg-gray-100 border-gray-200` | `dark:bg-white/[0.04] dark:border-white/[0.06]` |
| Agent/Bot | `bg-emerald-50 border-emerald-200` | `dark:bg-[#51ff97]/[0.08] dark:border-[#51ff97]/15` |
| Operator | `bg-blue-50 border-blue-200` | `dark:bg-indigo-500/[0.08] dark:border-indigo-500/15` |
| Send button | `bg-accent text-white` | Same (accent switches via variable) |

### Cards and Tables

| Element | Light | Dark |
|---------|-------|------|
| Card bg | `bg-white shadow-sm` | `dark:bg-white/[0.03] dark:shadow-none` |
| Card border | `border-gray-200` | `dark:border-white/[0.06]` |
| Table header | `text-gray-500 bg-gray-50` | `dark:text-[#64748b] dark:bg-transparent` |
| Table row hover | `hover:bg-gray-50` | `dark:hover:bg-white/[0.04]` |
| Operator row highlight | `bg-red-50 border-l-2 border-l-red-400` | `dark:bg-red-500/[0.04]` |

### Inputs and Buttons

| Element | Light | Dark |
|---------|-------|------|
| Input bg | `bg-gray-50` | `dark:bg-white/[0.04]` |
| Input border | `border-gray-200` | `dark:border-white/[0.08]` |
| Input focus | `focus:border-accent/40 focus:bg-white` | `dark:focus:bg-white/[0.06]` |
| Primary button | `bg-accent text-white` | Same |
| Secondary button | `bg-gray-100 text-gray-600` | `dark:bg-white/[0.04] dark:text-gray-400` |
| Danger button | `bg-red-50 text-red-600 border-red-200` | `dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/20` |

### Dropdowns and Menus

| Element | Light | Dark |
|---------|-------|------|
| Dropdown bg | `bg-white` | `dark:bg-[#1a1a2e]` |
| Dropdown border | `border-gray-200` | `dark:border-[#2a2a45]` |
| Option hover | `hover:bg-gray-50` | `dark:hover:bg-[#212138]` |
| Backdrop | `bg-black/40 backdrop-blur-sm` | Same |

## Scope

### Files to create (1)
- `frontend-react/src/contexts/ThemeContext.tsx` — context + provider + hook

### Files to modify (10)
1. `frontend-react/src/index.css` — `@custom-variant dark`, CSS variables, `@theme inline`, scrollbar, autofill, selection, body background
2. `frontend-react/src/App.tsx` — wrap admin routes with `ThemeProvider`
3. `frontend-react/src/layouts/AdminLayout.tsx` — theme toggle button, semantic classes
4. `frontend-react/src/pages/admin/AdminLoginPage.tsx` — semantic classes, adapt decorative blobs
5. `frontend-react/src/pages/admin/AdminDashboardPage.tsx` — semantic classes, audit existing `dark:` classes
6. `frontend-react/src/pages/admin/AdminChatsPage.tsx` — semantic classes
7. `frontend-react/src/pages/admin/AdminChatDetailPage.tsx` — semantic classes
8. `frontend-react/src/pages/admin/AdminConfirmationsPage.tsx` — semantic classes
9. `frontend-react/src/pages/admin/AdminActionsPage.tsx` — semantic classes
10. `frontend-react/src/pages/admin/AdminSettingsPage.tsx` — semantic classes

### Files NOT modified
- Backend (`hub/api.py`, `hub/db.py`) — no changes
- Main Hub frontend (non-admin pages) — stays dark-only
- `frontend-react/src/api/adminClient.ts` — no changes
- `frontend-react/src/hooks/useAdminQueries.ts` — no changes

## Non-goals
- System preference detection (`prefers-color-scheme`) — not needed, default is light
- Per-clinic theme branding — future scope
- Theme for main Hub app — only admin panel
- Animations/transitions between themes — instant switch is fine

## Testing
- Visual verification: each page in both themes
- Toggle persistence: switch theme, refresh, verify it persists
- Login page: verify theme applies before auth
- Mobile responsive: verify both themes on mobile breakpoints
- Sidebar: verify it stays dark in both themes
- Navigation from admin to Hub: verify `dark` class is cleaned up
- Existing `dark:` classes: verify no visual regressions
