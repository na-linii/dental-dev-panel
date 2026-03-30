import axios from 'axios'

// ── Types ──

export interface AdminUser {
  user_id: number
  username: string
  full_name: string
  role: string
  clinic_id: string
}

export interface AdminLoginResponse {
  token: string
  user: AdminUser
}

export interface AdminDashboardStats {
  active_chats: number
  awaiting_operator: number
  confirmations_today: number
  pending_actions: number
}

export interface AdminSessionSummary {
  id: number
  patient_name: string
  patient_phone: string
  doctor_name: string
  status: string
  status_label?: string
  awaiting_operator: boolean
  last_message_time: string | null
  last_message: string
  controller: string
}

export interface AdminSessionsResponse {
  items: AdminSessionSummary[]
  total: number
}

export interface AdminMessage {
  id: number
  author: string
  author_type: 'agent' | 'patient' | 'admin'
  text: string
  timestamp: string
}

export interface AdminSessionDetail {
  id: number
  patient_name: string
  patient_phone: string
  doctor_name: string
  status: string
  status_label?: string
  controller: string
  awaiting_operator: boolean
  messages: AdminMessage[]
}

export interface AdminSendMessageResponse {
  message: AdminMessage
}

export interface AdminAction {
  id: number
  type: string
  description: string
  patient_name: string
  created_at: string
  status: string
}

export interface AdminActionsResponse {
  items: AdminAction[]
  total: number
}

export interface AdminBotStatus {
  bot_enabled: boolean
  reason: string | null
  toggled_at: string | null
}

export interface AdminBlocklistItem {
  id: number
  phone: string | null
  telegram_user_id: number | null
  display_name: string | null
  reason: string | null
  created_at: string
}

// ── API Client ──

const adminApi = axios.create({ baseURL: '/admin/api' })

adminApi.interceptors.request.use((config) => {
  const token = localStorage.getItem('admin_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

adminApi.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('admin_token')
      localStorage.removeItem('admin_user')
      window.location.href = '/admin/login'
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
  status?: string
  awaiting_operator?: boolean
  search?: string
  limit?: number
  offset?: number
}) => (await adminApi.get<AdminSessionsResponse>('/sessions', { params })).data

export const getAdminSession = async (id: number) =>
  (await adminApi.get<AdminSessionDetail>(`/sessions/${id}`)).data

export const sendAdminMessage = async (sessionId: number, text: string) =>
  (await adminApi.post<AdminSendMessageResponse>(`/sessions/${sessionId}/messages`, { text })).data

export const updateAdminSessionStatus = async (sessionId: number, status: string) =>
  (await adminApi.patch(`/sessions/${sessionId}/status`, { status })).data

// ── Actions ──

export const getAdminActions = async () =>
  (await adminApi.get<AdminActionsResponse>('/actions')).data

export const updateAdminAction = async (actionId: number, status: 'done' | 'failed') =>
  (await adminApi.patch(`/actions/${actionId}`, { status })).data

// ── Settings ──

export const getAdminBotStatus = async () =>
  (await adminApi.get<AdminBotStatus>('/bot/status')).data

export const toggleAdminBot = async (enabled: boolean, reason?: string) =>
  (await adminApi.post<AdminBotStatus>('/bot/toggle', { enabled, reason })).data

export const getAdminBlocklist = async () =>
  (await adminApi.get<{ items: AdminBlocklistItem[] }>('/blocklist')).data

export const addAdminBlocklistEntry = async (body: { phone?: string; telegram_user_id?: number; reason?: string }) =>
  (await adminApi.post('/blocklist', body)).data

export const removeAdminBlocklistEntry = async (id: number) =>
  (await adminApi.delete(`/blocklist/${id}`)).data
