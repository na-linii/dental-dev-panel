import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { RefreshCw, CalendarCheck } from 'lucide-react'
import { useSessionsData } from '../../hooks/useAdminQueries'
import { format } from 'date-fns'
import { ru } from 'date-fns/locale'
import { STATUS_CONFIG, CONFIRMATION_FILTERS } from '../../config/adminStatuses'
import { pluralize } from '../../utils/pluralize'

export function AdminConfirmationsPage() {
  const [activeFilter, setActiveFilter] = useState('')
  const navigate = useNavigate()

  const { computed, isLoading, error: queryError, refetch } = useSessionsData()
  const error = queryError ? 'Не удалось загрузить записи' : null

  const { sessions, counts, totalCount } = useMemo(() => {
    const filtered = activeFilter
      ? computed.withConfirmation.filter((s) => s.confirmation_status === activeFilter)
      : computed.withConfirmation
    return { sessions: filtered, counts: computed.byConfirmation, totalCount: computed.confirmationTotal }
  }, [computed, activeFilter])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Записи</h1>
          <p className="text-text-tertiary mt-1">Подтверждение записей на прием</p>
        </div>
        <button
          onClick={() => refetch()}
          className="flex items-center gap-2 px-4 py-2 bg-surface-secondary dark:bg-white/[0.04] border border-border dark:border-white/[0.08] rounded-xl text-sm text-text-secondary hover:text-text-primary hover:border-accent/20 transition-all duration-200"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          Обновить
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="p-3 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 rounded-xl text-sm text-amber-700 dark:text-amber-300">
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
                ? 'bg-accent-soft text-accent border border-accent/20'
                : 'bg-surface-secondary dark:bg-white/[0.03] text-text-tertiary border border-border dark:border-white/[0.06]'
            }`}
          >
            {f.label}
            {f.value === '' ? ` (${totalCount})` : ` (${counts[f.value] || 0})`}
          </button>
        ))}
      </div>

      {/* Timeline cards */}
      {isLoading ? (
        <div className="px-4 py-12 text-center text-text-tertiary">
          <div className="flex items-center justify-center gap-2">
            <div className="w-4 h-4 border-2 border-accent border-t-transparent rounded-full animate-spin" />
            Загрузка...
          </div>
        </div>
      ) : sessions.length === 0 ? (
        <div className="px-4 py-12 text-center text-text-tertiary">
          <div className="flex flex-col items-center gap-2">
            <CalendarCheck className="w-8 h-8 text-text-muted" />
            <span>Записей не найдено</span>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {sessions.map((s) => {
            const date = s.confirmation_appointment_date ? new Date(s.confirmation_appointment_date + 'T00:00:00') : null
            const day = date ? format(date, 'd') : '\u2014'
            const month = date ? format(date, 'MMM', { locale: ru }).replace('.', '') : ''
            const cfg = STATUS_CONFIG[s.confirmation_status || '']
            const statusColor = cfg?.badge || 'bg-gray-100 dark:bg-gray-500/15 text-gray-500 dark:text-gray-300 border-gray-200 dark:border-gray-500/25'
            const statusLabel = cfg?.label || s.confirmation_status || '\u2014'
            const StatusIcon = cfg?.icon || CalendarCheck

            return (
              <div key={s.id} onClick={() => navigate(`/admin/chats/${s.id}`)}
                   className="flex items-center gap-3 px-4 py-3 bg-white dark:bg-white/[0.02] border border-gray-200 dark:border-white/[0.06] shadow-sm dark:shadow-none rounded-xl cursor-pointer hover:bg-gray-50 dark:hover:bg-white/[0.03] transition-colors duration-150">
                <div className="text-center min-w-[40px]">
                  <div className="text-xl font-extrabold text-text-primary leading-none">{day}</div>
                  <div className="text-[8px] text-text-tertiary uppercase tracking-wide">{month}</div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-text-primary truncate">
                    {s.confirmation_appointment_time || '\u2014'} &rarr; {s.confirmation_doctor_name || '\u2014'}
                  </div>
                  {s.patient?.name && (
                    <div className="text-xs text-text-tertiary truncate">{s.patient.name}</div>
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
        <div className="text-center text-xs text-text-muted py-3">
          Показано {sessions.length} {pluralize(sessions.length, 'запись', 'записи', 'записей')}
        </div>
      )}
    </div>
  )
}
