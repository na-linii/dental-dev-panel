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

export interface GraphData {
  nodes: GraphNode[]
  links: GraphLink[]
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

export interface AdminUser {
  id: number
  username: string
  full_name: string
  role: string
  clinic_id: string | null
  created_at: string
}
