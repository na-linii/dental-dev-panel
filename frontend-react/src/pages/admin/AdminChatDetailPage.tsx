import React, { useState, useRef, useLayoutEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Bot, User, ShieldCheck, Send } from 'lucide-react'
import { sendAdminMessage, updateSessionController, getAdminSession, getAdminBookings } from '../../api/adminClient'
import type { AdminSessionDetail, AdminMessage, AdminBooking } from '../../api/adminClient'
import { useQueryClient } from '@tanstack/react-query'
import { useAdminSessionDetail } from '../../hooks/useAdminQueries'
import { format } from 'date-fns'
import { ru } from 'date-fns/locale'

const CONTROLLER_LABELS: Record<string, string> = {
  bot: 'С ботом',
  operator: 'С оператором',
  closed: 'Завершён',
}

const CONTROLLER_COLORS: Record<string, string> = {
  bot: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/25',
  operator: 'bg-blue-500/15 text-blue-300 border-blue-500/25',
  closed: 'bg-gray-500/15 text-gray-300 border-gray-500/25',
}

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
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const prevMsgCount = useRef(0)

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
    } catch (e) {
      if (import.meta.env.DEV) console.error('Controller update error:', e)
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
    } catch (e) { if (import.meta.env.DEV) console.error('Phone update error:', e) }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-7 h-7 border-2 border-[#51ff97] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!session) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-[#64748b]">
        <p>Диалог не найден</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-[calc(100dvh-4rem)]">
      {/* Header */}
      <div className="flex items-center gap-4 pb-4 border-b border-white/[0.06]">
        <button
          onClick={() => navigate('/admin/chats')}
          className="w-9 h-9 flex items-center justify-center rounded-lg bg-white/[0.04] border border-white/[0.08] hover:bg-white/[0.08] transition-colors"
        >
          <ArrowLeft className="w-4 h-4 text-[#94a3b8]" />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-lg font-bold text-white truncate max-w-[200px] sm:max-w-none">{session.patient?.name || 'Без имени'}</h1>
            {/* Controller badge (clickable) */}
            <div className="relative">
              <button
                onClick={() => setShowControllerMenu(!showControllerMenu)}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium cursor-pointer transition-colors ${CONTROLLER_COLORS[session.controller] || 'bg-gray-500/15 text-gray-300 border-gray-500/25'}`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-current opacity-60" />
                {CONTROLLER_LABELS[session.controller] || session.controller}
              </button>
              {showControllerMenu && (
                <div className="absolute top-full mt-1 left-0 z-50 bg-[#1a1a2e] border border-white/[0.1] rounded-xl shadow-xl py-1 min-w-[180px]">
                  {CHANGEABLE_CONTROLLERS.map((c) => (
                    <button
                      key={c}
                      onClick={() => handleControllerChange(c)}
                      className={`w-full text-left px-3 py-2 text-sm hover:bg-white/[0.06] transition-colors ${
                        c === session.controller ? 'text-[#51ff97]' : 'text-[#94a3b8]'
                      }`}
                    >
                      {CONTROLLER_LABELS[c] || c}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {session.confirmation_status && (
              <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full border text-xs font-medium ${
                session.confirmation_status.startsWith('awaiting') ? 'bg-orange-500/15 text-orange-300 border-orange-500/25' :
                session.confirmation_status === 'sent' ? 'bg-amber-500/15 text-amber-300 border-amber-500/25' :
                session.confirmation_status === 'confirmed' ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/25' :
                session.confirmation_status === 'no_response' ? 'bg-gray-500/15 text-gray-400 border-gray-500/25' :
                'bg-gray-500/15 text-gray-300 border-gray-500/25'
              }`}>{session.confirmation_status}</span>
            )}
            {session.channel && (
              <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${
                session.channel === 'tg_bot' ? 'bg-blue-500/10 text-blue-400' :
                session.channel === 'tg_business' ? 'bg-purple-500/10 text-purple-400' :
                'bg-gray-500/10 text-gray-400'
              }`}>
                {session.channel === 'tg_bot' ? 'TG Bot' : session.channel === 'tg_business' ? 'TG Biz' : session.channel}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 sm:gap-4 mt-1 text-sm text-[#64748b] flex-wrap">
            {editingPhone ? (
              <span className="flex items-center gap-1.5">
                <input value={phoneInput} onChange={(e) => setPhoneInput(e.target.value)}
                  className="bg-white/[0.04] border border-white/[0.08] rounded px-2 py-0.5 text-xs text-white w-24 sm:w-32"
                  autoFocus onKeyDown={(e) => { if (e.key === 'Enter') savePhone(); if (e.key === 'Escape') setEditingPhone(false) }} />
                <button onClick={savePhone} className="text-[#51ff97] text-xs">✓</button>
                <button onClick={() => setEditingPhone(false)} className="text-[#64748b] text-xs">✗</button>
              </span>
            ) : (
              <span className="flex items-center gap-1 text-xs text-[#64748b]">
                {session.patient?.phone || 'Нет телефона'}
                <button onClick={() => { setPhoneInput(session.patient?.phone || ''); setEditingPhone(true) }}
                  className="text-[#475569] hover:text-[#94a3b8] transition-colors">✏️</button>
              </span>
            )}
            {session.confirmation_appointment_date && (
              <span className="text-xs text-[#64748b]">
                {session.confirmation_appointment_date}{session.confirmation_appointment_time ? `, ${session.confirmation_appointment_time}` : ''}
              </span>
            )}
            {session.confirmation_doctor_name && (
              <span className="text-xs text-[#64748b]">{session.confirmation_doctor_name}</span>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 pt-3">
        <button onClick={() => setActiveTab('chat')}
          className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors ${activeTab === 'chat' ? 'bg-[#51ff97]/10 text-[#51ff97] border border-[#51ff97]/20' : 'text-[#64748b] hover:text-[#94a3b8]'}`}>
          Чат
        </button>
        <button onClick={() => setActiveTab('appointments')}
          className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors flex items-center gap-1.5 ${activeTab === 'appointments' ? 'bg-[#51ff97]/10 text-[#51ff97] border border-[#51ff97]/20' : 'text-[#64748b] hover:text-[#94a3b8]'}`}>
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
              className="text-xs text-[#51ff97] hover:text-[#51ff97]/80 transition-colors"
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

      {/* Input */}
      <div className="pt-4 pb-2 border-t border-white/[0.06]">
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <input
              ref={inputRef}
              type="text"
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Написать от имени администратора..."
              disabled={isSending}
              className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white placeholder-[#475569] focus:outline-none focus:border-[#51ff97]/40 transition-all duration-200 disabled:opacity-50"
            />
          </div>
          <button
            onClick={handleSend}
            disabled={!messageText.trim() || isSending}
            className="flex items-center justify-center w-11 h-11 shrink-0 bg-[#51ff97] text-[#0d0d1a] rounded-xl transition-all duration-200 hover:bg-[#51ff97]/90 hover:shadow-[0_0_16px_rgba(81,255,151,0.2)] disabled:opacity-30 disabled:hover:shadow-none active:scale-95"
          >
            {isSending
              ? <span className="w-4 h-4 border-2 border-[#0d0d1a] border-t-transparent rounded-full animate-spin" />
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
  let bubble = 'bg-white/[0.04] border-white/[0.06]'
  let authorColor = 'text-[#64748b]'
  let AuthorIcon = User
  let authorLabel = message.role

  if (isPatient) {
    align = 'justify-start'
    bubble = 'bg-white/[0.04] border-white/[0.06]'
    authorColor = 'text-[#64748b]'
    AuthorIcon = User
    authorLabel = 'Пациент'
  } else if (isAgent) {
    align = 'justify-end'
    bubble = 'bg-[#51ff97]/[0.08] border-[#51ff97]/15'
    authorColor = 'text-[#51ff97]/60'
    AuthorIcon = Bot
    authorLabel = 'Агент'
  } else if (isOperator) {
    align = 'justify-end'
    bubble = 'bg-indigo-500/[0.08] border-indigo-500/15'
    authorColor = 'text-indigo-400/60'
    AuthorIcon = ShieldCheck
    authorLabel = 'Администратор'
  }

  return (
    <div className={`flex ${align}`}>
      <div className={`max-w-[85%] md:max-w-[70%] border rounded-2xl px-4 py-3 ${bubble}`}>
        <div className={`flex items-center gap-1.5 mb-1 ${authorColor}`}>
          <AuthorIcon className="w-3.5 h-3.5" />
          <span className="text-xs font-medium">{authorLabel}</span>
          <span className="text-[11px] text-[#475569] ml-auto">{format(new Date(message.created_at), 'HH:mm')}</span>
        </div>
        <p className="text-sm text-gray-200 leading-relaxed whitespace-pre-wrap">{message.content}</p>
      </div>
    </div>
  )
})

const BOOKING_STATUS_STYLES: Record<string, string> = {
  'подтверждён': 'bg-emerald-500/15 text-emerald-300 border-emerald-500/25',
  'отменён': 'bg-red-500/15 text-red-300 border-red-500/25',
  'завершён': 'bg-gray-500/15 text-gray-400 border-gray-500/25',
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
      <div className="flex-1 flex items-center justify-center py-12 text-[#64748b] text-sm">
        Пациент не привязан к CRM
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center py-12">
        <div className="w-5 h-5 border-2 border-[#51ff97] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (bookings.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center py-12 text-[#64748b] text-sm">
        Записей не найдено
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-auto py-4">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-white/[0.06]">
              <th className="text-left px-3 py-2.5 text-xs font-semibold text-[#64748b] uppercase tracking-wider">Дата</th>
              <th className="text-left px-3 py-2.5 text-xs font-semibold text-[#64748b] uppercase tracking-wider">Время</th>
              <th className="text-left px-3 py-2.5 text-xs font-semibold text-[#64748b] uppercase tracking-wider">Врач</th>
              <th className="text-left px-3 py-2.5 text-xs font-semibold text-[#64748b] uppercase tracking-wider hidden sm:table-cell">Услуга</th>
              <th className="text-left px-3 py-2.5 text-xs font-semibold text-[#64748b] uppercase tracking-wider">Статус</th>
            </tr>
          </thead>
          <tbody>
            {bookings.map((b) => {
              const statusStyle = BOOKING_STATUS_STYLES[b.booking_status || ''] || 'bg-blue-500/15 text-blue-300 border-blue-500/25'
              return (
                <tr key={b.id} className="border-b border-white/[0.04]">
                  <td className="px-3 py-2.5 text-sm text-white whitespace-nowrap">{b.appointment_date || '—'}</td>
                  <td className="px-3 py-2.5 text-sm text-white whitespace-nowrap">{b.appointment_time || '—'}</td>
                  <td className="px-3 py-2.5 text-sm text-[#94a3b8] truncate max-w-[150px]">{b.doctor_name || '—'}</td>
                  <td className="px-3 py-2.5 text-sm text-[#64748b] truncate max-w-[120px] hidden sm:table-cell">{b.service_key || '—'}</td>
                  <td className="px-3 py-2.5">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full border text-[10px] font-medium ${statusStyle}`}>
                      {b.booking_status || '—'}
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
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
      <div className="flex-1 h-px bg-white/[0.06]" />
      <span className="text-[11px] font-medium text-[#475569] whitespace-nowrap">{label}</span>
      <div className="flex-1 h-px bg-white/[0.06]" />
    </div>
  )
})
