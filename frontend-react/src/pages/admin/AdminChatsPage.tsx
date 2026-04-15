import { useState, useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { RefreshCw, Search, MessageCircle, ShieldBan } from 'lucide-react'
import type { AdminPatientSummary } from '../../api/adminClient'
import { useSessionsData, useAdminDashboard } from '../../hooks/useAdminQueries'
import { STATUS_CONFIG, CONTROLLER_FILTER_TAGS, getDisplayStatus, CHANNEL_CONFIG } from '../../config/adminStatuses'
import { pluralize } from '../../utils/pluralize'

type ActiveTab = 'all' | 'blocked'

function getChannelPill(channel: string | null | undefined) {
  if (!channel) return null
  return CHANNEL_CONFIG[channel] ?? { text: channel, cls: 'bg-gray-100 dark:bg-gray-500/10 text-gray-500 dark:text-gray-400' }
}

const OPERATOR_ATTENTION_STATUSES = ['awaiting_cancel', 'awaiting_reschedule']

function needsOperator(s: AdminPatientSummary): boolean {
  return s.controller === 'operator' ||
    OPERATOR_ATTENTION_STATUSES.includes(s.confirmation_status ?? '')
}

function formatActivityTime(ts: string | null | undefined, timezone: string): string | null {
  if (!ts) return null
  try {
    const d = new Date(ts)
    const now = new Date()
    const todayStr = now.toLocaleDateString('sv', { timeZone: timezone })
    const dateStr = d.toLocaleDateString('sv', { timeZone: timezone })
    if (dateStr === todayStr) {
      return d.toLocaleTimeString('ru', { timeZone: timezone, hour: '2-digit', minute: '2-digit' })
    }
    return d.toLocaleDateString('ru', { timeZone: timezone, day: 'numeric', month: 'short' })
  } catch {
    return null
  }
}

function getAvatarColor(displayStatus: string): string {
  if (displayStatus === 'operator') return 'bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-400'
  if (displayStatus === 'operator_active') return 'bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400'
  return 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400'
}

export function AdminChatsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [searchInput, setSearchInput] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [controllerFilter, setControllerFilter] = useState(() => searchParams.get('controller') || '')
  const [activeTab, setActiveTab] = useState<ActiveTab>('all')
  const navigate = useNavigate()

  const { allSessions, computed, isLoading, error: queryError, refetch } = useSessionsData()
  const { data: dashboardData } = useAdminDashboard()
  const timezone = dashboardData?.timezone || 'Europe/Moscow'
  const error = queryError ? 'Не удалось загрузить чаты' : null

  // Client-side filtering: controller + blocked + search
  const { sessions, tagCounts } = useMemo(() => {
    // "Все диалоги" — без заблокированных
    const unblocked = allSessions.filter((s) => !s.is_blocked)

    const operatorActive = unblocked.filter((s) => getDisplayStatus(s) === 'operator_active').length
    const counts: Record<string, number> = {
      '': unblocked.length,
      bot: unblocked.filter((s) => s.controller === 'bot' && !needsOperator(s)).length,
      operator: unblocked.filter((s) => needsOperator(s) && getDisplayStatus(s) !== 'operator_active').length,
      operator_active: operatorActive,
      closed: unblocked.filter((s) => s.controller === 'closed').length,
    }

    if (activeTab === 'blocked') {
      const filtered = searchQuery
        ? computed.blocked.filter((s) => (s.name || '').toLowerCase().includes(searchQuery.toLowerCase()) || (s.phone || '').includes(searchQuery))
        : computed.blocked
      return { sessions: filtered, tagCounts: counts }
    }

    let filtered = controllerFilter
      ? unblocked.filter((s) => {
          if (controllerFilter === 'operator_active') return getDisplayStatus(s) === 'operator_active'
          if (controllerFilter === 'operator') return needsOperator(s) && getDisplayStatus(s) !== 'operator_active'
          return s.controller === controllerFilter && !needsOperator(s)
        })
      : unblocked
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      filtered = filtered.filter((s) => (s.name || '').toLowerCase().includes(q) || (s.phone || '').includes(q))
    }
    return { sessions: filtered, tagCounts: counts }
  }, [allSessions, computed, controllerFilter, activeTab, searchQuery])

  const handleSearchKeyDown = (e: React.KeyboardEvent) => { if (e.key === 'Enter') setSearchQuery(searchInput) }
  const handleSearchClear = () => { setSearchInput(''); setSearchQuery('') }

  const handleControllerChange = (v: string) => {
    setControllerFilter(v)
    setSearchParams((prev) => {
      if (v) prev.set('controller', v)
      else prev.delete('controller')
      return prev
    }, { replace: true })
  }

  function renderRow(s: AdminPatientSummary) {
    const name = s.name || s.phone || 'Без имени'
    const pill = getChannelPill(s.channel)
    const time = formatActivityTime(s.last_activity_at || s.last_message_at, timezone)
    const isOperator = getDisplayStatus(s) === 'operator'
    const isBlocked = activeTab === 'blocked'

    return (
      <tr
        key={s.id}
        onClick={() => navigate(`/admin/chats/${s.id}`)}
        className={`cursor-pointer transition-colors duration-150 hover:bg-gray-50 dark:hover:bg-white/[0.03] ${
          isBlocked
            ? 'bg-red-50/30 dark:bg-red-500/[0.03] hover:bg-red-50/60 dark:hover:bg-red-500/[0.06] border-l-2 border-l-red-600'
            : isOperator ? 'bg-red-50/50 dark:bg-red-500/[0.04] border-l-2 border-l-red-400' : ''
        }`}
      >
        <td className="text-sm px-4 py-3 border-b border-border-light dark:border-white/[0.04]">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-text-primary">{name}</span>
            {pill && (
              <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold shrink-0 ${pill.cls}`}>
                {pill.text}
              </span>
            )}
          </div>
          {s.phone && <div className="text-xs text-gray-500">{s.phone}</div>}
        </td>
        <td className="text-sm px-4 py-3 border-b border-border-light dark:border-white/[0.04] max-w-[360px]">
          <div className="text-text-secondary truncate">{s.last_message || '—'}</div>
          {time && <div className="text-[10px] text-text-muted mt-0.5">{time}</div>}
        </td>
        <td className="text-sm px-4 py-3 border-b border-border-light dark:border-white/[0.04]">
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
  }

  function renderCard(s: AdminPatientSummary) {
    const name = s.name || s.phone || 'Без имени'
    const initial = name.charAt(0).toUpperCase()
    const pill = getChannelPill(s.channel)
    const time = formatActivityTime(s.last_activity_at || s.last_message_at, timezone)
    const isOperator = s.controller === 'operator'
    const isBlocked = activeTab === 'blocked'

    return (
      <div
        key={s.id}
        onClick={() => navigate(`/admin/chats/${s.id}`)}
        className={`px-3 py-2.5 rounded-xl border cursor-pointer transition-all duration-150 ${
          isBlocked
            ? 'bg-red-50/30 dark:bg-red-500/[0.03] border-red-200 dark:border-red-500/15 hover:bg-red-50/60 dark:hover:bg-red-500/[0.06]'
            : isOperator
              ? 'bg-red-50/50 dark:bg-red-500/[0.04] border-red-200 dark:border-red-500/15 hover:bg-red-50 dark:hover:bg-red-500/[0.07]'
              : 'bg-white dark:bg-white/[0.02] border-gray-200 dark:border-white/[0.06] hover:bg-gray-50 dark:hover:bg-white/[0.04]'
        }`}
      >
        {/* Top row: avatar + name/preview + time */}
        <div className="flex items-center gap-2">
          <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold shrink-0 ${getAvatarColor(getDisplayStatus(s))}`}>
            {initial}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-medium text-text-primary truncate">{name}</span>
              {pill && (
                <span className={`px-1.5 py-0.5 rounded text-[7px] font-bold shrink-0 ${pill.cls}`}>
                  {pill.text}
                </span>
              )}
              {time && (
                <span className="text-[10px] text-text-muted ml-auto shrink-0">{time}</span>
              )}
            </div>
            {s.last_message && (
              <p className="text-xs text-text-secondary mt-0.5 overflow-hidden text-ellipsis whitespace-nowrap">
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
  }

  return (
    <div className="space-y-6 min-w-0 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Переписка</h1>
          <p className="text-text-tertiary mt-1">Пациенты с инициированными диалогами</p>
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

      {/* Tabs: All / Blocked */}
      <div className="flex rounded-xl border border-gray-200 dark:border-white/[0.08] overflow-hidden w-fit">
        <button
          onClick={() => setActiveTab('all')}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors duration-150 ${activeTab === 'all' ? 'bg-accent text-brand-darker' : 'bg-white dark:bg-white/[0.03] text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-white/[0.06]'}`}
        >
          <MessageCircle className="w-4 h-4" />
          Все диалоги
        </button>
        <button
          onClick={() => setActiveTab('blocked')}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors duration-150 border-l border-gray-200 dark:border-white/[0.08] ${activeTab === 'blocked' ? 'bg-red-500 text-white' : 'bg-white dark:bg-white/[0.03] text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-white/[0.06]'}`}
        >
          <ShieldBan className="w-4 h-4" />
          Заблокированные
          {computed.blocked.length > 0 && <span className="opacity-70">{computed.blocked.length}</span>}
        </button>
      </div>

      {/* Search + Tag Filters */}
      <div className="space-y-3">
        {/* Search (only for 'all' tab) */}
        {activeTab === 'all' && <div className="relative sm:max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={handleSearchKeyDown}
            onBlur={() => { if (searchInput !== searchQuery) setSearchQuery(searchInput) }}
            placeholder="Поиск по имени или телефону..."
            className="w-full bg-surface-secondary dark:bg-white/[0.04] border border-border dark:border-white/[0.08] rounded-xl pl-10 pr-8 py-2.5 text-sm text-text-primary dark:text-white placeholder-text-muted dark:placeholder-[#475569] focus:outline-none focus:border-accent/40 transition-all duration-200"
          />
          {searchInput && (
            <button onClick={handleSearchClear} className="absolute right-3 top-1/2 -translate-y-1/2 text-text-tertiary hover:text-text-primary transition-colors">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          )}
        </div>}

        {/* Tag filters (only for 'all' tab) */}
        {activeTab === 'all' && <div className="flex items-center gap-2 flex-wrap">
          {CONTROLLER_FILTER_TAGS.map((tag) => {
            const isActive = controllerFilter === tag.value
            let cls: string
            if (isActive && tag.value === 'operator') {
              cls = 'bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 border-red-200 dark:border-red-500/20'
            } else if (isActive && tag.value === 'operator_active') {
              cls = 'bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-500/20'
            } else if (isActive) {
              cls = 'bg-accent-soft text-accent border-accent/20'
            } else {
              cls = 'bg-surface-secondary dark:bg-white/[0.03] text-text-tertiary border-border dark:border-white/[0.06]'
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
        </div>}
      </div>

      {/* Loading / Empty states */}
      {isLoading && (
        <div className="py-12 text-center text-text-tertiary">
          <div className="flex items-center justify-center gap-2">
            <div className="w-4 h-4 border-2 border-accent border-t-transparent rounded-full animate-spin" />
            Загрузка...
          </div>
        </div>
      )}
      {!isLoading && sessions.length === 0 && (
        <div className="py-12 text-center text-text-tertiary">
          {activeTab === 'blocked' ? 'Нет заблокированных диалогов' : 'Диалоги не найдены'}
        </div>
      )}

      {/* Desktop: Table layout */}
      {!isLoading && sessions.length > 0 && (
        <div className="hidden md:block bg-white dark:bg-white/[0.02] border border-gray-200 dark:border-white/[0.06] rounded-2xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border-light dark:border-white/[0.04]">
                <th className="text-left px-4 py-3.5 text-xs font-semibold text-text-tertiary uppercase tracking-wider">Пациент</th>
                <th className="text-left px-4 py-3.5 text-xs font-semibold text-text-tertiary uppercase tracking-wider">Последнее сообщение</th>
                <th className="text-left px-4 py-3.5 text-xs font-semibold text-text-tertiary uppercase tracking-wider">Статус</th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((s) => renderRow(s))}
            </tbody>
          </table>
        </div>
      )}

      {/* Mobile: Card layout */}
      {!isLoading && sessions.length > 0 && (
        <div className="md:hidden space-y-2">
          {sessions.map((s) => renderCard(s))}
        </div>
      )}

      {/* Footer */}
      {!isLoading && sessions.length > 0 && (
        <div className="text-center text-xs text-text-muted py-2">
          {sessions.length} {pluralize(sessions.length, 'пациент', 'пациента', 'пациентов')}
        </div>
      )}
    </div>
  )
}
