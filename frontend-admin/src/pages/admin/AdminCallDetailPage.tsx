import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Play, ChevronDown, ChevronRight, Phone, Clock, FileAudio, Info, Mic, MicOff, PhoneOff, AlertCircle, Bot, UserCheck } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { VoiceCallEndReason, VoiceTurnMeta } from '../../api/client'
import { getAdminCallRecordingUrl } from '../../api/client'
import { useAdminCallDetail } from '../../hooks/useAdminQueries'
import axios from 'axios'

const END_REASON_LABEL: Record<VoiceCallEndReason, { label: string; icon: LucideIcon; badge: string }> = {
  in_progress:       { label: 'Идёт',                icon: Mic,         badge: 'bg-blue-50 dark:bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-500/25' },
  completed_bot:     { label: 'Бот завершил',         icon: Bot,         badge: 'bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-500/25' },
  completed_handoff: { label: 'Передан оператору',    icon: UserCheck,   badge: 'bg-orange-50 dark:bg-orange-500/15 text-orange-700 dark:text-orange-300 border-orange-200 dark:border-orange-500/25' },
  dropped:           { label: 'Бросил трубку',        icon: PhoneOff,    badge: 'bg-gray-100 dark:bg-gray-500/15 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-500/25' },
  answering_machine: { label: 'Автоответчик',         icon: MicOff,      badge: 'bg-gray-100 dark:bg-gray-500/15 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-500/25' },
  error:             { label: 'Ошибка',               icon: AlertCircle, badge: 'bg-red-50 dark:bg-red-500/15 text-red-700 dark:text-red-300 border-red-200 dark:border-red-500/25' },
}

