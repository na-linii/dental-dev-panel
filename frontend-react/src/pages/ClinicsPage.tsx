import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { clinicsApi } from '../api/client'
import { ClinicCard } from '../components/ClinicCard'

export function ClinicsPage() {
  const navigate = useNavigate()

  const { data: clinics, isLoading } = useQuery({
    queryKey: ['clinics'],
    queryFn: clinicsApi.list,
  })

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h2 className="text-lg font-semibold mb-1">Clinics</h2>
      <p className="text-xs text-[#64748b] mb-4">
        Connected dental clinic agents. Health checks every 30s.
      </p>

      {isLoading && (
        <div className="text-[#64748b] text-sm">Loading clinics...</div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {clinics?.map((c) => (
          <ClinicCard
            key={c.id}
            clinic={c}
            onClick={() => navigate(`/clinic/${c.clinic_id}`)}
          />
        ))}
      </div>

      {clinics && clinics.length === 0 && (
        <div className="text-[#64748b] text-sm mt-4">
          No clinics registered. Add one via API.
        </div>
      )}
    </div>
  )
}
