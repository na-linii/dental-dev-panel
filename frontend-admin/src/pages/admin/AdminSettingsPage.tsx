import { useState, useEffect, useCallback } from 'react'
import { Power, ShieldAlert, AlertTriangle, RefreshCw, Clock, ShieldBan, Plus, Trash2, Phone, Send, Loader2, Bell } from 'lucide-react'
import { pluralize } from '../../utils/pluralize'
import { TOAST_DURATION_MS } from '../../utils/constants'
import {
  getAdminBotStatus, toggleAdminBot,
  getAdminBlocklist, addAdminBlocklistEntry, removeAdminBlocklistEntry,
  startTelegramImport, cancelTelegramImport, getTelegramImportStatus, getTelegramImportHistory,
  startMaxUserbotImport, cancelMaxUserbotImport, getMaxUserbotImportStatus, getMaxUserbotImportHistory,
  getConfirmationSchedule, updateConfirmationSchedule,
} from '../../api/client'
import type {
  AdminBotStatus, AdminBlocklistItem,
  TelegramImportStatus, TelegramImportHistoryItem,
  MaxUserbotImportStatus, MaxUserbotImportHistoryItem,
} from '../../api/client'

function TelegramImportSection() {
  const [mode, setMode] = useState<'incremental' | 'full'>('incremental')
  const [messageLimit, setMessageLimit] = useState(500)
  const [dryRun, setDryRun] = useState(false)
  const [status, setStatus] = useState<TelegramImportStatus | null>(null)
  const [history, setHistory] = useState<TelegramImportHistoryItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isRunning = status?.status === 'running'

  useEffect(() => {
    getTelegramImportStatus().then(setStatus).catch(() => {})
    getTelegramImportHistory().then(r => setHistory(r.runs)).catch(() => {})
  }, [])

  useEffect(() => {
    if (!isRunning) return
    const interval = setInterval(async () => {
      try {
        const s = await getTelegramImportStatus()
        setStatus(s)
        if (s.status !== 'running') {
          clearInterval(interval)
          getTelegramImportHistory().then(r => setHistory(r.runs)).catch(() => {})
        }
      } catch { /* ignore */ }
    }, 2000)
    return () => clearInterval(interval)
  }, [isRunning])

  const handleStart = async () => {
    setLoading(true)
    setError(null)
    try {
      await startTelegramImport({ mode, message_limit: messageLimit, dry_run: dryRun })
      const s = await getTelegramImportStatus()
      setStatus(s)
    } catch (e: any) {
      const detail = e?.response?.data?.detail
      if (typeof detail === 'object' && detail?.error) {
        setError(detail.error)
      } else {
        setError(typeof detail === 'string' ? detail : 'Не удалось запустить импорт')
      }
    } finally {
      setLoading(false)
    }
  }

  const handleCancel = async () => {
    try {
      await cancelTelegramImport()
    } catch { /* ignore */ }
  }

  const progressPercent = status && status.total > 0 ? Math.round((status.processed / status.total) * 100) : 0
  const lastRun = status?.last_run || (history.length > 0 ? history[0] : null)

  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <div className="mb-4">
        <h2 className="text-lg font-semibold">Импорт чатов из Telegram</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Подтягивает историю переписок из Telegram-аккаунта клиники
        </p>
      </div>
      <div className="flex gap-4 mb-4 flex-wrap">
        <div className="flex-1 min-w-[150px]">
          <label className="text-xs text-muted-foreground uppercase mb-1 block">Режим</label>
          <select
            value={mode}
            onChange={e => setMode(e.target.value as 'incremental' | 'full')}
            disabled={isRunning}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
          >
            <option value="incremental">Инкрементальный</option>
            <option value="full">Полный</option>
          </select>
        </div>
        <div className="flex-1 min-w-[150px]">
          <label className="text-xs text-muted-foreground uppercase mb-1 block">Лимит сообщений</label>
          <input
            type="number"
            value={messageLimit}
            onChange={e => setMessageLimit(Number(e.target.value))}
            disabled={isRunning}
            min={10}
            max={5000}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
          />
        </div>
        <div className="flex-1 min-w-[150px] flex items-end">
          <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
            <input
              type="checkbox"
              checked={dryRun}
              onChange={e => setDryRun(e.target.checked)}
              disabled={isRunning}
              className="rounded"
            />
            Тестовый прогон
          </label>
        </div>
      </div>
      <div className="mb-4 flex gap-3">
        <button
          onClick={handleStart}
          disabled={isRunning || loading}
          className="bg-primary text-primary-foreground px-6 py-2 rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50"
        >
          {loading ? 'Запускаем...' : isRunning ? 'Импорт выполняется...' : 'Запустить импорт'}
        </button>
        {isRunning && (
          <button
            onClick={handleCancel}
            className="bg-destructive text-destructive-foreground px-6 py-2 rounded-lg text-sm font-medium hover:opacity-90"
          >
            Остановить
          </button>
        )}
      </div>
      {error && (
        <div className="mb-4 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
          {error}
        </div>
      )}
      {isRunning && status && (
        <div className="mb-4 p-4 rounded-lg border border-border bg-background">
          <div className="flex justify-between mb-2">
            <span className="text-sm text-blue-500">Импорт выполняется...</span>
            <span className="text-sm text-muted-foreground">
              {status.processed} / {status.total} диалогов
            </span>
          </div>
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-primary transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            {status.new_messages} новых сообщений найдено
          </div>
        </div>
      )}
      {lastRun && !isRunning && (
        <div className="border-t border-border pt-4">
          <div className="text-xs text-muted-foreground mb-2">Последний импорт</div>
          <div className="flex gap-4 flex-wrap text-sm text-muted-foreground">
            <span>{lastRun.started_at ? new Date(lastRun.started_at).toLocaleString('ru-RU') : '—'}</span>
            <span>{lastRun.processed} диалогов</span>
            <span>{lastRun.new_messages} новых сообщений</span>
            <span className={lastRun.status === 'completed' ? 'text-green-500' : 'text-destructive'}>
              {lastRun.status === 'completed' ? 'Успешно' : lastRun.status === 'failed' ? `Ошибка: ${lastRun.error}` : lastRun.status}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}

export function AdminSettingsPage() {
  const isSuperadmin = (() => {
    try { return JSON.parse(localStorage.getItem('admin_user') || '{}').role === 'superadmin' } catch { return false }
  })()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">Настройки</h1>
        <p className="text-text-tertiary mt-1">Управление параметрами системы</p>
      </div>

      {isSuperadmin && <RedButtonSection />}
      <ConfirmationScheduleSection />
      <BlocklistSection />

      {/* Telegram Import (superadmin only) */}
      {isSuperadmin && <TelegramImportSection />}

      {/* MAX userbot Import (superadmin only) */}
      {isSuperadmin && <MaxUserbotImportSection />}
    </div>
  )
}

// ── MAX userbot Import ──

function MaxUserbotImportSection() {
  const [chatIdsInput, setChatIdsInput] = useState('')
  const [mode, setMode] = useState<'incremental' | 'full'>('incremental')
  const [dryRun, setDryRun] = useState(false)
  const [status, setStatus] = useState<MaxUserbotImportStatus | null>(null)
  const [history, setHistory] = useState<MaxUserbotImportHistoryItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isRunning = status?.status === 'running'

  useEffect(() => {
    getMaxUserbotImportStatus().then(setStatus).catch(() => {})
    getMaxUserbotImportHistory().then(r => setHistory(r.runs)).catch(() => {})
  }, [])

  useEffect(() => {
    if (!isRunning) return
    const interval = setInterval(async () => {
      try {
        const s = await getMaxUserbotImportStatus()
        setStatus(s)
        if (s.status !== 'running') {
          clearInterval(interval)
          getMaxUserbotImportHistory().then(r => setHistory(r.runs)).catch(() => {})
        }
      } catch { /* ignore */ }
    }, 2000)
    return () => clearInterval(interval)
  }, [isRunning])

  const parseChatIds = (raw: string): number[] => {
    return raw
      .split(/[\s,;]+/)
      .map(s => s.trim())
      .filter(Boolean)
      .map(s => Number(s))
      .filter(n => Number.isInteger(n) && n > 0)
  }

  const handleStart = async () => {
    setError(null)
    const chat_ids = parseChatIds(chatIdsInput)
    if (chat_ids.length === 0) {
      setError('Укажите хотя бы один chat_id (числа через запятую или пробел)')
      return
    }
    setLoading(true)
    try {
      await startMaxUserbotImport({ chat_ids, mode, dry_run: dryRun })
      const s = await getMaxUserbotImportStatus()
      setStatus(s)
    } catch (e: any) {
      const detail = e?.response?.data?.detail
      if (typeof detail === 'object' && detail?.error) {
        setError(detail.error)
      } else {
        setError(typeof detail === 'string' ? detail : 'Не удалось запустить импорт')
      }
    } finally {
      setLoading(false)
    }
  }

  const handleCancel = async () => {
    try {
      await cancelMaxUserbotImport()
    } catch { /* ignore */ }
  }

  const progressPercent = status && status.total > 0 ? Math.round((status.processed / status.total) * 100) : 0
  const lastRun = status?.last_run || (history.length > 0 ? history[0] : null)

  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <div className="mb-4">
        <h2 className="text-lg font-semibold">Импорт истории MAX (userbot)</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Подтягивает историю переписок из MAX-аккаунта клиники. Auto-discovery чатов нет —
          укажите chat_id вручную (числа через запятую или пробел).
        </p>
      </div>
      <div className="mb-4">
        <label className="text-xs text-muted-foreground uppercase mb-1 block">Chat IDs</label>
        <input
          type="text"
          value={chatIdsInput}
          onChange={e => setChatIdsInput(e.target.value)}
          disabled={isRunning}
          placeholder="9770861, 12345678"
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
        />
      </div>
      <div className="flex gap-4 mb-4 flex-wrap">
        <div className="flex-1 min-w-[150px]">
          <label className="text-xs text-muted-foreground uppercase mb-1 block">Режим</label>
          <select
            value={mode}
            onChange={e => setMode(e.target.value as 'incremental' | 'full')}
            disabled={isRunning}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
          >
            <option value="incremental">Инкрементальный</option>
            <option value="full">Полный</option>
          </select>
        </div>
        <div className="flex-1 min-w-[150px] flex items-end">
          <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
            <input
              type="checkbox"
              checked={dryRun}
              onChange={e => setDryRun(e.target.checked)}
              disabled={isRunning}
              className="rounded"
            />
            Тестовый прогон
          </label>
        </div>
      </div>
      <div className="mb-4 flex gap-3">
        <button
          onClick={handleStart}
          disabled={isRunning || loading}
          className="bg-primary text-primary-foreground px-6 py-2 rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50"
        >
          {loading ? 'Запускаем...' : isRunning ? 'Импорт выполняется...' : 'Запустить импорт'}
        </button>
        {isRunning && (
          <button
            onClick={handleCancel}
            className="bg-destructive text-destructive-foreground px-6 py-2 rounded-lg text-sm font-medium hover:opacity-90"
          >
            Остановить
          </button>
        )}
      </div>
      {error && (
        <div className="mb-4 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
          {error}
        </div>
      )}
      {isRunning && status && (
        <div className="mb-4 p-4 rounded-lg border border-border bg-background">
          <div className="flex justify-between mb-2">
            <span className="text-sm text-blue-500">Импорт выполняется...</span>
            <span className="text-sm text-muted-foreground">
              {status.processed} / {status.total} чатов
            </span>
          </div>
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-primary transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            {status.new_messages} новых сообщений найдено
          </div>
        </div>
      )}
      {lastRun && !isRunning && (
        <div className="border-t border-border pt-4">
          <div className="text-xs text-muted-foreground mb-2">Последний импорт</div>
          <div className="flex gap-4 flex-wrap text-sm text-muted-foreground">
            <span>{lastRun.started_at ? new Date(lastRun.started_at).toLocaleString('ru-RU') : '—'}</span>
            <span>{lastRun.processed} чатов</span>
            <span>{lastRun.new_messages} новых сообщений</span>
            <span className={lastRun.status === 'completed' ? 'text-green-500' : 'text-destructive'}>
              {lastRun.status === 'completed' ? 'Успешно' : lastRun.status === 'failed' ? `Ошибка: ${lastRun.error}` : lastRun.status}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Confirmation Schedule ──

function ConfirmationScheduleSection() {
  const [hours, setHours] = useState<number[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [newHour, setNewHour] = useState(9)

  const formatHour = (h: number) => `${String(h).padStart(2, '0')}:00`

  useEffect(() => {
    getConfirmationSchedule()
      .then((data) => setHours(data.schedule_hours ?? []))
      .catch(() => setError('Не удалось загрузить расписание'))
      .finally(() => setLoading(false))
  }, [])

  const showError = (msg: string) => {
    setError(msg)
    setTimeout(() => setError(null), TOAST_DURATION_MS)
  }

  const handleSaveErr = (e: unknown) => {
    const status = (e as { response?: { status?: number } })?.response?.status
    if (status === 409) {
      showError('Подтверждения отключены в YAML-конфиге клиники')
    } else {
      showError('Не удалось сохранить')
    }
  }

  const handleAdd = async () => {
    if (hours.includes(newHour)) {
      showError('Этот час уже добавлен')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const updated = [...hours, newHour].sort((a, b) => a - b)
      const res = await updateConfirmationSchedule(updated)
      setHours(res.schedule_hours)
      setShowAdd(false)
    } catch (e) {
      handleSaveErr(e)
    } finally {
      setSaving(false)
    }
  }

  const handleRemove = async (hour: number) => {
    if (hours.length <= 1) return

    setSaving(true)
    setError(null)
    try {
      const updated = hours.filter((h) => h !== hour)
      const res = await updateConfirmationSchedule(updated)
      setHours(res.schedule_hours)
    } catch (e) {
      handleSaveErr(e)
    } finally {
      setSaving(false)
    }
  }

  const canRemove = () => hours.length > 1

  const isDark = document.documentElement.classList.contains('dark')
  const selectClass = "bg-surface-secondary dark:bg-white/15 border border-border dark:border-white/20 rounded-xl px-3 py-2.5 text-sm text-text-primary dark:text-white focus:outline-none focus:border-accent/40 transition-all duration-200 tabular-nums"
  const optionStyle = isDark ? { backgroundColor: '#1e1e2e', color: '#fff' } : undefined

  return (
    <div className="bg-white dark:bg-white/[0.03] border border-gray-200 dark:border-white/[0.06] shadow-sm dark:shadow-none rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-4 md:p-5 border-b border-border-light dark:border-white/[0.04]">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-blue-50 dark:bg-blue-500/10 flex items-center justify-center text-blue-600 dark:text-blue-400">
            <Bell className="w-[18px] h-[18px]" />
          </div>
          <div>
            <p className="text-sm font-medium text-text-primary">Время напоминаний</p>
            <p className="text-xs text-text-tertiary">Расписание отправки напоминаний о визитах</p>
          </div>
        </div>
        {!showAdd && (
          <button
            onClick={() => setShowAdd(true)}
            disabled={saving}
            className="flex items-center gap-1.5 px-3 py-2 bg-accent-soft text-accent border border-accent/20 rounded-xl text-xs font-medium hover:bg-accent/15 dark:hover:bg-accent/15 hover:border-accent/30 transition-all duration-200"
          >
            <Plus className="w-3.5 h-3.5" />
            Добавить
          </button>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="mx-4 mt-3 px-3 py-2 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-lg text-xs text-red-600 dark:text-red-300">
          {error}
        </div>
      )}

      {/* Add form */}
      {showAdd && (
        <div className="p-4 border-b border-border-light dark:border-white/[0.04] bg-surface-secondary dark:bg-white/[0.01]">
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <label className="text-xs text-muted-foreground uppercase mb-1 block">Час отправки</label>
              <div className="flex items-center gap-2">
                <select value={newHour} onChange={(e) => setNewHour(Number(e.target.value))} className={selectClass + " w-24"}>
                  {Array.from({ length: 24 }, (_, i) => i).map((h) => (
                    <option key={h} value={h} style={optionStyle}>{String(h).padStart(2, '0')}:00</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex flex-col gap-2 pt-5">
              <button
                onClick={handleAdd}
                disabled={saving || hours.includes(newHour)}
                className="flex items-center gap-1.5 px-3.5 py-2.5 bg-accent text-white rounded-xl text-sm font-medium hover:bg-accent/90 transition-all duration-200 disabled:opacity-30"
              >
                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                Добавить
              </button>
              <button
                onClick={() => setShowAdd(false)}
                className="px-3.5 py-2.5 bg-surface-secondary dark:bg-white/[0.04] border border-border dark:border-white/[0.08] text-text-secondary rounded-xl text-sm hover:bg-surface-tertiary dark:hover:bg-white/[0.08] transition-all duration-200"
              >
                Отмена
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Schedule list */}
      {loading ? (
        <div className="px-5 py-8 flex justify-center">
          <Loader2 className="w-5 h-5 animate-spin text-text-tertiary" />
        </div>
      ) : hours.length === 0 ? (
        <div className="px-5 py-8 text-center">
          <p className="text-text-muted text-sm">Расписание не настроено</p>
        </div>
      ) : (
        <div className="divide-y divide-border-light dark:divide-white/[0.04]">
          {hours.map((hour, idx) => (
            <div key={hour} className="flex items-center justify-between px-5 py-3 hover:bg-gray-50 dark:hover:bg-white/[0.03] transition-colors duration-150 group">
              <div className="flex items-center gap-3">
                <Clock className="w-4 h-4 text-blue-500 dark:text-blue-400 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-text-primary tabular-nums">{formatHour(hour)}</p>
                  <p className="text-xs text-text-muted">
                    {idx === 0 ? 'Первичное напоминание' : `Повторное напоминание #${idx}`}
                  </p>
                </div>
              </div>
              {canRemove() && (
                <button
                  onClick={() => handleRemove(hour)}
                  disabled={saving}
                  className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-text-tertiary hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition-all duration-200 flex-shrink-0 disabled:opacity-30"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {hours.length > 0 && (
        <div className="text-center text-xs text-text-muted py-2.5 border-t border-border-light dark:border-white/[0.04]">
          {hours.length} {pluralize(hours.length, 'напоминание', 'напоминания', 'напоминаний')} в день
        </div>
      )}
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
      <div className="bg-white dark:bg-white/[0.03] border border-gray-200 dark:border-white/[0.06] shadow-sm dark:shadow-none rounded-2xl p-8 text-center">
        <RefreshCw className="w-5 h-5 text-text-tertiary animate-spin mx-auto mb-2" />
        <p className="text-text-tertiary text-sm">Загрузка...</p>
      </div>
    )
  }

  return (
    <div className="bg-white dark:bg-white/[0.03] border border-gray-200 dark:border-white/[0.06] shadow-sm dark:shadow-none rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-4 md:p-5 border-b border-border-light dark:border-white/[0.04]">
        <div className="flex items-center gap-3">
          <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${
            botEnabled ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400'
          }`}>
            <Power className="w-[18px] h-[18px]" />
          </div>
          <div>
            <p className="text-sm font-medium text-text-primary">Управление ботом</p>
            <p className="text-xs text-text-tertiary">Экстренное отключение AI-агента</p>
          </div>
        </div>
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
          botEnabled ? 'bg-emerald-50 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-300' : 'bg-red-50 dark:bg-red-500/15 text-red-600 dark:text-red-300'
        }`}>
          <span className={`w-1.5 h-1.5 rounded-full ${botEnabled ? 'bg-emerald-500 dark:bg-emerald-400' : 'bg-red-500 dark:bg-red-400'}`} />
          {botEnabled ? 'Активен' : 'Отключён'}
        </span>
      </div>

      {/* Error */}
      {error && (
        <div className="mx-4 mt-4 p-3 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 rounded-xl flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-700 dark:text-amber-300 mt-0.5 shrink-0" />
          <div className="flex-1">
            <p className="text-sm text-amber-700 dark:text-amber-300">{error}</p>
            <button onClick={fetchStatus} className="text-xs text-amber-600 dark:text-amber-400 underline mt-1">Повторить</button>
          </div>
        </div>
      )}

      <div className="p-4 md:p-5 space-y-4">
        {!botEnabled && status?.reason && (
          <div className="flex items-start gap-2 p-3 bg-red-50 dark:bg-red-500/5 rounded-xl">
            <ShieldAlert className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
            <div>
              <p className="text-xs text-text-tertiary">Причина отключения</p>
              <p className="text-sm text-text-primary mt-0.5">{status.reason}</p>
            </div>
          </div>
        )}

        {status?.toggled_at && (
          <div className="flex items-center gap-2 text-xs text-text-muted">
            <Clock className="w-3.5 h-3.5" />
            <span>{botEnabled ? 'Включён' : 'Отключён'}: {new Date(status.toggled_at).toLocaleString('ru-RU')}</span>
          </div>
        )}

        {showConfirm ? (
          <div className="space-y-3 p-4 bg-surface-secondary dark:bg-white/[0.02] rounded-xl border border-border dark:border-white/[0.06]">
            <p className="text-sm font-medium text-text-primary">{botEnabled ? 'Отключить бота?' : 'Включить бота?'}</p>
            <p className="text-xs text-text-tertiary">
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
                className="w-full bg-surface-secondary dark:bg-white/[0.04] border border-border dark:border-white/[0.08] rounded-xl px-3 py-2 text-sm text-text-primary dark:text-white placeholder-text-muted dark:placeholder-[#475569] focus:outline-none focus:border-accent/40 transition-all duration-200"
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
                className="px-4 py-2.5 bg-surface-secondary dark:bg-white/[0.04] border border-border dark:border-white/[0.08] text-text-secondary rounded-xl text-sm hover:bg-surface-tertiary dark:hover:bg-white/[0.08] transition-all duration-200"
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
                ? 'bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-500/20 hover:bg-red-100 dark:hover:bg-red-500/15'
                : 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20 hover:bg-emerald-100 dark:hover:bg-emerald-500/15'
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
  const [error, setError] = useState<string | null>(null)
  const [inputError, setInputError] = useState(false)

  useEffect(() => {
    getAdminBlocklist()
      .then((data) => setItems(Array.isArray(data) ? data : []))
      .catch(() => { setItems([]); setError('Не удалось загрузить чёрный список') })
      .finally(() => setLoading(false))
  }, [])

  const handleAdd = async () => {
    const trimmed = input.trim()
    if (!trimmed || saving) return

    // Валидация формата
    if (inputType === 'phone') {
      const digits = trimmed.replace(/\D/g, '')
      if (digits.length < 10 || digits.length > 15) {
        setError('Введите корректный номер телефона (от 10 до 15 цифр)')
        setInputError(true)
        setTimeout(() => { setError(null); setInputError(false) }, TOAST_DURATION_MS)
        return
      }
    }
    if (inputType === 'tg') {
      if (!/^\d+$/.test(trimmed)) {
        setError('Telegram ID должен состоять только из цифр')
        setInputError(true)
        setTimeout(() => { setError(null); setInputError(false) }, TOAST_DURATION_MS)
        return
      }
    }

    setInputError(false)
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
      setError('Не удалось добавить в чёрный список')
      setTimeout(() => setError(null), TOAST_DURATION_MS)
    } finally {
      setSaving(false)
    }
  }

  const handleRemove = async (id: string) => {
    try {
      await removeAdminBlocklistEntry(id)
      setItems((prev) => prev.filter((i) => i.id !== id))
    } catch {
      setError('Не удалось удалить из чёрного списка')
      setTimeout(() => setError(null), TOAST_DURATION_MS)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleAdd()
    if (e.key === 'Escape') { setShowAdd(false); setInput(''); setReason('') }
  }

  return (
    <div className="bg-white dark:bg-white/[0.03] border border-gray-200 dark:border-white/[0.06] shadow-sm dark:shadow-none rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-4 md:p-5 border-b border-border-light dark:border-white/[0.04]">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-red-50 dark:bg-red-500/10 flex items-center justify-center text-red-600 dark:text-red-400">
            <ShieldBan className="w-[18px] h-[18px]" />
          </div>
          <div>
            <p className="text-sm font-medium text-text-primary">Чёрный список</p>
            <p className="text-xs text-text-tertiary">Бот не отвечает заблокированным контактам</p>
          </div>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-1.5 px-3 py-2 bg-accent-soft text-accent border border-accent/20 rounded-xl text-xs font-medium hover:bg-accent/15 dark:hover:bg-accent/15 hover:border-accent/30 transition-all duration-200"
        >
          <Plus className="w-3.5 h-3.5" />
          Добавить
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="mx-4 mt-3 px-3 py-2 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-lg text-xs text-red-600 dark:text-red-300">
          {error}
        </div>
      )}

      {/* Add form */}
      {showAdd && (
        <div className="p-4 border-b border-border-light dark:border-white/[0.04] bg-surface-secondary dark:bg-white/[0.01] space-y-3">
          <div className="flex rounded-lg border border-border dark:border-white/[0.08] overflow-hidden w-fit">
            <button
              onClick={() => { setInputType('phone'); setInput(''); setInputError(false); setError(null) }}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors duration-150 ${inputType === 'phone' ? 'bg-accent text-white' : 'bg-surface-secondary dark:bg-white/[0.04] text-text-tertiary hover:bg-surface-tertiary dark:hover:bg-white/[0.08]'}`}
            >
              <Phone className="w-3 h-3" />
              Телефон
            </button>
            <button
              onClick={() => { setInputType('tg'); setInput(''); setInputError(false); setError(null) }}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors duration-150 ${inputType === 'tg' ? 'bg-accent text-white' : 'bg-surface-secondary dark:bg-white/[0.04] text-text-tertiary hover:bg-surface-tertiary dark:hover:bg-white/[0.08]'}`}
            >
              <Send className="w-3 h-3" />
              Telegram ID
            </button>
          </div>

          <div className="flex items-start gap-3">
            <div className="flex-1 space-y-2">
              <div className="relative">
                {inputType === 'phone'
                  ? <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary" />
                  : <Send className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary" />}
                <input
                  autoFocus
                  type={inputType === 'phone' ? 'tel' : 'number'}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={inputType === 'phone' ? '+7 (999) 123-45-67' : '123456789'}
                  className={`w-full bg-surface-secondary dark:bg-white/[0.04] border rounded-xl pl-10 pr-4 py-2.5 text-sm text-text-primary dark:text-white placeholder-text-muted dark:placeholder-[#475569] focus:outline-none transition-all duration-200 ${inputError ? 'border-red-400 dark:border-red-500/60 focus:border-red-400' : 'border-border dark:border-white/[0.08] focus:border-accent/40'}`}
                />
              </div>
              <input
                type="text"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Причина (необязательно)"
                className="w-full bg-surface-secondary dark:bg-white/[0.04] border border-border dark:border-white/[0.08] rounded-xl px-4 py-2 text-sm text-text-primary dark:text-white placeholder-text-muted dark:placeholder-[#475569] focus:outline-none focus:border-accent/40 transition-all duration-200"
              />
            </div>
            <div className="flex flex-col gap-2">
              <button
                onClick={handleAdd}
                disabled={!input.trim() || saving}
                className="flex items-center gap-1.5 px-3.5 py-2.5 bg-accent text-white rounded-xl text-sm font-medium hover:bg-accent/90 transition-all duration-200 disabled:opacity-30"
              >
                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                Добавить
              </button>
              <button
                onClick={() => { setShowAdd(false); setInput(''); setReason('') }}
                className="px-3.5 py-2.5 bg-surface-secondary dark:bg-white/[0.04] border border-border dark:border-white/[0.08] text-text-secondary rounded-xl text-sm hover:bg-surface-tertiary dark:hover:bg-white/[0.08] transition-all duration-200"
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
          <Loader2 className="w-5 h-5 animate-spin text-text-tertiary" />
        </div>
      ) : items.length === 0 ? (
        <div className="px-5 py-8 text-center">
          <p className="text-text-muted text-sm">Список пуст</p>
        </div>
      ) : (
        <div className="divide-y divide-border-light dark:divide-white/[0.04]">
          {items.map((item) => (
            <div key={item.id} className="flex items-center justify-between px-5 py-3 hover:bg-gray-50 dark:hover:bg-white/[0.03] transition-colors duration-150 group">
              <div className="flex items-center gap-3 min-w-0">
                {item.telegram_user_id
                  ? <Send className="w-4 h-4 text-blue-500 dark:text-blue-400 flex-shrink-0" />
                  : <Phone className="w-4 h-4 text-text-tertiary flex-shrink-0" />}
                <div className="min-w-0">
                  <p className="text-sm font-medium text-text-primary tabular-nums truncate">
                    {item.telegram_user_id ? `TG ID: ${item.telegram_user_id}` : item.phone || '---'}
                  </p>
                  {item.reason && (
                    <p className="text-xs text-text-muted truncate mt-0.5">{item.reason}</p>
                  )}
                  {item.created_by && (
                    <p className="text-xs text-text-muted truncate mt-0.5">Добавил: {item.created_by}</p>
                  )}
                </div>
              </div>
              <button
                onClick={() => handleRemove(item.id)}
                className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-text-tertiary hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition-all duration-200 flex-shrink-0"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {items.length > 0 && (
        <div className="text-center text-xs text-text-muted py-2.5 border-t border-border-light dark:border-white/[0.04]">
          {items.length} {pluralize(items.length, 'контакт', 'контакта', 'контактов')}
        </div>
      )}
    </div>
  )
}
