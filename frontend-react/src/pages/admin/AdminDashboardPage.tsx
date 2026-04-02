import { useNavigate } from 'react-router-dom'
import { MessageCircle, AlertTriangle, CheckCircle2, XCircle, ArrowRightLeft, TrendingUp, Users, RefreshCw } from 'lucide-react'
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

  const totalSessions = (stats?.sessions?.bot ?? 0) + (stats?.sessions?.operator ?? 0) + (stats?.sessions?.closed ?? 0)
  const confirmed = stats?.confirmations?.confirmed ?? 0
  const rescheduled = stats?.confirmations?.rescheduled ?? 0
  const cancelled = stats?.confirmations?.cancelled ?? 0
  const awaitingConfirm = stats?.confirmations?.awaiting_confirm ?? 0
  const awaitingReschedule = stats?.confirmations?.awaiting_reschedule ?? 0
  const awaitingCancel = stats?.confirmations?.awaiting_cancel ?? 0
  const operatorChats = stats?.sessions?.operator ?? 0

  const cardBase = 'bg-white/[0.03] border border-white/[0.06] rounded-2xl p-4 md:p-5 transition-all duration-200 hover:bg-white/[0.05] group'

  return (
    <div className="space-y-3 md:space-y-4">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">
          Добро пожаловать, {user.full_name?.split(' ')[1] || user.full_name?.split(' ')[0] || user.username}
        </h1>
        <p className="text-[#64748b] mt-1">{user.clinic_id}</p>
      </div>

      {/* Top row: 4 stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        {/* Всего диалогов */}
        <div className={cardBase}>
          <div className="w-8 h-8 md:w-9 md:h-9 rounded-lg bg-[#51ff97]/10 flex items-center justify-center text-[#51ff97] mb-3 md:mb-4 group-hover:scale-105 transition-transform duration-200">
            <MessageCircle className="w-4 h-4 md:w-[18px] md:h-[18px]" />
          </div>
          <p className="text-2xl md:text-3xl font-bold text-white tabular-nums">{totalSessions}</p>
          <p className="text-xs md:text-sm text-[#64748b] mt-0.5">Всего диалогов</p>
        </div>

        {/* Подтверждено */}
        <div className={cardBase}>
          <div className="w-8 h-8 md:w-9 md:h-9 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400 mb-3 md:mb-4 group-hover:scale-105 transition-transform duration-200">
            <CheckCircle2 className="w-4 h-4 md:w-[18px] md:h-[18px]" />
          </div>
          <p className="text-2xl md:text-3xl font-bold text-white tabular-nums">{confirmed}</p>
          <p className="text-xs md:text-sm text-[#64748b] mt-0.5">Подтверждено</p>
          {awaitingConfirm > 0 && (
            <p className="text-xs text-amber-600 dark:text-amber-400 tabular-nums mt-1">+{awaitingConfirm} ожидает</p>
          )}
        </div>

        {/* Перенесено */}
        <div className={cardBase}>
          <div className="w-8 h-8 md:w-9 md:h-9 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-400 mb-3 md:mb-4 group-hover:scale-105 transition-transform duration-200">
            <ArrowRightLeft className="w-4 h-4 md:w-[18px] md:h-[18px]" />
          </div>
          <p className="text-2xl md:text-3xl font-bold text-white tabular-nums">{rescheduled}</p>
          <p className="text-xs md:text-sm text-[#64748b] mt-0.5">Перенесено</p>
          {awaitingReschedule > 0 && (
            <p className="text-xs text-amber-600 dark:text-amber-400 tabular-nums mt-1">+{awaitingReschedule} ожидает</p>
          )}
        </div>

        {/* Отменено */}
        <div className={cardBase}>
          <div className="w-8 h-8 md:w-9 md:h-9 rounded-lg bg-red-500/10 flex items-center justify-center text-red-400 mb-3 md:mb-4 group-hover:scale-105 transition-transform duration-200">
            <XCircle className="w-4 h-4 md:w-[18px] md:h-[18px]" />
          </div>
          <p className="text-2xl md:text-3xl font-bold text-white tabular-nums">{cancelled}</p>
          <p className="text-xs md:text-sm text-[#64748b] mt-0.5">Отменено</p>
          {awaitingCancel > 0 && (
            <p className="text-xs text-amber-600 dark:text-amber-400 tabular-nums mt-1">+{awaitingCancel} ожидает</p>
          )}
        </div>
      </div>

      {/* Bottom row: 2 squares + 1 rectangle */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        {/* Ожидает оператора */}
        <button
          onClick={() => navigate('/admin/chats?controller=operator')}
          className={`${cardBase} text-left cursor-pointer hover:border-red-500/20`}
        >
          <div className="w-8 h-8 md:w-9 md:h-9 rounded-lg bg-red-500/10 flex items-center justify-center text-red-400 mb-3 md:mb-4 group-hover:scale-105 transition-transform duration-200">
            <AlertTriangle className="w-4 h-4 md:w-[18px] md:h-[18px]" />
          </div>
          <p className="text-2xl md:text-3xl font-bold text-white tabular-nums">{operatorChats}</p>
          <p className="text-xs md:text-sm text-[#64748b] mt-0.5">Ожидает оператора</p>
        </button>

        {/* Всего переписок */}
        <div className={cardBase}>
          <div className="w-8 h-8 md:w-9 md:h-9 rounded-lg bg-white/[0.06] flex items-center justify-center text-[#94a3b8] mb-3 md:mb-4 group-hover:scale-105 transition-transform duration-200">
            <Users className="w-4 h-4 md:w-[18px] md:h-[18px]" />
          </div>
          <p className="text-2xl md:text-3xl font-bold text-white tabular-nums">{totalSessions}</p>
          <p className="text-xs md:text-sm text-[#64748b] mt-0.5">Всего переписок</p>
        </div>

        {/* Прошлый месяц — spans 2 cols on lg */}
        <div className={`${cardBase} lg:col-span-2`}>
          <div className="flex items-center gap-2 mb-3 md:mb-4">
            <div className="w-8 h-8 md:w-9 md:h-9 rounded-lg bg-purple-500/10 flex items-center justify-center text-purple-400 group-hover:scale-105 transition-transform duration-200">
              <TrendingUp className="w-4 h-4 md:w-[18px] md:h-[18px]" />
            </div>
            <p className="text-xs md:text-sm text-[#64748b]">Прошлый месяц</p>
          </div>
          <div className="grid grid-cols-4 gap-2">
            <div>
              <p className="text-lg md:text-2xl font-bold text-white tabular-nums">{stats?.prev_month?.total ?? '—'}</p>
              <p className="text-[10px] md:text-xs text-[#64748b]">всего</p>
            </div>
            <div>
              <p className="text-lg md:text-2xl font-bold text-emerald-400 tabular-nums">{stats?.prev_month?.confirmed ?? '—'}</p>
              <p className="text-[10px] md:text-xs text-[#64748b]">подтверждено</p>
            </div>
            <div>
              <p className="text-lg md:text-2xl font-bold text-blue-400 tabular-nums">{stats?.prev_month?.rescheduled ?? '—'}</p>
              <p className="text-[10px] md:text-xs text-[#64748b]">перенесено</p>
            </div>
            <div>
              <p className="text-lg md:text-2xl font-bold text-red-400 tabular-nums">{stats?.prev_month?.cancelled ?? '—'}</p>
              <p className="text-[10px] md:text-xs text-[#64748b]">отменено</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
