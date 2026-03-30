import axios from 'axios'
import type {
  Clinic, ChatRequest, ChatResponse, GraphData,
  EdgeCaseItem, HealthResponse, TraceFlow, TraceSummary, AdminUser,
  EpicsResponse, ClinicCreateData, QualitySummary, QualityRunHistory,
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

  create: (data: ClinicCreateData) =>
    api.post<{ ok: boolean; clinic: Clinic }>('/clinics', data).then((r) => r.data.clinic),

  deploy: (id: string) => {
    const token = localStorage.getItem('dp_token')
    return `/api/clinics/${id}/deploy?token=${encodeURIComponent(token || '')}`
  },

  deployStatus: (id: string) =>
    api.get<{ deploy_status: string; deploy_log: string }>(`/clinics/${id}/deploy-status`).then((r) => r.data),

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

export interface EdgeCaseRunResult {
  case_id: string
  response: string
  trace_id?: string
  thread_id?: string
  error?: boolean
}

export const edgeCasesApi = {
  list: () =>
    api.get<{ items: EdgeCaseItem[]; error?: string }>('/edge-cases').then((r) => r.data),

  run: (clinicId: string, caseData: {
    case_id: string
    message: string
    patient_phone?: string | null
    patient_name?: string | null
    history?: Array<{ role: string; content: string }>
  }) =>
    api.post<EdgeCaseRunResult>(`/clinics/${clinicId}/edge-cases/run`, caseData).then((r) => r.data),

  runAll: (clinicId: string, cases: EdgeCaseItem[]) =>
    api.post<{ results: EdgeCaseRunResult[] }>(`/clinics/${clinicId}/edge-cases/run-all`, {
      cases: cases.map((c) => ({
        id: c.id,
        message: c.message,
        patient_phone: c.patient_phone,
        patient_name: c.patient_name,
        history: c.history,
      })),
    }).then((r) => r.data.results),
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

export interface JiraTask {
  key: string
  summary: string
  status: string
  statusCategory: string // new, indeterminate, done
  assignee: string | null
  assigneeAvatar: string | null
  url: string
  created: string
  updated: string
}

export const settingsApi = {
  getVizConfig: async () => {
    // Hub DB first (instant), fallback to graph.json viz_config
    try {
      const r = await api.get<{ config: Record<string, { shape: string; color: string; val: number }> }>('/settings/viz-config')
      if (r.data.config && Object.keys(r.data.config).length > 0) return r.data.config
    } catch { /* fallback */ }
    const data = await architectureApi.graph()
    return data.meta?.viz_config || {}
  },
  saveVizConfig: (config: Record<string, { shape: string; color: string; val: number }>) =>
    api.put('/settings/viz-config', config).then((r) => r.data),
}

export const qualityApi = {
  summary: (clinicId?: string) =>
    api.get<QualitySummary>('/quality/summary', {
      params: clinicId ? { clinic_id: clinicId } : {},
    }).then((r) => r.data),

  history: (clinicId?: string, limit = 10) =>
    api.get<{ runs: QualityRunHistory[] }>('/quality/history', {
      params: { limit, ...(clinicId ? { clinic_id: clinicId } : {}) },
    }).then((r) => r.data.runs),
}

export const roadmapApi = {
  tasks: () =>
    api.get<{ tasks: JiraTask[]; total: number }>('/roadmap/tasks').then((r) => r.data.tasks),

  epics: () =>
    api.get<EpicsResponse>('/roadmap/epics').then((r) => r.data.epics),
}
