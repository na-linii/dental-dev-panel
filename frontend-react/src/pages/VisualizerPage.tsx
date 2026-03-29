import { useState, useEffect, useMemo } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { clinicsApi } from '../api/client'
import { ForceGraph3D } from '../components/ForceGraph3D'
import { ChatPlayground } from '../components/ChatPlayground'
import { TraceLog } from '../components/TraceLog'
import type { Clinic, GraphData } from '../types'

export function VisualizerPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const [clinics, setClinics] = useState<Clinic[]>([])
  const [graphData, setGraphData] = useState<GraphData | null>(null)
  const [traceId, setTraceId] = useState<string | null>(null)
  const [graphError, setGraphError] = useState<string | null>(null)
  const [chatOpen, setChatOpen] = useState(false)

  const clinicId = searchParams.get('clinic') || ''

  useEffect(() => {
    clinicsApi.list().then(setClinics).catch(() => {})
  }, [])

  useEffect(() => {
    if (!clinicId && clinics.length > 0) {
      setSearchParams({ clinic: clinics[0].clinic_id }, { replace: true })
    }
  }, [clinicId, clinics, setSearchParams])

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
    <div className="flex flex-col relative" style={{ height: 'calc(100vh - 48px)' }}>
      {/* Top bar */}
      <div className="flex items-center gap-3 px-4 py-1.5 bg-[#111127] border-b border-[#1e293b] text-xs z-10">
        <button
          onClick={() => navigate('/')}
          className="text-[#64748b] hover:text-white cursor-pointer"
        >
          ← Back
        </button>
        <span className="text-[#1e293b]">|</span>
        <label className="text-[#64748b]">Clinic:</label>
        <select
          value={clinicId}
          onChange={(e) => setSearchParams({ clinic: e.target.value })}
          className="bg-[#0a0a1a] border border-[#1e293b] rounded px-2 py-1 text-white text-xs"
        >
          {clinics.map((c) => (
            <option key={c.clinic_id} value={c.clinic_id}>
              {c.name}
            </option>
          ))}
        </select>
        {activeClinic && (
          <span className="text-[#64748b]">
            {activeClinic.server_host}:{activeClinic.server_port}
          </span>
        )}
        <div className="ml-auto">
          <button
            onClick={() => setChatOpen(!chatOpen)}
            className={`px-2.5 py-1 rounded text-[11px] cursor-pointer border ${
              chatOpen
                ? 'bg-[#7dd3fc] text-[#0a0a1a] border-[#7dd3fc]'
                : 'bg-[#111127] text-white border-[#1e293b] hover:bg-[#1e293b]'
            }`}
          >
            {chatOpen ? '✕ Close Chat' : '💬 Chat'}
          </button>
        </div>
      </div>

      {/* Main area: graph takes full space, chat overlays on right */}
      <div className="flex-1 relative min-h-0">
        {/* 3D Graph — always full width */}
        <div className="absolute inset-0">
          {graphError && (
            <div className="absolute inset-0 flex items-center justify-center text-sm text-red-400 z-10">
              {graphError}
            </div>
          )}
          <ForceGraph3D data={graphData} className="w-full h-full" />
        </div>

        {/* Chat Playground — overlay panel, doesn't affect graph layout */}
        {chatOpen && clinicId && (
          <div className="absolute top-0 right-0 w-80 h-full bg-[#111127] border-l border-[#1e293b] z-20 flex flex-col">
            <ChatPlayground
              clinicId={clinicId}
              onTraceReceived={(id) => setTraceId(id)}
            />
          </div>
        )}
      </div>

      {/* Trace Log — always at bottom */}
      {traceId && (
        <div className="h-[280px] flex-shrink-0 border-t border-[#1e293b]">
          <TraceLog traceId={traceId} />
        </div>
      )}
    </div>
  )
}
