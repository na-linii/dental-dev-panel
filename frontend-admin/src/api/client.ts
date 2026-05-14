import axios from 'axios'

// ── Types (matching actual backend responses) ──

export interface AdminUser {
  id: number
  username: string
  full_name: string
  role: string
  clinic_id: string
  clinic_name: string
}

export interface AdminLoginResponse {
  access_token: string
  token_type: string
  user: AdminUser
}

interface PaginatedResponse<T> {
  items: T[]
  total: number
  limit: number
  offset: number
}

export interface AdminDashboardStats {
  timezone: string
  sessions: { bot: number; operator: number; operator_active?: number; closed: number }
  confirmations: Record<string, number>
  pending_actions: number
  total_patients: number
  prev_month?: { total: number; confirmed: number; rescheduled: number; cancelled: number; no_response?: number }
  // PD-373: per-booking SoT для терминальных счётчиков (источник — booking_confirmation_runs).
  bookings_by_patient_response?: { confirmed: number; cancelled: number; rescheduled: number; no_response: number }
}

export interface AdminPatientSummary {
  id: string            // users.id UUID (legacy, still accepted by API for bookmarks)
  public_id: number | null  // short numeric id for URLs (PD-362)
  kind: 'patient' | 'anonymous'
  name: string | null
  phone: string | null
  last_activity_at: string | null
  last_session_id: string | null
  channel: string
  thread_id: string
  controller: string
  confirmation_status: string | null
  operator_id: string | null
  confirmation_appointment_date: string | null
  confirmation_appointment_time: string | null
  confirmation_doctor_name: string | null
  last_message: string | null
  last_message_at: string | null
  is_blocked: boolean
  // PD-393: latest booking_confirmation_runs.status; UI uses
  // `confirmation_status ?? last_run_status` for the reminder badge so the
  // "Визит не подтверждён" indicator survives the 24h sweep clearing the
  // active-cycle cache on chat_sessions.
  last_run_status: string | null
}

/** @deprecated use AdminPatientSummary */
export type AdminSessionSummary = AdminPatientSummary

export interface AdminMessage {
  id: string
  session_id: string
  role: string
  content: string
  metadata: Record<string, unknown> | null
  created_at: string
}

export interface AdminSessionInfo {
  id: string
  channel: string
  thread_id: string
  controller: string
  operator_id: string | null
  cooldown_until: string | null
  confirmation_status: string | null
  confirmation_appointment_id: string | null
  confirmation_appointment_date: string | null
  confirmation_appointment_time: string | null
  confirmation_doctor_name: string | null
  crm_sync_status: string | null
  crm_sync_error: string | null
  created_at: string | null
  updated_at: string | null
  last_run_status: string | null  // PD-393: see AdminPatientSummary
}

export interface AdminPatientDetail {
  id: string
  public_id?: number | null       // PD-362: set for identified patients
  kind: 'patient' | 'anonymous'
  name: string | null
  phone: string | null
  ident_patient_id: string | null
  last_activity_at: string | null
  last_session_id: string | null   // session to send messages to
  sessions: AdminSessionInfo[]
  messages: AdminMessage[]
  has_more_messages: boolean
  // anonymous / backward-compat fields
  channel?: string
  controller?: string
  confirmation_status?: string | null
  patient?: {
    id: string | null
    public_id?: number | null
    name: string | null
    phone: string | null
    ident_patient_id: string | null
  } | null
}

/** @deprecated use AdminPatientDetail */
export type AdminSessionDetail = AdminPatientDetail

export interface AdminSendMessageResponse {
  success: boolean
  message_id: string
  delivered: boolean
}

export interface AdminAction {
  id: string
  action_type: string
  patient_id: string | null           // CRM ident_patient_id (not the patient UUID)
  patient_public_id: number | null    // PD-362: users.public_id — use this for chat navigation
  description: string | null
  data: Record<string, unknown> | null
  status: string
  created_at: string | null
  completed_at: string | null
  session_id: string | null
  patient_name: string | null
  patient_phone: string | null
  appointment_date: string | null
  appointment_time: string | null
  doctor_name: string | null
}

export interface BookingConfirmationRun {
  id: string
  attempt_number: number
  sent_at: string
  status: 'sent' | 'no_response' | 'confirmed' | 'cancelled' | 'rescheduled'
  response_at: string | null
}

export interface AdminBooking {
  id: string
  crm_booking_id: string | null
  patient_id: string | null
  doctor_id: string | null
  service_key: string | null
  appointment_date: string | null
  appointment_time: string | null
  booking_status: string | null
  doctor_name: string | null
  patient_name: string | null
  cached_at: string | null
  confirmation_runs: BookingConfirmationRun[]
}

export interface AdminBotStatus {
  bot_enabled: boolean
  reason: string | null
  toggled_at: string | null
  toggled_by: string | null
}

// ── Voice calls (PD-399) ──

