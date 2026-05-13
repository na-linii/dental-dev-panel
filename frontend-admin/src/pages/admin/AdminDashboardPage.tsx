import { useNavigate } from 'react-router-dom'
import { MessageCircle, AlertTriangle, CheckCircle2, XCircle, ArrowRightLeft, TrendingUp, Users, RefreshCw } from 'lucide-react'
import { useAdminDashboard } from '../../hooks/useAdminQueries'
import { DASHBOARD_LABELS } from '../../config/adminStatuses'

export function AdminDashboardPage() {
  const { data: stats, isLoading, error, refetch } = useAdminDashboard()
  const navigate = useNavigate()

  const user = (() => {
    try { return JSON.parse(localStorage.getItem('admin_user') || '{}') } catch { return {} }
  })()

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-7 h-7 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <p className="text-text-secondary">Не удалось загрузить статистику</p>
        <button onClick={() => refetch()} className="flex items-center gap-2 px-4 py-2 bg-surface-secondary dark:bg-white/[0.04] border border-border dark:border-white/[0.08] rounded-xl text-sm text-text-secondary hover:text-text-primary transition-colors">
          <RefreshCw className="w-4 h-4" /> Повторить
        </button>
      </div>
    )
  }

  // PD-373: sessions.operator теперь — только awaiting (operator_id IS NULL);
  // активные диалоги с оператором приходят отдельно как operator_active.
  const totalSessions =
    (stats?.sessions?.bot ?? 0) +
    (stats?.sessions?.operator ?? 0) +
    (stats?.sessions?.operator_active ?? 0) +
    (stats?.sessions?.closed ?? 0)
  // PD-373: терминальные счётчики читаем из per-booking SoT (booking_confirmation_runs),
  // а awaiting_* — из active-cycle cache в chat_sessions.confirmation_status.
  const confirmed = stats?.bookings_by_patient_response?.confirmed ?? 0
  const rescheduled = stats?.bookings_by_patient_response?.rescheduled ?? 0
  const cancelled = stats?.bookings_by_patient_response?.cancelled ?? 0
  const awaitingConfirm = stats?.confirmations?.awaiting_confirm ?? 0
  const awaitingReschedule = stats?.confirmations?.awaiting_reschedule ?? 0
  const awaitingCancel = stats?.confirmations?.awaiting_cancel ?? 0
  const operatorChats = stats?.sessions?.operator ?? 0

  const cardBase = 'bg-white dark:bg-white/[0.03] border border-gray-200 dark:border-white/[0.06] shadow-sm dark:shadow-none rounded-2xl p-4 md:p-5 transition-all duration-200 hover:bg-gray-50 dark:hover:bg-white/[0.05] group'

  return (
    <div className="space-y-3 md:space-y-4">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-text-primary">
          Добро пожаловать, {user.full_name?.split(' ')[0] || user.username}
        </h1>
      </div>

      {/* Top row: 4 stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        {/* Всего диалогов */}
        <div className={cardBase}>
          <div className="w-8 h-8 md:w-9 md:h-9 rounded-lg bg-accent-soft flex items-center justify-center text-accent mb-3 md:mb-4 group-hover:scale-105 transition-transform duration-200">
            <MessageCircle className="w-4 h-4 md:w-[18px] md:h-[18px]" />
          </div>
          <p className="text-2xl md:text-3xl font-bold text-text-primary tabular-nums">{totalSessions}</p>
          <p className="text-xs md:text-sm text-text-tertiary mt-0.5">{DASHBOARD_LABELS.totalSessions}</p>
        </div>

        {/* Подтверждено */}
        <div className={cardBase}>
          <div className="w-8 h-8 md:w-9 md:h-9 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 flex items-center justify-center text-emerald-600 dark:text-emerald-400 mb-3 md:mb-4 group-hover:scale-105 transition-transform duration-200">
            <CheckCircle2 className="w-4 h-4 md:w-[18px] md:h-[18px]" />
          </div>
          <p className="text-2xl md:text-3xl font-bold text-text-primary tabular-nums">{confirmed}</p>
          <p className="text-xs md:text-sm text-text-tertiary mt-0.5">{DASHBOARD_LABELS.confirmed}</p>
          {awaitingConfirm > 0 && (
            <p className="text-xs text-amber-600 dark:text-amber-400 tabular-nums mt-1">+{awaitingConfirm} ожидает</p>
          )}
        </div>

        {/* Перенесено */}
        <div className={cardBase}>
          <div className="w-8 h-8 md:w-9 md:h-9 rounded-lg bg-blue-50 dark:bg-blue-500/10 flex items-center justify-center text-blue-600 dark:text-blue-400 mb-3 md:mb-4 group-hover:scale-105 transition-transform duration-200">
            <ArrowRightLeft className="w-4 h-4 md:w-[18px] md:h-[18px]" />
          </div>
          <p className="text-2xl md:text-3xl font-bold text-text-primary tabular-nums">{rescheduled}</p>
          <p className="text-xs md:text-sm text-text-tertiary mt-0.5">{DASHBOARD_LABELS.rescheduled}</p>
          {awaitingReschedule > 0 && (
            <p className="text-xs text-amber-600 dark:text-amber-400 tabular-nums mt-1">+{awaitingReschedule} ожидает</p>
          )}
        </div>

        {/* Отменено */}
        <div className={cardBase}>
          <div className="w-8 h-8 md:w-9 md:h-9 rounded-lg bg-red-50 dark:bg-red-500/10 flex items-center justify-center text-red-600 dark:text-red-400 mb-3 md:mb-4 group-hover:scale-105 transition-transform duration-200">
            <XCircle className="w-4 h-4 md:w-[18px] md:h-[18px]" />
          </div>
          <p className="text-2xl md:text-3xl font-bold text-text-primary tabular-nums">{cancelled}</p>
          <p className="text-xs md:text-sm text-text-tertiary mt-0.5">{DASHBOARD_LABELS.cancelled}</p>
          {awaitingCancel > 0 && (
            <p className="text-xs text-amber-600 dark:text-amber-400 tabular-nums mt-1">+{awaitingCancel} ожидает</p>
          )}
        </div>
      </div>

      {/* Bottom row: 2 squares + 1 rectangle */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        {/* Ожидает оператора */}
        <button
          onClick={() => navigate('/chats?controller=operator')}
          className={`${cardBase} text-left cursor-pointer hover:border-red-500/20`}
        >
          <div className="w-8 h-8 md:w-9 md:h-9 rounded-lg bg-red-50 dark:bg-red-500/10 flex items-center justify-center text-red-600 dark:text-red-400 mb-3 md:mb-4 group-hover:scale-105 transition-transform duration-200">
            <AlertTriangle className="w-4 h-4 md:w-[18px] md:h-[18px]" />
          </div>
          <p className="text-2xl md:text-3xl font-bold text-text-primary tabular-nums">{operatorChats}</p>
          <p className="text-xs md:text-sm text-text-tertiary mt-0.5">{DASHBOARD_LABELS.operator}</p>
        </button>

        {/* Всего переписок */}
        <div className={cardBase}>
          <div className="w-8 h-8 md:w-9 md:h-9 rounded-lg bg-gray-100 dark:bg-white/[0.06] flex items-center justify-center text-text-secondary mb-3 md:mb-4 group-hover:scale-105 transition-transform duration-200">
            <Users className="w-4 h-4 md:w-[18px] md:h-[18px]" />
          </div>
          <p className="text-2xl md:text-3xl font-bold text-text-primary tabular-nums">{totalSessions}</p>
          <p className="text-xs md:text-sm text-text-tertiary mt-0.5">{DASHBOARD_LABELS.totalPatients}</p>
        </div>

        {/* Прошлый месяц — spans 2 cols on lg */}
        <div className={`${cardBase} col-span-2 lg:col-span-2`}>
          <div className="flex items-center gap-2 mb-3 md:mb-4">
            <div className="w-8 h-8 md:w-9 md:h-9 rounded-lg bg-purple-50 dark:bg-purple-500/10 flex items-center justify-center text-purple-600 dark:text-purple-400 group-hover:scale-105 transition-transform duration-200">
              <TrendingUp className="w-4 h-4 md:w-[18px] md:h-[18px]" />
            </div>
            <p className="text-xs md:text-sm text-text-tertiary">Прошлый месяц</p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div>
              <p className="text-lg md:text-2xl font-bold text-text-primary tabular-nums">{stats?.prev_month?.total ?? '—'}</p>
              <p className="text-[10px] md:text-xs text-text-tertiary">всего</p>
            </div>
            <div>
              <p className="text-lg md:text-2xl font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">{stats?.prev_month?.confirmed ?? '—'}</p>
              <p className="text-[10px] md:text-xs text-text-tertiary">подтверждено</p>
            </div>
            <div>
              <p className="text-lg md:text-2xl font-bold text-blue-600 dark:text-blue-400 tabular-nums">{stats?.prev_month?.rescheduled ?? '—'}</p>
              <p className="text-[10px] md:text-xs text-text-tertiary">перенесено</p>
            </div>
            <div>
              <p className="text-lg md:text-2xl font-bold text-red-600 dark:text-red-400 tabular-nums">{stats?.prev_month?.cancelled ?? '—'}</p>
              <p className="text-[10px] md:text-xs text-text-tertiary">отменено</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
