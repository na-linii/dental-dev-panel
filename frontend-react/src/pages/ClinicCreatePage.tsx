import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import yaml from 'js-yaml'
import { clinicsApi } from '../api/client'
import type { ClinicCreateData, DeployStep, ServiceItem, DoctorItem, FaqItem } from '../types'

/* ── style tokens ── */

const INPUT =
  'w-full px-3 py-2 rounded-lg bg-[#0a0a1a] border border-[#2a2a4a] text-sm text-white placeholder-[#475569] focus:outline-none focus:border-[#818cf8]'
const INPUT_MONO = `${INPUT} font-mono`
const LABEL = 'block text-xs text-[#94a3b8] mb-1'
const TOGGLE_BASE =
  'relative inline-flex h-5 w-9 items-center rounded-full transition-colors cursor-pointer'
const TOGGLE_DOT =
  'inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform'

/* ── section colors ── */

const SECTION_COLORS: Record<string, string> = {
  basic: '#818cf8',
  server: '#38bdf8',
  modules: '#a78bfa',
  channels: '#f472b6',
  booking: '#fb923c',
  confirmation: '#4ade80',
  handoff: '#f87171',
  llm: '#facc15',
  knowledge: '#2dd4bf',
  import: '#94a3b8',
}

/* ── Toggle component ── */

function Toggle({ value, onChange, label }: { value: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <label className="flex items-center gap-2 cursor-pointer">
      <button
        type="button"
        role="switch"
        aria-checked={value}
        onClick={() => onChange(!value)}
        className={`${TOGGLE_BASE} ${value ? 'bg-[#818cf8]' : 'bg-[#334155]'}`}
      >
        <span className={`${TOGGLE_DOT} ${value ? 'translate-x-4' : 'translate-x-0.5'}`} />
      </button>
      {label && <span className="text-xs text-[#94a3b8]">{label}</span>}
    </label>
  )
}

/* ── Checkbox component ── */

function Checkbox({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="flex items-center gap-2 cursor-pointer">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="w-3.5 h-3.5 rounded border-[#2a2a4a] bg-[#0a0a1a] text-[#818cf8] focus:ring-0 focus:ring-offset-0"
      />
      <span className="text-xs text-[#94a3b8]">{label}</span>
    </label>
  )
}

/* ── Collapsible Section ── */

function Section({
  id,
  title,
  children,
  expanded,
  onToggle,
}: {
  id: string
  title: string
  children: React.ReactNode
  expanded: boolean
  onToggle: () => void
}) {
  const color = SECTION_COLORS[id] || '#818cf8'
  return (
    <div className="bg-[#111127] border border-[#1e293b] rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center gap-3 px-5 py-3.5 hover:bg-[#1a1a3a] transition-colors cursor-pointer"
      >
        <div className="w-1 h-5 rounded-full" style={{ backgroundColor: color }} />
        <span className="text-sm font-semibold text-white flex-1 text-left">{title}</span>
        <span className={`text-[#475569] text-xs transition-transform ${expanded ? 'rotate-180' : ''}`}>
          {'\u25BC'}
        </span>
      </button>
      {expanded && <div className="px-5 pb-5 space-y-4">{children}</div>}
    </div>
  )
}

/* ── Deploy Progress ── */

function DeployProgress({ steps }: { steps: DeployStep[] }) {
  return (
    <div className="space-y-2">
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
            <span className="text-[#f87171] text-xs ml-auto truncate max-w-[300px]" title={s.output}>
              {s.output}
            </span>
          )}
        </div>
      ))}
    </div>
  )
}

/* ── helpers ── */

function toSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\u0430-\u044f\u0451]+/gi, '_')
    .replace(/^_|_$/g, '')
}

function defaultChannel() {
  return { enabled: false, tone: 'friendly' as const, greeting: '', features: ['faq', 'booking'] }
}

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
      telegram_enabled: false,
      telegram_bot_token: '',
      telegram_streaming: true,
      google_sheets_enabled: false,
      google_sheets_id: '',
      google_sa_key_path: '/app/credentials/dental-crm-sa.json',
      google_sheets_can_book: true,
      google_sheets_can_cancel: true,
      google_sheets_can_register_patient: true,
      google_sheets_can_confirm: true,

      channels: {
        tg_bot: { enabled: true, tone: 'friendly', greeting: '', features: ['faq', 'booking', 'appointments', 'handoff'] },
        tg_business: { enabled: false, tone: 'friendly', greeting: '', features: ['faq', 'booking', 'appointments', 'handoff'] },
      },

      pricing_mode: 'range',
      show_doctors: true,
      allow_primary: false,
      advance_days: 14,
      primary_patients: 'always',
      max_retries: 3,
      handoff_notify_via: 'telegram',
      require_phone_for: ['booking', 'reschedule', 'cancel'],

      confirmation_enabled: true,
      confirmation_schedule_hours: '10, 17',
      confirmation_advance_days: 1,
      confirmation_message_template: 'Напоминаем о вашей записи на {date} в {time} к {doctor}. Подтверждаете? (Да/Нет)',

      handoff_admin_chat_id: '',
      handoff_cooldown_minutes: 30,

      openai_api_key: '',
      openai_api_base: 'http://139.59.142.48/v1',
      openai_proxy_secret: '',
      openai_model: 'gpt-5.4-mini',
      openai_fallback_model: 'openai/gpt-5.4-mini',

      knowledge_about: '',
      knowledge_address: '',
      knowledge_phone: '',
      knowledge_working_hours: '',
      knowledge_features: [],
      knowledge_services: [],
      knowledge_doctors: [],
      knowledge_faq: [],
    },
  }
}

