import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { RefreshCw, CalendarCheck, Clock, CheckCircle2, XCircle, ArrowRightLeft } from 'lucide-react'
import { getAdminSessions } from '../../api/adminClient'
import type { AdminSessionSummary } from '../../api/adminClient'
import { format } from 'date-fns'

const CONFIRMATION_FILTERS = [
  { value: '', label: 'Все' },
  { value: 'sent', label: 'Отправлено' },
  { value: 'confirmed', label: 'Подтверждено' },
  { value: 'cancelled', label: 'Отменено' },
  { value: 'rescheduled', label: 'Перенесено' },
] as const

const STATUS_LABELS: Record<string, string> = {
  sent: 'Отправлено',
  confirmed: 'Подтверждено',
  cancelled: 'Отменено',
  rescheduled: 'Перенесено',
}

const STATUS_COLORS: Record<string, string> = {
  sent: 'bg-amber-500/15 text-amber-300 border-amber-500/25',
  confirmed: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/25',
  cancelled: 'bg-red-500/15 text-red-300 border-red-500/25',
  rescheduled: 'bg-orange-500/15 text-orange-300 border-orange-500/25',
}

const STATUS_ICONS: Record<string, typeof Clock> = {
  sent: Clock,
  confirmed: CheckCircle2,
  cancelled: XCircle,
  rescheduled: ArrowRightLeft,
}

