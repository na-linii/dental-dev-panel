import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { RefreshCw, CalendarCheck, Clock, CheckCircle2, XCircle, ArrowRightLeft, ClipboardCheck, Ban, Timer, AlertCircle } from 'lucide-react'
import type { AdminSessionSummary } from '../../api/adminClient'
import { useAdminSessions } from '../../hooks/useAdminQueries'
import { format } from 'date-fns'
import { ru } from 'date-fns/locale'

const CONFIRMATION_FILTERS = [
  { value: '', label: 'Все' },
  { value: 'sent', label: 'Отправлено' },
  { value: 'awaiting_confirm', label: 'Ожидает подтв.' },
  { value: 'awaiting_cancel', label: 'Ожидает отмены' },
  { value: 'awaiting_reschedule', label: 'Ожидает переноса' },
  { value: 'confirmed', label: 'Подтверждено' },
  { value: 'cancelled', label: 'Отменено' },
  { value: 'rescheduled', label: 'Перенесено' },
  { value: 'no_response', label: 'Нет ответа' },
] as const

const STATUS_LABELS: Record<string, string> = {
  sent: 'Отправлено',
  awaiting_confirm: 'Ожидает подтв.',
  awaiting_cancel: 'Ожидает отмены',
  awaiting_reschedule: 'Ожидает переноса',
  confirmed: 'Подтверждено',
  cancelled: 'Отменено',
  rescheduled: 'Перенесено',
  no_response: 'Нет ответа',
}

const STATUS_COLORS: Record<string, string> = {
  sent: 'bg-amber-500/15 text-amber-300 border-amber-500/25',
  awaiting_confirm: 'bg-orange-500/15 text-orange-300 border-orange-500/25',
  awaiting_cancel: 'bg-orange-500/15 text-orange-300 border-orange-500/25',
  awaiting_reschedule: 'bg-orange-500/15 text-orange-300 border-orange-500/25',
  confirmed: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/25',
  cancelled: 'bg-red-500/15 text-red-300 border-red-500/25',
  rescheduled: 'bg-orange-500/15 text-orange-300 border-orange-500/25',
  no_response: 'bg-gray-500/15 text-gray-400 border-gray-500/25',
}

const STATUS_ICONS: Record<string, typeof Clock> = {
  sent: Clock,
  awaiting_confirm: ClipboardCheck,
  awaiting_cancel: Ban,
  awaiting_reschedule: Timer,
  confirmed: CheckCircle2,
  cancelled: XCircle,
  rescheduled: ArrowRightLeft,
  no_response: AlertCircle,
}

export function AdminConfirmationsPage() {
  const [activeFilter, setActiveFilter] = useState('')
  const navigate = useNavigate()

  // Filtered query — always filter to sessions with confirmation data
  const { data: filteredData, isLoading, error: queryError, refetch } = useAdminSessions({
    limit: 200,
    has_confirmation: true,
    ...(activeFilter ? { confirmation_status: activeFilter } : {}),
  })
  const sessions: AdminSessionSummary[] = Array.isArray(filteredData) ? filteredData : []
  const error = queryError ? 'Не удалось загрузить записи' : null

  // All confirmation sessions for counts
  const { data: allData } = useAdminSessions({ limit: 200, has_confirmation: true })
  const counts = useMemo(() => {
    const all = Array.isArray(allData) ? allData : []
    const c: Record<string, number> = {}
    for (const s of all) {
      if (s.confirmation_status) c[s.confirmation_status] = (c[s.confirmation_status] || 0) + 1
    }
    return c
  }, [allData])

  const totalCount = Object.values(counts).reduce((a, b) => a + b, 0)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Записи</h1>
          <p className="text-[#64748b] mt-1">Подтверждение записей на прием</p>
        </div>
        <button
          onClick={() => refetch()}
          className="flex items-center gap-2 px-4 py-2 bg-white/[0.04] border border-white/[0.08] rounded-xl text-sm text-[#94a3b8] hover:text-white hover:border-[#51ff97]/20 transition-all duration-200"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          Обновить
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-sm text-amber-300">
          {error}
        </div>
      )}

      {/* Tag filters */}
      <div className="flex items-center gap-2 flex-wrap">
        {CONFIRMATION_FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => setActiveFilter(f.value)}
            className={`px-3.5 py-1.5 rounded-full text-sm border transition-all duration-200 ${
              activeFilter === f.value
                ? 'bg-[#51ff97]/10 text-[#51ff97] border border-[#51ff97]/20'
                : 'bg-white/[0.03] text-[#64748b] border border-white/[0.06]'
            }`}
          >
            {f.label}
            {f.value === '' ? ` (${totalCount})` : ` (${counts[f.value] || 0})`}
          </button>
        ))}
      </div>

      {/* Timeline cards */}
      {isLoading ? (
        <div className="px-4 py-12 text-center text-[#64748b]">
          <div className="flex items-center justify-center gap-2">
            <div className="w-4 h-4 border-2 border-[#51ff97] border-t-transparent rounded-full animate-spin" />
            Загрузка...
          </div>
        </div>
      ) : sessions.length === 0 ? (
        <div className="px-4 py-12 text-center text-[#64748b]">
          <div className="flex flex-col items-center gap-2">
            <CalendarCheck className="w-8 h-8 text-[#475569]" />
            <span>Записей не найдено</span>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {sessions.map((s) => {
            const date = s.confirmation_appointment_date ? new Date(s.confirmation_appointment_date + 'T00:00:00') : null
            const day = date ? format(date, 'd') : '\u2014'
            const month = date ? format(date, 'MMM', { locale: ru }).replace('.', '') : ''
            const statusColor = STATUS_COLORS[s.confirmation_status || ''] || 'bg-gray-500/15 text-gray-300 border-gray-500/25'
            const statusLabel = STATUS_LABELS[s.confirmation_status || ''] || s.confirmation_status || '\u2014'
            const StatusIcon = STATUS_ICONS[s.confirmation_status || ''] || Clock

            return (
              <div key={s.id} onClick={() => navigate(`/admin/chats/${s.id}`)}
                   className="flex items-center gap-3 px-4 py-3 bg-white/[0.02] border border-white/[0.06] rounded-xl cursor-pointer hover:bg-white/[0.03] transition-colors duration-150">
                <div className="text-center min-w-[40px]">
                  <div className="text-xl font-extrabold text-white leading-none">{day}</div>
                  <div className="text-[8px] text-[#64748b] uppercase tracking-wide">{month}</div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-white truncate">
                    {s.confirmation_appointment_time || '\u2014'} &rarr; {s.confirmation_doctor_name || '\u2014'}
                  </div>
                  {s.patient?.name && (
                    <div className="text-xs text-[#64748b] truncate">{s.patient.name}</div>
                  )}
                </div>
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium shrink-0 ${statusColor}`}>
                  <StatusIcon className="w-3 h-3" />
                  <span className="hidden sm:inline">{statusLabel}</span>
                </span>
              </div>
            )
          })}
        </div>
      )}

      {!isLoading && sessions.length > 0 && (
        <div className="text-center text-xs text-[#475569] py-3">
          Показано {sessions.length} записей
        </div>
      )}
    </div>
  )
}