const ALL_FEATURES = ['faq', 'booking', 'appointments', 'handoff']
const PHONE_OPTIONS = ['booking', 'reschedule', 'cancel']

/* ── formToYaml / yamlToForm ── */

function formToYaml(form: ClinicCreateData): string {
  const cfg = form.config
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const doc: any = {
    clinic_id: form.clinic_id,
    name: form.name,
  }

  // Modules
  doc.modules = {
    telegram: {
      enabled: cfg.telegram_enabled,
      config: {
        bot_token: cfg.telegram_bot_token || '${TELEGRAM_BOT_TOKEN}',
        streaming: cfg.telegram_streaming,
      },
    },
    google_sheets: {
      enabled: cfg.google_sheets_enabled,
      config: {
        spreadsheet_id: cfg.google_sheets_id || '${SHEET_ID}',
        credentials_path: cfg.google_sa_key_path,
        capabilities: {
          can_book: cfg.google_sheets_can_book,
          can_cancel: cfg.google_sheets_can_cancel,
          can_register_patient: cfg.google_sheets_can_register_patient,
          can_confirm: cfg.google_sheets_can_confirm,
        },
      },
    },
  }

  // Channels
  doc.channels = {}
  for (const [key, ch] of Object.entries(cfg.channels)) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const entry: any = {
      enabled: ch.enabled,
      tone: ch.tone,
      features: ch.features,
    }
    if (ch.greeting) entry.greeting = ch.greeting
    doc.channels[key] = entry
  }

  // Booking
  doc.pricing_mode = cfg.pricing_mode
  doc.show_doctors = cfg.show_doctors
  doc.allow_primary = cfg.allow_primary
  doc.advance_days = cfg.advance_days
  doc.primary_patients = cfg.primary_patients
  doc.max_retries = cfg.max_retries
  doc.handoff_notify_via = cfg.handoff_notify_via
  doc.require_phone_for = cfg.require_phone_for

  // Confirmation
  doc.confirmation = {
    enabled: cfg.confirmation_enabled,
    schedule_hours: cfg.confirmation_schedule_hours.split(',').map((s) => Number(s.trim())).filter(Boolean),
    advance_days: cfg.confirmation_advance_days,
    message_template: cfg.confirmation_message_template,
  }

  // Handoff
  doc.handoff = {
    admin_chat_id: cfg.handoff_admin_chat_id || '${HANDOFF_ADMIN_CHAT_ID}',
    cooldown_minutes: cfg.handoff_cooldown_minutes,
  }

  // Knowledge
  doc.knowledge = {
    about: cfg.knowledge_about,
    address: cfg.knowledge_address,
    phone: cfg.knowledge_phone,
    working_hours: cfg.knowledge_working_hours,
    features: cfg.knowledge_features,
    services: cfg.knowledge_services.map((s) => ({
      name: s.name,
      category: s.category,
      price_from: s.price_from || undefined,
      price_to: s.price_to || undefined,
      duration_min: s.duration_min || undefined,
      description: s.description || undefined,
    })),
    doctors: cfg.knowledge_doctors.map((d) => ({
      name: d.name,
      specialty: d.specialty,
      description: d.description || undefined,
    })),
    faq: cfg.knowledge_faq.map((f) => ({
      q: f.question,
      a: f.answer,
    })),
  }

  return yaml.dump(doc, { lineWidth: 120, noRefs: true, quotingType: '"' })
}

