import { useEffect, useMemo, useRef, useState } from 'react'
import { Phone, PhoneOff, Mic, MicOff, User, UserPlus, Loader2, Trash2, X } from 'lucide-react'
import { Room, RoomEvent, Track } from 'livekit-client'
import type { RemoteTrack, RemoteTrackPublication, RemoteParticipant } from 'livekit-client'
import {
  clearDemoState,
  createDemoVoiceRoom,
  getDemoPatients,
  type AdminUser,
  type DemoPatient,
} from '../api/client'

// 5-bar live equalizer driven by WebAudio AnalyserNode on both mic and agent
// audio tracks. participant.audioLevel in livekit-client v2 doesn't update for
// remote participants reliably, so we tap MediaStreamTrack ourselves.
// Animates via requestAnimationFrame + refs (no React state per-frame).
function CallEqualizer({ room }: { room: Room | null }) {
  const barRefs = useRef<(HTMLDivElement | null)[]>([null, null, null, null, null])
  const labelRef = useRef<HTMLSpanElement | null>(null)
  const wrapRef = useRef<HTMLDivElement | null>(null)
  // Hysteresis state shared across animation frames.
  const active = useRef<'local' | 'remote' | null>(null)
  const candidate = useRef<'local' | 'remote' | null>(null)
  const lastSwitchAt = useRef(0)
  const lastActiveAt = useRef(0)

  useEffect(() => {
    if (!room) return
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    if (!AC) return
    const ctx = new AC()
    let cancelled = false

    type AnalyserPair = {
      analyser: AnalyserNode
      buffer: Uint8Array<ArrayBuffer>
      stream: MediaStream
      source: MediaStreamAudioSourceNode
    }
    const localPair = { current: null as AnalyserPair | null }
    const remotePair = { current: null as AnalyserPair | null }

    function makeAnalyser(track: MediaStreamTrack): AnalyserPair {
      const stream = new MediaStream([track])
      const source = ctx.createMediaStreamSource(stream)
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 64
      analyser.smoothingTimeConstant = 0.6
      source.connect(analyser)
      return {
        analyser,
        buffer: new Uint8Array(analyser.frequencyBinCount) as Uint8Array<ArrayBuffer>,
        stream,
        source,
      }
    }

    function attachLocal() {
      const pub = room!.localParticipant.getTrackPublication(Track.Source.Microphone)
      const track = pub?.track?.mediaStreamTrack
      if (track && !localPair.current) localPair.current = makeAnalyser(track)
    }

    function attachRemote(track: RemoteTrack) {
      if (track.kind !== Track.Kind.Audio) return
      const mst = track.mediaStreamTrack
      if (mst && !remotePair.current) remotePair.current = makeAnalyser(mst)
    }

    // pick up tracks that exist NOW
    attachLocal()
    for (const p of room.remoteParticipants.values()) {
      for (const pub of p.audioTrackPublications.values()) {
        if (pub.track) attachRemote(pub.track as RemoteTrack)
      }
    }

    const onSubscribed = (track: RemoteTrack) => attachRemote(track)
    const onLocalPublished = () => attachLocal()
    room.on(RoomEvent.TrackSubscribed, onSubscribed)
    room.on(RoomEvent.LocalTrackPublished, onLocalPublished)

    function rmsFromFreqData(buf: Uint8Array<ArrayBuffer>): number {
      let sum = 0
      for (let i = 0; i < buf.length; i++) sum += (buf[i] / 255) ** 2
      return Math.sqrt(sum / buf.length)
    }

    function bandAverage(buf: Uint8Array<ArrayBuffer>, idx: number, total = 5): number {
      const chunk = Math.max(1, Math.floor(buf.length / total))
      const start = idx * chunk
      const end = Math.min(buf.length, start + chunk)
      let sum = 0
      for (let i = start; i < end; i++) sum += buf[i]
      return sum / (end - start) / 255
    }

    let frame = 0
    function loop() {
      if (cancelled) return
      frame = requestAnimationFrame(loop)
      let localRms = 0
      let remoteRms = 0
      if (localPair.current) {
        localPair.current.analyser.getByteFrequencyData(localPair.current.buffer)
        localRms = rmsFromFreqData(localPair.current.buffer)
      }
      if (remotePair.current) {
        remotePair.current.analyser.getByteFrequencyData(remotePair.current.buffer)
        remoteRms = rmsFromFreqData(remotePair.current.buffer)
      }
      // Hysteresis: don't flip the active speaker on every frame. Only switch
      // to a new speaker after they've been clearly louder for >= 350ms; and
      // hold the previous active speaker for at least 500ms after they go
      // silent so a half-second pause doesn't trigger "Тишина" mid-sentence.
      const now = performance.now()
      if (localRms > remoteRms * 1.4 && localRms > 0.05) {
        candidate.current = 'local'
        if (lastSwitchAt.current === 0) lastSwitchAt.current = now
        if (active.current !== 'local' && now - lastSwitchAt.current > 350) {
          active.current = 'local'
          lastActiveAt.current = now
        }
      } else if (remoteRms > localRms * 1.2 && remoteRms > 0.05) {
        candidate.current = 'remote'
        if (lastSwitchAt.current === 0) lastSwitchAt.current = now
        if (active.current !== 'remote' && now - lastSwitchAt.current > 350) {
          active.current = 'remote'
          lastActiveAt.current = now
        }
      } else {
        // Both quiet — keep current active speaker, but go to 'idle' after 500ms.
        lastSwitchAt.current = 0
        if (active.current && now - lastActiveAt.current > 500) {
          active.current = null
        }
      }
      // Update lastActive while the current speaker is still loud-ish.
      if (active.current === 'local' && localRms > 0.04) lastActiveAt.current = now
      if (active.current === 'remote' && remoteRms > 0.04) lastActiveAt.current = now

      const youSpeaking = active.current === 'local'
      const agentSpeaking = active.current === 'remote'
      const activePair = youSpeaking
        ? localPair.current
        : agentSpeaking
          ? remotePair.current
          : null
      const palette = youSpeaking
        ? '#10b981' // emerald-500
        : agentSpeaking
          ? '#38bdf8' // sky-400
          : 'rgba(120,120,130,0.35)'
      for (let i = 0; i < 5; i++) {
        const bar = barRefs.current[i]
        if (!bar) continue
        const v = activePair ? bandAverage(activePair.buffer, i) : 0
        const noise = activePair ? 0 : 0.05 + Math.sin(performance.now() / 350 + i) * 0.02
        const h = Math.min(1, Math.max(0.08, v * 1.4 + noise))
        bar.style.height = `${Math.round(h * 100)}%`
        bar.style.background = palette
      }
      if (labelRef.current) {
        labelRef.current.textContent = youSpeaking
          ? 'Вы говорите'
          : agentSpeaking
            ? 'Агент говорит'
            : 'Тишина'
      }
    }
    loop()

    return () => {
      cancelled = true
      cancelAnimationFrame(frame)
      room.off(RoomEvent.TrackSubscribed, onSubscribed)
      room.off(RoomEvent.LocalTrackPublished, onLocalPublished)
      void ctx.close()
    }
  }, [room])

  return (
    <div ref={wrapRef} className="flex flex-col items-center gap-1.5">
      <div className="flex gap-1 items-end h-10">
        {[0, 1, 2, 3, 4].map((i) => (
          <div
            key={i}
            ref={(el) => {
              barRefs.current[i] = el
            }}
            className="w-1.5 rounded-full"
            style={{ height: '8%', background: 'rgba(120,120,130,0.35)' }}
          />
        ))}
      </div>
      <span ref={labelRef} className="text-[11px] text-text-tertiary tabular-nums">
        Тишина
      </span>
    </div>
  )
}