export type VoiceCallEndReason =
  | 'in_progress'
  | 'completed_bot'
  | 'completed_handoff'
  | 'dropped'
  | 'answering_machine'
  | 'error'

export interface AdminCallSummary {
  session_id: string
  livekit_room: string
  caller_phone: string | null
  callee_did: string | null
  started_at: string | null
  ended_at: string | null
  duration_ms: number | null
  end_reason: VoiceCallEndReason | null
  has_recording: boolean
  patient: { id: string; name: string | null; public_id: number | null } | null
  last_message_preview: string | null
  last_message_at: string | null
}

export interface VoiceTurnMeta {
  raw_stt_text: string | null
  stt_confidence: number | null
  stt_latency_ms: number | null
  llm_ttft_ms: number | null
  llm_total_ms: number | null
  tts_ttfb_ms: number | null
  tts_total_ms: number | null
  total_turn_ms: number | null
  vad_interruption_count: number
  was_barge_in: boolean
  filler_used: string | null
}

export interface AdminCallDetail {
  session: {
    id: string
    clinic_id: string
    channel: string
    controller: string
    created_at: string | null
    updated_at: string | null
  }
  voice: {
    livekit_room: string
    egress_id: string | null
    caller_phone: string | null
    callee_did: string | null
    started_at: string | null
    ended_at: string | null
    duration_ms: number | null
    end_reason: VoiceCallEndReason | null
    has_recording: boolean
    recording_format: string | null
    recording_size_bytes: number | null
    recording_ready_at: string | null
  }
  patient: {
    id: string
    name: string | null
    phone: string | null
    public_id: number | null
    ident_patient_id: string | null
  } | null
  messages: Array<{
    id: string
    role: string
    content: string
    created_at: string | null
    voice_turn_meta: VoiceTurnMeta | null
  }>
}

export interface AdminBlocklistItem {
  id: string
  phone: string | null
  telegram_user_id: string | null
  reason: string | null
  created_by: string | null
  created_at: string | null
}

// Telegram Import
export interface TelegramImportStatus {
  task_id: string | null
  status: 'idle' | 'running' | 'completed' | 'failed'
  processed: number
  total: number
  new_messages: number
  started_at: string | null
  finished_at: string | null
  error: string | null
  last_run: {
    task_id: string
    status: string
    mode: string
    processed: number
    new_messages: number
    started_at: string
    finished_at: string | null
    error: string | null
  } | null
}

export interface TelegramImportHistoryItem {
  task_id: string
  status: string
  mode: string
  processed: number
  new_messages: number
  started_at: string
  finished_at: string | null
  error: string | null
}

// MAX Userbot Import (mirrors Telegram import shape; `total`/`processed` count chat_ids, not dialogs)
export interface MaxUserbotImportStatus {
  task_id: string | null
  status: 'idle' | 'running' | 'completed' | 'failed' | 'cancelled'
  processed: number
  total: number
  new_messages: number
  started_at: string | null
  finished_at: string | null
  error: string | null
  last_run: {
    task_id: string
    status: string
    mode: string
    processed: number
    new_messages: number
    started_at: string
    finished_at: string | null
    error: string | null
  } | null
}

export interface MaxUserbotImportHistoryItem {
  task_id: string
  status: string
  mode: string
  processed: number
  new_messages: number
  started_at: string
  finished_at: string | null
  error: string | null
}

// ── API Client ──

const adminApi = axios.create({ baseURL: '/api', timeout: 30_000 })

adminApi.interceptors.request.use((config) => {
  const token = localStorage.getItem('admin_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

adminApi.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401 && !err.config?.url?.includes('/login')) {
      localStorage.removeItem('admin_token')
      localStorage.removeItem('admin_user')
      if (!window.location.pathname.includes('/login')) {
        window.location.href = '/login'
      }
    }
    if (err.response?.status === 502 || err.response?.status === 503) {
      err.message = 'Сервис временно недоступен. Попробуйте позже.'
    }
    if (err.response?.status === 504) {
      err.message = 'Сервис не отвечает. Попробуйте позже.'
    }
    return Promise.reject(err)
  },
)

// ── Auth ──

export const adminLogin = async (username: string, password: string) => {
  const res = await adminApi.post<AdminLoginResponse>('/login', { username, password })
  return res.data
}

export const adminMe = async () => {
  const res = await adminApi.get<AdminUser>('/me')
  return res.data
}

// ── Dashboard ──

export const getAdminDashboardStats = async () =>
  (await adminApi.get<AdminDashboardStats>('/dashboard/stats')).data

// ── Sessions ──

export const getAdminSessions = async (params?: {
  controller?: string
  confirmation_status?: string
  has_confirmation?: boolean
  search?: string
  blocked?: boolean
  limit?: number
  offset?: number
}): Promise<{ items: AdminPatientSummary[]; total: number }> => {
  const res = await adminApi.get<PaginatedResponse<AdminPatientSummary>>('/sessions', { params })
  return { items: res.data.items, total: res.data.total }
}

