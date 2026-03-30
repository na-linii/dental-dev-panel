import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

const tabs = [
  { to: '/', label: 'Clinics' },
  { to: '/architecture', label: 'Architecture' },
  // TODO: перенести Edge Cases в Clinix
  // { to: '/edge-cases', label: 'Edge Cases' },
  { to: '/roadmap', label: 'Project Board' },
]

export function Layout() {
  const { user, logout } = useAuth()

  return (
    <div className="min-h-screen bg-[#0a0a1a] text-white">
      <nav className="bg-[#111127] border-b border-[#1e293b] px-6 flex items-center h-12 gap-6">
        <span className="font-bold text-[#7dd3fc] text-base">Dental Hub</span>
        <div className="flex">
          {tabs.map((t) => (
            <NavLink
              key={t.to}
              to={t.to}
              end={t.to === '/'}
              className={({ isActive }) =>
                `px-4 py-2.5 text-sm border-b-2 transition-colors ${
                  isActive
                    ? 'text-[#7dd3fc] border-[#7dd3fc]'
                    : 'text-[#64748b] border-transparent hover:text-white'
                }`
              }
            >
              {t.label}
            </NavLink>
          ))}
        </div>
        {user && (
          <div className="ml-auto flex items-center gap-2 text-xs text-[#64748b]">
            <img src={user.avatar} className="w-6 h-6 rounded-full" alt="" />
            <span className="text-white">{user.name}</span>
            <button
              onClick={logout}
              className="text-[#64748b] hover:text-white ml-2 cursor-pointer"
            >
              Logout
            </button>
          </div>
        )}
      </nav>
      <Outlet />
    </div>
  )
}
