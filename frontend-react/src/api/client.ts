import axios from 'axios'
import type {
  Clinic, ChatRequest, ChatResponse, GraphData,
  EdgeCaseItem, HealthResponse, TraceFlow, TraceSummary, AdminUser,
} from '../types'

const api = axios.create({ baseURL: '/api' })

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('dp_token')
  if (token) {
    config.headers.Authorization = `Bearer ${atob(token)}`
  }
  return config
})

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.clear()
      window.location.reload()
    }
    return Promise.reject(err)
  },
)

export const clinicsApi = {
  list: () =>
    api.get<{ clinics: Clinic[] }>('/clinics').then((r) => r.data.clinics),

  health: (id: string) =>
    api.get<HealthResponse>(`/clinics/${id}/health`).then((r) => r.data),

  config: (id: string) =>
    api.get<Record<string, unknown>>(`/clinics/${id}/config`).then((r) => r.data),

  chat: (id: string, body: ChatRequest) =>
    api.post<ChatResponse>(`/clinics/${id}/chat`, body).then((r) => r.data),

  graph: (id: string, params?: Record<string, string>) =>
    api.get<GraphData>(`/clinics/${id}/graph`, { params }).then((r) => r.data),

  admins: (id: string) =>
    api.get<{ admins: AdminUser[] }>(`/clinics/${id}/admins`).then((r) => r.data.admins),

  createAdmin: (id: string, data: { username: string; password: string; full_name: string; role: string }) =>
    api.post<{ admin: AdminUser }>(`/clinics/${id}/admins`, data).then((r) => r.data.admin),

  deleteAdmin: (clinicId: string, adminId: number) =>
    api.delete(`/clinics/${clinicId}/admins/${adminId}`),
}

export const edgeCasesApi = {
  list: () =>
    api.get<{ items: EdgeCaseItem[]; error?: string }>('/edge-cases').then((r) => r.data),
}

export const tracesApi = {
  list: (clinicId: string, since?: string, limit = 25) =>
    api.get<{ traces: TraceSummary[] }>(`/clinics/${clinicId}/traces`, {
      params: { limit, ...(since ? { since } : {}) },
    }).then((r) => r.data.traces),

  detail: (clinicId: string, traceId: string) =>
    api.get<{ flow: TraceFlow[]; trace_id: string }>(`/clinics/${clinicId}/traces/${traceId}`)
      .then((r) => r.data),
}

// Keep legacy for backward compat
export const traceApi = {
  get: (traceId: string) =>
    api.get<{ flow: TraceFlow[]; trace_id: string }>(`/trace/${traceId}`).then((r) => r.data),
}

export const architectureApi = {
  graph: () =>
    api.get<GraphData>('/architecture/graph').then((r) => r.data),
}

export const langfuseApi = {
  url: () =>
    api.get<{ url: string }>('/langfuse-url').then((r) => r.data.url),
}
