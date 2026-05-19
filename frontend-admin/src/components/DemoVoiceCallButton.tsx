import { useEffect, useMemo, useRef, useState } from 'react'
import { Phone, PhoneOff, Mic, MicOff, User, UserPlus, Loader2, X } from 'lucide-react'
import { Room, RoomEvent, Track } from 'livekit-client'
import type { RemoteTrack, RemoteTrackPublication, RemoteParticipant } from 'livekit-client'
import { createDemoVoiceRoom, type AdminUser, type DemoPatientKey } from '../api/client'

// 5-bar live equalizer driven by LiveKit participant.audioLevel.
// One color while you speak (emerald), another while the agent speaks (sky).
function CallEqualizer({ room }: { room: Room | null }) {
  const [localLevel, setLocalLevel] = useState(0)
  const [remoteLevel, setRemoteLevel] = useState(0)

  useEffect(() => {
    if (!room) return
    let alive = true
    const tick = () => {
      if (!alive) return
      let local = 0
      const localPub = room.localParticipant.getTrackPublication(Track.Source.Microphone)
      if (localPub && !localPub.isMuted) local = room.localParticipant.audioLevel ?? 0
      let remote = 0
      for (const p of room.remoteParticipants.values()) {
        if ((p.audioLevel ?? 0) > remote) remote = p.audioLevel ?? 0
      }
      setLocalLevel(local)
      setRemoteLevel(remote)
    }
    const id = window.setInterval(tick, 60)
    return () => {
      alive = false
      window.clearInterval(id)
    }
  }, [room])

  const youSpeaking = localLevel > remoteLevel && localLevel > 0.02
  const agentSpeaking = remoteLevel > 0.02 && !youSpeaking
  const peak = Math.max(localLevel, remoteLevel)

  const bars = [0, 1, 2, 3, 4]
  const heights = bars.map((i) => {
    const offset = Math.abs(i - 2) * 0.18
    const noisy = Math.max(0, peak - offset)
    const h = Math.min(1, noisy * 3.2 + 0.08)
    return Math.max(0.08, h)
  })

  const baseColor = youSpeaking
    ? 'bg-emerald-500'
    : agentSpeaking
      ? 'bg-sky-400'
      : 'bg-gray-300 dark:bg-white/15'
  const label = youSpeaking ? 'Вы говорите' : agentSpeaking ? 'Агент говорит' : 'Тишина'

  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="flex gap-1 items-end h-10">
        {heights.map((h, i) => (
          <div
            key={i}
            className={`w-1.5 rounded-full transition-all duration-75 ${baseColor}`}
            style={{ height: `${Math.round(h * 100)}%` }}
          />
        ))}
      </div>
      <span className="text-[11px] text-text-tertiary tabular-nums">{label}</span>
    </div>
  )
}

const OPERATOR_ALLOWLIST = new Set(['aleksey', 'ekaterina', 'konstantin'])
const DEMO_CLINIC_ID = 'starsmile_demo'

export function isDemoVoiceAllowed(user: AdminUser | null): boolean {
  if (!user) return false
  if (user.clinic_id !== DEMO_CLINIC_ID) return false
  if (user.role === 'superadmin') return true
  const clean = (user.username || '').toLowerCase().replace(/-demo$/, '')
  return OPERATOR_ALLOWLIST.has(clean)
}

type CallState = 'idle' | 'connecting' | 'in_call' | 'error'

interface DemoVoiceCallButtonProps {
  user: AdminUser | null
}

export function DemoVoiceCallButton({ user }: DemoVoiceCallButtonProps) {
  const [isOpen, setIsOpen] = useState(false)
  if (!isDemoVoiceAllowed(user)) return null
  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-sm font-medium shadow-sm transition-all duration-200"
      >
        <Phone className="w-4 h-4" />
        Позвонить агенту
      </button>
      {isOpen && <DemoVoiceModal onClose={() => setIsOpen(false)} />}
    </>
  )
}