function formatDuration(ms: number | null): string {
  if (ms == null) return '—'
  const s = Math.round(ms / 1000)
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`
}

function formatDateTime(iso: string | null): string {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString('ru', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    })
  } catch { return iso }
}

function formatTimeOnly(iso: string | null): string {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  } catch { return iso }
}

function formatPhone(phone: string | null): string {
  if (!phone) return '—'
  if (/^\+7\d{10}$/.test(phone)) {
    return `+7 (${phone.slice(2, 5)}) ${phone.slice(5, 8)}-${phone.slice(8, 10)}-${phone.slice(10)}`
  }
  return phone
}

function formatMs(ms: number | null): string {
  if (ms == null) return '—'
  if (ms < 1000) return `${ms} мс`
  return `${(ms / 1000).toFixed(2)} с`
}

function TurnMetaDropdown({ meta }: { meta: VoiceTurnMeta }) {
  const [open, setOpen] = useState(false)
  const items: Array<[string, string | number | boolean | null]> = [
    ['Распознано (raw STT)', meta.raw_stt_text],
    ['ASR уверенность', meta.stt_confidence != null ? `${(meta.stt_confidence * 100).toFixed(0)}%` : null],
    ['STT латенси', formatMs(meta.stt_latency_ms)],
    ['LLM время до первого токена', formatMs(meta.llm_ttft_ms)],
    ['LLM всего', formatMs(meta.llm_total_ms)],
    ['TTS до первого байта', formatMs(meta.tts_ttfb_ms)],
    ['TTS всего', formatMs(meta.tts_total_ms)],
    ['Полный turn', formatMs(meta.total_turn_ms)],
    ['Перебиваний (VAD)', meta.vad_interruption_count],
    ['Был barge-in', meta.was_barge_in ? 'да' : 'нет'],
    ['Филлер', meta.filler_used],
  ]
  return (
    <div className="mt-1">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1 text-xs text-text-tertiary hover:text-accent transition-colors"
      >
        {open ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
        Метрики turn'а
      </button>
      {open && (
        <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 px-3 py-2 bg-gray-50 dark:bg-white/[0.03] border border-gray-200 dark:border-white/[0.06] rounded-lg text-xs">
          {items.filter(([, v]) => v !== null && v !== '—').map(([k, v]) => (
            <div key={k} className="flex justify-between gap-2">
              <span className="text-text-tertiary">{k}:</span>
              <span className="text-text-secondary text-right truncate" title={String(v)}>{String(v)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function Bubble({ role, content, createdAt, meta }: { role: string; content: string; createdAt: string | null; meta: VoiceTurnMeta | null }) {
  const isPatient = role === 'patient'
  const isBot = role === 'bot' || role === 'agent'
  const align = isPatient ? 'items-end' : 'items-start'
  const bubble = isPatient
    ? 'bg-accent/10 text-text-primary'
    : isBot
      ? 'bg-gray-100 dark:bg-white/[0.05] text-text-primary'
      : 'bg-amber-50 dark:bg-amber-500/10 text-text-primary'
  const label = isPatient ? 'Пациент' : isBot ? 'Бот' : role
  return (
    <div className={`flex flex-col ${align}`}>
      <div className="flex items-baseline gap-2 text-xs text-text-tertiary mb-1">
        <span className="font-medium text-text-secondary">{label}</span>
        <span>{formatTimeOnly(createdAt)}</span>
      </div>
      <div className={`max-w-[80%] px-3.5 py-2 rounded-2xl text-sm ${bubble}`}>{content}</div>
      {meta && (
        <div className="w-full max-w-[80%]">
          <TurnMetaDropdown meta={meta} />
        </div>
      )}
    </div>
  )
}

type PlayerState = 'idle' | 'loading' | 'ready' | 'error'

function PlayerSection({ sessionId, hasRecording }: { sessionId: string; hasRecording: boolean }) {
  const [state, setState] = useState<PlayerState>('idle')
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  if (!hasRecording) {
    return (
      <div className="px-4 py-3 bg-white dark:bg-white/[0.02] border border-gray-200 dark:border-white/[0.06] rounded-xl shadow-sm dark:shadow-none">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gray-100 dark:bg-white/[0.05] flex items-center justify-center text-text-tertiary shrink-0">
            <FileAudio className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm text-text-primary">Запись звонка</div>
            <p className="text-xs text-text-tertiary mt-0.5">Запись для этого звонка не сохранена.</p>
          </div>
        </div>
      </div>
    )
  }

  const handlePlay = async () => {
    setState('loading')
    setErrorMsg(null)
    try {
      const { url } = await getAdminCallRecordingUrl(sessionId)
      setAudioUrl(url)
      setState('ready')
    } catch (err) {
      const status = axios.isAxiosError(err) ? err.response?.status : undefined
      if (status === 404) setErrorMsg('Запись пока недоступна')
      else if (status === 503) setErrorMsg('Сервис записей не настроен')
      else setErrorMsg('Не удалось загрузить запись')
      setState('error')
    }
  }

  return (
    <div className="px-4 py-3 bg-white dark:bg-white/[0.02] border border-gray-200 dark:border-white/[0.06] rounded-xl shadow-sm dark:shadow-none">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={handlePlay}
          disabled={state === 'loading' || state === 'ready'}
          className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center text-accent shrink-0 disabled:opacity-60 disabled:cursor-not-allowed hover:bg-accent/20 transition-colors"
        >
          <Play className="w-5 h-5 ml-0.5" />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 text-sm text-text-primary">
            <FileAudio className="w-4 h-4 text-emerald-500 dark:text-emerald-400" />
            <span>Запись звонка</span>
          </div>
          {state === 'idle' && (
            <p className="text-xs text-text-tertiary mt-0.5">Нажмите кнопку для воспроизведения</p>
          )}
          {state === 'loading' && (
            <p className="text-xs text-text-tertiary mt-0.5">Загружаем ссылку...</p>
          )}
          {state === 'ready' && (
            <p className="text-xs text-text-tertiary mt-0.5">Ссылка действительна 15 минут</p>
          )}
          {state === 'error' && (
            <p className="text-xs text-red-600 dark:text-red-400 mt-0.5">{errorMsg}</p>
          )}
        </div>
      </div>
      {state === 'ready' && audioUrl && (
        <audio src={audioUrl} controls autoPlay className="mt-3 w-full" />
      )}
    </div>
  )
}

export function AdminCallDetailPage() {
  const { sessionId } = useParams<{ sessionId: string }>()
  const navigate = useNavigate()
  const { data, isLoading, error } = useAdminCallDetail(sessionId)

  if (isLoading) {
    return <div className="text-sm text-text-tertiary">Загружаю звонок...</div>
  }
  if (error || !data) {
    return (
      <div className="space-y-3">
        <button onClick={() => navigate('/calls')} className="flex items-center gap-1 text-sm text-text-tertiary hover:text-accent">
          <ArrowLeft className="w-4 h-4" /> К списку
        </button>
        <div className="p-3 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 rounded-xl text-sm text-amber-700 dark:text-amber-300">
          Не удалось загрузить звонок
        </div>
      </div>
    )
  }

  const { voice, patient, messages } = data
  const reasonCfg = voice.end_reason ? END_REASON_LABEL[voice.end_reason] : null
  const ReasonIcon = reasonCfg?.icon

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Back */}
      <button onClick={() => navigate('/calls')} className="flex items-center gap-1 text-sm text-text-tertiary hover:text-accent transition-colors">
        <ArrowLeft className="w-4 h-4" /> К списку
      </button>

      {/* Header card */}
      <div className="p-5 bg-white dark:bg-white/[0.02] border border-gray-200 dark:border-white/[0.06] shadow-sm dark:shadow-none rounded-xl">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-text-primary truncate">
              {patient?.name || formatPhone(voice.caller_phone) || 'Без номера'}
            </h1>
            {patient && voice.caller_phone && (
              <p className="text-sm text-text-tertiary mt-0.5">{formatPhone(voice.caller_phone)}</p>
            )}
            <div className="flex items-center gap-3 mt-3 text-sm text-text-secondary flex-wrap">
              <span className="flex items-center gap-1.5"><Clock className="w-4 h-4 text-text-tertiary" />{formatDuration(voice.duration_ms)}</span>
              <span className="flex items-center gap-1.5"><Phone className="w-4 h-4 text-text-tertiary" />{formatDateTime(voice.started_at)}</span>
              {voice.callee_did && (
                <span className="text-text-tertiary text-xs">на {formatPhone(voice.callee_did)}</span>
              )}
            </div>
          </div>
          {reasonCfg && (
            <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border whitespace-nowrap ${reasonCfg.badge}`}>
              {ReasonIcon && <ReasonIcon className="w-4 h-4" />}
              {reasonCfg.label}
            </span>
          )}
        </div>
      </div>

      {/* Player */}
      <PlayerSection sessionId={data.session.id} hasRecording={voice.has_recording} />

      {/* Transcript */}
      <div className="space-y-4">
        <div className="flex items-baseline justify-between">
          <h2 className="text-lg font-semibold text-text-primary">Транскрипт</h2>
          <span className="text-xs text-text-tertiary">{messages.length} реплик</span>
        </div>
        {messages.length === 0 ? (
          <div className="px-4 py-6 bg-white dark:bg-white/[0.02] border border-gray-200 dark:border-white/[0.06] rounded-xl text-sm text-text-tertiary text-center">
            Сообщений в этом звонке нет
          </div>
        ) : (
          <div className="space-y-4 p-4 bg-white dark:bg-white/[0.02] border border-gray-200 dark:border-white/[0.06] rounded-xl shadow-sm dark:shadow-none">
            {messages.map((m) => (
              <Bubble
                key={m.id}
                role={m.role}
                content={m.content}
                createdAt={m.created_at}
                meta={m.voice_turn_meta}
              />
            ))}
          </div>
        )}
      </div>

      {/* Tech info */}
      <details className="text-xs text-text-tertiary">
        <summary className="cursor-pointer flex items-center gap-1 hover:text-accent transition-colors">
          <Info className="w-3 h-3" /> Технические детали
        </summary>
        <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 px-3 py-2 bg-gray-50 dark:bg-white/[0.03] border border-gray-200 dark:border-white/[0.06] rounded-lg">
          <div><span className="text-text-tertiary">session_id:</span> {data.session.id}</div>
          <div><span className="text-text-tertiary">livekit_room:</span> {voice.livekit_room}</div>
          {voice.egress_id && <div><span className="text-text-tertiary">egress_id:</span> {voice.egress_id}</div>}
          {voice.recording_format && <div><span className="text-text-tertiary">recording_format:</span> {voice.recording_format}</div>}
          {voice.recording_size_bytes != null && (
            <div><span className="text-text-tertiary">recording_size:</span> {(voice.recording_size_bytes / 1024).toFixed(1)} КБ</div>
          )}
        </div>
      </details>
    </div>
  )
}
