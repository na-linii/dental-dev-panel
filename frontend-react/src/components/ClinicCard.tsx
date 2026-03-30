import { useQuery } from '@tanstack/react-query'
import { clinicsApi } from '../api/client'
import type { Clinic } from '../types'

interface Props {
  clinic: Clinic
  onClick: () => void
}

const DEPLOY_BADGE: Record<string, { bg: string; text: string; label: string }> = {
  not_deployed: { bg: 'bg-[#1e1b4b]', text: 'text-[#a5b4fc]', label: 'NOT DEPLOYED' },
  deploying: { bg: 'bg-[#422006]', text: 'text-[#fbbf24]', label: 'DEPLOYING' },
  deployed: { bg: 'bg-[#052e16]', text: 'text-[#4ade80]', label: 'DEPLOYED' },
  failed: { bg: 'bg-[#450a0a]', text: 'text-[#f87171]', label: 'FAILED' },
}

export function ClinicCard({ clinic, onClick }: Props) {
  const { data: health } = useQuery({
    queryKey: ['health', clinic.id],
    queryFn: () => clinicsApi.health(clinic.id),
    refetchInterval: 30_000,
    retry: 1,
  })

  const isOnline = health?.status === 'ok'
  const deployStatus = (clinic.config?.deploy_status as string) || 'not_deployed'
  const badge = DEPLOY_BADGE[deployStatus] || DEPLOY_BADGE.not_deployed

  return (
    <div
      onClick={onClick}
      className="bg-[#111127] border border-[#1e293b] rounded-xl p-4 cursor-pointer hover:border-[#7dd3fc]/40 transition-colors"
    >
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
            <td className="text-[#64748b] py-0.5 pr-2">Health</td>
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
          <tr>
            <td className="text-[#64748b] py-0.5 pr-2">Deploy</td>
            <td>
              <span
                className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold ${badge.bg} ${badge.text}`}
              >
                {badge.label}
              </span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}
