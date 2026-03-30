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
      <p className="text-xs text-[#64748b] mb-5">
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

        {/* Add clinic card — same size as clinic cards, in the grid */}
        <div
          onClick={() => navigate('/clinics/new')}
          className="bg-[#111127] border border-dashed border-[#2a2a4a] rounded-xl p-5 cursor-pointer hover:border-[#818cf8]/50 hover:bg-[#111130] transition-colors flex flex-col items-center justify-center min-h-[160px]"
        >
          <div className="w-10 h-10 rounded-full bg-[#1e1e3a] flex items-center justify-center mb-2">
            <span className="text-[#818cf8] text-xl font-light">+</span>
          </div>
          <span className="text-[#64748b] text-xs">Add Clinic</span>
        </div>
      </div>
    </div>
  )
}