function DemoVoiceModal({ onClose }: { onClose: () => void }) {
  const [state, setState] = useState<CallState>('idle')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [, setRoomName] = useState<string | null>(null)
  const [patientLabel, setPatientLabel] = useState<string | null>(null)
  const [muted, setMuted] = useState(false)
  const [startedAt, setStartedAt] = useState<number | null>(null)
  const [tick, setTick] = useState(0)

  const roomRef = useRef<Room | null>(null)
  const audioElRef = useRef<HTMLAudioElement | null>(null)

  // Duration ticker
  useEffect(() => {
    if (state !== 'in_call') return
    const id = window.setInterval(() => setTick((t) => t + 1), 1000)
    return () => window.clearInterval(id)
  }, [state])

  const durationMs = useMemo(() => {
    void tick
    if (!startedAt) return 0
    return Date.now() - startedAt
  }, [startedAt, tick])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      void roomRef.current?.disconnect()
      roomRef.current = null
    }
  }, [])

  async function startCall(choice: 'new' | DemoPatientKey, label: string) {
    setErrorMsg(null)
    setPatientLabel(label)
    setState('connecting')
    try {
      const body =
        choice === 'new'
          ? { patient_choice: 'new' as const }
          : { patient_choice: 'existing' as const, patient_key: choice }
      const res = await createDemoVoiceRoom(body)
      if (!res.livekit_url) throw new Error('Сервис не настроен (нет LIVEKIT_URL).')
      setRoomName(res.room)

      const room = new Room({
        adaptiveStream: true,
        dynacast: true,
        audioCaptureDefaults: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      })
      roomRef.current = room

      room.on(RoomEvent.TrackSubscribed, (track: RemoteTrack, _pub: RemoteTrackPublication, _p: RemoteParticipant) => {
        if (track.kind === Track.Kind.Audio) {
          const el = track.attach() as HTMLAudioElement
          el.autoplay = true
          el.style.display = 'none'
          if (audioElRef.current?.parentElement) audioElRef.current.replaceWith(el)
          else document.body.appendChild(el)
          audioElRef.current = el
        }
      })
      room.on(RoomEvent.Disconnected, () => {
        setState('idle')
        setRoomName(null)
        setStartedAt(null)
      })

      await room.connect(res.livekit_url, res.token)
      await room.localParticipant.setMicrophoneEnabled(true)
      setStartedAt(Date.now())
      setState('in_call')
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setErrorMsg(`Не удалось установить соединение: ${msg}`)
      setState('error')
      await roomRef.current?.disconnect()
      roomRef.current = null
    }
  }

  async function toggleMute() {
    const room = roomRef.current
    if (!room) return
    const newMuted = !muted
    await room.localParticipant.setMicrophoneEnabled(!newMuted)
    setMuted(newMuted)
  }

  async function hangUp() {
    await roomRef.current?.disconnect()
    roomRef.current = null
    if (audioElRef.current) {
      audioElRef.current.remove()
      audioElRef.current = null
    }
    setState('idle')
    setStartedAt(null)
    setRoomName(null)
    setPatientLabel(null)
    setMuted(false)
  }

  async function closeModal() {
    if (state === 'in_call' || state === 'connecting') await hangUp()
    onClose()
  }

  const durationSec = Math.floor(durationMs / 1000)
  const mm = Math.floor(durationSec / 60).toString().padStart(2, '0')
  const ss = (durationSec % 60).toString().padStart(2, '0')

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-white/10 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-text-primary">Демо-звонок голосовому агенту</h2>
          <button onClick={closeModal} className="text-text-tertiary hover:text-text-primary">
            <X className="w-5 h-5" />
          </button>
        </div>

        {state === 'idle' && (
          <>
            <p className="text-sm text-text-tertiary mb-4">
              Звонок откроется через ваш браузер (WebRTC). Агент использует те же моки, что и текстовое демо.
            </p>
            <div className="space-y-2">
              <button
                onClick={() => startCall('new', 'Новый пациент')}
                className="w-full flex items-center gap-3 px-4 py-3 bg-gray-50 dark:bg-white/[0.04] hover:bg-gray-100 dark:hover:bg-white/[0.08] border border-gray-200 dark:border-white/10 rounded-xl text-left transition-all"
              >
                <UserPlus className="w-5 h-5 text-text-tertiary" />
                <div>
                  <div className="text-sm font-medium text-text-primary">Новый пациент</div>
                  <div className="text-xs text-text-tertiary">Без истории, агент попросит представиться</div>
                </div>
              </button>
              <button
                onClick={() => startCall('ivan', 'Иван Иванович')}
                className="w-full flex items-center gap-3 px-4 py-3 bg-gray-50 dark:bg-white/[0.04] hover:bg-gray-100 dark:hover:bg-white/[0.08] border border-gray-200 dark:border-white/10 rounded-xl text-left transition-all"
              >
                <User className="w-5 h-5 text-text-tertiary" />
                <div>
                  <div className="text-sm font-medium text-text-primary">Иван Иванович (с историей)</div>
                  <div className="text-xs text-text-tertiary">+7 900 111-11-11 · постоянный пациент</div>
                </div>
              </button>
            </div>
          </>
        )}

        {state === 'connecting' && (
          <div className="py-8 flex flex-col items-center gap-3">
            <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
            <p className="text-sm text-text-tertiary">Соединяемся с агентом{patientLabel ? ` (${patientLabel})` : ''}…</p>
          </div>
        )}

        {state === 'in_call' && (
          <div className="py-4 space-y-4">
            <div className="text-center">
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-50 dark:bg-emerald-500/15 border border-emerald-200 dark:border-emerald-500/25 rounded-full">
                <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                <span className="text-xs text-emerald-700 dark:text-emerald-300 font-medium">В разговоре</span>
              </div>
              <p className="mt-3 text-base font-medium text-text-primary">{patientLabel}</p>
              <div className="mt-3">
                <CallEqualizer room={roomRef.current} />
              </div>
              <p className="text-2xl tabular-nums mt-3 text-text-primary">{mm}:{ss}</p>
            </div>
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={toggleMute}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                  muted
                    ? 'bg-amber-100 dark:bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-500/30'
                    : 'bg-gray-100 dark:bg-white/[0.06] text-text-primary border border-gray-200 dark:border-white/10'
                }`}
              >
                {muted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                {muted ? 'Микрофон выключен' : 'Микрофон включён'}
              </button>
              <button
                onClick={hangUp}
                className="flex items-center gap-2 px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-xl text-sm font-medium shadow-sm"
              >
                <PhoneOff className="w-4 h-4" />
                Положить трубку
              </button>
            </div>
          </div>
        )}

        {state === 'error' && (
          <div className="py-4 space-y-3">
            <div className="p-3 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-xl text-sm text-red-700 dark:text-red-300">
              {errorMsg}
            </div>
            <button
              onClick={() => setState('idle')}
              className="w-full px-4 py-2 bg-gray-100 dark:bg-white/[0.06] hover:bg-gray-200 dark:hover:bg-white/[0.1] text-text-primary rounded-xl text-sm"
            >
              Попробовать снова
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
