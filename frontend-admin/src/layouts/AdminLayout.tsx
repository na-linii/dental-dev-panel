import { useState, useEffect } from 'react'
import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { LogOut, Menu, Sun, Moon } from 'lucide-react'

function NaLiniiLogo({ className = 'w-8 h-8' }: { className?: string }) {
  return <img src="/logo.svg" alt="НаЛинии" className={className} />
}
import { adminMe } from '../api/client'
import type { AdminUser } from '../api/client'
import { useTheme } from '../contexts/ThemeContext'
import { NAV_ITEMS } from '../config/adminStatuses'

export function AdminLayout() {
  const [user, setUser] = useState<AdminUser | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const navigate = useNavigate()
  const { theme, toggleTheme } = useTheme()

  useEffect(() => {
    const token = localStorage.getItem('admin_token')
    if (!token) {
      navigate('/login', { replace: true })
      return
    }
    const stored = localStorage.getItem('admin_user')
    if (stored) {
      setUser(JSON.parse(stored))
    }
    adminMe().then(setUser).catch(() => {
      localStorage.removeItem('admin_token')
      localStorage.removeItem('admin_user')
      navigate('/login', { replace: true })
    })
  }, [navigate])

  const handleLogout = () => {
    localStorage.removeItem('admin_token')
    localStorage.removeItem('admin_user')
    navigate('/login', { replace: true })
  }

  // Session inactivity timeout (4 hours)
  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>
    const resetTimer = () => {
      clearTimeout(timeout)
      timeout = setTimeout(() => {
        localStorage.removeItem('admin_token')
        localStorage.removeItem('admin_user')
        navigate('/login', { replace: true })
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

      {/* Sidebar — white in light, dark in dark */}
      <aside className={`fixed lg:static inset-y-0 left-0 z-50 w-64 bg-sidebar-bg border-r border-sidebar-border flex flex-col transition-transform duration-200 lg:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        {/* Clinic name */}
        <div className="px-5 py-4 border-b border-gray-200 dark:border-white/[0.06]">
          <div className="flex items-center gap-2.5">
            <NaLiniiLogo className="w-8 h-8 shrink-0" />
            <span className="text-base font-bold text-gray-900 dark:text-white tracking-tight">НаЛинии</span>
          </div>
        </div>

        {/* Nav links */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          {NAV_ITEMS.filter((item) => !('superadminOnly' in item && item.superadminOnly) || user.role === 'superadmin').map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 ${
                  isActive
                    ? 'bg-accent/10 text-accent'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/[0.04]'
                }`
              }
            >
              <item.icon className="w-[18px] h-[18px]" />
              {item.label}
            </NavLink>
          ))}
        </nav>

        {/* User section */}
        <div className="px-3 py-4 border-t border-gray-200 dark:border-white/[0.06]">
          <div className="flex items-center gap-3 px-3 py-2">
            <div className="w-8 h-8 rounded-full bg-accent/10 flex items-center justify-center text-accent text-xs font-bold">
              {user.full_name?.charAt(0) || user.username.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-gray-900 dark:text-white truncate">{user.full_name || user.username}</p>
              <p className="text-xs text-gray-500">{user.role}</p>
              {user.clinic_name && (
                <p className="text-xs text-gray-400 dark:text-gray-500 truncate mt-0.5">{user.clinic_name}</p>
              )}
            </div>
          </div>
          <div className="space-y-0.5 mt-1">
            <button
              onClick={toggleTheme}
              className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/[0.04] transition-all duration-200"
            >
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              <span>{theme === 'dark' ? 'Светлая тема' : 'Тёмная тема'}</span>
            </button>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm text-gray-600 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition-all duration-200"
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
        <header className="lg:hidden flex items-center justify-between px-4 py-3 bg-surface-secondary border-b border-border">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 rounded-lg text-text-secondary hover:text-text-primary hover:bg-surface-tertiary transition-colors"
          >
            <Menu className="w-5 h-5" />
          </button>
          <span className="text-sm font-medium text-text-secondary">{user.clinic_name || 'НаЛинии'}</span>
          <button
            onClick={handleLogout}
            className="p-2 rounded-lg text-text-tertiary hover:text-red-500 dark:hover:text-red-400 transition-colors"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </header>

        {/* Page content */}
        <main className="flex-1 p-4 md:p-6 lg:p-8 overflow-auto bg-surface-secondary dark:bg-[#0d0d1a]">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
