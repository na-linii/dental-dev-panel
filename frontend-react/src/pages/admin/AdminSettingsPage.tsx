import { useState, useEffect, useCallback } from 'react'
import { Power, ShieldAlert, AlertTriangle, RefreshCw, Clock, ShieldBan, Plus, Trash2, Phone, Send, Loader2 } from 'lucide-react'
import {
  getAdminBotStatus, toggleAdminBot,
  getAdminBlocklist, addAdminBlocklistEntry, removeAdminBlocklistEntry,
} from '../../api/adminClient'
import type { AdminBotStatus, AdminBlocklistItem } from '../../api/adminClient'

export function AdminSettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Настройки</h1>
        <p className="text-[#64748b] mt-1">Управление параметрами системы</p>
      </div>

      <RedButtonSection />
      <BlocklistSection />
    </div>
  )
}

// ── Red Button ──

function RedButtonSection() {
  const [status, setStatus] = useState<AdminBotStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [toggling, setToggling] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [reason, setReason] = useState('')
  const [showConfirm, setShowConfirm] = useState(false)

  const fetchStatus = useCallback(async () => {
    try {
      setError(null)
      const data = await getAdminBotStatus()
      setStatus(data)
    } catch {
      setError('Не удалось получить статус бота')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchStatus() }, [fetchStatus])

  const handleToggle = async () => {
    if (!status) return
    setToggling(true)
    setError(null)
    try {
      const newEnabled = !status.bot_enabled
      await toggleAdminBot(newEnabled, newEnabled ? undefined : reason || undefined)
      // Re-fetch full status after toggle (backend returns {success, bot_enabled}, not full status)
      await fetchStatus()
      setShowConfirm(false)
      setReason('')
    } catch {
      setError('Не удалось переключить бота')
    } finally {
      setToggling(false)
    }
  }

  const botEnabled = status?.bot_enabled ?? true

  if (loading) {
    return (
      <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-8 text-center">
        <RefreshCw className="w-5 h-5 text-[#64748b] animate-spin mx-auto mb-2" />
        <p className="text-[#64748b] text-sm">Загрузка...</p>
      </div>
    )
  }

  return (
    <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-4 md:p-5 border-b border-white/[0.04]">
        <div className="flex items-center gap-3">
          <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${
            botEnabled ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'
          }`}>
            <Power className="w-[18px] h-[18px]" />
          </div>
          <div>
            <p className="text-sm font-medium text-white">Управление ботом</p>
            <p className="text-xs text-[#64748b]">Экстренное отключение AI-агента</p>
          </div>
        </div>
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
          botEnabled ? 'bg-emerald-500/15 text-emerald-300' : 'bg-red-500/15 text-red-300'
        }`}>
          <span className={`w-1.5 h-1.5 rounded-full ${botEnabled ? 'bg-emerald-400' : 'bg-red-400'}`} />
          {botEnabled ? 'Активен' : 'Отключён'}
        </span>
      </div>

      {/* Error */}
      {error && (
        <div className="mx-4 mt-4 p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
          <div className="flex-1">
            <p className="text-sm text-amber-300">{error}</p>
            <button onClick={fetchStatus} className="text-xs text-amber-400 underline mt-1">Повторить</button>
          </div>
        </div>
      )}

      <div className="p-4 md:p-5 space-y-4">
        {!botEnabled && status?.reason && (
          <div className="flex items-start gap-2 p-3 bg-red-500/5 rounded-xl">
            <ShieldAlert className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
            <div>
              <p className="text-xs text-[#64748b]">Причина отключения</p>
              <p className="text-sm text-white mt-0.5">{status.reason}</p>
            </div>
          </div>
        )}

        {status?.toggled_at && (
          <div className="flex items-center gap-2 text-xs text-[#475569]">
            <Clock className="w-3.5 h-3.5" />
            <span>{botEnabled ? 'Включён' : 'Отключён'}: {new Date(status.toggled_at).toLocaleString('ru-RU')}</span>
          </div>
        )}

        {showConfirm ? (
          <div className="space-y-3 p-4 bg-white/[0.02] rounded-xl border border-white/[0.06]">
            <p className="text-sm font-medium text-white">{botEnabled ? 'Отключить бота?' : 'Включить бота?'}</p>
            <p className="text-xs text-[#64748b]">
              {botEnabled
                ? 'Все сообщения пациентов будут переданы администратору. AI-агент не будет отвечать.'
                : 'AI-агент начнёт обрабатывать сообщения пациентов.'}
            </p>
            {botEnabled && (
              <input
                type="text"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Причина отключения (необязательно)"
                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2 text-sm text-white placeholder-[#475569] focus:outline-none focus:border-[#51ff97]/40 transition-all duration-200"
              />
            )}
            <div className="flex gap-2">
              <button
                onClick={handleToggle}
                disabled={toggling}
                className={`flex-1 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 disabled:opacity-50 ${
                  botEnabled ? 'bg-red-500 text-white hover:bg-red-600' : 'bg-emerald-500 text-white hover:bg-emerald-600'
                }`}
              >
                {toggling ? 'Подождите...' : botEnabled ? 'Отключить' : 'Включить'}
              </button>
              <button
                onClick={() => { setShowConfirm(false); setReason('') }}
                className="px-4 py-2.5 bg-white/[0.04] border border-white/[0.08] text-[#94a3b8] rounded-xl text-sm hover:bg-white/[0.08] transition-all duration-200"
              >
                Отмена
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setShowConfirm(true)}
            className={`w-full px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${
              botEnabled
                ? 'bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/15'
                : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/15'
            }`}
          >
            {botEnabled ? 'Отключить бота' : 'Включить бота'}
          </button>
        )}
      </div>
    </div>
  )
}

