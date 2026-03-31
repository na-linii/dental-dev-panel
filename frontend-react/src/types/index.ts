export interface Clinic {
  id: string
  name: string
  server_host: string
  server_port: number
  clinic_id: string
  status: string
  config: Record<string, unknown>
  created_at: string
  updated_at?: string
}

export interface HealthResponse {
  status: string
  error?: string
}

export interface ChatRequest {
  message: string
  clinic_id: string
  channel: string
  channel_user_id: string
  thread_id: string
  phone?: string
  name?: string
  channel_username?: string
}

export interface ChatResponse {
  response: string
  trace_id?: string
  thread_id: string
  error?: boolean
  is_identified?: boolean
  display_name?: string
  identity_ms?: number
}

export interface GraphNode {
  id: string
  name: string
  group: string
  val: number
  shape: string
  color?: string
  planned?: boolean
  description?: string
  connects_to?: string[]
  prompt_name?: string
  inputs?: Array<{ name: string; type: string; required?: boolean; description?: string }>
  outputs?: Array<{ name: string; type: string; required?: boolean; description?: string }>
  requires?: string[]
  conflicts_with?: string[]
}

export interface GraphLink {
  source: string
  target: string
}

export interface VizConfigEntry {
  shape: string
  color: string
  val: number
}

export interface GraphMeta {
  version?: string
  model?: string
  clinic_id?: string
  fallback_model?: string
  viz_config?: Record<string, VizConfigEntry>
}

export interface GraphData {
  nodes: GraphNode[]
  links: GraphLink[]
  meta?: GraphMeta
}

export interface EdgeCaseItem {
  id: string
  category: string
  message: string
  expected: string
  patient_name?: string | null
  patient_phone?: string | null
  is_identified: boolean
  history: Array<{ role: string; content: string }>
}

export interface TraceFlow {
  name: string
  type: string
  model?: string
  startTime?: string
  endTime?: string
  input?: unknown
  output?: unknown
  id: string
  parentId?: string
}

export interface TraceSummary {
  id: string
  name: string
  startTime: string
  latency: number | null
  tags: string[]
  userId: string | null
  sessionId: string | null
  input: unknown
  output: unknown
  metadata: Record<string, unknown> | null
  scores: unknown[]
}

export interface User {
  login: string
  avatar: string
  name: string
}

export interface EpicTask {
  key: string
  summary: string
  status: string
  statusCategory: string
  assignee: string | null
  assigneeAvatar: string | null
  url: string
}

export interface EpicProgress {
  total: number
  done: number
  review: number
  in_progress: number
  todo: number
  backlog: number
  percent: number
}

export interface Epic {
  key: string
  summary: string
  status: string
  url?: string
  progress: EpicProgress
  tasks: EpicTask[]
}

export interface EpicsResponse {
  epics: Epic[]
}

export interface AdminUser {
  id: number
  username: string
  full_name: string
  role: string
  clinic_id: string | null
  created_at: string
}

export interface ServiceItem {
  name: string
  category: string
  price_from: number | ''
  price_to: number | ''
  duration_min: number | ''
  description: string
}

export interface DoctorItem {
  name: string
  specialty: string
  description: string
}

export interface FaqItem {
  question: string
  answer: string
}

export interface ClinicCreateData {
  id: string
  name: string
  server_host: string
  server_port: number
  clinic_id: string
  ssh_user: string
  ssh_auth_type: 'key' | 'password'
  hub_url: string
  config: {
    // Modules
    telegram_enabled: boolean
    telegram_bot_token: string
    telegram_streaming: boolean
    google_sheets_enabled: boolean
    google_sheets_id: string
    google_sa_key_path: string
    google_sheets_can_book: boolean
    google_sheets_can_cancel: boolean
    google_sheets_can_register_patient: boolean
    google_sheets_can_confirm: boolean

    // Channels
    channels: {
      [key: string]: {
        enabled: boolean
        tone: 'friendly' | 'formal' | 'neutral'
        greeting: string
        features: string[]
      }
    }

    // Booking
    pricing_mode: 'range' | 'exact' | 'hidden'
    show_doctors: boolean
    allow_primary: boolean
    advance_days: number
    primary_patients: 'always' | 'never' | 'ask'
    max_retries: number
    handoff_notify_via: 'telegram' | 'email' | 'none'
    require_phone_for: string[]

    // Confirmation
    confirmation_enabled: boolean
    confirmation_schedule_hours: string
    confirmation_advance_days: number
    confirmation_message_template: string

    // Handoff
    handoff_admin_chat_id: string
    handoff_cooldown_minutes: number

    // OpenAI / LLM
    openai_api_key: string
    openai_api_base: string
    openai_proxy_secret: string
    openai_model: string
    openai_fallback_model: string

    // Knowledge Base
    knowledge_about: string
    knowledge_address: string
    knowledge_phone: string
    knowledge_working_hours: string
    knowledge_features: string[]
    knowledge_services: ServiceItem[]
    knowledge_doctors: DoctorItem[]
    knowledge_faq: FaqItem[]
  }
}

export interface DeployStep {
  step: string
  status: 'running' | 'done' | 'failed' | 'pending'
  output?: string
}

export interface QualityCategoryResult {
  passed: number
  failed: number
}

export interface QualitySummary {
  total: number
  passed: number
  failed: number
  categories: Record<string, QualityCategoryResult>
  latency_p50: number
  latency_p95: number
  run_name?: string
  run_at?: string
  error?: string
}

export interface QualityRunHistory {
  name: string
  created_at: string
  total: number
  passed: number
  failed: number
  pass_rate: number
  avg_latency: number
}
