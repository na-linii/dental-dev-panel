import { useState, useEffect, useRef, useCallback } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { clinicsApi } from '../api/client'
import { ClinicCard } from '../components/ClinicCard'
import type { ClinicCreateData, DeployStep } from '../types'

/* ── helpers ── */

function toSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9а-яё]+/gi, '_')
    .replace(/^_|_$/g, '')
}

const STEPS = ['Basic Info', 'Server', 'Modules & Config', 'Review & Deploy'] as const
type StepIndex = 0 | 1 | 2 | 3

const INPUT =
  'w-full px-3 py-2 rounded-lg bg-[#0a0a1a] border border-[#2a2a4a] text-sm text-white placeholder-[#475569] focus:outline-none focus:border-[#818cf8]'
const INPUT_MONO = `${INPUT} font-mono`
const LABEL = 'block text-xs text-[#94a3b8] mb-1'

/* ── default form state ── */

function defaultForm(): ClinicCreateData {
  return {
    id: '',
    name: '',
    server_host: '',
    server_port: 8080,
    clinic_id: '',
    ssh_user: '',
    ssh_auth_type: 'key',
    hub_url: typeof window !== 'undefined' ? window.location.origin : '',
    config: {
      telegram_bot_token: '',
      google_sheets_id: '',
      google_sa_key_path: '/app/credentials/dental-crm-sa.json',
      openai_api_key: '',
      openai_api_base: 'http://139.59.142.48/v1',
      openai_proxy_secret: '',
    },
  }
}

/* ── Step indicator ── */

