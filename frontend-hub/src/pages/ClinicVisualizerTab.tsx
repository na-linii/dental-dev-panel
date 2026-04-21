import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { clinicsApi, tracesApi, settingsApi } from '../api/client'
import { ForceGraph3D } from '../components/ForceGraph3D'
import type { ForceGraph3DHandle } from '../components/ForceGraph3D'
import { ChatPlayground } from '../components/ChatPlayground'
import { TraceLog, buildAnimPath, initAnimGraph } from '../components/TraceLog'
import { VizLegend } from '../components/VizLegend'
import type { GraphData } from '../types'
import type { VizConfigEntry } from '../types'

const ANIM_COLORS = ['#7dd3fc', '#facc15', '#4ade80', '#c084fc', '#fb923c', '#f472b6']

type Mode = 'live' | 'replay'

export function ClinicVisualizerTab() {
  const { clinicId } = useParams<{ clinicId: string }>()
  const [graphData, setGraphData] = useState<GraphData | null>(null)
  const [graphError, setGraphError] = useState<string | null>(null)
  const [vizConfig, setVizConfig] = useState<Record<string, VizConfigEntry>>({})
  const [playgroundOpen, setPlaygroundOpen] = useState(false)
  const [traceLogOpen, setTraceLogOpen] = useState(false)
  const [mode, setMode] = useState<Mode>('live')
  const [replayTraceId, setReplayTraceId] = useState<string | null>(null)

  const graphRef = useRef<ForceGraph3DHandle>(null)
  const lastAnimatedRef = useRef<Set<string>>(new Set())
  const initialLoadDoneRef = useRef(false)

  useEffect(() => {
    if (!clinicId) return
    setGraphData(null)
    setGraphError(null)

    // Load DB vizConfig first, then merge with graph data (DB takes priority)
    let dbVizConfig: Record<string, VizConfigEntry> = {}

    settingsApi.getVizConfig()
      .then((dbConfig) => {
        if (Object.keys(dbConfig).length > 0) {
          dbVizConfig = dbConfig
        }
      })
      .catch(() => {})
      .finally(() => {
        clinicsApi
          .graph(clinicId)
          .then((data) => {
            initAnimGraph(data.nodes || [], data.links || [])
            // Merge: DB config takes priority over graph meta viz_config
            const graphVc = data.meta?.viz_config || {}
            const merged = { ...graphVc, ...dbVizConfig }
            if (Object.keys(merged).length > 0) {
              setVizConfig(merged)
              // Also apply merged config to graph data for ForceGraph3D
              data = { ...data, meta: { ...data.meta, viz_config: merged } }
            }
            setGraphData(data)
          })
          .catch(() => setGraphError('Failed to load graph'))
      })
  }, [clinicId])

  const { data: traces, isError: tracesError } = useQuery({
    queryKey: ['live-traces', clinicId],
    queryFn: () => tracesApi.list(clinicId!),
    refetchInterval: 5000,
    enabled: !!clinicId && mode === 'live',
  })

  const { data: health } = useQuery({
    queryKey: ['clinic-health', clinicId],
    queryFn: () => clinicsApi.health(clinicId!),
    refetchInterval: 15000,
    enabled: !!clinicId,
  })

  const isOnline = health?.status === 'ok'

  useEffect(() => {
    if (mode !== 'live' || !traces || !graphRef.current) return
    if (!initialLoadDoneRef.current) {
      initialLoadDoneRef.current = true
      for (const trace of traces) lastAnimatedRef.current.add(trace.id)
      return
    }
    for (const trace of traces) {
      if (lastAnimatedRef.current.has(trace.id)) continue
      if (!trace.latency) continue
      lastAnimatedRef.current.add(trace.id)
      const colorIdx = trace.userId
        ? Math.abs(trace.userId.split('').reduce((a: number, c: string) => a + c.charCodeAt(0), 0)) % ANIM_COLORS.length
        : 0
      tracesApi.detail(clinicId!, trace.id).then((data) => {
        const path = buildAnimPath(data.flow)
        if (path.length > 0 && graphRef.current) {
          graphRef.current.animateFlow(path, 1, ANIM_COLORS[colorIdx])
        }
      }).catch(() => {})
    }
  }, [traces, mode, clinicId])

  const handleReplay = useCallback(async (traceId: string, replaySpeed: number) => {
    if (!graphRef.current || !clinicId) return
    setMode('replay')
    setReplayTraceId(traceId)
    try {
      const data = await tracesApi.detail(clinicId, traceId)
      const path = buildAnimPath(data.flow)
      if (path.length > 0) {
        graphRef.current.animateFlow(path, replaySpeed, '#7dd3fc')
        const totalDur = path.reduce((sum, s) => sum + Math.max(s.dur / replaySpeed, 100), 0)
        setTimeout(() => { setMode('live'); setReplayTraceId(null) }, totalDur + 500)
      } else { setMode('live'); setReplayTraceId(null) }
    } catch { setMode('live'); setReplayTraceId(null) }
  }, [clinicId])

  return (
    <div className="flex flex-col h-full">
      {/* Controls bar */}
      <div className="flex items-center justify-end gap-1.5 px-4 py-1.5 bg-[#111127] border-b border-[#1e293b] flex-shrink-0">
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

      {/* Main area */}
      <div className="flex flex-1 min-h-0">
        <div className="flex-1 relative min-w-0">
          {/* Legend — always visible */}
          <VizLegend
            vizConfig={vizConfig}
            onConfigChange={(newConfig) => {
              setVizConfig(newConfig)
              // Update graphData so ForceGraph3D re-renders with new colors
              if (graphData) {
                setGraphData({
                  ...graphData,
                  meta: { ...graphData.meta, viz_config: newConfig },
                })
              }
            }}
          />
          <div className="absolute top-3 right-3 z-10 px-2.5 py-1 rounded-md text-[11px] font-medium"
            style={{
              background: 'rgba(0,0,0,0.7)',
              color: mode === 'replay'
                ? '#facc15'
                : isOnline
                  ? (tracesError ? '#fb923c' : '#4ade80')
                  : '#f87171',
              border: `1px solid ${
                mode === 'replay'
                  ? '#facc1540'
                  : isOnline
                    ? (tracesError ? '#fb923c40' : '#4ade8040')
                    : '#f8717140'
              }`,
            }}
          >
            {mode === 'replay'
              ? `▶ REPLAY ${replayTraceId?.slice(0, 8)}...`
              : isOnline
                ? (tracesError ? '⚠ LIVE (traces error)' : '● LIVE')
                : '● OFFLINE'}
          </div>
          {/* Version badge */}
          {graphData?.meta?.version && (
            <div className="absolute bottom-3 left-3 z-10 px-2.5 py-1 rounded-md text-[11px] font-medium"
              style={{ background: 'rgba(0,0,0,0.7)', color: '#64748b', border: '1px solid rgba(100,116,139,0.2)' }}
            >
              DentalCORE v{graphData.meta.version}
            </div>
          )}
          {graphError && (
            <div className="absolute inset-0 flex items-center justify-center text-sm text-red-400 z-10">{graphError}</div>
          )}
          <ForceGraph3D ref={graphRef} data={graphData} className="w-full h-full" />
        </div>
        {playgroundOpen && clinicId && (
          <div className="w-80 flex-shrink-0 border-l border-[#1e293b] flex flex-col overflow-hidden">
            <ChatPlayground clinicId={clinicId} />
          </div>
        )}
      </div>

      {traceLogOpen && clinicId && (
        <div className="h-[280px] flex-shrink-0 border-t border-[#1e293b]">
          <TraceLog clinicId={clinicId} onReplay={handleReplay} />
        </div>
      )}
    </div>
  )
}
