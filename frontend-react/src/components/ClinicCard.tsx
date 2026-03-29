import { useQuery } from '@tanstack/react-query'
import { clinicsApi } from '../api/client'
import type { Clinic } from '../types'

interface Props {
  clinic: Clinic
  onClick: () => void
}

export function ClinicCard({ clinic, onClick }: Props) {
  const { data: health } = useQuery({
    queryKey: ['health', clinic.id],
    queryFn: () => clinicsApi.health(clinic.id),
    refetchInterval: 30_000,
    retry: 1,
  })

  const isOnline = health?.status === 'ok'

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
    </div>
  )
}