export const getAdminSession = async (patientId: string, params?: { messages_limit?: number; before_id?: string }) =>
  (await adminApi.get<AdminPatientDetail>(`/sessions/${patientId}`, { params })).data

export const sendAdminMessage = async (sessionId: string, text: string) =>
  (await adminApi.post<AdminSendMessageResponse>(`/sessions/${sessionId}/messages`, { text })).data

export const updateSessionController = async (sessionId: string, controller: string) =>
  (await adminApi.patch(`/sessions/${sessionId}/controller`, { controller })).data

export const updateSessionConfirmation = async (sessionId: string, confirmation_status: string) =>
  (await adminApi.patch(`/sessions/${sessionId}/confirmation`, { confirmation_status })).data

export const updatePatientPhone = async (sessionId: string, phone: string) =>
  (await adminApi.patch(`/sessions/${sessionId}/phone`, { phone })).data

// ── Voice calls (PD-399, superadmin only) ──

export const getAdminCalls = async (params?: {
  from?: string
  to?: string
  end_reason?: VoiceCallEndReason[]
  caller_phone?: string
  has_recording?: boolean
  limit?: number
  offset?: number
}): Promise<{ items: AdminCallSummary[]; total: number }> => {
  const res = await adminApi.get<PaginatedResponse<AdminCallSummary>>('/calls', { params })
  return { items: res.data.items, total: res.data.total }
}

export const getAdminCall = async (sessionId: string): Promise<AdminCallDetail> =>
  (await adminApi.get<AdminCallDetail>(`/calls/${sessionId}`)).data

export interface AdminCallRecordingUrl {
  url: string
  expires_at: string
}

export const getAdminCallRecordingUrl = async (sessionId: string): Promise<AdminCallRecordingUrl> =>
  (await adminApi.get<AdminCallRecordingUrl>(`/calls/${sessionId}/recording-url`)).data

// ── Actions ──

export const getAdminActions = async (params?: { status?: string }) => {
  const res = await adminApi.get<PaginatedResponse<AdminAction>>('/actions', { params })
  return res.data.items ?? res.data
}

export const updateAdminAction = async (actionId: string, status: 'done' | 'failed') =>
  (await adminApi.patch(`/actions/${actionId}`, { status })).data

// ── Bookings ──

export const getAdminBookings = async (params?: { patient_id?: string; date_from?: string; date_to?: string }) => {
  const res = await adminApi.get<{ items: AdminBooking[]; total: number }>('/bookings', { params })
  return res.data.items ?? res.data
}

// ── Settings ──

export const getAdminBotStatus = async () =>
  (await adminApi.get<AdminBotStatus>('/bot/status')).data

export const toggleAdminBot = async (enabled: boolean, reason?: string) =>
  (await adminApi.post<{ success: boolean; bot_enabled: boolean }>('/bot/toggle', { enabled, reason })).data

export const getAdminBlocklist = async () => {
  const res = await adminApi.get<PaginatedResponse<AdminBlocklistItem>>('/blocklist', { params: { limit: 200 } })
  return res.data.items ?? res.data
}

export const addAdminBlocklistEntry = async (body: { phone?: string; telegram_user_id?: string; reason?: string }) =>
  (await adminApi.post('/blocklist', body)).data

export const removeAdminBlocklistEntry = async (id: string) =>
  (await adminApi.delete(`/blocklist/${id}`)).data

// Telegram Import
export const startTelegramImport = async (params: {
  mode: string
  message_limit: number
  dry_run: boolean
}) => (await adminApi.post<{ task_id: string; status: string }>('/telegram/import', params)).data

export const getTelegramImportStatus = async () =>
  (await adminApi.get<TelegramImportStatus>('/telegram/import/status')).data

export const cancelTelegramImport = async () =>
  (await adminApi.post<{ status: string; task_id: string }>('/telegram/import/cancel')).data

export const getTelegramImportHistory = async () =>
  (await adminApi.get<{ runs: TelegramImportHistoryItem[] }>('/telegram/import/history')).data

// MAX Userbot Import
export const startMaxUserbotImport = async (params: {
  chat_ids: number[]
  mode: 'incremental' | 'full'
  dry_run: boolean
}) => (await adminApi.post<{ task_id: string; status: string }>('/max_userbot/import', params)).data

export const getMaxUserbotImportStatus = async () =>
  (await adminApi.get<MaxUserbotImportStatus>('/max_userbot/import/status')).data

export const cancelMaxUserbotImport = async () =>
  (await adminApi.post<{ status: string; task_id: string }>('/max_userbot/import/cancel')).data

export const getMaxUserbotImportHistory = async () =>
  (await adminApi.get<{ runs: MaxUserbotImportHistoryItem[] }>('/max_userbot/import/history')).data
