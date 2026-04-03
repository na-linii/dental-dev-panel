import { useState, useEffect } from 'react'
import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { LayoutDashboard, MessageCircle, CalendarCheck, ClipboardList, Settings, LogOut, Menu } from 'lucide-react'

function NaLiniiLogo({ className = 'w-8 h-8' }: { className?: string }) {
  return <img src="/logo.svg" alt="НаЛинии" className={className} />
}
import { adminMe } from '../api/adminClient'
import type { AdminUser } from '../api/adminClient'

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
      }, 4 * 60 * 60 * 1000) // 4 hours
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
    <div className="min-h-screen bg-[#0d0d1a] text-white flex">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`fixed lg:static inset-y-0 left-0 z-50 w-64 bg-[#111127] border-r border-[#1e293b] flex flex-col transition-transform duration-200 lg:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        {/* Clinic name */}
        <div className="px-5 py-4 border-b border-[#1e293b]">
          <div className="flex items-center gap-2.5">
            <NaLiniiLogo className="w-8 h-8 shrink-0" />
            <div className="min-w-0">
              <p className="text-xs text-[#64748b] uppercase tracking-wider">Личный кабинет</p>
              <p className="text-sm font-semibold text-white mt-0.5 truncate">{user.clinic_id}</p>
            </div>
          </div>
        </div>

        {/* Nav links */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          {navItems.filter((item) => !(item.to === '/admin/actions' && user?.role === 'operator')).map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 ${
                  isActive
                    ? 'bg-[#51ff97]/10 text-[#51ff97]'
                    : 'text-[#94a3b8] hover:text-white hover:bg-white/[0.04]'
                }`
              }
            >
              <item.icon className="w-[18px] h-[18px]" />
              {item.label}
            </NavLink>
          ))}
        </nav>

        {/* User section */}
        <div className="px-3 py-4 border-t border-[#1e293b]">
          <div className="flex items-center gap-3 px-3 py-2">
            <div className="w-8 h-8 rounded-full bg-[#51ff97]/20 flex items-center justify-center text-[#51ff97] text-xs font-bold">
              {user.full_name?.charAt(0) || user.username.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-white truncate">{user.full_name || user.username}</p>
              <p className="text-xs text-[#64748b]">{user.role}</p>
            </div>
            <button
              onClick={handleLogout}
              className="p-1.5 rounded-lg text-[#64748b] hover:text-red-400 hover:bg-red-400/10 transition-colors"
              title="Выйти"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-h-screen min-w-0 overflow-hidden">
        {/* Top bar (mobile) */}
        <header className="lg:hidden flex items-center justify-between px-4 py-3 bg-[#111127] border-b border-[#1e293b]">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 rounded-lg text-[#94a3b8] hover:text-white hover:bg-white/[0.04] transition-colors"
          >
            <Menu className="w-5 h-5" />
          </button>
          <span className="text-sm font-medium text-[#94a3b8]">{user.clinic_id}</span>
          <button
            onClick={handleLogout}
            className="p-2 rounded-lg text-[#64748b] hover:text-red-400 transition-colors"
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
