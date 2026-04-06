import { useState, useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { RefreshCw, Search, AlertCircle, Bell, ClipboardCheck, CircleCheck, Ban, CircleX, Timer, MessageCircle, MessageSquare } from 'lucide-react'
import type { AdminSessionSummary } from '../../api/adminClient'
import { useAdminSessions } from '../../hooks/useAdminQueries'
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
  no_response:         { label: 'Нет ответа',                  icon: Timer,          badge: 'bg-gray-500/15 text-gray-400 border-gray-500/25',         dot: 'bg-gray-400' },
  // Chat controller statuses (when no confirmation)
  bot:                 { label: 'Разговор с агентом',          icon: MessageCircle,  badge: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/25', dot: 'bg-emerald-400' },
  operator:            { label: 'Ожидает администратора',      icon: AlertCircle,    badge: 'bg-red-500/15 text-red-300 border-red-500/25',            dot: 'bg-red-400' },
  operator_active:     { label: 'С оператором',                icon: MessageCircle,  badge: 'bg-blue-500/15 text-blue-300 border-blue-500/25',          dot: 'bg-blue-400' },
  closed:              { label: 'Чат завершён',                icon: MessageSquare,  badge: 'bg-gray-500/15 text-gray-300 border-gray-500/25',         dot: 'bg-gray-400' },
}

const CONTROLLER_TAGS = [
  { value: '', label: 'Все' },
  { value: 'bot', label: 'С агентом' },
  { value: 'operator', label: 'С оператором' },
  { value: 'closed', label: 'Завершён' },
] as const

function getChannelPill(channel: string | null | undefined) {
  if (!channel) return null
  if (channel === 'tg_bot') return { text: 'TG', cls: 'bg-blue-500/10 text-blue-400' }
  if (channel === 'tg_business') return { text: 'BIZ', cls: 'bg-purple-500/10 text-purple-400' }
  return { text: channel, cls: 'bg-gray-500/10 text-gray-400' }
}

function getDisplayTime(s: AdminSessionSummary): string | null {
  const ts = s.last_message_at || s.updated_at
  if (!ts) return null
  return format(new Date(ts), 'HH:mm')
}

function getAvatarColor(controller: string): string {
  if (controller === 'operator') return 'bg-red-500/20 text-red-400'
  return 'bg-emerald-500/20 text-emerald-400'
}

function getDisplayStatus(s: { controller: string; operator_id?: string | null }): string {
  if (s.controller === 'operator' && s.operator_id) return 'operator_active'
  return s.controller
}

export function AdminChatsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [searchInput, setSearchInput] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [controllerFilter, setControllerFilter] = useState(() => searchParams.get('controller') || '')
  const navigate = useNavigate()

  const { data, isLoading, error: queryError, refetch } = useAdminSessions({
    limit: 100,
    ...(controllerFilter ? { controller: controllerFilter } : {}),
    ...(searchQuery ? { search: searchQuery } : {}),
  })
  const sessions: AdminSessionSummary[] = Array.isArray(data) ? data : []
  const error = queryError ? 'Не удалось загрузить чаты' : null

  // Count sessions per controller for tag badges
  const tagCounts = useMemo(() => {
    const counts: Record<string, number> = { '': sessions.length, bot: 0, operator: 0, closed: 0 }
    for (const s of sessions) {
      if (s.controller in counts) counts[s.controller]++
    }
    // When filtering, "Все" count is total shown; others count from current result set
    return counts
  }, [sessions])

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
    <div className="space-y-6 min-w-0 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Чаты</h1>
          <p className="text-[#64748b] mt-1">{sessions.length} чатов</p>
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

      {/* Search + Tag Filters */}
      <div className="space-y-3">
        {/* Search */}
        <div className="relative sm:max-w-sm">
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

        {/* Tag filters */}
        <div className="flex items-center gap-2 flex-wrap">
          {CONTROLLER_TAGS.map((tag) => {
            const isActive = controllerFilter === tag.value
            const isOperator = tag.value === 'operator'
            let cls: string
            if (isActive && isOperator) {
              cls = 'bg-red-500/10 text-red-400 border-red-500/20'
            } else if (isActive) {
              cls = 'bg-[#51ff97]/10 text-[#51ff97] border-[#51ff97]/20'
            } else {
              cls = 'bg-white/[0.03] text-[#64748b] border-white/[0.06]'
            }
            const count = tagCounts[tag.value] ?? 0
            return (
              <button
                key={tag.value}
                onClick={() => handleControllerChange(tag.value)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all duration-200 ${cls}`}
              >
                {tag.label}
                <span className="ml-1.5 opacity-60">{count}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Loading / Empty states */}
      {isLoading && (
        <div className="py-12 text-center text-[#64748b]">
          <div className="flex items-center justify-center gap-2">
            <div className="w-4 h-4 border-2 border-[#51ff97] border-t-transparent rounded-full animate-spin" />
            Загрузка...
          </div>
        </div>
      )}
      {!isLoading && sessions.length === 0 && (
        <div className="py-12 text-center text-[#64748b]">
          Диалоги не найдены
        </div>
      )}

      {/* Desktop: Table layout */}
      {!isLoading && sessions.length > 0 && (
        <div className="hidden md:block bg-white/[0.02] border border-white/[0.06] rounded-2xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr>
                <th className="text-left text-[8px] uppercase tracking-wider text-[#475569] border-b border-white/[0.06] px-4 py-3">Пациент</th>
                <th className="text-left text-[8px] uppercase tracking-wider text-[#475569] border-b border-white/[0.06] px-4 py-3">Последнее сообщение</th>
                <th className="text-left text-[8px] uppercase tracking-wider text-[#475569] border-b border-white/[0.06] px-4 py-3">Статус</th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((s) => {
                const name = s.patient?.name || s.patient?.phone || 'Без имени'
                const pill = getChannelPill(s.channel)
                const time = getDisplayTime(s)
                const isOperator = s.controller === 'operator'

                return (
                  <tr
                    key={s.id}
                    onClick={() => navigate(`/admin/chats/${s.id}`)}
                    className={`cursor-pointer transition-all duration-150 hover:bg-white/[0.04] ${
                      isOperator ? 'bg-red-500/[0.04] border-l-2 border-l-red-400' : ''
                    }`}
                  >
                    <td className="text-sm px-4 py-3 border-b border-white/[0.04]">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-white">{name}</span>
                        {pill && (
                          <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold shrink-0 ${pill.cls}`}>
                            {pill.text}
                          </span>
                        )}
                      </div>
                      {s.patient?.phone && <div className="text-xs text-gray-500">{s.patient.phone}</div>}
                    </td>
                    <td className="text-sm px-4 py-3 border-b border-white/[0.04] max-w-[360px]">
                      <div className="text-[#94a3b8] truncate">{s.last_message || '—'}</div>
                      {time && <div className="text-[10px] text-[#475569] mt-0.5">{time}</div>}
                    </td>
                    <td className="text-sm px-4 py-3 border-b border-white/[0.04]">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-medium ${STATUS_CONFIG[getDisplayStatus(s)]?.badge || ''}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${STATUS_CONFIG[getDisplayStatus(s)]?.dot || ''}`} />
                          {STATUS_CONFIG[getDisplayStatus(s)]?.label}
                        </span>
                        {s.confirmation_status && STATUS_CONFIG[s.confirmation_status] && (
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-medium ${STATUS_CONFIG[s.confirmation_status].badge}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${STATUS_CONFIG[s.confirmation_status].dot}`} />
                            {STATUS_CONFIG[s.confirmation_status].label}
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Mobile: Card layout */}
      {!isLoading && sessions.length > 0 && (
        <div className="md:hidden space-y-2">
          {sessions.map((s) => {
            const name = s.patient?.name || s.patient?.phone || 'Без имени'
            const initial = name.charAt(0).toUpperCase()
            const pill = getChannelPill(s.channel)
            const time = getDisplayTime(s)
            const isOperator = s.controller === 'operator'

            return (
              <div
                key={s.id}
                onClick={() => navigate(`/admin/chats/${s.id}`)}
                className={`px-3 py-2.5 rounded-xl border cursor-pointer transition-all duration-150 ${
                  isOperator
                    ? 'bg-red-500/[0.04] border-red-500/15 hover:bg-red-500/[0.07]'
                    : 'bg-white/[0.02] border-white/[0.06] hover:bg-white/[0.04]'
                }`}
              >
                {/* Top row: avatar + name/preview + time */}
                <div className="flex items-center gap-2">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold shrink-0 ${getAvatarColor(s.controller)}`}>
                    {initial}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-medium text-white truncate">{name}</span>
                      {pill && (
                        <span className={`px-1.5 py-0.5 rounded text-[7px] font-bold shrink-0 ${pill.cls}`}>
                          {pill.text}
                        </span>
                      )}
                      {time && (
                        <span className="text-[10px] text-[#475569] ml-auto shrink-0">{time}</span>
                      )}
                    </div>
                    {s.last_message && (
                      <p className="text-xs text-[#64748b] mt-0.5 overflow-hidden text-ellipsis whitespace-nowrap">
                        {s.last_message}
                      </p>
                    )}
                  </div>
                </div>
                {/* Bottom row: status badges */}
                <div className="flex items-center gap-1.5 mt-2 ml-9">
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[9px] font-medium ${STATUS_CONFIG[getDisplayStatus(s)]?.badge || ''}`}>
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${STATUS_CONFIG[getDisplayStatus(s)]?.dot || ''}`} />
                    {STATUS_CONFIG[getDisplayStatus(s)]?.label}
                  </span>
                  {s.confirmation_status && STATUS_CONFIG[s.confirmation_status] && (
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[9px] font-medium ${STATUS_CONFIG[s.confirmation_status].badge}`}>
                      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${STATUS_CONFIG[s.confirmation_status].dot}`} />
                      {STATUS_CONFIG[s.confirmation_status].label}
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Footer */}
      {!isLoading && sessions.length > 0 && (
        <div className="text-center text-xs text-[#475569] py-2">
          {sessions.length} чатов
        </div>
      )}
    </div>
  )
}
