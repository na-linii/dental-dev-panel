import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { clinicsApi } from '../api/client'

export function ClinicConfigTab() {
  const { clinicId } = useParams<{ clinicId: string }>()
  const [botDisabled, setBotDisabled] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  const { data: config, isLoading } = useQuery({
    queryKey: ['config', clinicId],
    queryFn: () => clinicsApi.config(clinicId!),
    enabled: !!clinicId,
  })

  const configData = (config as any)?.config || config || {}

  const handleRedButton = () => {
    if (!showConfirm) {
      setShowConfirm(true)
      return
    }
    setBotDisabled(!botDisabled)
    setShowConfirm(false)
    // TODO: call API to toggle bot
  }

  if (isLoading) {
    return <div className="p-6 text-[#64748b] text-sm">Loading config...</div>
  }

  const sections = [
    { key: 'clinic_id', label: 'Clinic ID' },
    { key: 'name', label: 'Name' },
    { key: 'pricing_mode', label: 'Pricing Mode' },
    { key: 'advance_days', label: 'Advance Booking Days' },
    { key: 'show_doctors', label: 'Show Doctors' },
    { key: 'allow_primary', label: 'Allow Primary Patients' },
    { key: 'primary_patients', label: 'Primary Patient Mode' },
    { key: 'max_retries', label: 'Max Retries' },
    { key: 'handoff_notify_via', label: 'Handoff Notify' },
    { key: 'crm_adapter', label: 'CRM Adapter' },
    { key: 'confirmation_enabled', label: 'Confirmation Enabled' },
  ]

  return (
    <div className="p-6 max-w-3xl mx-auto overflow-y-auto" style={{ height: '100%' }}>
      {/* Red Button */}
      <div className="mb-6 p-4 bg-[#111127] border border-[#1e293b] rounded-xl">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-white mb-0.5">Agent Responses</h3>
            <p className="text-xs text-[#64748b]">
              {botDisabled
                ? 'Agent responses DISABLED. Messages still saved, handoffs still work.'
                : 'Agent is responding to patients normally.'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {showConfirm && (
              <button
                onClick={() => setShowConfirm(false)}
                className="px-3 py-1.5 text-xs text-[#64748b] hover:text-white cursor-pointer"
              >
                Cancel
              </button>
            )}
            <button
              onClick={handleRedButton}
              className={`px-4 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
                botDisabled
                  ? 'bg-[#4ade80] text-[#0a0a1a] hover:bg-[#22c55e]'
                  : showConfirm
                    ? 'bg-[#dc2626] text-white animate-pulse'
                    : 'bg-[#991b1b] text-[#fca5a5] hover:bg-[#dc2626] hover:text-white'
              }`}
            >
              {botDisabled ? 'Enable Agent' : showConfirm ? 'Confirm Disable' : 'Disable Agent'}
            </button>
          </div>
        </div>
        {botDisabled && (
          <div className="mt-2 px-2 py-1 bg-[#dc2626]/10 border border-[#dc2626]/20 rounded text-xs text-[#f87171]">
            ⚠ Agent responses are disabled for this clinic
          </div>
        )}
      </div>

      {/* Config sections */}
      <div className="bg-[#111127] border border-[#1e293b] rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-[#1e293b]">
          <h3 className="text-sm font-semibold text-white">Clinic Configuration</h3>
        </div>
        <div className="divide-y divide-[#1e293b]">
          {sections.map((s) => {
            const val = configData[s.key]
            if (val === undefined) return null
            return (
              <div key={s.key} className="flex items-center justify-between px-4 py-2.5">
                <span className="text-xs text-[#94a3b8]">{s.label}</span>
                <span className="text-xs text-white font-mono">
                  {typeof val === 'boolean' ? (val ? '✓' : '✗') : String(val || '—')}
                </span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Knowledge base preview */}
      {configData.knowledge && (
        <div className="mt-4 bg-[#111127] border border-[#1e293b] rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-[#1e293b]">
            <h3 className="text-sm font-semibold text-white">Knowledge Base</h3>
          </div>
          <div className="divide-y divide-[#1e293b]">
            {configData.knowledge.about && (
              <div className="px-4 py-2.5">
                <span className="text-[10px] text-[#64748b] uppercase">About</span>
                <p className="text-xs text-[#cbd5e1] mt-0.5">{configData.knowledge.about}</p>
              </div>
            )}
            {configData.knowledge.address && (
              <div className="px-4 py-2.5 flex justify-between">
                <span className="text-xs text-[#94a3b8]">Address</span>
                <span className="text-xs text-white">{configData.knowledge.address}</span>
              </div>
            )}
            {configData.knowledge.phone && (
              <div className="px-4 py-2.5 flex justify-between">
                <span className="text-xs text-[#94a3b8]">Phone</span>
                <span className="text-xs text-white">{configData.knowledge.phone}</span>
              </div>
            )}
            {configData.knowledge.working_hours && (
              <div className="px-4 py-2.5 flex justify-between">
                <span className="text-xs text-[#94a3b8]">Hours</span>
                <span className="text-xs text-white">{configData.knowledge.working_hours}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modules */}
      {configData.modules && Object.keys(configData.modules).length > 0 && (
        <div className="mt-4 bg-[#111127] border border-[#1e293b] rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-[#1e293b]">
            <h3 className="text-sm font-semibold text-white">Modules</h3>
          </div>
          <div className="divide-y divide-[#1e293b]">
            {Object.entries(configData.modules).map(([name, mod]: [string, any]) => (
              <div key={name} className="flex items-center justify-between px-4 py-2.5">
                <span className="text-xs text-[#94a3b8]">{name}</span>
                <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                  mod?.enabled
                    ? 'bg-[#052e16] text-[#4ade80]'
                    : 'bg-[#1e293b] text-[#64748b]'
                }`}>
                  {mod?.enabled ? 'ENABLED' : 'DISABLED'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
