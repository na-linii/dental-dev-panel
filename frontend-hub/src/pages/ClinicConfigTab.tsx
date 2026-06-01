import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { clinicsApi } from '../api/client'
import { ConfigSection, SECTION_COLORS } from '../components/ConfigSection'
import { ConfigField } from '../components/ConfigField'
import { ReminderScheduleEditor } from '../components/ReminderScheduleEditor'

/* ── helper to safely dig into nested objects ── */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function get(obj: any, path: string): any {
  return path.split('.').reduce((o, k) => o?.[k], obj)
}

export function ClinicConfigTab() {
  const { clinicId } = useParams<{ clinicId: string }>()
  const queryClient = useQueryClient()
  const [botDisabled, setBotDisabled] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  const { data: config, isLoading } = useQuery({
    queryKey: ['config', clinicId],
    queryFn: () => clinicsApi.config(clinicId!),
    enabled: !!clinicId,
  })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cfg = (config as any)?.config || config || {}

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

  /* ── extract nested data ── */
  const modules = cfg.modules || {}
  const channels = cfg.channels || {}
  const confirmation = cfg.confirmation || {}
  const handoff = cfg.handoff || {}
  const knowledge = cfg.knowledge || {}
  const services: { name: string; category: string; price_from?: number; price_to?: number; duration_min?: number; description?: string }[] = knowledge.services || []
  const doctors: { name: string; specialty: string; description?: string }[] = knowledge.doctors || []
  const faq: { q: string; a: string }[] = knowledge.faq || []
  const features: string[] = knowledge.features || []

  return (
    <div className="p-6 max-w-[900px] mx-auto overflow-y-auto space-y-4 h-full">

      {/* Red Button */}
      <div className="p-4 bg-[#111127] border border-[#1e293b] rounded-xl">
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
            Agent responses are disabled for this clinic
          </div>
        )}
      </div>

      {/* ── Section 1: Basic Info ── */}
      <ConfigSection title="Basic Info" color={SECTION_COLORS.basic}>
        <ConfigField label="Name" value={cfg.name} />
        <ConfigField label="Clinic ID" value={cfg.clinic_id} type="badge" />
        <ConfigField label="Telegram Bot" value={
          cfg.telegram_bot_username
          || modules.telegram?.config?.bot_username
          || cfg.gateway?.telegram?.bot_username
        } />
      </ConfigSection>

      {/* ── Section 2: Server ── */}
      {(cfg.server_host || cfg.server_port) && (
        <ConfigSection title="Server & Deploy" color={SECTION_COLORS.server} defaultOpen={false}>
          <ConfigField label="Host" value={cfg.server_host} />
          <ConfigField label="Port" value={cfg.server_port} />
          <ConfigField label="SSH User" value={cfg.ssh_user} />
        </ConfigSection>
      )}

      {/* ── Section 3: Modules ── */}
      {Object.keys(modules).length > 0 && (
        <ConfigSection title="Modules" color={SECTION_COLORS.modules}>
          {Object.entries(modules).map(([name, mod]: [string, unknown]) => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const m = mod as any
            return (
              <div key={name} className="bg-[#0a0a1a] rounded-lg p-3 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-white">{name}</span>
                  <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                    m?.enabled
                      ? 'bg-[#052e16] text-[#4ade80]'
                      : 'bg-[#1e293b] text-[#64748b]'
                  }`}>
                    {m?.enabled ? 'ENABLED' : 'DISABLED'}
                  </span>
                </div>
                {m?.config && (
                  <div className="pl-2 border-l-2 border-[#2a2a4a] ml-1 mt-2">
                    {name === 'telegram' && (
                      <>
                        <ConfigField label="Bot Token" value={m.config.bot_token} type="secret" />
                        <ConfigField label="Streaming" value={m.config.streaming} type="toggle" />
                      </>
                    )}
                    {name === 'google_sheets' && (
                      <>
                        <ConfigField label="Spreadsheet ID" value={m.config.spreadsheet_id} />
                        <ConfigField label="Credentials Path" value={m.config.credentials_path} />
                        {m.config.capabilities && (
                          <div className="flex flex-wrap gap-2 mt-1">
                            {Object.entries(m.config.capabilities).map(([cap, val]) => (
                              <span key={cap} className={`text-[10px] px-1.5 py-0.5 rounded ${
                                val ? 'bg-[#052e16] text-[#4ade80]' : 'bg-[#1e293b] text-[#64748b]'
                              }`}>
                                {cap}
                              </span>
                            ))}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </ConfigSection>
      )}

      {/* ── Section 4: Channels ── */}
      {Object.keys(channels).length > 0 && (
        <ConfigSection title="Channels" color={SECTION_COLORS.channels}>
          {Object.entries(channels).map(([key, ch]: [string, unknown]) => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const c = ch as any
            return (
              <div key={key} className="bg-[#0a0a1a] rounded-lg p-3 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-white font-mono">{key}</span>
                  <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                    c?.enabled
                      ? 'bg-[#052e16] text-[#4ade80]'
                      : 'bg-[#1e293b] text-[#64748b]'
                  }`}>
                    {c?.enabled ? 'ENABLED' : 'DISABLED'}
                  </span>
                </div>
                {c?.enabled && (
                  <div className="pl-2 border-l-2 border-[#2a2a4a] ml-1 mt-2">
                    <ConfigField label="Tone" value={c.tone} type="badge" />
                    {c.greeting && <ConfigField label="Greeting" value={c.greeting} />}
                    {c.features?.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-1">
                        {c.features.map((f: string) => (
                          <span key={f} className="text-[10px] px-1.5 py-0.5 rounded bg-[#1e293b] text-[#c4b5fd]">
                            {f}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </ConfigSection>
      )}

      {/* ── Section 5: Booking Settings ── */}
      <ConfigSection title="Booking Settings" color={SECTION_COLORS.booking}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8">
          <ConfigField label="Pricing Mode" value={cfg.pricing_mode} type="badge" />
          <ConfigField label="Show Doctors" value={cfg.show_doctors} type="toggle" />
          <ConfigField label="Allow Primary" value={cfg.allow_primary} type="toggle" />
          <ConfigField label="Advance Days" value={cfg.advance_days} />
          <ConfigField label="Primary Patients" value={cfg.primary_patients} type="badge" />
          <ConfigField label="Max Retries" value={cfg.max_retries} />
          <ConfigField label="Handoff Notify Via" value={cfg.handoff_notify_via} type="badge" />
        </div>
        {cfg.require_phone_for?.length > 0 && (
          <div className="mt-2">
            <span className="text-xs text-[#64748b]">Require Phone For</span>
            <div className="flex flex-wrap gap-1.5 mt-1">
              {cfg.require_phone_for.map((v: string) => (
                <span key={v} className="text-[10px] px-1.5 py-0.5 rounded bg-[#1e293b] text-[#fdba74]">
                  {v}
                </span>
              ))}
            </div>
          </div>
        )}
      </ConfigSection>

      {/* ── Section 6: Confirmation ── */}
      <ConfigSection title="Confirmation" color={SECTION_COLORS.confirmation} defaultOpen={false}>
        <ConfigField label="Enabled" value={confirmation.enabled ?? cfg.confirmation_enabled} type="toggle" />

        <div className="mt-4">
          <ReminderScheduleEditor
            hours={
              Array.isArray(confirmation.schedule_hours)
                ? confirmation.schedule_hours
                : (cfg.confirmation_schedule_hours || [11, 17])
            }
            onSave={async (hours) => {
              await clinicsApi.updateConfirmationSchedule(clinicId!, hours)
              await queryClient.invalidateQueries({ queryKey: ['config', clinicId] })
            }}
            isLoading={isLoading}
          />
        </div>

        <ConfigField label="Advance Days" value={confirmation.advance_days ?? cfg.confirmation_advance_days} />
        {(confirmation.message_template || cfg.confirmation_message_template) && (
          <div className="mt-2">
            <span className="text-xs text-[#64748b]">Message Template</span>
            <p className="text-xs text-[#cbd5e1] mt-1 bg-[#0a0a1a] rounded p-2 font-mono">
              {confirmation.message_template || cfg.confirmation_message_template}
            </p>
          </div>
        )}
      </ConfigSection>

      {/* ── Section 7: Handoff ── */}
      <ConfigSection title="Handoff" color={SECTION_COLORS.handoff} defaultOpen={false}>
        <ConfigField label="Admin Chat ID" value={handoff.admin_chat_id ?? cfg.handoff_admin_chat_id} type="secret" />
        <ConfigField label="Cooldown Minutes" value={handoff.cooldown_minutes ?? cfg.handoff_cooldown_minutes} />
      </ConfigSection>

      {/* ── Section 8: LLM ── */}
      <ConfigSection title="OpenAI / LLM" color={SECTION_COLORS.llm} defaultOpen={false}>
        <ConfigField label="API Key" value={undefined} type="secret" />
        <ConfigField label="API Base URL" value={cfg.openai_api_base} />
        <ConfigField label="Proxy Secret" value={undefined} type="secret" />
        <ConfigField label="Model" value={cfg.openai_model} type="badge" />
        <ConfigField label="Fallback Model" value={cfg.openai_fallback_model} type="badge" />
      </ConfigSection>

      {/* ── Section 9: Knowledge Base ── */}
      <ConfigSection title="Knowledge Base" color={SECTION_COLORS.knowledge}>
        {knowledge.about && (
          <div>
            <span className="text-xs text-[#64748b]">About</span>
            <p className="text-xs text-[#cbd5e1] mt-1 bg-[#0a0a1a] rounded p-2">{knowledge.about}</p>
          </div>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8">
          <ConfigField label="Address" value={knowledge.address} />
          <ConfigField label="Phone" value={knowledge.phone} />
          <ConfigField label="Working Hours" value={knowledge.working_hours} />
        </div>

        {/* Features */}
        {features.length > 0 && (
          <div className="mt-2">
            <span className="text-xs text-[#64748b]">Features</span>
            <div className="flex flex-wrap gap-1.5 mt-1">
              {features.map((f, i) => (
                <span key={i} className="text-[10px] px-1.5 py-0.5 rounded bg-[#1e293b] text-[#5eead4]">
                  {f}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Services */}
        {services.length > 0 && (
          <div className="mt-3">
            <span className="text-xs text-[#64748b] mb-2 block">Services ({services.length})</span>
            <div className="space-y-1.5">
              {services.map((s, i) => (
                <div key={i} className="bg-[#0a0a1a] rounded-lg p-2.5 flex items-center justify-between">
                  <div>
                    <span className="text-xs text-white font-medium">{s.name}</span>
                    {s.category && <span className="text-[10px] text-[#64748b] ml-2">{s.category}</span>}
                    {s.description && <p className="text-[10px] text-[#94a3b8] mt-0.5">{s.description}</p>}
                  </div>
                  <div className="text-right shrink-0 ml-4">
                    {(s.price_from || s.price_to) && (
                      <span className="text-[10px] text-[#5eead4] font-mono">
                        {s.price_from && s.price_to
                          ? `${s.price_from} - ${s.price_to}`
                          : s.price_from || s.price_to}
                      </span>
                    )}
                    {s.duration_min && (
                      <span className="text-[10px] text-[#64748b] ml-2">{s.duration_min} min</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Doctors */}
        {doctors.length > 0 && (
          <div className="mt-3">
            <span className="text-xs text-[#64748b] mb-2 block">Doctors ({doctors.length})</span>
            <div className="space-y-1.5">
              {doctors.map((d, i) => (
                <div key={i} className="bg-[#0a0a1a] rounded-lg p-2.5">
                  <span className="text-xs text-white font-medium">{d.name}</span>
                  <span className="text-[10px] text-[#64748b] ml-2">{d.specialty}</span>
                  {d.description && <p className="text-[10px] text-[#94a3b8] mt-0.5">{d.description}</p>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* FAQ */}
        {faq.length > 0 && (
          <div className="mt-3">
            <span className="text-xs text-[#64748b] mb-2 block">FAQ ({faq.length})</span>
            <div className="space-y-1.5">
              {faq.map((f, i) => (
                <div key={i} className="bg-[#0a0a1a] rounded-lg p-2.5">
                  <span className="text-xs text-[#e2e8f0] font-medium">{f.q}</span>
                  <p className="text-[10px] text-[#94a3b8] mt-0.5">{f.a}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </ConfigSection>
    </div>
  )
}