const DEMO_CLINIC_ID = 'starsmile_demo'

// Everyone inside the demo clinic gets the button regardless of role.
// The backend repeats the same check (and additionally honours the
// DEMO_VOICE_ENABLED kill switch on hub-api).
export function isDemoVoiceAllowed(user: AdminUser | null): boolean {
  return Boolean(user) && user!.clinic_id === DEMO_CLINIC_ID
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
  const [patients, setPatients] = useState<DemoPatient[]>([])
  const [clearing, setClearing] = useState(false)
  const [clearResult, setClearResult] = useState<string | null>(null)
  const [audioBlocked, setAudioBlocked] = useState(false)

  useEffect(() => {
    let alive = true
    getDemoPatients()
      .then((p) => {
        if (alive) setPatients(p)
      })
      .catch(() => {
        if (alive) setPatients([])
      })
    return () => {
      alive = false
    }
  }, [])

  async function handleClear() {
    if (!window.confirm('Удалить ВСЕ звонки, переписку и сессии демо-клиники? Mock-пациенты останутся.')) return
    setClearing(true)
    setClearResult(null)
    try {
      const res = await clearDemoState()
      const total = Object.values(res.deleted).reduce((a, b) => a + b, 0)
      setClearResult(`Удалено записей: ${total} (${Object.entries(res.deleted).map(([k, v]) => `${k}=${v}`).join(', ')})`)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setClearResult(`Ошибка: ${msg}`)
    } finally {
      setClearing(false)
    }
  }

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

  async function startCall(choice: 'new' | 'existing', patientKey: string | null, label: string) {
    setErrorMsg(null)
    setPatientLabel(label)
    setState('connecting')
    try {
      const body =
        choice === 'new' || !patientKey
          ? { patient_choice: 'new' as const }
          : { patient_choice: 'existing' as const, patient_key: patientKey }
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
          el.play().catch(() => {
            /* autoplay blocked — surfaced via AudioPlaybackStatusChanged */
          })
          console.info('[demo-voice] agent audio track subscribed, canPlaybackAudio=', room.canPlaybackAudio)
        }
      })
      // Chrome blocks autoplay of remote audio when play() runs outside a user
      // gesture (the TrackSubscribed handler is async). LiveKit raises this
      // event when playback is blocked; recover via room.startAudio() from a
      // click. Without this the agent's voice is silently never heard.
      room.on(RoomEvent.AudioPlaybackStatusChanged, () => {
        setAudioBlocked(!room.canPlaybackAudio)
      })
      room.on(RoomEvent.Disconnected, () => {
        setState('idle')
        setRoomName(null)
        setStartedAt(null)
        setAudioBlocked(false)
      })

      await room.connect(res.livekit_url, res.token)
      await room.localParticipant.setMicrophoneEnabled(true)
      // Best-effort: unblock audio while the originating click may still count
      // as a user gesture. If too late, the "включить звук" button appears.
      try {
        await room.startAudio()
      } catch {
        /* startAudio needs a fresh gesture — handled by the in-call button */
      }
      setAudioBlocked(!room.canPlaybackAudio)
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
    setAudioBlocked(false)
  }

  async function unblockAudio() {
    const room = roomRef.current
    if (!room) return
    try {
      await room.startAudio()
      await audioElRef.current?.play()
    } catch {
      /* ignore — user can tap again */
    }
    setAudioBlocked(!room.canPlaybackAudio)
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
            <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-1">
              <button
                onClick={() => startCall('new', null, 'Новый пациент')}
                className="w-full flex items-center gap-3 px-4 py-3 bg-gray-50 dark:bg-white/[0.04] hover:bg-gray-100 dark:hover:bg-white/[0.08] border border-gray-200 dark:border-white/10 rounded-xl text-left transition-all"
              >
                <UserPlus className="w-5 h-5 text-text-tertiary" />
                <div>
                  <div className="text-sm font-medium text-text-primary">Новый пациент</div>
                  <div className="text-xs text-text-tertiary">Без истории, агент попросит представиться</div>
                </div>
              </button>
              {patients.map((p) => (
                <button
                  key={p.key}
                  onClick={() => startCall('existing', p.key, p.name)}
                  className="w-full flex items-center gap-3 px-4 py-3 bg-gray-50 dark:bg-white/[0.04] hover:bg-gray-100 dark:hover:bg-white/[0.08] border border-gray-200 dark:border-white/10 rounded-xl text-left transition-all"
                >
                  <User className="w-5 h-5 text-text-tertiary shrink-0" />
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-text-primary truncate">{p.name}</div>
                    <div className="text-xs text-text-tertiary truncate">
                      +{p.phone.slice(0, 1)} {p.phone.slice(1, 4)} {p.phone.slice(4, 7)}-{p.phone.slice(7, 9)}-{p.phone.slice(9)}
                      {p.note ? ` · ${p.note}` : ''}
                    </div>
                  </div>
                </button>
              ))}
            </div>
            <div className="mt-4 pt-3 border-t border-gray-200 dark:border-white/10 space-y-2">
              <button
                onClick={handleClear}
                disabled={clearing}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-all disabled:opacity-50"
              >
                <Trash2 className="w-3.5 h-3.5" />
                {clearing ? 'Очищаю…' : 'Очистить демо-данные (звонки + переписку)'}
              </button>
              {clearResult && (
                <div className="text-[11px] text-text-tertiary text-center">{clearResult}</div>
              )}
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
            {audioBlocked && (
              <button
                onClick={unblockAudio}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-sm font-semibold shadow-sm animate-pulse"
              >
                🔊 Нажмите, чтобы включить звук агента
              </button>
            )}
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
