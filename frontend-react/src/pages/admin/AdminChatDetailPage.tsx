import { useState, useEffect, useRef, useLayoutEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Bot, User, ShieldCheck, Send } from 'lucide-react'
import { getAdminSession, sendAdminMessage, updateAdminSessionStatus } from '../../api/adminClient'
import type { AdminSessionDetail, AdminMessage } from '../../api/adminClient'
import { format } from 'date-fns'
import { ru } from 'date-fns/locale'

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
}

const CHANGEABLE_STATUSES = [
  'operator_chat', 'chat_completed', 'visit_confirmed', 'cancelled', 'rescheduled',
]

export function AdminChatDetailPage() {
  const { sessionId } = useParams()
  const navigate = useNavigate()
  const [session, setSession] = useState<AdminSessionDetail | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [messageText, setMessageText] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [showStatusMenu, setShowStatusMenu] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const prevMsgCount = useRef(0)

  const loadSession = async (id: number, silent = false) => {
    if (!silent) setIsLoading(true)
    try {
      setSession(await getAdminSession(id))
    } catch (e) {
      console.error('Session load error:', e)
    } finally {
      if (!silent) setIsLoading(false)
    }
  }

  useEffect(() => {
    if (sessionId) {
      prevMsgCount.current = 0
      loadSession(Number(sessionId))
    }
  }, [sessionId])

  // Scroll to bottom on new messages
  useLayoutEffect(() => {
    if (!session) return
    const count = session.messages.length
    if (prevMsgCount.current === 0) {
      const container = scrollRef.current
      if (container) container.scrollTop = container.scrollHeight
    } else if (count > prevMsgCount.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
    prevMsgCount.current = count
  }, [session])

  // Auto-refresh every 5s
  useEffect(() => {
    if (!sessionId) return
    const id = setInterval(() => {
      if (!document.hidden) loadSession(Number(sessionId), true)
    }, 5000)
    return () => clearInterval(id)
  }, [sessionId])

  const handleSend = async () => {
    if (!messageText.trim() || !session || isSending) return
    const text = messageText.trim()
    setMessageText('')
    setIsSending(true)
    try {
      const result = await sendAdminMessage(session.id, text)
      setSession((prev) => {
        if (!prev) return prev
        return { ...prev, messages: [...prev.messages, result.message], awaiting_operator: false }
      })
    } catch (e) {
      console.error('Send message error:', e)
      setMessageText(text)
    } finally {
      setIsSending(false)
      inputRef.current?.focus()
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
  }

  const handleStatusChange = async (newStatus: string) => {
    if (!session) return
    setShowStatusMenu(false)
    try {
      await updateAdminSessionStatus(session.id, newStatus)
      setSession((prev) => prev ? { ...prev, status: newStatus } : prev)
    } catch (e) {
      console.error('Status update error:', e)
    }
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
    <div className="flex flex-col h-[calc(100vh-4rem)]">
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
            <h1 className="text-lg font-bold text-white truncate">{session.patient_name}</h1>
            {/* Status badge (clickable) */}
            <div className="relative">
              <button
                onClick={() => setShowStatusMenu(!showStatusMenu)}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium cursor-pointer transition-colors ${STATUS_COLORS[session.status] || 'bg-gray-500/15 text-gray-300 border-gray-500/25'}`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-current opacity-60" />
                {STATUS_LABELS[session.status] || session.status_label || session.status}
              </button>
              {showStatusMenu && (
                <div className="absolute top-full mt-1 left-0 z-50 bg-[#1a1a2e] border border-white/[0.1] rounded-xl shadow-xl py-1 min-w-[180px]">
                  {CHANGEABLE_STATUSES.map((s) => (
                    <button
                      key={s}
                      onClick={() => handleStatusChange(s)}
                      className={`w-full text-left px-3 py-2 text-sm hover:bg-white/[0.06] transition-colors ${
                        s === session.status ? 'text-[#51ff97]' : 'text-[#94a3b8]'
                      }`}
                    >
                      {STATUS_LABELS[s] || s}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-4 mt-1 text-sm text-[#64748b]">
            {session.patient_phone && <span>{session.patient_phone}</span>}
            {session.doctor_name && <span>Врач: {session.doctor_name}</span>}
          </div>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto py-5 px-3 space-y-3 min-h-0">
        {session.messages.map((msg, i) => {
          const msgDate = format(new Date(msg.timestamp), 'yyyy-MM-dd')
          const prevDate = i > 0 ? format(new Date(session.messages[i - 1].timestamp), 'yyyy-MM-dd') : null
          const showSeparator = msgDate !== prevDate
          return (
            <div key={msg.id}>
              {showSeparator && <DateSeparator date={new Date(msg.timestamp)} />}
              <MessageBubble message={msg} />
            </div>
          )
        })}
        <div ref={messagesEndRef} />
      </div>

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
            className="flex items-center justify-center w-11 h-11 bg-[#51ff97] text-[#0d0d1a] rounded-xl transition-all duration-200 hover:bg-[#51ff97]/90 hover:shadow-[0_0_16px_rgba(81,255,151,0.2)] disabled:opacity-30 disabled:hover:shadow-none active:scale-95"
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

function MessageBubble({ message }: { message: AdminMessage }) {
  const isPatient = message.author_type === 'patient'
  const isAgent = message.author_type === 'agent'
  const isAdmin = message.author_type === 'admin'

  let align = 'justify-start'
  let bubble = 'bg-white/[0.04] border-white/[0.06]'
  let authorColor = 'text-[#64748b]'
  let AuthorIcon = User

  if (isPatient) {
    align = 'justify-start'
    bubble = 'bg-white/[0.04] border-white/[0.06]'
    authorColor = 'text-[#64748b]'
    AuthorIcon = User
  } else if (isAgent) {
    align = 'justify-end'
    bubble = 'bg-[#51ff97]/[0.08] border-[#51ff97]/15'
    authorColor = 'text-[#51ff97]/60'
    AuthorIcon = Bot
  } else if (isAdmin) {
    align = 'justify-end'
    bubble = 'bg-indigo-500/[0.08] border-indigo-500/15'
    authorColor = 'text-indigo-400/60'
    AuthorIcon = ShieldCheck
  }

  return (
    <div className={`flex ${align}`}>
      <div className={`max-w-[85%] md:max-w-[70%] border rounded-2xl px-4 py-3 ${bubble}`}>
        <div className={`flex items-center gap-1.5 mb-1 ${authorColor}`}>
          <AuthorIcon className="w-3.5 h-3.5" />
          <span className="text-xs font-medium">
            {isAgent ? 'Агент' : isAdmin ? 'Администратор' : message.author}
          </span>
          <span className="text-[11px] text-[#475569] ml-auto">{format(new Date(message.timestamp), 'HH:mm')}</span>
        </div>
        <p className="text-sm text-gray-200 leading-relaxed whitespace-pre-wrap">{message.text}</p>
      </div>
    </div>
  )
}

function DateSeparator({ date }: { date: Date }) {
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
}
