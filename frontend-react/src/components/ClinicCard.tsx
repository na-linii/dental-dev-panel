import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { clinicsApi } from '../api/client'
import type { Clinic } from '../types'

interface Props {
  clinic: Clinic
  onOpenViz: (clinicId: string) => void
}

export function ClinicCard({ clinic, onOpenViz }: Props) {
  const [showConfig, setShowConfig] = useState(false)

  const { data: health } = useQuery({
    queryKey: ['health', clinic.id],
    queryFn: () => clinicsApi.health(clinic.id),
    refetchInterval: 30_000,
    retry: 1,
  })

  const { data: config } = useQuery({
    queryKey: ['config', clinic.id],
    queryFn: () => clinicsApi.config(clinic.id),
    enabled: showConfig,
  })

  const isOnline = health?.status === 'ok'

  return (
    <div className="bg-[#111127] border border-[#1e293b] rounded-xl p-4">
      <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
        <span
          className={`w-2 h-2 rounded-full ${isOnline ? 'bg-[#4ade80]' : 'bg-[#f87171]'}`}
        />
        {clinic.name}
      </h3>

      <table className="w-full text-xs">
        <tbody>
          <tr>
            <td className="text-[#64748b] py-0.5 pr-2">ID</td>
            <td>{clinic.clinic_id}</td>
          </tr>
          <tr>
            <td className="text-[#64748b] py-0.5 pr-2">Server</td>
            <td>{clinic.server_host}:{clinic.server_port}</td>
          </tr>
          <tr>
            <td className="text-[#64748b] py-0.5 pr-2">Status</td>
            <td>
              <span
                className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                  isOnline
                    ? 'bg-[#052e16] text-[#4ade80]'
                    : 'bg-[#450a0a] text-[#f87171]'
                }`}
              >
                {isOnline ? 'ONLINE' : 'OFFLINE'}
              </span>
            </td>
          </tr>
        </tbody>
      </table>

      <div className="flex gap-1.5 mt-3">
        <button
          onClick={() => setShowConfig(!showConfig)}
          className="px-2.5 py-1 rounded border border-[#1e293b] bg-[#111127] text-white text-[11px] cursor-pointer hover:bg-[#1e293b]"
        >
          {showConfig ? 'Hide Config' : 'Config'}
        </button>
        <button
          onClick={() => onOpenViz(clinic.id)}
          className="px-2.5 py-1 rounded bg-[#7dd3fc] text-[#0a0a1a] text-[11px] font-semibold cursor-pointer border border-[#7dd3fc]"
        >
          Open Visualizer
        </button>
      </div>

      {showConfig && config && (
        <pre className="mt-2 p-2 bg-[#0a0a1a] border border-[#1e293b] rounded text-[10px] text-[#94a3b8] overflow-auto max-h-48">
          {JSON.stringify(config, null, 2)}
        </pre>
      )}
    </div>
  )
}