export function AdminConfirmationsPage() {
  const [sessions, setSessions] = useState<AdminSessionSummary[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeFilter, setActiveFilter] = useState('')
  const [counts, setCounts] = useState<Record<string, number>>({})
  const navigate = useNavigate()

  const loadSessions = async (silent = false) => {
    if (!silent) setIsLoading(true)
    setError(null)
    try {
      // Load confirmation sessions — filter on backend, not locally
      const params: Record<string, unknown> = { limit: 200 }
      if (activeFilter) params.confirmation_status = activeFilter

      const filteredData = await getAdminSessions(params as Parameters<typeof getAdminSessions>[0])
      const filtered = Array.isArray(filteredData) ? filteredData : []
      setSessions(filtered)

      // Load counts for all statuses (separate call without filter)
      if (!silent) {
        const allData = await getAdminSessions({ limit: 200 } as Parameters<typeof getAdminSessions>[0])
        const all = Array.isArray(allData) ? allData : []
        const newCounts: Record<string, number> = {}
        for (const s of all) {
          if (s.confirmation_status) {
            newCounts[s.confirmation_status] = (newCounts[s.confirmation_status] || 0) + 1
          }
        }
        setCounts(newCounts)
      }
    } catch (e) {
      console.error('Confirmations load error:', e)
      setError('Не удалось загрузить записи')
      setSessions([])
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadSessions()
  }, [activeFilter])

  // Auto-refresh every 10s
  useEffect(() => {
    const id = setInterval(() => {
      if (!document.hidden) loadSessions(true)
    }, 10000)
    return () => clearInterval(id)
  }, [activeFilter])

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
          onClick={() => loadSessions()}
          className="flex items-center gap-2 px-4 py-2 bg-white/[0.04] border border-white/[0.08] rounded-xl text-sm text-[#94a3b8] hover:text-white hover:border-[#51ff97]/20 transition-all duration-200"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          Обновить
        </button>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {(['sent', 'confirmed', 'cancelled', 'rescheduled'] as const).map((status) => {
          const Icon = STATUS_ICONS[status]
          return (
            <button
              key={status}
              onClick={() => setActiveFilter(activeFilter === status ? '' : status)}
              className={`p-4 rounded-xl border transition-all duration-200 text-left ${
                activeFilter === status
                  ? `${STATUS_COLORS[status]} border-current`
                  : 'bg-white/[0.02] border-white/[0.06] hover:bg-white/[0.04]'
              }`}
            >
              <div className="flex items-center gap-2 mb-2">
                <Icon className={`w-4 h-4 ${activeFilter === status ? '' : 'text-[#64748b]'}`} />
                <span className={`text-xs font-medium ${activeFilter === status ? '' : 'text-[#64748b]'}`}>
                  {STATUS_LABELS[status]}
                </span>
              </div>
              <p className={`text-2xl font-bold ${activeFilter === status ? '' : 'text-white'}`}>
                {counts[status] || 0}
              </p>
            </button>
          )
        })}
      </div>

      {/* Error */}
      {error && (
        <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-sm text-amber-300">
          {error}
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex items-center gap-2 flex-wrap">
        {CONFIRMATION_FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => setActiveFilter(f.value)}
            className={`px-3.5 py-2 rounded-xl text-sm border transition-all duration-200 ${
              activeFilter === f.value
                ? 'bg-[#51ff97]/10 border-[#51ff97]/25 text-[#51ff97]'
                : 'bg-white/[0.04] border-white/[0.08] text-[#94a3b8] hover:text-white'
            }`}
          >
            {f.label}
            {f.value === '' ? ` (${totalCount})` : ` (${counts[f.value] || 0})`}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/[0.06]">
                <th className="text-left px-4 py-3.5 text-xs font-semibold text-[#64748b] uppercase tracking-wider">Пациент</th>
                <th className="text-left px-4 py-3.5 text-xs font-semibold text-[#64748b] uppercase tracking-wider">Телефон</th>
                <th className="text-left px-4 py-3.5 text-xs font-semibold text-[#64748b] uppercase tracking-wider">Статус</th>
                <th className="text-left px-4 py-3.5 text-xs font-semibold text-[#64748b] uppercase tracking-wider hidden md:table-cell">Канал</th>
                <th className="text-left px-4 py-3.5 text-xs font-semibold text-[#64748b] uppercase tracking-wider hidden lg:table-cell">Обновлено</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-[#64748b]">
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-4 h-4 border-2 border-[#51ff97] border-t-transparent rounded-full animate-spin" />
                      Загрузка...
                    </div>
                  </td>
                </tr>
              ) : sessions.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-[#64748b]">
                    <div className="flex flex-col items-center gap-2">
                      <CalendarCheck className="w-8 h-8 text-[#475569]" />
                      <span>Записей не найдено</span>
                    </div>
                  </td>
                </tr>
              ) : sessions.map((s) => {
                const StatusIcon = s.confirmation_status ? STATUS_ICONS[s.confirmation_status] || Clock : Clock
                return (
                  <tr
                    key={s.id}
                    onClick={() => navigate(`/admin/chats/${s.id}`)}
                    className="border-b border-white/[0.04] hover:bg-white/[0.03] transition-colors duration-150 cursor-pointer"
                  >
                    <td className="px-4 py-3">
                      <p className="text-sm text-white truncate max-w-[180px]">{s.patient?.name || 'Без имени'}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-sm text-[#94a3b8]">{s.patient?.phone || '---'}</p>
                    </td>
                    <td className="px-4 py-3">
                      {s.confirmation_status && (
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium ${STATUS_COLORS[s.confirmation_status] || 'bg-gray-500/15 text-gray-300 border-gray-500/25'}`}>
                          <StatusIcon className="w-3 h-3" />
                          {STATUS_LABELS[s.confirmation_status] || s.confirmation_status}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <span className="text-sm text-[#94a3b8]">{s.channel || '---'}</span>
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      {s.updated_at ? (
                        <>
                          <p className="text-sm text-white whitespace-nowrap">{format(new Date(s.updated_at), 'dd.MM.yyyy')}</p>
                          <p className="text-xs text-[#64748b]">{format(new Date(s.updated_at), 'HH:mm')}</p>
                        </>
                      ) : (
                        <p className="text-sm text-[#475569]">---</p>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {!isLoading && sessions.length > 0 && (
          <div className="text-center text-xs text-[#475569] py-3 border-t border-white/[0.04]">
            Показано {sessions.length} записей
          </div>
        )}
      </div>
    </div>
  )
}
