import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { clinicsApi } from '../api/client'
import { ClinicCard } from '../components/ClinicCard'

function toSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9а-яё]+/gi, '_')
    .replace(/^_|_$/g, '')
}

export function ClinicsPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [showModal, setShowModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [name, setName] = useState('')
  const [clinicId, setClinicId] = useState('')
  const [serverHost, setServerHost] = useState('')
  const [serverPort, setServerPort] = useState(8080)
  const [slugManual, setSlugManual] = useState(false)

  const { data: clinics, isLoading } = useQuery({
    queryKey: ['clinics'],
    queryFn: clinicsApi.list,
  })

  function resetForm() {
    setName('')
    setClinicId('')
    setServerHost('')
    setServerPort(8080)
    setSlugManual(false)
    setError('')
  }

  function openModal() {
    resetForm()
    setShowModal(true)
  }

  function handleNameChange(val: string) {
    setName(val)
    if (!slugManual) {
      setClinicId(toSlug(val))
    }
  }

  function handleClinicIdChange(val: string) {
    setSlugManual(true)
    setClinicId(val)
  }

  async function handleSave() {
    if (!name.trim() || !clinicId.trim() || !serverHost.trim()) {
      setError('Name, Clinic ID, and Server host are required')
      return
    }

    setSaving(true)
    setError('')
    try {
      await clinicsApi.create({
        id: clinicId.trim(),
        name: name.trim(),
        server_host: serverHost.trim(),
        server_port: serverPort,
        clinic_id: clinicId.trim(),
      })
      await queryClient.invalidateQueries({ queryKey: ['clinics'] })
      setShowModal(false)
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        'Failed to create clinic'
      setError(msg)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-lg font-semibold">Clinics</h2>
        <button
          onClick={openModal}
          className="w-8 h-8 flex items-center justify-center rounded-lg bg-[#1e1e3a] hover:bg-[#2a2a4a] text-[#818cf8] border border-[#2a2a4a] transition-colors text-lg font-bold"
          title="Add clinic"
        >
          +
        </button>
      </div>
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
          No clinics registered. Click + to add one.
        </div>
      )}

      {/* Add Clinic Modal */}
      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
          onClick={() => setShowModal(false)}
        >
          <div
            className="bg-[#111127] border border-[#2a2a4a] rounded-xl w-full max-w-md p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-semibold mb-4">Add Clinic</h3>

            <div className="space-y-3">
              <div>
                <label className="block text-xs text-[#94a3b8] mb-1">Clinic Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  placeholder="Зубатка"
                  className="w-full px-3 py-2 rounded-lg bg-[#0a0a1a] border border-[#2a2a4a] text-sm text-white placeholder-[#475569] focus:outline-none focus:border-[#818cf8]"
                />
              </div>

              <div>
                <label className="block text-xs text-[#94a3b8] mb-1">Clinic ID</label>
                <input
                  type="text"
                  value={clinicId}
                  onChange={(e) => handleClinicIdChange(e.target.value)}
                  placeholder="zubatka"
                  className="w-full px-3 py-2 rounded-lg bg-[#0a0a1a] border border-[#2a2a4a] text-sm text-white placeholder-[#475569] focus:outline-none focus:border-[#818cf8] font-mono"
                />
              </div>

              <div>
                <label className="block text-xs text-[#94a3b8] mb-1">Server Host</label>
                <input
                  type="text"
                  value={serverHost}
                  onChange={(e) => setServerHost(e.target.value)}
                  placeholder="158.160.240.47"
                  className="w-full px-3 py-2 rounded-lg bg-[#0a0a1a] border border-[#2a2a4a] text-sm text-white placeholder-[#475569] focus:outline-none focus:border-[#818cf8] font-mono"
                />
              </div>

              <div>
                <label className="block text-xs text-[#94a3b8] mb-1">Server Port</label>
                <input
                  type="number"
                  value={serverPort}
                  onChange={(e) => setServerPort(Number(e.target.value) || 8080)}
                  className="w-full px-3 py-2 rounded-lg bg-[#0a0a1a] border border-[#2a2a4a] text-sm text-white placeholder-[#475569] focus:outline-none focus:border-[#818cf8] font-mono"
                />
              </div>

              {error && (
                <div className="text-red-400 text-xs">{error}</div>
              )}
            </div>

            <div className="flex justify-end gap-2 mt-5">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 text-sm rounded-lg bg-[#1e1e3a] hover:bg-[#2a2a4a] text-[#94a3b8] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-2 text-sm rounded-lg bg-[#818cf8] hover:bg-[#6366f1] text-white font-medium transition-colors disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Add Clinic'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
