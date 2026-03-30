import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { RefreshCw, Search, AlertCircle, Filter } from 'lucide-react'
import { getAdminSessions } from '../../api/adminClient'
import type { AdminSessionSummary } from '../../api/adminClient'
import { format } from 'date-fns'

const STATUS_LABELS: Record<string, string> = {
  agent_chat: 'С агентом',
  operator_chat: 'С оператором',
  awaiting_operator: 'Ожидает оператора',
  chat_completed: 'Завершён',
  visit_reminder: 'Напоминание',
  confirm_in_mis: 'Подтвердите в МИС',
  visit_confirmed: 'Подтверждён',
  visit_not_confirmed: 'Не подтверждён',
  cancel_in_mis: 'Отмените в МИС',
  cancelled: 'Отменён',
  reschedule_in_mis: 'Перенесите в МИС',
  rescheduled: 'Перенесён',
  blocked: 'Заблокирован',
}

const STATUS_COLORS: Record<string, string> = {
  agent_chat: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/25',
  operator_chat: 'bg-blue-500/15 text-blue-300 border-blue-500/25',
  awaiting_operator: 'bg-red-500/15 text-red-300 border-red-500/25',
  chat_completed: 'bg-gray-500/15 text-gray-300 border-gray-500/25',
  visit_reminder: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/25',
  confirm_in_mis: 'bg-orange-500/15 text-orange-300 border-orange-500/25',
  visit_confirmed: 'bg-gray-500/15 text-gray-300 border-gray-500/25',
  visit_not_confirmed: 'bg-red-500/15 text-red-300 border-red-500/25',
  cancel_in_mis: 'bg-orange-500/15 text-orange-300 border-orange-500/25',
  cancelled: 'bg-gray-500/15 text-gray-300 border-gray-500/25',
  reschedule_in_mis: 'bg-orange-500/15 text-orange-300 border-orange-500/25',
  rescheduled: 'bg-gray-500/15 text-gray-300 border-gray-500/25',
  blocked: 'bg-red-500/15 text-red-300 border-red-500/25',
}

const FILTER_STATUSES = [
  'agent_chat', 'operator_chat', 'awaiting_operator', 'chat_completed',
  'visit_reminder', 'confirm_in_mis', 'visit_confirmed', 'cancelled',
]

export function AdminChatsPage() {
  const [sessions, setSessions] = useState<AdminSessionSummary[]>([])
  const [total, setTotal] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [searchParams, setSearchParams] = useSearchParams()
  const [searchInput, setSearchInput] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState(() => searchParams.get('status') || '')
  const [awaitingOnly, setAwaitingOnly] = useState(() => searchParams.get('awaiting') === '1')
  const navigate = useNavigate()

  const loadSessions = async () => {
    setIsLoading(true)
    try {
      const params: Record<string, unknown> = { limit: 100 }
      if (statusFilter) params.status = statusFilter
      if (awaitingOnly) params.awaiting_operator = true
      if (searchQuery) params.search = searchQuery
      const res = await getAdminSessions(params as Parameters<typeof getAdminSessions>[0])
      setSessions(res.items)
      setTotal(res.total)
    } catch (e) {
      console.error('Sessions load error:', e)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => { loadSessions() }, [statusFilter, awaitingOnly, searchQuery])

  // Auto-refresh every 10s
  useEffect(() => {
    const id = setInterval(() => {
      if (!document.hidden) loadSessions()
    }, 10000)
    return () => clearInterval(id)
  }, [statusFilter, awaitingOnly, searchQuery])

  const handleSearch = () => setSearchQuery(searchInput)
  const handleSearchKeyDown = (e: React.KeyboardEvent) => { if (e.key === 'Enter') handleSearch() }
  const handleSearchClear = () => { setSearchInput(''); setSearchQuery('') }

  const handleStatusChange = (v: string) => {
    setStatusFilter(v)
    setSearchParams((prev) => {
      if (v) prev.set('status', v)
      else prev.delete('status')
      return prev
    }, { replace: true })
  }

  const handleAwaitingToggle = () => {
    const next = !awaitingOnly
    setAwaitingOnly(next)
    setSearchParams((prev) => {
      if (next) prev.set('awaiting', '1')
      else prev.delete('awaiting')
      return prev
    }, { replace: true })
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Чаты</h1>
          <p className="text-[#64748b] mt-1">{total} диалогов</p>
        </div>
        <button
          onClick={loadSessions}
          className="flex items-center gap-2 px-4 py-2 bg-white/[0.04] border border-white/[0.08] rounded-xl text-sm text-[#94a3b8] hover:text-white hover:border-[#51ff97]/20 transition-all duration-200"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          Обновить
        </button>
      </div>

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

        {/* Status filter */}
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-[#64748b]" />
          <select
            value={statusFilter}
            onChange={(e) => handleStatusChange(e.target.value)}
            className="bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-[#51ff97]/40 transition-all duration-200 cursor-pointer"
          >
            <option value="">Все статусы</option>
            {FILTER_STATUSES.map((s) => (
              <option key={s} value={s}>{STATUS_LABELS[s] || s}</option>
            ))}
          </select>
        </div>

        {/* Awaiting toggle */}
        <button
          onClick={handleAwaitingToggle}
          className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-sm border transition-all duration-200 ${
            awaitingOnly
              ? 'bg-red-500/15 border-red-500/25 text-red-400'
              : 'bg-white/[0.04] border-white/[0.08] text-[#94a3b8] hover:text-white'
          }`}
        >
          <AlertCircle className="w-4 h-4" />
          <span className="hidden sm:inline">Ожидает оператора</span>
          <span className="sm:hidden">Ждут</span>
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
                <th className="text-left px-4 py-3.5 text-xs font-semibold text-[#64748b] uppercase tracking-wider hidden md:table-cell">Врач</th>
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
                    s.awaiting_operator
                      ? 'bg-red-500/[0.04] hover:bg-red-500/[0.07] border-l-2 border-l-red-400'
                      : 'hover:bg-white/[0.03]'
                  }`}
                >
                  <td className="px-4 py-3">
                    {s.last_message_time ? (
                      <>
                        <p className="text-sm text-white whitespace-nowrap">{format(new Date(s.last_message_time), 'dd.MM.yyyy')}</p>
                        <p className="text-xs text-[#64748b]">{format(new Date(s.last_message_time), 'HH:mm')}</p>
                      </>
                    ) : (
                      <p className="text-sm text-[#475569]">---</p>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-sm text-white truncate max-w-[160px]">{s.patient_name}</p>
                    {s.patient_phone && <p className="text-xs text-[#64748b] truncate">{s.patient_phone}</p>}
                  </td>
                  <td className="px-4 py-3 text-sm text-[#94a3b8] hidden md:table-cell truncate max-w-[120px]">
                    {s.doctor_name || '---'}
                  </td>
                  <td className="px-4 py-3">
                    {s.status && (
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium ${STATUS_COLORS[s.status] || 'bg-gray-500/15 text-gray-300 border-gray-500/25'}`}>
                        <span className="w-1.5 h-1.5 rounded-full bg-current opacity-60" />
                        {STATUS_LABELS[s.status] || s.status_label || s.status}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {!isLoading && sessions.length > 0 && (
          <div className="text-center text-xs text-[#475569] py-3 border-t border-white/[0.04]">
            Показано {sessions.length} из {total} диалогов
          </div>
        )}
      </div>
    </div>
  )
}