function StepIndicator({ current }: { current: StepIndex }) {
  return (
    <div className="flex items-center justify-center gap-1 mb-6">
      {STEPS.map((label, i) => {
        const done = i < current
        const active = i === current
        return (
          <div key={label} className="flex items-center gap-1">
            <div className="flex flex-col items-center">
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-colors ${
                  done
                    ? 'bg-[#818cf8] border-[#818cf8] text-white'
                    : active
                    ? 'border-[#818cf8] text-[#818cf8] bg-transparent'
                    : 'border-[#334155] text-[#475569] bg-transparent'
                }`}
              >
                {done ? '\u2713' : i + 1}
              </div>
              <span
                className={`text-[10px] mt-1 whitespace-nowrap ${
                  active ? 'text-[#818cf8]' : 'text-[#475569]'
                }`}
              >
                {label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div
                className={`w-8 h-0.5 mb-4 ${
                  i < current ? 'bg-[#818cf8]' : 'bg-[#334155]'
                }`}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}

/* ── Deploy progress ── */

function DeployProgress({ steps }: { steps: DeployStep[] }) {
  return (
    <div className="mt-4 space-y-2">
      {steps.map((s) => (
        <div key={s.step} className="flex items-center gap-3 text-sm">
          <span className="w-5 text-center">
            {s.status === 'done' && <span className="text-[#4ade80]">{'\u2713'}</span>}
            {s.status === 'running' && (
              <span className="inline-block w-4 h-4 border-2 border-[#818cf8] border-t-transparent rounded-full animate-spin" />
            )}
            {s.status === 'failed' && <span className="text-[#f87171]">{'\u2717'}</span>}
            {s.status === 'pending' && <span className="text-[#475569]">{'\u25CB'}</span>}
          </span>
          <span className={s.status === 'pending' ? 'text-[#475569]' : 'text-[#e2e8f0]'}>
            {s.step}
          </span>
          {s.output && s.status === 'failed' && (
            <span className="text-[#f87171] text-xs ml-auto truncate max-w-[200px]" title={s.output}>
              {s.output}
            </span>
          )}
        </div>
      ))}
    </div>
  )
}

/* ── Main page ── */

export function ClinicsPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [showModal, setShowModal] = useState(false)
  const [step, setStep] = useState<StepIndex>(0)
  const [form, setForm] = useState<ClinicCreateData>(defaultForm)
  const [slugManual, setSlugManual] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  // deploy
  const [deploying, setDeploying] = useState(false)
  const [deploySteps, setDeploySteps] = useState<DeployStep[]>([])
  const [deployDone, setDeployDone] = useState(false)
  const [deployError, setDeployError] = useState('')
  const eventSourceRef = useRef<EventSource | null>(null)

  const { data: clinics, isLoading } = useQuery({
    queryKey: ['clinics'],
    queryFn: clinicsApi.list,
  })

  /* form helpers */

  function patch(partial: Partial<ClinicCreateData>) {
    setForm((prev) => ({ ...prev, ...partial }))
  }

  function patchConfig(partial: Partial<ClinicCreateData['config']>) {
    setForm((prev) => ({ ...prev, config: { ...prev.config, ...partial } }))
  }

  function handleNameChange(val: string) {
    patch({ name: val })
    if (!slugManual) {
      const slug = toSlug(val)
      patch({ clinic_id: slug, id: slug })
    }
  }

  function handleClinicIdChange(val: string) {
    setSlugManual(true)
    patch({ clinic_id: val, id: val })
  }

  function openModal() {
    setForm(defaultForm())
    setSlugManual(false)
    setStep(0)
    setSaved(false)
    setSaving(false)
    setError('')
    setDeploying(false)
    setDeploySteps([])
    setDeployDone(false)
    setDeployError('')
    setShowModal(true)
  }

  function closeModal() {
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
      eventSourceRef.current = null
    }
    setShowModal(false)
  }

  /* validation */

  function canGoNext(): boolean {
    switch (step) {
      case 0:
        return !!(form.name.trim() && form.clinic_id.trim())
      case 1:
        return !!(form.server_host.trim() && form.server_port && form.ssh_user.trim())
      case 2:
        return true // config is optional
      case 3:
        return true
      default:
        return false
    }
  }

  /* save */

  async function handleSave() {
    setSaving(true)
    setError('')
    try {
      await clinicsApi.create(form)
      await queryClient.invalidateQueries({ queryKey: ['clinics'] })
      setSaved(true)
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        'Failed to create clinic'
      setError(msg)
    } finally {
      setSaving(false)
    }
  }

  /* deploy via SSE */

  const startDeploy = useCallback(() => {
    setDeploying(true)
    setDeploySteps([])
    setDeployDone(false)
    setDeployError('')

    const url = clinicsApi.deploy(form.clinic_id)
    const es = new EventSource(url)
    eventSourceRef.current = es

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as DeployStep
        setDeploySteps((prev) => {
          const idx = prev.findIndex((s) => s.step === data.step)
          if (idx >= 0) {
            const next = [...prev]
            next[idx] = data
            return next
          }
          return [...prev, data]
        })
        if (data.status === 'failed') {
          setDeployError(data.output || 'Deploy failed')
        }
      } catch {
        // ignore non-JSON messages
      }
    }

    es.addEventListener('done', () => {
      setDeployDone(true)
      setDeploying(false)
      es.close()
      eventSourceRef.current = null
      queryClient.invalidateQueries({ queryKey: ['clinics'] })
    })

    es.addEventListener('error', () => {
      if (es.readyState === EventSource.CLOSED) {
        // Normal close after done
        if (!deployDone) {
          setDeployDone(true)
          setDeploying(false)
        }
      } else {
        setDeployError('Connection to deploy stream lost')
        setDeploying(false)
        es.close()
        eventSourceRef.current = null
      }
    })
  }, [form.clinic_id, queryClient, deployDone])

  // cleanup on unmount
  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close()
      }
    }
  }, [])

  /* step content renderers */

  function renderStep0() {
    return (
      <div className="space-y-3">
        <div>
          <label className={LABEL}>Clinic Name</label>
          <input
            type="text"
            value={form.name}
            onChange={(e) => handleNameChange(e.target.value)}
            placeholder="Зубатка"
            className={INPUT}
          />
        </div>
        <div>
          <label className={LABEL}>Clinic ID</label>
          <input
            type="text"
            value={form.clinic_id}
            onChange={(e) => handleClinicIdChange(e.target.value)}
            placeholder="zubatka"
            className={INPUT_MONO}
          />
          <p className="text-[10px] text-[#475569] mt-1">Auto-generated from name. Edit to override.</p>
        </div>
      </div>
    )
  }

  function renderStep1() {
    return (
      <div className="space-y-3">
        <div>
          <label className={LABEL}>Server Host (IP)</label>
          <input
            type="text"
            value={form.server_host}
            onChange={(e) => patch({ server_host: e.target.value })}
            placeholder="158.160.240.47"
            className={INPUT_MONO}
          />
        </div>
        <div>
          <label className={LABEL}>Server Port</label>
          <input
            type="number"
            value={form.server_port}
            onChange={(e) => patch({ server_port: Number(e.target.value) || 8080 })}
            className={INPUT_MONO}
          />
        </div>
        <div>
          <label className={LABEL}>SSH User</label>
          <input
            type="text"
            value={form.ssh_user}
            onChange={(e) => patch({ ssh_user: e.target.value })}
            placeholder="root"
            className={INPUT_MONO}
          />
        </div>
        <div>
          <label className={LABEL}>SSH Auth Type</label>
          <select
            value={form.ssh_auth_type}
            onChange={(e) => patch({ ssh_auth_type: e.target.value as 'key' | 'password' })}
            className={INPUT}
          >
            <option value="key">SSH Key</option>
            <option value="password">Password</option>
          </select>
        </div>
        <div>
          <label className={LABEL}>Hub URL</label>
          <input
            type="text"
            value={form.hub_url}
            onChange={(e) => patch({ hub_url: e.target.value })}
            className={INPUT_MONO}
          />
          <p className="text-[10px] text-[#475569] mt-1">Auto-filled from current browser URL.</p>
        </div>
      </div>
    )
  }

  function renderStep2() {
    return (
      <div className="space-y-3">
        <div>
          <label className={LABEL}>Telegram Bot Token</label>
          <input
            type="password"
            value={form.config.telegram_bot_token || ''}
            onChange={(e) => patchConfig({ telegram_bot_token: e.target.value })}
            placeholder="123456:ABC-DEF..."
            className={INPUT_MONO}
          />
        </div>
        <div>
          <label className={LABEL}>Google Sheets Spreadsheet ID</label>
          <input
            type="text"
            value={form.config.google_sheets_id || ''}
            onChange={(e) => patchConfig({ google_sheets_id: e.target.value })}
            placeholder="1a2b3c..."
            className={INPUT_MONO}
          />
        </div>
        <div>
          <label className={LABEL}>Google SA Key Path</label>
          <input
            type="text"
            value={form.config.google_sa_key_path || ''}
            onChange={(e) => patchConfig({ google_sa_key_path: e.target.value })}
            className={INPUT_MONO}
          />
        </div>
        <div>
          <label className={LABEL}>OpenAI API Key</label>
          <input
            type="password"
            value={form.config.openai_api_key || ''}
            onChange={(e) => patchConfig({ openai_api_key: e.target.value })}
            className={INPUT_MONO}
          />
        </div>
        <div>
          <label className={LABEL}>OpenAI API Base URL</label>
          <input
            type="text"
            value={form.config.openai_api_base || ''}
            onChange={(e) => patchConfig({ openai_api_base: e.target.value })}
            className={INPUT_MONO}
          />
        </div>
        <div>
          <label className={LABEL}>OpenAI Proxy Secret</label>
          <input
            type="password"
            value={form.config.openai_proxy_secret || ''}
            onChange={(e) => patchConfig({ openai_proxy_secret: e.target.value })}
            className={INPUT_MONO}
          />
        </div>
      </div>
    )
  }

  function renderStep3() {
    const rows: Array<[string, string]> = [
      ['Name', form.name],
      ['Clinic ID', form.clinic_id],
      ['Server', `${form.server_host}:${form.server_port}`],
      ['SSH User', form.ssh_user],
      ['SSH Auth', form.ssh_auth_type],
      ['Hub URL', form.hub_url],
    ]

    const configRows: Array<[string, string | undefined]> = [
      ['Telegram Token', form.config.telegram_bot_token ? '\u2022\u2022\u2022 configured' : undefined],
      ['Google Sheets ID', form.config.google_sheets_id || undefined],
      ['Google SA Key', form.config.google_sa_key_path || undefined],
      ['OpenAI API Key', form.config.openai_api_key ? '\u2022\u2022\u2022 configured' : undefined],
      ['OpenAI Base URL', form.config.openai_api_base || undefined],
      ['Proxy Secret', form.config.openai_proxy_secret ? '\u2022\u2022\u2022 configured' : undefined],
    ]

    return (
      <div className="space-y-4">
        {/* Summary table */}
        <div>
          <h4 className="text-xs font-semibold text-[#94a3b8] uppercase tracking-wider mb-2">
            Server
          </h4>
          <table className="w-full text-xs">
            <tbody>
              {rows.map(([k, v]) => (
                <tr key={k}>
                  <td className="text-[#64748b] py-0.5 pr-3 w-28">{k}</td>
                  <td className="text-[#e2e8f0] font-mono">{v || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div>
          <h4 className="text-xs font-semibold text-[#94a3b8] uppercase tracking-wider mb-2">
            Config
          </h4>
          <table className="w-full text-xs">
            <tbody>
              {configRows.map(([k, v]) => (
                <tr key={k}>
                  <td className="text-[#64748b] py-0.5 pr-3 w-28">{k}</td>
                  <td className={`font-mono ${v ? 'text-[#e2e8f0]' : 'text-[#334155]'}`}>
                    {v || 'not set'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Action buttons */}
        <div className="flex gap-2 pt-2">
          {!saved && (
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 text-sm rounded-lg bg-[#818cf8] hover:bg-[#6366f1] text-white font-medium transition-colors disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
          )}
          {saved && !deploying && !deployDone && (
            <button
              onClick={startDeploy}
              className="px-4 py-2 text-sm rounded-lg bg-[#059669] hover:bg-[#047857] text-white font-medium transition-colors"
            >
              Deploy
            </button>
          )}
          {saved && !deploying && !deployDone && (
            <span className="text-[#4ade80] text-xs self-center">Saved to Hub DB</span>
          )}
        </div>

        {/* Deploy progress */}
        {(deploying || deploySteps.length > 0) && (
          <div className="bg-[#0a0a1a] border border-[#1e293b] rounded-lg p-4">
            <h4 className="text-xs font-semibold text-[#94a3b8] uppercase tracking-wider mb-3">
              Deploy Progress
            </h4>
            <DeployProgress steps={deploySteps} />
            {deployDone && !deployError && (
              <div className="mt-3 text-sm text-[#4ade80] font-medium">
                Deploy complete!
              </div>
            )}
            {deployError && (
              <div className="mt-3 text-sm text-[#f87171]">
                {deployError}
              </div>
            )}
          </div>
        )}

        {error && <div className="text-red-400 text-xs">{error}</div>}
      </div>
    )
  }

  /* ── render ── */

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

      {/* Wizard Modal */}
      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
          onClick={closeModal}
        >
          <div
            className="bg-[#111127] border border-[#2a2a4a] rounded-xl w-full max-w-lg p-6 shadow-2xl max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-semibold mb-4">Add Clinic</h3>

            <StepIndicator current={step} />

            {/* Step content */}
            {step === 0 && renderStep0()}
            {step === 1 && renderStep1()}
            {step === 2 && renderStep2()}
            {step === 3 && renderStep3()}

            {/* Navigation */}
            {step < 3 && error && (
              <div className="text-red-400 text-xs mt-3">{error}</div>
            )}

            <div className="flex justify-between mt-5">
              <div>
                {step > 0 && (
                  <button
                    onClick={() => setStep((s) => (s - 1) as StepIndex)}
                    className="px-4 py-2 text-sm rounded-lg bg-[#1e1e3a] hover:bg-[#2a2a4a] text-[#94a3b8] transition-colors"
                  >
                    Back
                  </button>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={closeModal}
                  className="px-4 py-2 text-sm rounded-lg bg-[#1e1e3a] hover:bg-[#2a2a4a] text-[#94a3b8] transition-colors"
                >
                  {deployDone ? 'Close' : 'Cancel'}
                </button>
                {step < 3 && (
                  <button
                    onClick={() => {
                      setError('')
                      setStep((s) => (s + 1) as StepIndex)
                    }}
                    disabled={!canGoNext()}
                    className="px-4 py-2 text-sm rounded-lg bg-[#818cf8] hover:bg-[#6366f1] text-white font-medium transition-colors disabled:opacity-50"
                  >
                    Next
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