// ── Blocklist ──

type InputType = 'phone' | 'tg'

function BlocklistSection() {
  const [items, setItems] = useState<AdminBlocklistItem[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showAdd, setShowAdd] = useState(false)
  const [inputType, setInputType] = useState<InputType>('phone')
  const [input, setInput] = useState('')
  const [reason, setReason] = useState('')

  useEffect(() => {
    getAdminBlocklist()
      .then((data) => setItems(Array.isArray(data) ? data : []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false))
  }, [])

  const handleAdd = async () => {
    const trimmed = input.trim()
    if (!trimmed || saving) return
    setSaving(true)
    try {
      const body = inputType === 'phone'
        ? { phone: trimmed.replace(/[^\d+]/g, ''), reason: reason || undefined }
        : { telegram_user_id: trimmed, reason: reason || undefined }
      await addAdminBlocklistEntry(body)
      const data = await getAdminBlocklist()
      setItems(Array.isArray(data) ? data : [])
      setInput('')
      setReason('')
      setShowAdd(false)
    } catch {
      // keep form open on error
    } finally {
      setSaving(false)
    }
  }

  const handleRemove = async (id: string) => {
    try {
      await removeAdminBlocklistEntry(id)
      setItems((prev) => prev.filter((i) => i.id !== id))
    } catch {
      // silently ignore
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleAdd()
    if (e.key === 'Escape') { setShowAdd(false); setInput(''); setReason('') }
  }

  return (
    <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-4 md:p-5 border-b border-white/[0.04]">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-red-500/10 flex items-center justify-center text-red-400">
            <ShieldBan className="w-[18px] h-[18px]" />
          </div>
          <div>
            <p className="text-sm font-medium text-white">Чёрный список</p>
            <p className="text-xs text-[#64748b]">Бот не отвечает заблокированным контактам</p>
          </div>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-1.5 px-3 py-2 bg-[#51ff97]/10 text-[#51ff97] border border-[#51ff97]/20 rounded-xl text-xs font-medium hover:bg-[#51ff97]/15 hover:border-[#51ff97]/30 transition-all duration-200"
        >
          <Plus className="w-3.5 h-3.5" />
          Добавить
        </button>
      </div>

      {/* Add form */}
      {showAdd && (
        <div className="p-4 border-b border-white/[0.04] bg-white/[0.01] space-y-3">
          <div className="flex rounded-lg border border-white/[0.08] overflow-hidden w-fit">
            <button
              onClick={() => { setInputType('phone'); setInput('') }}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors duration-150 ${inputType === 'phone' ? 'bg-[#51ff97] text-[#0d0d1a]' : 'bg-white/[0.04] text-[#64748b] hover:bg-white/[0.08]'}`}
            >
              <Phone className="w-3 h-3" />
              Телефон
            </button>
            <button
              onClick={() => { setInputType('tg'); setInput('') }}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors duration-150 ${inputType === 'tg' ? 'bg-[#51ff97] text-[#0d0d1a]' : 'bg-white/[0.04] text-[#64748b] hover:bg-white/[0.08]'}`}
            >
              <Send className="w-3 h-3" />
              Telegram ID
            </button>
          </div>

          <div className="flex items-start gap-3">
            <div className="flex-1 space-y-2">
              <div className="relative">
                {inputType === 'phone'
                  ? <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#475569]" />
                  : <Send className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#475569]" />}
                <input
                  autoFocus
                  type={inputType === 'phone' ? 'tel' : 'number'}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={inputType === 'phone' ? '+7 (999) 123-45-67' : '123456789'}
                  className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-[#475569] focus:outline-none focus:border-[#51ff97]/40 transition-all duration-200"
                />
              </div>
              <input
                type="text"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Причина (необязательно)"
                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-2 text-sm text-white placeholder-[#475569] focus:outline-none focus:border-[#51ff97]/40 transition-all duration-200"
              />
            </div>
            <div className="flex flex-col gap-2">
              <button
                onClick={handleAdd}
                disabled={!input.trim() || saving}
                className="flex items-center gap-1.5 px-3.5 py-2.5 bg-[#51ff97] text-[#0d0d1a] rounded-xl text-sm font-medium hover:bg-[#51ff97]/90 transition-all duration-200 disabled:opacity-30"
              >
                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                Добавить
              </button>
              <button
                onClick={() => { setShowAdd(false); setInput(''); setReason('') }}
                className="px-3.5 py-2.5 bg-white/[0.04] border border-white/[0.08] text-[#94a3b8] rounded-xl text-sm hover:bg-white/[0.08] transition-all duration-200"
              >
                Отмена
              </button>
            </div>
          </div>
        </div>
      )}

      {/* List */}
      {loading ? (
        <div className="px-5 py-8 flex justify-center">
          <Loader2 className="w-5 h-5 animate-spin text-[#64748b]" />
        </div>
      ) : items.length === 0 ? (
        <div className="px-5 py-8 text-center">
          <p className="text-[#475569] text-sm">Список пуст</p>
        </div>
      ) : (
        <div className="divide-y divide-white/[0.04]">
          {items.map((item) => (
            <div key={item.id} className="flex items-center justify-between px-5 py-3 hover:bg-white/[0.03] transition-colors duration-150 group">
              <div className="flex items-center gap-3 min-w-0">
                {item.telegram_user_id
                  ? <Send className="w-4 h-4 text-blue-400 flex-shrink-0" />
                  : <Phone className="w-4 h-4 text-[#64748b] flex-shrink-0" />}
                <div className="min-w-0">
                  <p className="text-sm font-medium text-white tabular-nums truncate">
                    {item.telegram_user_id ? `TG ID: ${item.telegram_user_id}` : item.phone || '---'}
                  </p>
                  {item.reason && (
                    <p className="text-xs text-[#475569] truncate mt-0.5">{item.reason}</p>
                  )}
                  {item.created_by && (
                    <p className="text-xs text-[#475569] truncate mt-0.5">Добавил: {item.created_by}</p>
                  )}
                </div>
              </div>
              <button
                onClick={() => handleRemove(item.id)}
                className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-[#64748b] hover:text-red-400 hover:bg-red-500/10 transition-all duration-200 flex-shrink-0"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {items.length > 0 && (
        <div className="text-center text-xs text-[#475569] py-2.5 border-t border-white/[0.04]">
          {items.length} контактов
        </div>
      )}
    </div>
  )
}
