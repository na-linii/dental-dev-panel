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

// Backend: GET /admin/api/dashboard/stats
export interface AdminDashboardStats {
  sessions: { bot: number; operator: number; closed: number }
  confirmations: Record<string, number>
  pending_actions: number
  total_patients: number
  prev_month?: { total: number; confirmed: number; rescheduled: number; cancelled: number }
}

// Backend: GET /admin/api/sessions — returns array of these
export interface AdminSessionSummary {
  id: string
  channel: string
  thread_id: string
  controller: string
  confirmation_status: string | null
  crm_sync_status: string | null
  updated_at: string | null
  created_at: string | null
  patient: { id: string | null; name: string | null; phone: string | null } | null
  last_message: string | null
  last_message_at: string | null
  confirmation_appointment_date: string | null
  confirmation_appointment_time: string | null
  confirmation_doctor_name: string | null
  operator_id?: string | null
  is_blocked?: boolean
}

// Backend: GET /admin/api/sessions/:id
export interface AdminMessage {
  id: string
  role: string
  content: string
  metadata: Record<string, unknown> | null
  created_at: string
}

export interface AdminSessionDetail {
  id: string
  clinic_id: string
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
  patient: { id: string | null; name: string | null; phone: string | null; ident_patient_id: string | null } | null
  messages: AdminMessage[]
  has_more_messages?: boolean
}

export interface AdminSendMessageResponse {
  success: boolean
  message_id: string
  delivered: boolean
}

// Backend: GET /admin/api/actions — returns array of these
export interface AdminAction {
  id: string
  action_type: string
  patient_id: string | null
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

// Backend: GET /admin/api/bookings — returns array of these
export interface AdminBooking {
  id: string
  patient_id: string | null
  doctor_id: string | null
  service_key: string | null
  appointment_date: string | null
  appointment_time: string | null
  booking_status: string | null
  doctor_name: string | null
  patient_name: string | null
  cached_at: string | null
}

// Backend: GET /admin/api/settings/bot
export interface AdminBotStatus {
  bot_enabled: boolean
  reason: string | null
  toggled_at: string | null
  toggled_by: string | null
}

// Backend: GET /admin/api/settings/blocklist — returns array of these
export interface AdminBlocklistItem {
  id: string
  phone: string | null
  telegram_user_id: string | null
  reason: string | null
  created_by: string | null
  created_at: string | null
}

// ── API Client ──

const adminApi = axios.create({ baseURL: '/admin/api', timeout: 30_000 })

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
        window.location.href = '/admin/login'
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
}): Promise<{ items: AdminSessionSummary[]; total: number }> => {
  const res = await adminApi.get<PaginatedResponse<AdminSessionSummary>>('/sessions', { params })
  return { items: res.data.items, total: res.data.total }
}

export const getAdminSession = async (id: string, params?: { messages_limit?: number; before_id?: string }) =>
  (await adminApi.get<AdminSessionDetail>(`/sessions/${id}`, { params })).data

export const sendAdminMessage = async (sessionId: string, text: string) =>
  (await adminApi.post<AdminSendMessageResponse>(`/sessions/${sessionId}/messages`, { text })).data

export const updateSessionController = async (sessionId: string, controller: string) =>
  (await adminApi.patch(`/sessions/${sessionId}/controller`, { controller })).data

export const updateSessionConfirmation = async (sessionId: string, confirmation_status: string) =>
  (await adminApi.patch(`/sessions/${sessionId}/confirmation`, { confirmation_status })).data

export const updatePatientPhone = async (sessionId: string, phone: string) =>
  (await adminApi.patch(`/sessions/${sessionId}/phone`, { phone })).data

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
