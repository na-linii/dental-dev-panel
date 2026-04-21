import { useQuery } from '@tanstack/react-query'
import { clinicsApi } from '../api/client'
import type { Clinic } from '../types'

interface Props {
  clinic: Clinic
  onClick: () => void
}

export function ClinicCard({ clinic, onClick }: Props) {
  const { data: health, isLoading: healthLoading } = useQuery({
    queryKey: ['health', clinic.id],
    queryFn: () => clinicsApi.health(clinic.id),
    refetchInterval: 30_000,
    retry: 1,
  })

  const isOnline = health?.status === 'ok'
  const isChecking = healthLoading && !health

  // deploy_status comes from DB column, not config JSONB
  const deployStatus = (clinic as unknown as Record<string, unknown>).deploy_status as string || 'not_deployed'

  return (
    <div
      onClick={onClick}
      className="bg-[#111127] border border-[#1e293b] rounded-xl p-5 cursor-pointer hover:border-[#7dd3fc]/40 transition-colors flex flex-col"
    >
      {/* Header: name + status dot */}
      <div className="flex items-center gap-2.5 mb-3">
        <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${
          isChecking ? 'bg-[#facc15] animate-pulse' : isOnline ? 'bg-[#4ade80]' : 'bg-[#f87171]'
        }`} />
        <h3 className="text-sm font-semibold text-white truncate">{clinic.name}</h3>
      </div>

      {/* Info rows */}
      <div className="space-y-1.5 text-xs mb-3 flex-1">
        <div className="flex justify-between">
          <span className="text-[#64748b]">ID</span>
          <span className="text-[#cbd5e1] font-mono">{clinic.clinic_id}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-[#64748b]">Server</span>
          <span className="text-[#cbd5e1] font-mono">{clinic.server_host}:{clinic.server_port}</span>
        </div>
      </div>

      {/* Badges row */}
      <div className="flex items-center gap-2">
        {/* Health badge */}
        <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
          isChecking
            ? 'bg-[#422006] text-[#fbbf24]'
            : isOnline
              ? 'bg-[#052e16] text-[#4ade80]'
              : 'bg-[#450a0a] text-[#f87171]'
        }`}>
          {isChecking ? 'CHECKING...' : isOnline ? 'ONLINE' : 'OFFLINE'}
        </span>

        {/* Deploy badge */}
        <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
          deployStatus === 'deployed' ? 'bg-[#052e16] text-[#4ade80]' :
          deployStatus === 'deploying' ? 'bg-[#422006] text-[#fbbf24]' :
          deployStatus === 'failed' ? 'bg-[#450a0a] text-[#f87171]' :
          'bg-[#1e1b4b] text-[#a5b4fc]'
        }`}>
          {deployStatus === 'deployed' ? 'DEPLOYED' :
           deployStatus === 'deploying' ? 'DEPLOYING' :
           deployStatus === 'failed' ? 'FAILED' :
           'NOT DEPLOYED'}
        </span>
      </div>
    </div>
  )
}
