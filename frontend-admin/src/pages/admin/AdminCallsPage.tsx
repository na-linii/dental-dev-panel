import { RefreshCw, Phone, FileAudio, Mic, MicOff, PhoneOff, AlertCircle, Bot, UserCheck } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { AdminCallSummary, VoiceCallEndReason } from '../../api/client'
import { useAdminCalls } from '../../hooks/useAdminQueries'

// ── End reason display config ──────────────────────────────────────────────

interface EndReasonConfig {
  label: string
  icon: LucideIcon
  badge: string
  dot: string
}

const END_REASON_CONFIG: Record<VoiceCallEndReason, EndReasonConfig> = {
  in_progress: {
    label: 'Идёт',
    icon: Mic,
    badge: 'bg-blue-50 dark:bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-500/25',
    dot: 'bg-blue-500 dark:bg-blue-400',
  },
  completed_bot: {
    label: 'Бот завершил',
    icon: Bot,
    badge: 'bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-500/25',
    dot: 'bg-emerald-500 dark:bg-emerald-400',
  },
  completed_handoff: {
    label: 'Передан оператору',
    icon: UserCheck,
    badge: 'bg-orange-50 dark:bg-orange-500/15 text-orange-700 dark:text-orange-300 border-orange-200 dark:border-orange-500/25',
    dot: 'bg-orange-500 dark:bg-orange-400',
  },
  dropped: {
    label: 'Бросил трубку',
    icon: PhoneOff,
    badge: 'bg-gray-100 dark:bg-gray-500/15 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-500/25',
    dot: 'bg-gray-500 dark:bg-gray-400',
  },
  answering_machine: {
    label: 'Автоответчик',
    icon: MicOff,
    badge: 'bg-gray-100 dark:bg-gray-500/15 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-500/25',
    dot: 'bg-gray-500 dark:bg-gray-400',
  },
  error: {
    label: 'Ошибка',
    icon: AlertCircle,
    badge: 'bg-red-50 dark:bg-red-500/15 text-red-700 dark:text-red-300 border-red-200 dark:border-red-500/25',
    dot: 'bg-red-500 dark:bg-red-400',
  },
}

// ── Helpers ────────────────────────────────────────────────────────────────

function formatDuration(ms: number | null): string {
  if (ms == null) return '—'
  const seconds = Math.round(ms / 1000)
  const mm = Math.floor(seconds / 60)
  const ss = seconds % 60
  return `${mm}:${ss.toString().padStart(2, '0')}`
}

function formatDateTime(iso: string | null): string {
  if (!iso) return '—'
  try {
    const d = new Date(iso)
    return d.toLocaleString('ru', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return iso
  }
}

function formatPhone(phone: string | null): string {
  if (!phone) return 'Без номера'
  // crude E.164 prettify: +7 (916) 123-45-67
  if (/^\+7\d{10}$/.test(phone)) {
    return `+7 (${phone.slice(2, 5)}) ${phone.slice(5, 8)}-${phone.slice(8, 10)}-${phone.slice(10)}`
  }
  return phone
}

// ── Components ─────────────────────────────────────────────────────────────

function EndReasonBadge({ reason }: { reason: VoiceCallEndReason | null }) {
  if (!reason) return null
  const cfg = END_REASON_CONFIG[reason]
  const Icon = cfg.icon
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${cfg.badge}`}>
      <Icon className="w-3.5 h-3.5" />
      {cfg.label}
    </span>
  )
}

function CallRow({ call }: { call: AdminCallSummary }) {
  const patient = call.patient
  const initial = (patient?.name || call.caller_phone || '?').charAt(0).toUpperCase()
  return (
    <div className="flex items-center gap-4 px-4 py-3 bg-white dark:bg-white/[0.02] border border-gray-200 dark:border-white/[0.06] shadow-sm dark:shadow-none rounded-xl hover:border-accent/30 hover:bg-gray-50 dark:hover:bg-white/[0.03] transition-all duration-150 cursor-default">
      <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center text-accent text-sm font-semibold shrink-0">
        {initial}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium text-text-primary truncate">
            {patient?.name || formatPhone(call.caller_phone)}
          </span>
          {patient && call.caller_phone && (
            <span className="text-xs text-text-tertiary">{formatPhone(call.caller_phone)}</span>
          )}
        </div>
        {call.last_message_preview && (
          <p className="text-xs text-text-tertiary truncate mt-0.5">{call.last_message_preview}</p>
        )}
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <div className="text-xs text-text-tertiary tabular-nums w-12 text-right">{formatDuration(call.duration_ms)}</div>
        <div className="text-xs text-text-tertiary w-24 text-right">{formatDateTime(call.started_at)}</div>
        {call.has_recording ? (
          <FileAudio className="w-4 h-4 text-emerald-500 dark:text-emerald-400" />
        ) : (
          <div className="w-4 h-4" />
        )}
        <EndReasonBadge reason={call.end_reason} />
      </div>
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────

export function AdminCallsPage() {
  const { data, isLoading, error, refetch } = useAdminCalls({ limit: 100 })
  const calls = data?.items ?? []
  const total = data?.total ?? 0

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Звонки</h1>
          <p className="text-text-tertiary mt-1">
            Голосовые звонки клиники — транскрипты, записи и статусы
          </p>
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
          Не удалось загрузить звонки
        </div>
      )}

      {/* Counter */}
      {!isLoading && !error && (
        <div className="text-sm text-text-tertiary">
          Всего: <span className="text-text-primary font-medium tabular-nums">{total}</span>
        </div>
      )}

      {/* List */}
      {!isLoading && !error && calls.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 px-6 bg-white dark:bg-white/[0.02] border border-gray-200 dark:border-white/[0.06] shadow-sm dark:shadow-none rounded-xl">
          <Phone className="w-10 h-10 text-text-tertiary mb-3" />
          <p className="text-sm text-text-secondary">Звонков пока нет</p>
          <p className="text-xs text-text-tertiary mt-1">
            Когда голосовой агент начнёт сохранять диалоги, они появятся здесь
          </p>
        </div>
      )}

      {calls.length > 0 && (
        <div className="space-y-2">
          {calls.map((call) => (
            <CallRow key={call.session_id} call={call} />
          ))}
        </div>
      )}
    </div>
  )
}
