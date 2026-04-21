import { useState, useRef, useEffect, useCallback } from 'react'
import { clinicsApi } from '../api/client'
import type { ChatResponse } from '../types'

interface ChatPlaygroundProps {
  clinicId: string
}

interface Message {
  role: 'user' | 'bot' | 'error'
  text: string
}

function generateUserId(): string {
  return 'hub-' + Math.floor(Math.random() * 900000 + 100000)
}

export function ChatPlayground({ clinicId }: ChatPlaygroundProps) {
  const [channel, setChannel] = useState('tg_bot')
  const [userId] = useState(generateUserId)
  const [phone, setPhone] = useState('')
  const [name, setName] = useState('')
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState<Message[]>([])
  const [sending, setSending] = useState(false)
  const [threadId, setThreadId] = useState('')
  const msgsEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    msgsEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const send = useCallback(async () => {
    const text = input.trim()
    if (!text || sending) return
    setInput('')
    setMessages((prev) => [...prev, { role: 'user', text }])
    setSending(true)

    try {
      const body: Record<string, string> = {
        message: text,
        clinic_id: clinicId,
        channel,
        channel_user_id: userId,
        thread_id: threadId || userId,
      }
      if (phone) body.phone = phone
      if (name) body.name = name

      const data: ChatResponse = await clinicsApi.chat(clinicId, body as never)
      if (data.thread_id) setThreadId(data.thread_id)

      setMessages((prev) => [
        ...prev,
        { role: 'bot', text: data.response || 'No response' },
      ])
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Unknown error'
      setMessages((prev) => [...prev, { role: 'error', text: msg }])
    } finally {
      setSending(false)
    }
  }, [input, sending, clinicId, channel, userId, threadId, phone, name])

  return (
    <div className="flex flex-col h-full bg-[#111127]">
      <div className="px-3 py-2 border-b border-[#1e293b] text-xs font-semibold text-[#7dd3fc]">
        Playground
      </div>

      <div className="px-3 py-2 space-y-1.5 border-b border-[#1e293b] text-xs">
        <div className="flex items-center gap-2">
          <label className="text-[#64748b] w-16">Channel</label>
          <select
            value={channel}
            onChange={(e) => setChannel(e.target.value)}
            className="flex-1 bg-[#0a0a1a] border border-[#1e293b] rounded px-2 py-1 text-white text-xs"
          >
            <option value="tg_bot">tg_bot</option>
            <option value="tg_business">tg_business</option>
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-[#64748b] w-16">User ID</label>
          <input value={userId} readOnly className="flex-1 bg-[#0a0a1a] border border-[#1e293b] rounded px-2 py-1 text-white text-xs opacity-60" />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-[#64748b] w-16">Phone</label>
          <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="optional" className="flex-1 bg-[#0a0a1a] border border-[#1e293b] rounded px-2 py-1 text-white text-xs" />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-[#64748b] w-16">Name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="optional" className="flex-1 bg-[#0a0a1a] border border-[#1e293b] rounded px-2 py-1 text-white text-xs" />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-2">
        {messages.map((m, i) => (
          <div
            key={i}
            className={`text-xs px-2.5 py-1.5 rounded-lg max-w-[95%] whitespace-pre-wrap ${
              m.role === 'user'
                ? 'bg-[#1e3a5f] text-white ml-auto'
                : m.role === 'bot'
                  ? 'bg-[#1a3a2a] text-white'
                  : 'bg-[#3a1a1a] text-red-300'
            }`}
          >
            {m.text}
          </div>
        ))}
        <div ref={msgsEndRef} />
      </div>

      <div className="px-3 py-2 border-t border-[#1e293b] flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && send()}
          placeholder="Message..."
          disabled={sending}
          className="flex-1 bg-[#0a0a1a] border border-[#1e293b] rounded px-2 py-1.5 text-white text-xs"
        />
        <button
          onClick={send}
          disabled={sending || !input.trim()}
          className="bg-[#7dd3fc] text-[#0a0a1a] px-3 py-1.5 rounded text-xs font-semibold disabled:opacity-40"
        >
          {sending ? '...' : 'Send'}
        </button>
      </div>
    </div>
  )
}
