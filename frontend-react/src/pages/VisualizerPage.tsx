import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { clinicsApi, tracesApi } from '../api/client'
import { ForceGraph3D } from '../components/ForceGraph3D'
import type { ForceGraph3DHandle } from '../components/ForceGraph3D'
import { ChatPlayground } from '../components/ChatPlayground'
import { TraceLog, buildAnimPath, setGraphNodes } from '../components/TraceLog'
import type { Clinic, GraphData } from '../types'

const ANIM_COLORS = ['#7dd3fc', '#facc15', '#4ade80', '#c084fc', '#fb923c', '#f472b6']

type Mode = 'live' | 'replay'

export function VisualizerPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const [clinics, setClinics] = useState<Clinic[]>([])
  const [graphData, setGraphData] = useState<GraphData | null>(null)
  const [graphError, setGraphError] = useState<string | null>(null)
  const [playgroundOpen, setPlaygroundOpen] = useState(false)
  const [traceLogOpen, setTraceLogOpen] = useState(false)
  const [mode, setMode] = useState<Mode>('live')
  const [replayTraceId, setReplayTraceId] = useState<string | null>(null)

  const graphRef = useRef<ForceGraph3DHandle>(null)
  const lastAnimatedRef = useRef<Set<string>>(new Set())
  const initialLoadDoneRef = useRef(false)

  const clinicId = searchParams.get('clinic') || ''

  useEffect(() => {
    clinicsApi.list().then(setClinics).catch(() => {})
  }, [])

  useEffect(() => {
    if (!clinicId) return
    setGraphData(null)
    setGraphError(null)
    clinicsApi
      .graph(clinicId)
      .then((data) => { setGraphNodes(data.nodes || []); setGraphData(data) })
      .catch(() => setGraphError('Failed to load graph'))
  }, [clinicId])

  const activeClinic = useMemo(
    () => clinics.find((c) => c.clinic_id === clinicId),
    [clinics, clinicId],
  )

  // Poll traces for LIVE mode
  const { data: traces } = useQuery({
    queryKey: ['live-traces', clinicId],
    queryFn: () => tracesApi.list(clinicId),
    refetchInterval: 5000,
    enabled: !!clinicId && mode === 'live',
  })

  // LIVE mode: animate only NEW traces (not existing ones on page load)
  useEffect(() => {
    if (mode !== 'live' || !traces || !graphRef.current) return

    // First load: mark all existing traces as "seen", don't animate them
    if (!initialLoadDoneRef.current) {
      initialLoadDoneRef.current = true
      for (const trace of traces) {
        lastAnimatedRef.current.add(trace.id)
      }
      return
    }

    for (const trace of traces) {
      if (lastAnimatedRef.current.has(trace.id)) continue
      if (!trace.latency) continue // trace still running, skip

      lastAnimatedRef.current.add(trace.id)

      // Assign color based on userId hash
      const colorIdx = trace.userId
        ? Math.abs(trace.userId.split('').reduce((a: number, c: string) => a + c.charCodeAt(0), 0)) % ANIM_COLORS.length
        : 0

      // Fetch detail and animate
      tracesApi.detail(clinicId, trace.id).then((data) => {
        const path = buildAnimPath(data.flow)
        if (path.length > 0 && graphRef.current) {
          graphRef.current.animateFlow(path, 1, ANIM_COLORS[colorIdx])  // LIVE = real time (1x)
        }
      }).catch(() => {})
    }
  }, [traces, mode, clinicId])

  // REPLAY mode — speed comes from TraceLog
  const handleReplay = useCallback(async (traceId: string, replaySpeed: number) => {
    if (!graphRef.current) return
    setMode('replay')
    setReplayTraceId(traceId)

    try {
      const data = await tracesApi.detail(clinicId, traceId)
      const path = buildAnimPath(data.flow)
      if (path.length > 0) {
        graphRef.current.animateFlow(path, replaySpeed, '#7dd3fc')
        // Return to LIVE after animation
        const totalDur = path.reduce((sum, s) => sum + Math.max(s.dur / replaySpeed, 100), 0)
        setTimeout(() => {
          setMode('live')
          setReplayTraceId(null)
        }, totalDur + 500)
      } else {
        setMode('live')
        setReplayTraceId(null)
      }
    } catch {
      setMode('live')
      setReplayTraceId(null)
    }
  }, [clinicId])

  return (
    <div className="flex flex-col" style={{ height: 'calc(100vh - 48px)' }}>
      {/* Top bar */}
      <div className="flex items-center gap-3 px-4 py-1.5 bg-[#111127] border-b border-[#1e293b] text-xs flex-shrink-0">
        <button
          onClick={() => navigate('/')}
          className="text-[#64748b] hover:text-white cursor-pointer"
        >
          ← Back
        </button>
        <span className="text-[#1e293b]">|</span>
        {activeClinic ? (
          <>
            <span className="text-white font-medium">{activeClinic.name}</span>
            <span className="text-[#64748b]">{activeClinic.clinic_id}</span>
            <span className="text-[#64748b]">{activeClinic.server_host}:{activeClinic.server_port}</span>
          </>
        ) : (
          <span className="text-[#64748b]">{clinicId}</span>
        )}

        <div className="ml-auto flex items-center gap-1.5">
          {/* Trace Log toggle */}
          <button
            onClick={() => setTraceLogOpen(!traceLogOpen)}
            className={`px-2.5 py-1 rounded text-[11px] cursor-pointer border ${
              traceLogOpen
                ? 'bg-[#7dd3fc] text-[#0a0a1a] border-[#7dd3fc]'
                : 'bg-[#111127] text-white border-[#1e293b] hover:bg-[#1e293b]'
            }`}
          >
            {traceLogOpen ? '✕ Trace Log' : '📋 Trace Log'}
          </button>
          {/* Playground toggle */}
          <button
            onClick={() => setPlaygroundOpen(!playgroundOpen)}
            className={`px-2.5 py-1 rounded text-[11px] cursor-pointer border ${
              playgroundOpen
                ? 'bg-[#7dd3fc] text-[#0a0a1a] border-[#7dd3fc]'
                : 'bg-[#111127] text-white border-[#1e293b] hover:bg-[#1e293b]'
            }`}
          >
            {playgroundOpen ? '✕ Playground' : '💬 Playground'}
          </button>
        </div>
      </div>

      {/* Main area */}
      <div className="flex flex-1 min-h-0">
        {/* 3D Graph */}
        <div className="flex-1 relative min-w-0">
          {/* Mode indicator */}
          <div className="absolute top-3 left-3 z-10 px-2.5 py-1 rounded-md text-[11px] font-medium"
            style={{
              background: 'rgba(0,0,0,0.7)',
              color: mode === 'live' ? '#4ade80' : '#facc15',
              border: `1px solid ${mode === 'live' ? '#4ade8040' : '#facc1540'}`,
            }}
          >
            {mode === 'live' ? '🟢 LIVE' : `▶ REPLAY ${replayTraceId?.slice(0, 8)}...`}
          </div>

          {graphError && (
            <div className="absolute inset-0 flex items-center justify-center text-sm text-red-400 z-10">
              {graphError}
            </div>
          )}
          <ForceGraph3D ref={graphRef} data={graphData} className="w-full h-full" />
        </div>

        {/* Playground panel */}
        {playgroundOpen && clinicId && (
          <div className="w-80 flex-shrink-0 border-l border-[#1e293b] flex flex-col overflow-hidden">
            <ChatPlayground clinicId={clinicId} />
          </div>
        )}
      </div>

      {/* Trace Log */}
      {traceLogOpen && clinicId && (
        <div className="h-[280px] flex-shrink-0 border-t border-[#1e293b]">
          <TraceLog clinicId={clinicId} onReplay={handleReplay} />
        </div>
      )}
    </div>
  )
}
