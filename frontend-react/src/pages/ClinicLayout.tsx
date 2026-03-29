import { useEffect, useState } from 'react'
import { NavLink, Outlet, useParams, useNavigate } from 'react-router-dom'
import { clinicsApi } from '../api/client'
import type { Clinic } from '../types'

export function ClinicLayout() {
  const { clinicId } = useParams<{ clinicId: string }>()
  const navigate = useNavigate()
  const [clinic, setClinic] = useState<Clinic | null>(null)

  useEffect(() => {
    clinicsApi.list().then((clinics) => {
      const c = clinics.find((x) => x.clinic_id === clinicId)
      if (c) setClinic(c)
    })
  }, [clinicId])

  const tabs = [
    { to: '', label: 'Visualizer', end: true },
    { to: 'config', label: 'Config' },
    { to: 'admins', label: 'Administrators' },
  ]

  return (
    <div className="flex flex-col" style={{ height: 'calc(100vh - 48px)' }}>
      {/* Clinic sub-header with tabs */}
      <div className="flex items-center gap-4 px-4 bg-[#0d0d20] border-b border-[#1e293b] flex-shrink-0">
        <button
          onClick={() => navigate('/')}
          className="text-[#64748b] hover:text-white text-xs cursor-pointer py-2"
        >
          ← Clinics
        </button>
        <span className="text-[#1e293b]">|</span>
        <span className="text-white text-sm font-medium">{clinic?.name || clinicId}</span>
        <span className="text-[#64748b] text-xs">{clinicId}</span>

        <div className="flex ml-6">
          {tabs.map((t) => (
            <NavLink
              key={t.to}
              to={t.to}
              end={t.end}
              className={({ isActive }) =>
                `px-4 py-2 text-xs border-b-2 transition-colors ${
                  isActive
                    ? 'text-[#7dd3fc] border-[#7dd3fc]'
                    : 'text-[#64748b] border-transparent hover:text-white'
                }`
              }
            >
              {t.label}
            </NavLink>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div className="flex-1 min-h-0">
        <Outlet />
      </div>
    </div>
  )
}