function yamlToForm(text: string): ClinicCreateData {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const doc: any = yaml.load(text)
  const form = defaultForm()

  if (doc.clinic_id) {
    form.clinic_id = doc.clinic_id
    form.id = doc.clinic_id
  }
  if (doc.name) form.name = doc.name

  // Modules
  if (doc.modules?.telegram) {
    form.config.telegram_enabled = doc.modules.telegram.enabled ?? false
    form.config.telegram_bot_token = doc.modules.telegram.config?.bot_token || ''
    form.config.telegram_streaming = doc.modules.telegram.config?.streaming ?? true
  }
  if (doc.modules?.google_sheets) {
    form.config.google_sheets_enabled = doc.modules.google_sheets.enabled ?? false
    form.config.google_sheets_id = doc.modules.google_sheets.config?.spreadsheet_id || ''
    form.config.google_sa_key_path = doc.modules.google_sheets.config?.credentials_path || form.config.google_sa_key_path
    const caps = doc.modules.google_sheets.config?.capabilities
    if (caps) {
      form.config.google_sheets_can_book = caps.can_book ?? true
      form.config.google_sheets_can_cancel = caps.can_cancel ?? true
      form.config.google_sheets_can_register_patient = caps.can_register_patient ?? true
      form.config.google_sheets_can_confirm = caps.can_confirm ?? true
    }
  }

  // Channels
  if (doc.channels) {
    for (const [key, val] of Object.entries(doc.channels)) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const ch = val as any
      form.config.channels[key] = {
        enabled: ch.enabled ?? false,
        tone: ch.tone || 'friendly',
        greeting: ch.greeting || '',
        features: ch.features || [],
      }
    }
  }

  // Booking
  if (doc.pricing_mode) form.config.pricing_mode = doc.pricing_mode
  if (doc.show_doctors !== undefined) form.config.show_doctors = doc.show_doctors
  if (doc.allow_primary !== undefined) form.config.allow_primary = doc.allow_primary
  if (doc.advance_days !== undefined) form.config.advance_days = doc.advance_days
  if (doc.primary_patients) form.config.primary_patients = doc.primary_patients
  if (doc.max_retries !== undefined) form.config.max_retries = doc.max_retries
  if (doc.handoff_notify_via) form.config.handoff_notify_via = doc.handoff_notify_via
  if (doc.require_phone_for) form.config.require_phone_for = doc.require_phone_for

  // Confirmation
  if (doc.confirmation) {
    form.config.confirmation_enabled = doc.confirmation.enabled ?? true
    if (doc.confirmation.schedule_hours) {
      form.config.confirmation_schedule_hours = doc.confirmation.schedule_hours.join(', ')
    }
    if (doc.confirmation.advance_days !== undefined) form.config.confirmation_advance_days = doc.confirmation.advance_days
    if (doc.confirmation.message_template) form.config.confirmation_message_template = doc.confirmation.message_template
  }

  // Handoff
  if (doc.handoff) {
    form.config.handoff_admin_chat_id = doc.handoff.admin_chat_id || ''
    if (doc.handoff.cooldown_minutes !== undefined) form.config.handoff_cooldown_minutes = doc.handoff.cooldown_minutes
  }

  // Knowledge
  if (doc.knowledge) {
    form.config.knowledge_about = doc.knowledge.about || ''
    form.config.knowledge_address = doc.knowledge.address || ''
    form.config.knowledge_phone = doc.knowledge.phone || ''
    form.config.knowledge_working_hours = doc.knowledge.working_hours || ''
    form.config.knowledge_features = doc.knowledge.features || []
    if (doc.knowledge.services) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      form.config.knowledge_services = doc.knowledge.services.map((s: any) => ({
        name: s.name || '',
        category: s.category || '',
        price_from: s.price_from ?? '',
        price_to: s.price_to ?? '',
        duration_min: s.duration_min ?? '',
        description: s.description || '',
      }))
    }
    if (doc.knowledge.doctors) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      form.config.knowledge_doctors = doc.knowledge.doctors.map((d: any) => ({
        name: d.name || '',
        specialty: d.specialty || '',
        description: d.description || '',
      }))
    }
    if (doc.knowledge.faq) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      form.config.knowledge_faq = doc.knowledge.faq.map((f: any) => ({
        question: f.q || '',
        answer: f.a || '',
      }))
    }
  }

  // Also parse legacy flat crm / gateway keys
  if (doc.crm) {
    form.config.google_sheets_enabled = true
    form.config.google_sheets_id = doc.crm.spreadsheet_id || form.config.google_sheets_id
    form.config.google_sa_key_path = doc.crm.credentials_path || form.config.google_sa_key_path
    if (doc.crm.capabilities) {
      form.config.google_sheets_can_book = doc.crm.capabilities.can_book ?? true
      form.config.google_sheets_can_cancel = doc.crm.capabilities.can_cancel ?? true
      form.config.google_sheets_can_register_patient = doc.crm.capabilities.can_register_patient ?? true
      form.config.google_sheets_can_confirm = doc.crm.capabilities.can_confirm ?? true
    }
  }
  if (doc.gateway?.telegram) {
    form.config.telegram_enabled = doc.gateway.telegram.enabled ?? true
    form.config.telegram_bot_token = doc.gateway.telegram.bot_token || form.config.telegram_bot_token
    form.config.telegram_streaming = doc.gateway.telegram.streaming ?? true
  }

  return form
}

/* ══════════════════════════════════════════════════════════
   Main page component
   ══════════════════════════════════════════════════════════ */

