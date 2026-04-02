import { useNavigate } from 'react-router-dom'
import { MessageCircle, AlertTriangle, Bell, ClipboardList, RefreshCw } from 'lucide-react'
import { useAdminDashboard } from '../../hooks/useAdminQueries'

export function AdminDashboardPage() {
  const { data: stats, isLoading, error, refetch } = useAdminDashboard()
  const navigate = useNavigate()

  const user = (() => {
    try { return JSON.parse(localStorage.getItem('admin_user') || '{}') } catch { return {} }
  })()

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-7 h-7 border-2 border-[#51ff97] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <p className="text-[#94a3b8]">Не удалось загрузить статистику</p>
        <button onClick={() => refetch()} className="flex items-center gap-2 px-4 py-2 bg-white/[0.04] border border-white/[0.08] rounded-xl text-sm text-[#94a3b8] hover:text-white transition-colors">
          <RefreshCw className="w-4 h-4" /> Повторить
        </button>
      </div>
    )
  }

  // Derive display values from backend format:
  // stats.sessions = {bot, operator, closed}
  // stats.confirmations = {sent: N, confirmed: N, ...}
  // stats.pending_actions, stats.total_patients
  const activeChats = (stats?.sessions?.bot ?? 0) + (stats?.sessions?.operator ?? 0)
  const operatorChats = stats?.sessions?.operator ?? 0
  const totalConfirmations = stats?.confirmations
    ? Object.values(stats.confirmations).reduce((a, b) => a + b, 0)
    : 0

  const cards = [
    {
      title: 'Активные чаты',
      value: activeChats,
      icon: MessageCircle,
      accent: 'text-emerald-400',
      bg: 'bg-emerald-500/10',
      border: 'hover:border-emerald-500/20',
    },
    {
      title: 'С оператором',
      value: operatorChats,
      icon: AlertTriangle,
      accent: 'text-red-400',
      bg: 'bg-red-500/10',
      border: 'hover:border-red-500/20',
    },
    {
      title: 'Подтверждения',
      value: totalConfirmations,
      icon: Bell,
      accent: 'text-blue-400',
      bg: 'bg-blue-500/10',
      border: 'hover:border-blue-500/20',
    },
    {
      title: 'Ожидает действий',
      value: stats?.pending_actions ?? 0,
      icon: ClipboardList,
      accent: 'text-amber-400',
      bg: 'bg-amber-500/10',
      border: 'hover:border-amber-500/20',
    },
  ]

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">
          Добро пожаловать, {user.full_name?.split(' ')[1] || user.full_name?.split(' ')[0] || user.username}
        </h1>
        <p className="text-[#64748b] mt-1">{user.clinic_id}</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        {cards.map((c) => (
          <div
            key={c.title}
            className={`bg-white/[0.03] border border-white/[0.06] ${c.border} rounded-2xl p-4 md:p-5 transition-all duration-200 hover:bg-white/[0.05] group`}
          >
            <div className={`w-8 h-8 md:w-9 md:h-9 rounded-lg ${c.bg} flex items-center justify-center ${c.accent} mb-3 md:mb-4 group-hover:scale-105 transition-transform duration-200`}>
              <c.icon className="w-4 h-4 md:w-[18px] md:h-[18px]" />
            </div>
            <p className="text-2xl md:text-3xl font-bold text-white tabular-nums">{c.value}</p>
            <p className="text-xs md:text-sm text-[#64748b] mt-0.5">{c.title}</p>
          </div>
        ))}
      </div>

      {/* Alert box */}
      {operatorChats > 0 && (
        <button
          onClick={() => navigate('/admin/chats?controller=operator')}
          className="w-full bg-red-500/[0.08] border border-red-500/20 hover:border-red-500/30 rounded-2xl p-5 text-left transition-all duration-200 group"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-red-500/10 flex items-center justify-center text-red-400 group-hover:scale-105 transition-transform">
              <AlertTriangle className="w-[18px] h-[18px]" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white tabular-nums">{operatorChats}</p>
              <p className="text-xs text-[#94a3b8]">Чатов с оператором</p>
            </div>
          </div>
        </button>
      )}
    </div>
  )
}
