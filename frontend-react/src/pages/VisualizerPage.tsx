import { useState, useEffect, useMemo } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { clinicsApi } from '../api/client'
import { ForceGraph3D } from '../components/ForceGraph3D'
import { ChatPlayground } from '../components/ChatPlayground'
import { TraceLog } from '../components/TraceLog'
import type { Clinic, GraphData } from '../types'

export function VisualizerPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const [clinics, setClinics] = useState<Clinic[]>([])
  const [graphData, setGraphData] = useState<GraphData | null>(null)
  const [traceId, setTraceId] = useState<string | null>(null)
  const [graphError, setGraphError] = useState<string | null>(null)
  const [playgroundOpen, setPlaygroundOpen] = useState(false)

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
      .then(setGraphData)
      .catch(() => setGraphError('Failed to load graph'))
  }, [clinicId])

  const activeClinic = useMemo(
    () => clinics.find((c) => c.clinic_id === clinicId),
    [clinics, clinicId],
  )

  return (
    <div className="flex flex-col" style={{ height: 'calc(100vh - 48px)' }}>
      {/* Top bar — clinic info, no dropdown */}
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
        <div className="ml-auto">
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

      {/* Main area: graph + playground side by side */}
      <div className="flex flex-1 min-h-0">
        {/* 3D Graph */}
        <div className="flex-1 relative min-w-0">
          {graphError && (
            <div className="absolute inset-0 flex items-center justify-center text-sm text-red-400 z-10">
              {graphError}
            </div>
          )}
          <ForceGraph3D data={graphData} className="w-full h-full" />
        </div>

        {/* Playground panel */}
        {playgroundOpen && clinicId && (
          <div className="w-80 flex-shrink-0 bg-[#111127] border-l border-[#1e293b] flex flex-col overflow-hidden">
            <ChatPlayground
              clinicId={clinicId}
              onTraceReceived={(id) => setTraceId(id)}
            />
          </div>
        )}
      </div>

      {/* Trace Log — visible when playground is open */}
      {playgroundOpen && (
        <div className="h-[280px] flex-shrink-0 border-t border-[#1e293b]">
          <TraceLog traceId={traceId} />
        </div>
      )}
    </div>
  )
}
