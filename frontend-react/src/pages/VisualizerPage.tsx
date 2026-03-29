import { useState, useEffect, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { clinicsApi } from '../api/client'
import { ForceGraph3D } from '../components/ForceGraph3D'
import { ChatPlayground } from '../components/ChatPlayground'
import { TraceLog } from '../components/TraceLog'
import type { Clinic, GraphData } from '../types'

export function VisualizerPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [clinics, setClinics] = useState<Clinic[]>([])
  const [graphData, setGraphData] = useState<GraphData | null>(null)
  const [traceId, setTraceId] = useState<string | null>(null)
  const [graphError, setGraphError] = useState<string | null>(null)

  const clinicId = searchParams.get('clinic') || ''

  // Load clinics list
  useEffect(() => {
    clinicsApi.list().then(setClinics).catch(() => {})
  }, [])

  // Auto-select first clinic if none in URL
  useEffect(() => {
    if (!clinicId && clinics.length > 0) {
      setSearchParams({ clinic: clinics[0].clinic_id }, { replace: true })
    }
  }, [clinicId, clinics, setSearchParams])

  // Load graph data when clinic changes
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
      {/* Top bar: clinic selector */}
      <div className="flex items-center gap-3 px-4 py-1.5 bg-[#111127] border-b border-[#1e293b] text-xs">
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
      </div>

      {/* Main area: graph + chat */}
      <div className="flex flex-1 min-h-0">
        {/* 3D Graph */}
        <div className="flex-1 relative">
          {graphError && (
            <div className="absolute inset-0 flex items-center justify-center text-sm text-red-400">
              {graphError}
            </div>
          )}
          <ForceGraph3D data={graphData} className="w-full h-full" />
        </div>

        {/* Chat Playground */}
        <div className="w-80 flex-shrink-0">
          {clinicId && (
            <ChatPlayground
              clinicId={clinicId}
              onTraceReceived={(id) => setTraceId(id)}
            />
          )}
        </div>
      </div>

      {/* Trace Log */}
      <div className="h-[300px] flex-shrink-0">
        <TraceLog traceId={traceId} />
      </div>
    </div>
  )
}
