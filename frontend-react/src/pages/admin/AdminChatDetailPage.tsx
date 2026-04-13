import React, { useState, useRef, useLayoutEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Bot, User, ShieldCheck, Send } from 'lucide-react'
import { sendAdminMessage, updateSessionController, getAdminSession, getAdminBookings } from '../../api/adminClient'
import type { AdminSessionDetail, AdminMessage, AdminBooking } from '../../api/adminClient'
import { useQueryClient } from '@tanstack/react-query'
import { useAdminSessionDetail } from '../../hooks/useAdminQueries'
import { format } from 'date-fns'
import { ru } from 'date-fns/locale'
import { STATUS_CONFIG, CONTROLLER_LABELS, CONTROLLER_COLORS, RUN_STATUS_CONFIG, getDisplayStatus } from '../../config/adminStatuses'
import type { BookingConfirmationRun } from '../../api/adminClient'
import { useInvalidateSessions } from '../../hooks/useAdminQueries'

const CHANGEABLE_CONTROLLERS = ['bot', 'operator', 'closed']

export function AdminChatDetailPage() {
  const { sessionId } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { data: session, isLoading } = useAdminSessionDetail(sessionId)
  const [loadingOlder, setLoadingOlder] = useState(false)
  const [messageText, setMessageText] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [showControllerMenu, setShowControllerMenu] = useState(false)
  const [editingPhone, setEditingPhone] = useState(false)
  const [phoneInput, setPhoneInput] = useState('')
  const [activeTab, setActiveTab] = useState<'chat' | 'appointments'>('chat')
  const [error, setError] = useState<string | null>(null)
  const invalidateSessions = useInvalidateSessions()
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const prevMsgCount = useRef(0)

  const showError = (msg: string) => {
    setError(msg)
    setTimeout(() => setError(null), 4000)
  }

  // Scroll to bottom on new messages
  useLayoutEffect(() => {
    if (!session) return
    const count = session.messages.length
    const container = scrollRef.current
    if (!container) return

    if (prevMsgCount.current === 0) {
      // First load — jump to bottom
      container.scrollTop = container.scrollHeight
    } else if (count > prevMsgCount.current) {
      // New messages — only scroll if user is near bottom
      const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 100
      if (isNearBottom) {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
      }
    }
    prevMsgCount.current = count
  }, [session])

  const handleSend = async () => {
    if (!messageText.trim() || !session || isSending) return
    const text = messageText.trim()
    setMessageText('')
    setIsSending(true)
    try {
      const result = await sendAdminMessage(session.id, text)
      // Backend returns {success, message_id, delivered} — add optimistic message
      const optimisticMsg: AdminMessage = {
        id: result.message_id || String(Date.now()),
        role: 'operator',
        content: text,
        metadata: null,
        created_at: new Date().toISOString(),
      }
      queryClient.setQueryData(['admin', 'session', sessionId], (prev: AdminSessionDetail | undefined) => {
        if (!prev) return prev
        return { ...prev, messages: [...prev.messages, optimisticMsg] }
      })
    } catch (e) {
      if (import.meta.env.DEV) console.error('Send message error:', e)
      setMessageText(text)
      showError('Не удалось отправить сообщение')
    } finally {
      setIsSending(false)
      inputRef.current?.focus()
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
  }

  const handleControllerChange = async (newController: string) => {
    if (!session) return
    setShowControllerMenu(false)
    try {
      await updateSessionController(session.id, newController)
      queryClient.setQueryData(['admin', 'session', sessionId], (prev: AdminSessionDetail | undefined) => prev ? { ...prev, controller: newController } : prev)
      invalidateSessions()
    } catch (e) {
      if (import.meta.env.DEV) console.error('Controller update error:', e)
      showError('Не удалось сменить контроллер')
    }
  }

  const savePhone = async () => {
    if (!session || !phoneInput.trim()) return
    try {
      const { updatePatientPhone } = await import('../../api/adminClient')
      await updatePatientPhone(session.id, phoneInput.trim())
      queryClient.setQueryData(['admin', 'session', sessionId], (prev: AdminSessionDetail | undefined) =>
        prev ? { ...prev, patient: { ...prev.patient, phone: phoneInput.trim() } } : prev)
      setEditingPhone(false)
    } catch (e) {
      if (import.meta.env.DEV) console.error('Phone update error:', e)
      showError('Не удалось сохранить телефон')
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-7 h-7 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!session) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-text-tertiary">
        <p>Диалог не найден</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-[calc(100dvh-4rem)]">
      {/* Header */}
      <div className="flex items-center gap-4 pb-4 border-b border-border dark:border-white/[0.06]">
        <button
          onClick={() => navigate('/admin/chats')}
          className="w-9 h-9 flex items-center justify-center rounded-lg bg-surface-secondary dark:bg-white/[0.04] border border-border dark:border-white/[0.08] hover:bg-surface-tertiary dark:hover:bg-white/[0.08] transition-colors"
        >
          <ArrowLeft className="w-4 h-4 text-text-secondary" />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-lg font-bold text-text-primary truncate max-w-[200px] sm:max-w-none">{session.patient?.name || 'Без имени'}</h1>
            {/* Controller badge (clickable) */}
            <div className="relative">
              {(() => {
                const ds = getDisplayStatus(session)
                const badgeCls = STATUS_CONFIG[ds]?.badge || CONTROLLER_COLORS[session.controller] || 'bg-gray-100 dark:bg-gray-500/15 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-500/25'
                const badgeLabel = STATUS_CONFIG[ds]?.label || CONTROLLER_LABELS[session.controller] || session.controller
                return (
                  <button
                    onClick={() => setShowControllerMenu(!showControllerMenu)}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium cursor-pointer transition-colors ${badgeCls}`}
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-current opacity-60" />
                    {badgeLabel}
                  </button>
                )
              })()}
              {showControllerMenu && (
                <div className="absolute top-full mt-1 left-0 z-50 bg-white dark:bg-[#1a1a2e] border border-gray-200 dark:border-white/[0.1] rounded-xl shadow-xl py-1 min-w-[180px]">
                  {CHANGEABLE_CONTROLLERS.map((c) => (
                    <button
                      key={c}
                      onClick={() => handleControllerChange(c)}
                      className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-white/[0.06] transition-colors ${
                        c === session.controller ? 'text-accent' : 'text-text-secondary'
                      }`}
                    >
                      {CONTROLLER_LABELS[c] || c}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {session.confirmation_status && STATUS_CONFIG[session.confirmation_status] && (
              <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full border text-xs font-medium ${STATUS_CONFIG[session.confirmation_status].badge}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${STATUS_CONFIG[session.confirmation_status].dot}`} />
                {STATUS_CONFIG[session.confirmation_status].label}
              </span>
            )}
            {session.channel && (
              <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${
                session.channel === 'tg_bot' ? 'bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400' :
                session.channel === 'tg_business' ? 'bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400' :
                'bg-gray-100 dark:bg-gray-500/10 text-gray-600 dark:text-gray-400'
              }`}>
                {session.channel === 'tg_bot' ? 'TG Bot' : session.channel === 'tg_business' ? 'TG Biz' : session.channel}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 sm:gap-4 mt-1 text-sm text-text-tertiary flex-wrap">
            {editingPhone ? (
              <span className="flex items-center gap-1.5">
                <input value={phoneInput} onChange={(e) => setPhoneInput(e.target.value)}
                  className="bg-surface-secondary dark:bg-white/[0.04] border border-border dark:border-white/[0.08] rounded px-2 py-0.5 text-xs text-text-primary dark:text-white w-24 sm:w-32"
                  autoFocus onKeyDown={(e) => { if (e.key === 'Enter') savePhone(); if (e.key === 'Escape') setEditingPhone(false) }} />
                <button onClick={savePhone} className="text-accent text-xs">✓</button>
                <button onClick={() => setEditingPhone(false)} className="text-text-tertiary text-xs">✗</button>
              </span>
            ) : (
              <span className="flex items-center gap-1 text-xs text-text-tertiary">
                {session.patient?.phone || 'Нет телефона'}
                <button onClick={() => { setPhoneInput(session.patient?.phone || ''); setEditingPhone(true) }}
                  className="text-text-muted hover:text-text-secondary transition-colors">✏️</button>
              </span>
            )}
            {session.confirmation_appointment_date && (
              <span className="text-xs text-text-tertiary">
                {session.confirmation_appointment_date}{session.confirmation_appointment_time ? `, ${session.confirmation_appointment_time}` : ''}
              </span>
            )}
            {session.confirmation_doctor_name && (
              <span className="text-xs text-text-tertiary">{session.confirmation_doctor_name}</span>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 pt-3">
        <button onClick={() => setActiveTab('chat')}
          className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors ${activeTab === 'chat' ? 'bg-accent-soft text-accent border border-accent/20' : 'text-text-tertiary hover:text-text-secondary'}`}>
          Чат
        </button>
        <button onClick={() => setActiveTab('appointments')}
          className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors flex items-center gap-1.5 ${activeTab === 'appointments' ? 'bg-accent-soft text-accent border border-accent/20' : 'text-text-tertiary hover:text-text-secondary'}`}>
          Записи
          {session.confirmation_appointment_id && <span className="px-1.5 py-0.5 rounded-full bg-blue-500/15 text-blue-300 text-[9px] font-bold">1</span>}
        </button>
      </div>

      {/* Messages */}
      {activeTab === 'chat' && (
      <div ref={scrollRef} className="flex-1 overflow-y-auto py-5 px-3 space-y-3 min-h-0">
        {session.has_more_messages && (
          <div className="text-center py-2">
            <button
              onClick={async () => {
                if (!session || loadingOlder) return
                setLoadingOlder(true)
                try {
                  const oldest = session.messages[0]
                  const older = await getAdminSession(session.id, { messages_limit: 50, before_id: oldest.id })
                  queryClient.setQueryData(['admin', 'session', sessionId], (prev: AdminSessionDetail | undefined) => {
                    if (!prev) return prev
                    return { ...prev, messages: [...older.messages, ...prev.messages], has_more_messages: older.has_more_messages }
                  })
                } catch (e) { if (import.meta.env.DEV) console.error(e) }
                setLoadingOlder(false)
              }}
              disabled={loadingOlder}
              className="text-xs text-accent hover:text-accent/80 transition-colors"
            >
              {loadingOlder ? 'Загрузка...' : '↑ Загрузить ранее'}
            </button>
          </div>
        )}
        {session.messages.map((msg, i) => {
          const msgDate = format(new Date(msg.created_at), 'yyyy-MM-dd')
          const prevDate = i > 0 ? format(new Date(session.messages[i - 1].created_at), 'yyyy-MM-dd') : null
          const showSeparator = msgDate !== prevDate
          return (
            <div key={msg.id}>
              {showSeparator && <DateSeparator date={new Date(msg.created_at)} />}
              <MessageBubble message={msg} />
            </div>
          )
        })}
        <div ref={messagesEndRef} />
      </div>
      )}

      {/* Appointments */}
      {activeTab === 'appointments' && (
        <AppointmentsTab session={session} key={session.id} />
      )}

      {/* Error toast */}
      {error && (
        <div className="mx-3 mb-1 px-3 py-2 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-lg text-xs text-red-600 dark:text-red-300 animate-[fadeIn_0.2s]">
          {error}
        </div>
      )}

      {/* Input */}
      <div className="pt-4 pb-2 border-t border-border dark:border-white/[0.06]">
        <div className="flex items-end gap-3">
          <div className="flex-1">
            <textarea
              ref={inputRef}
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Написать от имени администратора..."
              disabled={isSending}
              rows={1}
              className="w-full bg-surface-secondary dark:bg-white/[0.04] border border-border dark:border-white/[0.08] rounded-xl px-4 py-3 text-sm text-text-primary dark:text-white placeholder-text-muted dark:placeholder-[#475569] focus:outline-none focus:border-accent/40 transition-all duration-200 disabled:opacity-50 resize-none overflow-y-auto max-h-[120px]"
            />
          </div>
          <button
            onClick={handleSend}
            disabled={!messageText.trim() || isSending}
            className="flex items-center justify-center w-11 h-11 shrink-0 bg-accent text-white rounded-xl transition-all duration-200 hover:bg-accent/90 dark:hover:shadow-[0_0_16px_rgba(81,255,151,0.2)] disabled:opacity-30 disabled:hover:shadow-none active:scale-95"
          >
            {isSending
              ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              : <Send className="w-[18px] h-[18px]" />}
          </button>
        </div>
      </div>
    </div>
  )
}

const MessageBubble = React.memo(function MessageBubble({ message }: { message: AdminMessage }) {
  // Backend uses 'role': 'patient' | 'agent' | 'operator' | 'system'
  const isPatient = message.role === 'patient'
  const isAgent = message.role === 'agent' || message.role === 'bot'
  const isOperator = message.role === 'operator'

  let align = 'justify-start'
  let bubble = 'bg-gray-100 dark:bg-white/[0.04] border-gray-200 dark:border-white/[0.06]'
  let authorColor = 'text-text-tertiary'
  let AuthorIcon = User
  let authorLabel = message.role

  if (isPatient) {
    align = 'justify-start'
    bubble = 'bg-gray-100 dark:bg-white/[0.04] border-gray-200 dark:border-white/[0.06]'
    authorColor = 'text-text-tertiary'
    AuthorIcon = User
    authorLabel = 'Пациент'
  } else if (isAgent) {
    align = 'justify-end'
    bubble = 'bg-emerald-50 dark:bg-brand-green/[0.08] border-emerald-200 dark:border-brand-green/15'
    authorColor = 'text-emerald-600/60 dark:text-brand-green/60'
    AuthorIcon = Bot
    authorLabel = 'Агент'
  } else if (isOperator) {
    align = 'justify-end'
    bubble = 'bg-blue-50 dark:bg-indigo-500/[0.08] border-blue-200 dark:border-indigo-500/15'
    authorColor = 'text-blue-600/60 dark:text-indigo-400/60'
    AuthorIcon = ShieldCheck
    authorLabel = 'Администратор'
  }

  return (
    <div className={`flex ${align}`}>
      <div className={`max-w-[85%] md:max-w-[70%] border rounded-2xl px-4 py-3 ${bubble}`}>
        <div className={`flex items-center gap-1.5 mb-1 ${authorColor}`}>
          <AuthorIcon className="w-3.5 h-3.5" />
          <span className="text-xs font-medium">{authorLabel}</span>
          <span className="text-[11px] text-text-muted ml-auto">{format(new Date(message.created_at), 'HH:mm')}</span>
        </div>
        <p className="text-sm text-gray-800 dark:text-gray-200 leading-relaxed whitespace-pre-wrap">{message.content}</p>
      </div>
    </div>
  )
})


function getBookingDisplayStatus(b: AdminBooking): { label: string; badge: string } {
  const today = new Date().toISOString().slice(0, 10)
  const crmStatus = (b.booking_status || '').toLowerCase()
  const apptDate = b.appointment_date || ''
  if (crmStatus === 'отменён') return { label: 'Отменён', badge: 'bg-red-50 dark:bg-red-500/15 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-500/25' }
  if (apptDate && apptDate <= today) return { label: 'Завершён', badge: 'bg-gray-100 dark:bg-gray-500/15 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-500/25' }
  return { label: 'Запланировано', badge: 'bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/25' }
}

function formatDateRu(dateStr: string): string {
  try {
    return format(new Date(dateStr + 'T00:00:00'), 'd MMM yyyy', { locale: ru })
  } catch {
    return dateStr
  }
}

function formatRunTime(isoStr: string): string {
  try {
    return format(new Date(isoStr), 'd MMM · HH:mm', { locale: ru })
  } catch {
    return isoStr
  }
}

function ConfirmationRunsList({ runs }: { runs: BookingConfirmationRun[] }) {
  if (runs.length === 0) return (
    <div className="px-4 pb-3 pt-1 text-xs text-text-tertiary">Напоминаний не отправлялось</div>
  )
  return (
    <div className="border-t border-white/[0.05] pb-2">
      <div className="px-4 pt-2 pb-1 text-[10px] font-semibold text-text-tertiary uppercase tracking-widest">
        Напоминания о визите
      </div>
      {runs.map((run) => {
        const cfg = RUN_STATUS_CONFIG[run.status] || RUN_STATUS_CONFIG['sent']
        return (
          <div key={run.id} className="flex items-center gap-3 px-4 py-2 border-b border-white/[0.03] last:border-0">
            <span className="text-base flex-shrink-0">📨</span>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-medium text-text-primary">
                {formatRunTime(run.sent_at)} — {run.attempt_number}-е напоминание
              </div>
              {run.response_at && (
                <div className="text-[11px] text-text-tertiary mt-0.5">
                  Ответ: {formatRunTime(run.response_at)}
                </div>
              )}
            </div>
            <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold flex-shrink-0 ${cfg.badge}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
              {cfg.label}
            </span>
          </div>
        )
      })}
    </div>
  )
}

function BookingCard({ booking }: { booking: AdminBooking }) {
  const [open, setOpen] = React.useState(false)
  const { label, badge } = getBookingDisplayStatus(booking)
  const runs = booking.confirmation_runs ?? []
  const hasRuns = runs.length > 0

  return (
    <div className="bg-white/[0.03] border border-white/[0.07] rounded-xl mb-3 overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-white/[0.02] transition-colors"
      >
        <div className="w-9 h-9 rounded-lg bg-emerald-500/12 flex items-center justify-center text-lg flex-shrink-0">🦷</div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-text-primary truncate">
            {booking.doctor_name || '—'}
          </div>
          <div className="text-xs text-text-tertiary mt-0.5">
            {booking.appointment_date ? formatDateRu(booking.appointment_date) : '—'}
            {booking.appointment_time ? ` · ${booking.appointment_time}` : ''}
            {booking.service_key ? ` · ${booking.service_key}` : ''}
          </div>
        </div>
        <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
          <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold ${badge}`}>
            <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70" />
            {label}
          </span>
          {hasRuns && (
            <span className="text-[10px] text-text-tertiary">{runs.length} напом.</span>
          )}
        </div>
        <span className={`text-text-tertiary text-xs ml-1 transition-transform duration-150 ${open ? 'rotate-90' : ''}`}>▶</span>
      </button>

      {open && <ConfirmationRunsList runs={runs} />}
      {!open && hasRuns && (
        <div className="px-4 pb-2 text-[11px] text-text-tertiary">
          {runs[runs.length - 1]?.status === 'confirmed' ? '✓ пациент подтвердил' :
           runs[runs.length - 1]?.status === 'cancelled' ? '✗ пациент отменил' :
           runs[runs.length - 1]?.status === 'sent' ? '⏳ ждём ответа' :
           runs[runs.length - 1]?.status === 'no_response' ? '— нет ответа' :
           '— нажмите для деталей'}
          {' — нажмите для деталей'}
        </div>
      )}
    </div>
  )
}

function AppointmentsTab({ session }: { session: AdminSessionDetail }) {
  const [bookings, setBookings] = React.useState<AdminBooking[]>([])
  const [loading, setLoading] = React.useState(true)

  const patientId = session.patient?.ident_patient_id

  React.useEffect(() => {
    if (!patientId) { setLoading(false); return }
    let cancelled = false
    getAdminBookings({ patient_id: patientId })
      .then((items) => { if (!cancelled) setBookings(Array.isArray(items) ? items : []) })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [patientId])

  if (!patientId) {
    return (
      <div className="flex-1 flex items-center justify-center py-12 text-text-tertiary text-sm">
        Пациент не привязан к CRM
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center py-12">
        <div className="w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (bookings.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center py-12 text-text-tertiary text-sm">
        Записей не найдено
      </div>
    )
  }

  const today = new Date().toISOString().slice(0, 10)
  const upcoming = bookings.filter((b) => !b.appointment_date || b.appointment_date > today)
  const past = bookings.filter((b) => b.appointment_date && b.appointment_date <= today)

  return (
    <div className="flex-1 overflow-auto py-4 px-1">
      {upcoming.length > 0 && (
        <>
          <div className="text-[10px] font-semibold text-text-tertiary uppercase tracking-widest mb-2 px-1">
            Текущие и предстоящие визиты
          </div>
          {upcoming.map((b) => <BookingCard key={b.id} booking={b} />)}
        </>
      )}
      {past.length > 0 && (
        <>
          <div className="text-[10px] font-semibold text-text-tertiary uppercase tracking-widest mb-2 px-1 mt-4 opacity-60">
            Прошлые визиты
          </div>
          <div className="opacity-60">
            {past.map((b) => <BookingCard key={b.id} booking={b} />)}
          </div>
        </>
      )}
    </div>
  )
}

const DateSeparator = React.memo(function DateSeparator({ date }: { date: Date }) {
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)

  const isSameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()

  let label: string
  if (isSameDay(date, today)) label = 'Сегодня'
  else if (isSameDay(date, yesterday)) label = 'Вчера'
  else label = format(date, 'd MMMM yyyy', { locale: ru })

  return (
    <div className="flex items-center gap-3 my-2">
      <div className="flex-1 h-px bg-border-light dark:bg-white/[0.06]" />
      <span className="text-[11px] font-medium text-text-muted whitespace-nowrap">{label}</span>
      <div className="flex-1 h-px bg-border-light dark:bg-white/[0.06]" />
    </div>
  )
})