export function ClinicCreatePage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [form, setForm] = useState<ClinicCreateData>(defaultForm)
  const [slugManual, setSlugManual] = useState(false)

  // Section expand state — all expanded by default
  const [expanded, setExpanded] = useState<Record<string, boolean>>({
    basic: true, server: true, modules: true, channels: true,
    booking: true, confirmation: true, handoff: true, llm: true,
    knowledge: true, import: true,
  })

  // Save / deploy
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const [deploying, setDeploying] = useState(false)
  const [deploySteps, setDeploySteps] = useState<DeployStep[]>([])
  const [deployDone, setDeployDone] = useState(false)
  const [deployError, setDeployError] = useState('')
  const eventSourceRef = useRef<EventSource | null>(null)

  // YAML import
  const [yamlText, setYamlText] = useState('')
  const [yamlError, setYamlError] = useState('')
  const [showYamlExport, setShowYamlExport] = useState(false)

  /* ── form helpers ── */

  function patch(partial: Partial<ClinicCreateData>) {
    setForm((prev) => ({ ...prev, ...partial }))
  }

  function patchConfig(partial: Partial<ClinicCreateData['config']>) {
    setForm((prev) => ({ ...prev, config: { ...prev.config, ...partial } }))
  }

  function patchChannel(key: string, partial: Partial<ClinicCreateData['config']['channels'][string]>) {
    setForm((prev) => ({
      ...prev,
      config: {
        ...prev.config,
        channels: {
          ...prev.config.channels,
          [key]: { ...(prev.config.channels[key] || defaultChannel()), ...partial },
        },
      },
    }))
  }

  function toggleSection(id: string) {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }))
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

  /* ── Knowledge list helpers ── */

  function addFeature() {
    patchConfig({ knowledge_features: [...form.config.knowledge_features, ''] })
  }
  function removeFeature(idx: number) {
    patchConfig({ knowledge_features: form.config.knowledge_features.filter((_, i) => i !== idx) })
  }
  function updateFeature(idx: number, val: string) {
    const arr = [...form.config.knowledge_features]
    arr[idx] = val
    patchConfig({ knowledge_features: arr })
  }

  function addService() {
    patchConfig({
      knowledge_services: [...form.config.knowledge_services, { name: '', category: '', price_from: '', price_to: '', duration_min: '', description: '' }],
    })
  }
  function removeService(idx: number) {
    patchConfig({ knowledge_services: form.config.knowledge_services.filter((_, i) => i !== idx) })
  }
  function updateService(idx: number, partial: Partial<ServiceItem>) {
    const arr = [...form.config.knowledge_services]
    arr[idx] = { ...arr[idx], ...partial }
    patchConfig({ knowledge_services: arr })
  }

  function addDoctor() {
    patchConfig({ knowledge_doctors: [...form.config.knowledge_doctors, { name: '', specialty: '', description: '' }] })
  }
  function removeDoctor(idx: number) {
    patchConfig({ knowledge_doctors: form.config.knowledge_doctors.filter((_, i) => i !== idx) })
  }
  function updateDoctor(idx: number, partial: Partial<DoctorItem>) {
    const arr = [...form.config.knowledge_doctors]
    arr[idx] = { ...arr[idx], ...partial }
    patchConfig({ knowledge_doctors: arr })
  }

  function addFaq() {
    patchConfig({ knowledge_faq: [...form.config.knowledge_faq, { question: '', answer: '' }] })
  }
  function removeFaq(idx: number) {
    patchConfig({ knowledge_faq: form.config.knowledge_faq.filter((_, i) => i !== idx) })
  }
  function updateFaq(idx: number, partial: Partial<FaqItem>) {
    const arr = [...form.config.knowledge_faq]
    arr[idx] = { ...arr[idx], ...partial }
    patchConfig({ knowledge_faq: arr })
  }

  /* channel feature toggle */
  function toggleChannelFeature(chKey: string, feature: string) {
    const ch = form.config.channels[chKey] || defaultChannel()
    const features = ch.features.includes(feature)
      ? ch.features.filter((f) => f !== feature)
      : [...ch.features, feature]
    patchChannel(chKey, { features })
  }

  /* phone requirement toggle */
  function togglePhoneReq(val: string) {
    const arr = form.config.require_phone_for.includes(val)
      ? form.config.require_phone_for.filter((v) => v !== val)
      : [...form.config.require_phone_for, val]
    patchConfig({ require_phone_for: arr })
  }

  /* ── YAML import/export ── */

  function handleYamlImport() {
    setYamlError('')
    try {
      const imported = yamlToForm(yamlText)
      setForm(imported)
      if (imported.clinic_id) setSlugManual(true)
      setYamlText('')
    } catch (e) {
      setYamlError(`YAML parse error: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  /* ── save ── */

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

  /* ── deploy via SSE ── */

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
        // ignore
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
        setDeployDone(true)
        setDeploying(false)
      } else {
        setDeployError('Connection to deploy stream lost')
        setDeploying(false)
        es.close()
        eventSourceRef.current = null
      }
    })
  }, [form.clinic_id, queryClient])

  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close()
      }
    }
  }, [])

  /* ══════════════════════════════════════════════════════════
     Render
     ══════════════════════════════════════════════════════════ */

  return (
    <div className="min-h-screen pb-24">
      {/* Header */}
      <div className="max-w-[900px] mx-auto px-6 pt-6 pb-4">
        <button
          onClick={() => navigate('/')}
          className="text-xs text-[#64748b] hover:text-white transition-colors mb-3 flex items-center gap-1"
        >
          {'\u2190'} Back to Clinics
        </button>
        <h1 className="text-xl font-bold text-white">New Clinic</h1>
        <p className="text-xs text-[#64748b] mt-1">Configure all settings for a new clinic deployment.</p>
      </div>

      {/* Sections */}
      <div className="max-w-[900px] mx-auto px-6 space-y-4">

        {/* ── Section 1: Basic Info ── */}
        <Section id="basic" title="Basic Info" expanded={expanded.basic} onToggle={() => toggleSection('basic')}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
        </Section>

        {/* ── Section 2: Server & Deploy ── */}
        <Section id="server" title="Server & Deploy" expanded={expanded.server} onToggle={() => toggleSection('server')}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
              <div className="flex gap-4 mt-1">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="ssh_auth"
                    checked={form.ssh_auth_type === 'key'}
                    onChange={() => patch({ ssh_auth_type: 'key' })}
                    className="text-[#818cf8]"
                  />
                  <span className="text-sm text-[#94a3b8]">SSH Key</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="ssh_auth"
                    checked={form.ssh_auth_type === 'password'}
                    onChange={() => patch({ ssh_auth_type: 'password' })}
                    className="text-[#818cf8]"
                  />
                  <span className="text-sm text-[#94a3b8]">Password</span>
                </label>
              </div>
            </div>
            <div className="sm:col-span-2">
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
        </Section>

        {/* ── Section 3: Modules ── */}
        <Section id="modules" title="Modules" expanded={expanded.modules} onToggle={() => toggleSection('modules')}>
          {/* Telegram Bot */}
          <div className="bg-[#0a0a1a] rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-white">Telegram Bot</span>
              <Toggle value={form.config.telegram_enabled} onChange={(v) => patchConfig({ telegram_enabled: v })} />
            </div>
            {form.config.telegram_enabled && (
              <div className="space-y-3 pl-2 border-l-2 border-[#2a2a4a] ml-1">
                <div>
                  <label className={LABEL}>Bot Token</label>
                  <input
                    type="password"
                    value={form.config.telegram_bot_token}
                    onChange={(e) => patchConfig({ telegram_bot_token: e.target.value })}
                    placeholder="123456:ABC-DEF..."
                    className={INPUT_MONO}
                  />
                </div>
                <Toggle value={form.config.telegram_streaming} onChange={(v) => patchConfig({ telegram_streaming: v })} label="Streaming" />
              </div>
            )}
          </div>

          {/* Google Sheets CRM */}
          <div className="bg-[#0a0a1a] rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-white">Google Sheets CRM</span>
              <Toggle value={form.config.google_sheets_enabled} onChange={(v) => patchConfig({ google_sheets_enabled: v })} />
            </div>
            {form.config.google_sheets_enabled && (
              <div className="space-y-3 pl-2 border-l-2 border-[#2a2a4a] ml-1">
                <div>
                  <label className={LABEL}>Spreadsheet ID</label>
                  <input
                    type="text"
                    value={form.config.google_sheets_id}
                    onChange={(e) => patchConfig({ google_sheets_id: e.target.value })}
                    placeholder="1a2b3c..."
                    className={INPUT_MONO}
                  />
                </div>
                <div>
                  <label className={LABEL}>Credentials Path</label>
                  <input
                    type="text"
                    value={form.config.google_sa_key_path}
                    onChange={(e) => patchConfig({ google_sa_key_path: e.target.value })}
                    className={INPUT_MONO}
                  />
                </div>
                <div>
                  <label className={LABEL}>Capabilities</label>
                  <div className="flex flex-wrap gap-4 mt-1">
                    <Checkbox checked={form.config.google_sheets_can_book} onChange={(v) => patchConfig({ google_sheets_can_book: v })} label="can_book" />
                    <Checkbox checked={form.config.google_sheets_can_cancel} onChange={(v) => patchConfig({ google_sheets_can_cancel: v })} label="can_cancel" />
                    <Checkbox checked={form.config.google_sheets_can_register_patient} onChange={(v) => patchConfig({ google_sheets_can_register_patient: v })} label="can_register_patient" />
                    <Checkbox checked={form.config.google_sheets_can_confirm} onChange={(v) => patchConfig({ google_sheets_can_confirm: v })} label="can_confirm" />
                  </div>
                </div>
              </div>
            )}
          </div>
        </Section>

        {/* ── Section 4: Channels ── */}
        <Section id="channels" title="Channels" expanded={expanded.channels} onToggle={() => toggleSection('channels')}>
          {Object.entries(form.config.channels).map(([key, ch]) => (
            <div key={key} className="bg-[#0a0a1a] rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-white font-mono">{key}</span>
                <Toggle value={ch.enabled} onChange={(v) => patchChannel(key, { enabled: v })} />
              </div>
              {ch.enabled && (
                <div className="space-y-3 pl-2 border-l-2 border-[#2a2a4a] ml-1">
                  <div>
                    <label className={LABEL}>Tone</label>
                    <select
                      value={ch.tone}
                      onChange={(e) => patchChannel(key, { tone: e.target.value as 'friendly' | 'formal' | 'neutral' })}
                      className={INPUT}
                    >
                      <option value="friendly">Friendly</option>
                      <option value="formal">Formal</option>
                      <option value="neutral">Neutral</option>
                    </select>
                  </div>
                  <div>
                    <label className={LABEL}>Greeting Message</label>
                    <textarea
                      value={ch.greeting}
                      onChange={(e) => patchChannel(key, { greeting: e.target.value })}
                      placeholder="Здравствуйте! Клиника..."
                      className={`${INPUT} resize-y min-h-[60px]`}
                      rows={2}
                    />
                  </div>
                  <div>
                    <label className={LABEL}>Features</label>
                    <div className="flex flex-wrap gap-4 mt-1">
                      {ALL_FEATURES.map((f) => (
                        <Checkbox key={f} checked={ch.features.includes(f)} onChange={() => toggleChannelFeature(key, f)} label={f} />
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </Section>

        {/* ── Section 5: Booking Settings ── */}
        <Section id="booking" title="Booking Settings" expanded={expanded.booking} onToggle={() => toggleSection('booking')}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={LABEL}>Pricing Mode</label>
              <div className="flex gap-4 mt-1">
                {(['range', 'exact', 'hidden'] as const).map((m) => (
                  <label key={m} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="pricing_mode"
                      checked={form.config.pricing_mode === m}
                      onChange={() => patchConfig({ pricing_mode: m })}
                      className="text-[#818cf8]"
                    />
                    <span className="text-sm text-[#94a3b8] capitalize">{m}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <Toggle value={form.config.show_doctors} onChange={(v) => patchConfig({ show_doctors: v })} label="Show Doctors" />
              <Toggle value={form.config.allow_primary} onChange={(v) => patchConfig({ allow_primary: v })} label="Allow Primary" />
            </div>
            <div>
              <label className={LABEL}>Advance Days</label>
              <input
                type="number"
                value={form.config.advance_days}
                onChange={(e) => patchConfig({ advance_days: Number(e.target.value) || 14 })}
                className={INPUT_MONO}
              />
            </div>
            <div>
              <label className={LABEL}>Primary Patients</label>
              <select
                value={form.config.primary_patients}
                onChange={(e) => patchConfig({ primary_patients: e.target.value as 'always' | 'never' | 'ask' })}
                className={INPUT}
              >
                <option value="always">Always</option>
                <option value="never">Never</option>
                <option value="ask">Ask</option>
              </select>
            </div>
            <div>
              <label className={LABEL}>Max Retries</label>
              <input
                type="number"
                value={form.config.max_retries}
                onChange={(e) => patchConfig({ max_retries: Number(e.target.value) || 3 })}
                className={INPUT_MONO}
              />
            </div>
            <div>
              <label className={LABEL}>Handoff Notify Via</label>
              <select
                value={form.config.handoff_notify_via}
                onChange={(e) => patchConfig({ handoff_notify_via: e.target.value as 'telegram' | 'email' | 'none' })}
                className={INPUT}
              >
                <option value="telegram">Telegram</option>
                <option value="email">Email</option>
                <option value="none">None</option>
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className={LABEL}>Require Phone For</label>
              <div className="flex flex-wrap gap-4 mt-1">
                {PHONE_OPTIONS.map((opt) => (
                  <Checkbox key={opt} checked={form.config.require_phone_for.includes(opt)} onChange={() => togglePhoneReq(opt)} label={opt} />
                ))}
              </div>
            </div>
          </div>
        </Section>

        {/* ── Section 6: Confirmation ── */}
        <Section id="confirmation" title="Confirmation" expanded={expanded.confirmation} onToggle={() => toggleSection('confirmation')}>
          <Toggle value={form.config.confirmation_enabled} onChange={(v) => patchConfig({ confirmation_enabled: v })} label="Enabled" />
          {form.config.confirmation_enabled && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2">
              <div>
                <label className={LABEL}>Schedule Hours (comma-separated)</label>
                <input
                  type="text"
                  value={form.config.confirmation_schedule_hours}
                  onChange={(e) => patchConfig({ confirmation_schedule_hours: e.target.value })}
                  placeholder="10, 17"
                  className={INPUT_MONO}
                />
              </div>
              <div>
                <label className={LABEL}>Advance Days</label>
                <input
                  type="number"
                  value={form.config.confirmation_advance_days}
                  onChange={(e) => patchConfig({ confirmation_advance_days: Number(e.target.value) || 1 })}
                  className={INPUT_MONO}
                />
              </div>
              <div className="sm:col-span-2">
                <label className={LABEL}>Message Template</label>
                <textarea
                  value={form.config.confirmation_message_template}
                  onChange={(e) => patchConfig({ confirmation_message_template: e.target.value })}
                  className={`${INPUT} resize-y min-h-[60px]`}
                  rows={2}
                />
                <p className="text-[10px] text-[#475569] mt-1">Placeholders: {'{date}'}, {'{time}'}, {'{doctor}'}</p>
              </div>
            </div>
          )}
        </Section>

        {/* ── Section 7: Handoff ── */}
        <Section id="handoff" title="Handoff" expanded={expanded.handoff} onToggle={() => toggleSection('handoff')}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={LABEL}>Admin Chat ID</label>
              <input
                type="text"
                value={form.config.handoff_admin_chat_id}
                onChange={(e) => patchConfig({ handoff_admin_chat_id: e.target.value })}
                placeholder="-1001234567890"
                className={INPUT_MONO}
              />
            </div>
            <div>
              <label className={LABEL}>Cooldown Minutes</label>
              <input
                type="number"
                value={form.config.handoff_cooldown_minutes}
                onChange={(e) => patchConfig({ handoff_cooldown_minutes: Number(e.target.value) || 30 })}
                className={INPUT_MONO}
              />
            </div>
          </div>
        </Section>

        {/* ── Section 8: OpenAI / LLM ── */}
        <Section id="llm" title="OpenAI / LLM" expanded={expanded.llm} onToggle={() => toggleSection('llm')}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={LABEL}>OpenAI API Key</label>
              <input
                type="password"
                value={form.config.openai_api_key}
                onChange={(e) => patchConfig({ openai_api_key: e.target.value })}
                className={INPUT_MONO}
              />
            </div>
            <div>
              <label className={LABEL}>OpenAI API Base URL</label>
              <input
                type="text"
                value={form.config.openai_api_base}
                onChange={(e) => patchConfig({ openai_api_base: e.target.value })}
                className={INPUT_MONO}
              />
            </div>
            <div>
              <label className={LABEL}>OpenAI Proxy Secret</label>
              <input
                type="password"
                value={form.config.openai_proxy_secret}
                onChange={(e) => patchConfig({ openai_proxy_secret: e.target.value })}
                className={INPUT_MONO}
              />
            </div>
            <div>
              <label className={LABEL}>Model</label>
              <input
                type="text"
                value={form.config.openai_model}
                onChange={(e) => patchConfig({ openai_model: e.target.value })}
                className={INPUT_MONO}
              />
            </div>
            <div>
              <label className={LABEL}>Fallback Model</label>
              <input
                type="text"
                value={form.config.openai_fallback_model}
                onChange={(e) => patchConfig({ openai_fallback_model: e.target.value })}
                className={INPUT_MONO}
              />
            </div>
          </div>
        </Section>

        {/* ── Section 9: Knowledge Base ── */}
        <Section id="knowledge" title="Knowledge Base" expanded={expanded.knowledge} onToggle={() => toggleSection('knowledge')}>
          <div className="space-y-4">
            {/* Basic knowledge fields */}
            <div>
              <label className={LABEL}>About</label>
              <textarea
                value={form.config.knowledge_about}
                onChange={(e) => patchConfig({ knowledge_about: e.target.value })}
                placeholder="Описание клиники..."
                className={`${INPUT} resize-y min-h-[60px]`}
                rows={2}
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={LABEL}>Address</label>
                <input
                  type="text"
                  value={form.config.knowledge_address}
                  onChange={(e) => patchConfig({ knowledge_address: e.target.value })}
                  placeholder="г. Москва, ул. Примерная, д. 7"
                  className={INPUT}
                />
              </div>
              <div>
                <label className={LABEL}>Phone</label>
                <input
                  type="text"
                  value={form.config.knowledge_phone}
                  onChange={(e) => patchConfig({ knowledge_phone: e.target.value })}
                  placeholder="+7 (495) 000-00-00"
                  className={INPUT}
                />
              </div>
              <div className="sm:col-span-2">
                <label className={LABEL}>Working Hours</label>
                <input
                  type="text"
                  value={form.config.knowledge_working_hours}
                  onChange={(e) => patchConfig({ knowledge_working_hours: e.target.value })}
                  placeholder="Пн-Пт 09:00-20:00"
                  className={INPUT}
                />
              </div>
            </div>

            {/* Features list */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className={LABEL}>Features</label>
                <button
                  type="button"
                  onClick={addFeature}
                  className="text-xs text-[#818cf8] hover:text-[#6366f1] transition-colors"
                >
                  + Add
                </button>
              </div>
              <div className="space-y-2">
                {form.config.knowledge_features.map((f, i) => (
                  <div key={i} className="flex gap-2">
                    <input
                      type="text"
                      value={f}
                      onChange={(e) => updateFeature(i, e.target.value)}
                      placeholder="Feature description..."
                      className={`${INPUT} flex-1`}
                    />
                    <button
                      type="button"
                      onClick={() => removeFeature(i)}
                      className="text-[#f87171] hover:text-[#ef4444] text-sm px-2 transition-colors"
                    >
                      {'\u2717'}
                    </button>
                  </div>
                ))}
                {form.config.knowledge_features.length === 0 && (
                  <p className="text-[10px] text-[#475569]">No features added yet.</p>
                )}
              </div>
            </div>

            {/* Services table */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className={LABEL}>Services</label>
                <button
                  type="button"
                  onClick={addService}
                  className="text-xs text-[#818cf8] hover:text-[#6366f1] transition-colors"
                >
                  + Add
                </button>
              </div>
              {form.config.knowledge_services.length > 0 && (
                <div className="space-y-2">
                  {form.config.knowledge_services.map((s, i) => (
                    <div key={i} className="bg-[#0a0a1a] rounded-lg p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-[#64748b]">Service #{i + 1}</span>
                        <button
                          type="button"
                          onClick={() => removeService(i)}
                          className="text-[#f87171] hover:text-[#ef4444] text-sm px-1 transition-colors"
                        >
                          {'\u2717'}
                        </button>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        <input type="text" value={s.name} onChange={(e) => updateService(i, { name: e.target.value })} placeholder="Name" className={INPUT} />
                        <input type="text" value={s.category} onChange={(e) => updateService(i, { category: e.target.value })} placeholder="Category" className={INPUT} />
                        <input type="number" value={s.price_from} onChange={(e) => updateService(i, { price_from: e.target.value ? Number(e.target.value) : '' })} placeholder="Price from" className={INPUT_MONO} />
                        <input type="number" value={s.price_to} onChange={(e) => updateService(i, { price_to: e.target.value ? Number(e.target.value) : '' })} placeholder="Price to" className={INPUT_MONO} />
                        <input type="number" value={s.duration_min} onChange={(e) => updateService(i, { duration_min: e.target.value ? Number(e.target.value) : '' })} placeholder="Duration (min)" className={INPUT_MONO} />
                        <input type="text" value={s.description} onChange={(e) => updateService(i, { description: e.target.value })} placeholder="Description" className={INPUT} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {form.config.knowledge_services.length === 0 && (
                <p className="text-[10px] text-[#475569]">No services added yet.</p>
              )}
            </div>

            {/* Doctors table */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className={LABEL}>Doctors</label>
                <button
                  type="button"
                  onClick={addDoctor}
                  className="text-xs text-[#818cf8] hover:text-[#6366f1] transition-colors"
                >
                  + Add
                </button>
              </div>
              {form.config.knowledge_doctors.length > 0 && (
                <div className="space-y-2">
                  {form.config.knowledge_doctors.map((d, i) => (
                    <div key={i} className="bg-[#0a0a1a] rounded-lg p-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs text-[#64748b]">Doctor #{i + 1}</span>
                        <button
                          type="button"
                          onClick={() => removeDoctor(i)}
                          className="text-[#f87171] hover:text-[#ef4444] text-sm px-1 transition-colors"
                        >
                          {'\u2717'}
                        </button>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <input type="text" value={d.name} onChange={(e) => updateDoctor(i, { name: e.target.value })} placeholder="Name" className={INPUT} />
                        <input type="text" value={d.specialty} onChange={(e) => updateDoctor(i, { specialty: e.target.value })} placeholder="Specialty" className={INPUT} />
                        <input type="text" value={d.description} onChange={(e) => updateDoctor(i, { description: e.target.value })} placeholder="Description" className={INPUT} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {form.config.knowledge_doctors.length === 0 && (
                <p className="text-[10px] text-[#475569]">No doctors added yet.</p>
              )}
            </div>

            {/* FAQ table */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className={LABEL}>FAQ</label>
                <button
                  type="button"
                  onClick={addFaq}
                  className="text-xs text-[#818cf8] hover:text-[#6366f1] transition-colors"
                >
                  + Add
                </button>
              </div>
              {form.config.knowledge_faq.length > 0 && (
                <div className="space-y-2">
                  {form.config.knowledge_faq.map((f, i) => (
                    <div key={i} className="bg-[#0a0a1a] rounded-lg p-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs text-[#64748b]">FAQ #{i + 1}</span>
                        <button
                          type="button"
                          onClick={() => removeFaq(i)}
                          className="text-[#f87171] hover:text-[#ef4444] text-sm px-1 transition-colors"
                        >
                          {'\u2717'}
                        </button>
                      </div>
                      <div className="grid grid-cols-1 gap-2">
                        <input type="text" value={f.question} onChange={(e) => updateFaq(i, { question: e.target.value })} placeholder="Question" className={INPUT} />
                        <textarea value={f.answer} onChange={(e) => updateFaq(i, { answer: e.target.value })} placeholder="Answer" className={`${INPUT} resize-y min-h-[40px]`} rows={1} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {form.config.knowledge_faq.length === 0 && (
                <p className="text-[10px] text-[#475569]">No FAQ entries added yet.</p>
              )}
            </div>
          </div>
        </Section>

        {/* ── Section 10: Import / Export YAML ── */}
        <Section id="import" title="Import / Export YAML" expanded={expanded.import} onToggle={() => toggleSection('import')}>
          <div className="space-y-3">
            <div>
              <label className={LABEL}>Paste YAML config to import</label>
              <textarea
                value={yamlText}
                onChange={(e) => setYamlText(e.target.value)}
                placeholder="clinic_id: my_clinic\nname: My Clinic\n..."
                className={`${INPUT_MONO} resize-y min-h-[120px]`}
                rows={6}
              />
              {yamlError && <p className="text-xs text-[#f87171] mt-1">{yamlError}</p>}
              <button
                type="button"
                onClick={handleYamlImport}
                disabled={!yamlText.trim()}
                className="mt-2 px-4 py-2 text-sm rounded-lg bg-[#818cf8] hover:bg-[#6366f1] text-white font-medium transition-colors disabled:opacity-50"
              >
                Import from YAML
              </button>
            </div>
            <div>
              <button
                type="button"
                onClick={() => setShowYamlExport(!showYamlExport)}
                className="text-xs text-[#818cf8] hover:text-[#6366f1] transition-colors"
              >
                {showYamlExport ? 'Hide' : 'Export as YAML'}
              </button>
              {showYamlExport && (
                <pre className="mt-2 p-4 bg-[#0a0a1a] border border-[#2a2a4a] rounded-lg text-xs text-[#e2e8f0] font-mono overflow-x-auto whitespace-pre-wrap max-h-[400px] overflow-y-auto">
                  {formToYaml(form)}
                </pre>
              )}
            </div>
          </div>
        </Section>
      </div>

      {/* ── Sticky bottom bar ── */}
      <div className="fixed bottom-0 left-0 right-0 bg-[#111127] border-t border-[#1e293b] px-6 py-3 z-40">
        <div className="max-w-[900px] mx-auto flex items-center gap-3">
          {!saved && (
            <button
              onClick={handleSave}
              disabled={saving || !form.name.trim() || !form.clinic_id.trim()}
              className="px-6 py-2 text-sm rounded-lg bg-[#818cf8] hover:bg-[#6366f1] text-white font-medium transition-colors disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
          )}
          {saved && !deploying && !deployDone && (
            <>
              <button
                onClick={startDeploy}
                className="px-6 py-2 text-sm rounded-lg bg-[#059669] hover:bg-[#047857] text-white font-medium transition-colors"
              >
                Deploy
              </button>
              <span className="text-[#4ade80] text-xs">Saved to Hub DB</span>
            </>
          )}
          {deploying && (
            <span className="text-[#818cf8] text-xs flex items-center gap-2">
              <span className="inline-block w-4 h-4 border-2 border-[#818cf8] border-t-transparent rounded-full animate-spin" />
              Deploying...
            </span>
          )}
          {deployDone && !deployError && (
            <span className="text-[#4ade80] text-sm font-medium">Deploy complete!</span>
          )}
          {deployError && (
            <span className="text-[#f87171] text-sm">{deployError}</span>
          )}
          {error && <span className="text-[#f87171] text-xs">{error}</span>}

          {/* Deploy progress inline */}
          {(deploying || deploySteps.length > 0) && (
            <div className="ml-4 flex-1 max-w-md">
              <DeployProgress steps={deploySteps} />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
