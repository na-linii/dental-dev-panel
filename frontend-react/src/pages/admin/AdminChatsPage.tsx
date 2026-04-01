import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { RefreshCw, Search, AlertCircle, Filter, Bell, ClipboardCheck, CircleCheck, Ban, CircleX, Timer, MessageCircle, Headphones, MessageSquare } from 'lucide-react'
import { getAdminSessions } from '../../api/adminClient'
import type { AdminSessionSummary } from '../../api/adminClient'
import { format } from 'date-fns'
import type { LucideIcon } from 'lucide-react'

interface StatusConfig {
  label: string
  icon: LucideIcon
  badge: string
  dot: string
}

// Unified status config — same as legacy admin panel
const STATUS_CONFIG: Record<string, StatusConfig> = {
  // Confirmation statuses
  sent:                { label: 'Напоминание о визите',       icon: Bell,           badge: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/25', dot: 'bg-emerald-400' },
  awaiting_confirm:    { label: 'Подтвердите в МИС',          icon: ClipboardCheck, badge: 'bg-orange-500/15 text-orange-300 border-orange-500/25',    dot: 'bg-orange-400' },
  awaiting_cancel:     { label: 'Отмените в МИС',             icon: Ban,            badge: 'bg-orange-500/15 text-orange-300 border-orange-500/25',    dot: 'bg-orange-400' },
  awaiting_reschedule: { label: 'Перенесите в МИС',           icon: Timer,          badge: 'bg-orange-500/15 text-orange-300 border-orange-500/25',    dot: 'bg-orange-400' },
  confirmed:           { label: 'Визит подтверждён',           icon: CircleCheck,    badge: 'bg-gray-500/15 text-gray-300 border-gray-500/25',         dot: 'bg-gray-400' },
  cancelled:           { label: 'Отменён',                     icon: CircleX,        badge: 'bg-gray-500/15 text-gray-300 border-gray-500/25',         dot: 'bg-gray-400' },
  rescheduled:         { label: 'Перенесён',                   icon: RefreshCw,      badge: 'bg-gray-500/15 text-gray-300 border-gray-500/25',         dot: 'bg-gray-400' },
  // Chat controller statuses (when no confirmation)
  bot:                 { label: 'Разговор с агентом',          icon: MessageCircle,  badge: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/25', dot: 'bg-emerald-400' },
  operator:            { label: 'Ожидает администратора',      icon: AlertCircle,    badge: 'bg-red-500/15 text-red-300 border-red-500/25',            dot: 'bg-red-400' },
  closed:              { label: 'Чат завершён',                icon: MessageSquare,  badge: 'bg-gray-500/15 text-gray-300 border-gray-500/25',         dot: 'bg-gray-400' },
}

function getSessionStatus(s: AdminSessionSummary): StatusConfig {
  if (s.confirmation_status && STATUS_CONFIG[s.confirmation_status]) {
    return STATUS_CONFIG[s.confirmation_status]
  }
  return STATUS_CONFIG[s.controller] || STATUS_CONFIG.bot
}

const FILTER_CONTROLLERS = [
  { value: 'bot', label: 'Разговор с агентом' },
  { value: 'operator', label: 'Ожидает администратора' },
  { value: 'closed', label: 'Завершён' },
]

export function AdminChatsPage() {
  const [sessions, setSessions] = useState<AdminSessionSummary[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchParams, setSearchParams] = useSearchParams()
  const [searchInput, setSearchInput] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [controllerFilter, setControllerFilter] = useState(() => searchParams.get('controller') || '')
  const navigate = useNavigate()

  const loadSessions = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const params: Record<string, unknown> = { limit: 100 }
      if (controllerFilter) params.controller = controllerFilter
      if (searchQuery) params.search = searchQuery
      // Backend returns flat array
      const data = await getAdminSessions(params as Parameters<typeof getAdminSessions>[0])
      setSessions(Array.isArray(data) ? data : [])
    } catch (e) {
      console.error('Sessions load error:', e)
      setError('Не удалось загрузить чаты')
      setSessions([])
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => { loadSessions() }, [controllerFilter, searchQuery])

  // Auto-refresh every 10s
  useEffect(() => {
    const id = setInterval(() => {
      if (!document.hidden) loadSessions()
    }, 10000)
    return () => clearInterval(id)
  }, [controllerFilter, searchQuery])

  const handleSearch = () => setSearchQuery(searchInput)
  const handleSearchKeyDown = (e: React.KeyboardEvent) => { if (e.key === 'Enter') handleSearch() }
  const handleSearchClear = () => { setSearchInput(''); setSearchQuery('') }

  const handleControllerChange = (v: string) => {
    setControllerFilter(v)
    setSearchParams((prev) => {
      if (v) prev.set('controller', v)
      else prev.delete('controller')
      return prev
    }, { replace: true })
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Чаты</h1>
          <p className="text-[#64748b] mt-1">{sessions.length} диалогов</p>
        </div>
        <button
          onClick={loadSessions}
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

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* Search */}
        <div className="relative flex-1 min-w-0 sm:min-w-[200px] sm:max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#475569]" />
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={handleSearchKeyDown}
            onBlur={() => { if (searchInput !== searchQuery) handleSearch() }}
            placeholder="Поиск по имени или телефону..."
            className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl pl-10 pr-8 py-2.5 text-sm text-white placeholder-[#475569] focus:outline-none focus:border-[#51ff97]/40 transition-all duration-200"
          />
          {searchInput && (
            <button onClick={handleSearchClear} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#64748b] hover:text-white transition-colors">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          )}
        </div>

        {/* Controller filter */}
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-[#64748b]" />
          <select
            value={controllerFilter}
            onChange={(e) => handleControllerChange(e.target.value)}
            className="bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-[#51ff97]/40 transition-all duration-200 cursor-pointer"
          >
            <option value="">Все</option>
            {FILTER_CONTROLLERS.map((f) => (
              <option key={f.value} value={f.value}>{f.label}</option>
            ))}
          </select>
        </div>

        {/* Operator-only shortcut */}
        <button
          onClick={() => handleControllerChange(controllerFilter === 'operator' ? '' : 'operator')}
          className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-sm border transition-all duration-200 ${
            controllerFilter === 'operator'
              ? 'bg-red-500/15 border-red-500/25 text-red-400'
              : 'bg-white/[0.04] border-white/[0.08] text-[#94a3b8] hover:text-white'
          }`}
        >
          <AlertCircle className="w-4 h-4" />
          <span className="hidden sm:inline">С оператором</span>
          <span className="sm:hidden">Опер.</span>
        </button>
      </div>

      {/* Table */}
      <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/[0.06]">
                <th className="text-left px-4 py-3.5 text-xs font-semibold text-[#64748b] uppercase tracking-wider">Время</th>
                <th className="text-left px-4 py-3.5 text-xs font-semibold text-[#64748b] uppercase tracking-wider">Пациент</th>
                <th className="text-left px-4 py-3.5 text-xs font-semibold text-[#64748b] uppercase tracking-wider hidden md:table-cell">Канал</th>
                <th className="text-left px-4 py-3.5 text-xs font-semibold text-[#64748b] uppercase tracking-wider">Статус</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={4} className="px-4 py-12 text-center text-[#64748b]">
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-4 h-4 border-2 border-[#51ff97] border-t-transparent rounded-full animate-spin" />
                      Загрузка...
                    </div>
                  </td>
                </tr>
              ) : sessions.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-12 text-center text-[#64748b]">
                    Диалоги не найдены
                  </td>
                </tr>
              ) : sessions.map((s) => (
                <tr
                  key={s.id}
                  onClick={() => navigate(`/admin/chats/${s.id}`)}
                  className={`border-b border-white/[0.04] transition-colors duration-150 cursor-pointer ${
                    s.controller === 'operator'
                      ? 'bg-red-500/[0.04] hover:bg-red-500/[0.07] border-l-2 border-l-red-400'
                      : 'hover:bg-white/[0.03]'
                  }`}
                >
                  <td className="px-4 py-3">
                    {s.last_message_at ? (
                      <>
                        <p className="text-sm text-white whitespace-nowrap">{format(new Date(s.last_message_at), 'dd.MM.yyyy')}</p>
                        <p className="text-xs text-[#64748b]">{format(new Date(s.last_message_at), 'HH:mm')}</p>
                      </>
                    ) : s.updated_at ? (
                      <>
                        <p className="text-sm text-white whitespace-nowrap">{format(new Date(s.updated_at), 'dd.MM.yyyy')}</p>
                        <p className="text-xs text-[#64748b]">{format(new Date(s.updated_at), 'HH:mm')}</p>
                      </>
                    ) : (
                      <p className="text-sm text-[#475569]">---</p>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-sm text-white truncate max-w-[160px]">{s.patient?.name || 'Без имени'}</p>
                    {s.patient?.phone && <p className="text-xs text-[#64748b] truncate">{s.patient.phone}</p>}
                  </td>
                  <td className="px-4 py-3 text-sm text-[#94a3b8] hidden md:table-cell truncate max-w-[120px]">
                    {s.channel || '---'}
                  </td>
                  <td className="px-4 py-3">
                    {(() => {
                      const st = getSessionStatus(s)
                      const Icon = st.icon
                      return (
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium ${st.badge}`}>
                          <Icon className="w-3.5 h-3.5" />
                          {st.label}
                        </span>
                      )
                    })()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {!isLoading && sessions.length > 0 && (
          <div className="text-center text-xs text-[#475569] py-3 border-t border-white/[0.04]">
            Показано {sessions.length} диалогов
          </div>
        )}
      </div>
    </div>
  )
}
