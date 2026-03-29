import { useState, useRef, useEffect, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { tracesApi } from '../api/client'
import type { TraceSummary, TraceFlow } from '../types'

// Animation path types (shared with ForceGraph3D)
export interface AnimStep {
  links: [string, string][]
  dur: number
  /** Nodes that are "thinking" (LLM call) during this step. nodeId → 'openai' | 'openrouter' */
  llmNodes?: Record<string, 'openai' | 'openrouter'>
}

// Name → graph node ID mapping — built dynamically from /graph API data
let _nameToNode: Record<string, string> = {}
let _toolNames: string[] = []

/** Update the name→nodeId mapping from graph nodes. Call once when graph data loads. */
export function setGraphNodes(nodes: Array<{ id: string; name: string; group: string }>) {
  _nameToNode = {}
  _toolNames = []
  for (const n of nodes) {
    _nameToNode[n.name] = n.id
    // Also map by ID for tool names (traces use short names like "get_availability")
    const shortName = n.id.includes(':') ? n.id.split(':')[1] : n.id
    if (shortName !== n.name) _nameToNode[shortName] = n.id
    if (n.group === 'tool') _toolNames.push(shortName)
  }
}

function toNodeId(name: string): string {
  return _nameToNode[name] || name.toLowerCase().replace(/\s+/g, '_')
}

function obsDur(obs?: { startTime?: string; endTime?: string }): number {
  if (obs?.startTime && obs?.endTime) {
    return Math.max(Math.round(new Date(obs.endTime).getTime() - new Date(obs.startTime).getTime()), 50)
  }
  return 150
}

/** Build animation path from trace observations */
export function buildAnimPath(flow: TraceFlow[]): AnimStep[] {
  if (!flow?.length) return []

  const root = flow.find((o) => !o.parentId) || flow[0]
  const routerObs = flow.find((o) => o.name === 'router')
  const routerParent = routerObs?.parentId
  const faqObs = flow.find((o) => o.name === 'faq' && o.parentId === routerParent)
  const bookingObs = flow.find((o) => o.name === 'booking' && o.parentId === routerParent)
  const agentName = faqObs ? 'FAQ Agent' : bookingObs ? 'Booking Agent' : null
  const agentObs = faqObs || bookingObs

  // Detect LLM provider from ChatOpenAI observations
  const llmObservations = flow.filter((o) => o.name === 'ChatOpenAI')
  function detectProvider(obs?: TraceFlow): 'openai' | 'openrouter' {
    if (!obs?.model) return 'openai'
    const model = obs.model.toLowerCase()
    if (model.includes('openrouter') || model.includes('anthropic') || model.includes('mistral')) return 'openrouter'
    return 'openai'
  }
  // Router's LLM
  const routerLlm = llmObservations.find((o) => routerObs && o.parentId === routerObs.id)
  const routerProvider = detectProvider(routerLlm)
  // Agent's LLM (any ChatOpenAI not belonging to router)
  const agentLlm = llmObservations.find((o) => !routerObs || o.parentId !== routerObs.id)
  const agentProvider = detectProvider(agentLlm)
  const hookObs = flow.find((o) => o.name === 'pre_model_hook')

  const path: AnimStep[] = []

  function add(from: string, to: string, obs?: TraceFlow | typeof root) {
    path.push({ links: [[toNodeId(from), toNodeId(to)]], dur: obsDur(obs as { startTime?: string; endTime?: string }) })
  }

  // Forward path: Telegram → Gateway → Router → Agent
  add('Telegram', 'Chat Gateway', root)
  add('Chat Gateway', 'Identity DB')
  add('Identity DB', 'Chat Gateway')
  if (routerObs) {
    // Router is "thinking" — LLM call for intent classification
    path.push({
      links: [[toNodeId('Chat Gateway'), toNodeId('Dental Router')]],
      dur: obsDur(routerObs),
      llmNodes: { [toNodeId('Dental Router')]: routerProvider },
    })
  }
  if (agentName && agentObs) add('Dental Router', agentName, agentObs)

  // Knowledge lookup: agent → tool:tier1, then tool:tier2 → db:kb (real graph links)
  if (hookObs && agentName) {
    add(agentName, 'Tier 1+2 Search', hookObs)    // faq:agent → tool:tier1
    // tier2 → db:kb is the real link in graph
    path.push({ links: [[toNodeId('Tier 1+2 Search'), 'tool:tier2']], dur: obsDur(hookObs) / 2 })
    path.push({ links: [['tool:tier2', toNodeId('Knowledge Base')]], dur: obsDur(hookObs) / 2 })
    // Return: db:kb → tool:tier2 → faq:agent (reverse of real links)
    path.push({ links: [[toNodeId('Knowledge Base'), 'tool:tier2']], dur: obsDur(hookObs) / 2 })
    path.push({ links: [['tool:tier2', toNodeId(agentName)]], dur: obsDur(hookObs) / 2 })
    // Agent "thinking" — LLM generates response
    if (agentLlm) {
      path.push({
        links: [],  // no link animation, just node glow
        dur: obsDur(agentLlm),
        llmNodes: { [toNodeId(agentName)]: agentProvider },
      })
    }
  }

  // CRM tools: agent → tool → crm_gateway (real graph links)
  flow.forEach((obs) => {
    if (obs.name && _toolNames.includes(obs.name)) {
      add(agentName || 'Booking Agent', obs.name, obs)
      add(obs.name, 'CRM Gateway', obs)
    }
  })

  // Handoff: agent → tool:handoff → chat_gateway (real graph links)
  const handoffObs = flow.find((o) => o.name?.includes('handoff'))
  if (handoffObs) {
    add(agentName || '?', 'Handoff', handoffObs)
    add('Handoff', 'Chat Gateway', handoffObs)
  }

  // Return path: agent → router → chat_gateway → telegram (reverse of real links)
  if (agentName && agentObs) {
    add(agentName, 'Dental Router', agentObs)        // faq:agent → router (reverse of router→faq:agent)
    add('Dental Router', 'Chat Gateway', agentObs)    // router → chat_gateway (reverse of chat_gateway→router)
  }
  add('Chat Gateway', 'Telegram', root)               // chat_gateway → telegram (reverse of telegram→chat_gateway)

  return path
}

function fmtTime(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

const SPEEDS = [1, 2, 4] as const

interface TraceLogProps {
  clinicId: string
  onReplay?: (traceId: string, speed: number) => void
}

interface StepData {
  from: string
  to: string
  dur: number
  input?: unknown
  output?: unknown
  model?: string
  type?: string
}

function formatValue(val: unknown): string {
  if (val === null || val === undefined) return '—'
  if (typeof val === 'string') return val.length > 300 ? val.slice(0, 300) + '...' : val
  if (typeof val === 'object') {
    // Extract meaningful content from common structures
    const obj = val as Record<string, unknown>
    if (obj.content) return String(obj.content).slice(0, 300)
    if (obj.text) return String(obj.text).slice(0, 300)
    if (obj.message) return String(obj.message).slice(0, 300)
    if (obj.messages && Array.isArray(obj.messages)) {
      const last = obj.messages[obj.messages.length - 1] as Record<string, unknown> | undefined
      if (last?.content) return String(last.content).slice(0, 300)
    }
    if (obj.kwargs) return formatValue(obj.kwargs)
    return JSON.stringify(val, null, 2).slice(0, 500)
  }
  return String(val)
}

function StepDetail({ step }: { step: StepData }) {
  const [open, setOpen] = useState(false)

  return (
    <div className="border-b border-[#1e293b]/50 last:border-b-0">
      <div
        className="flex items-center gap-1.5 text-[10px] py-1 px-2 cursor-pointer hover:bg-[#1e293b]/30 rounded"
        onClick={() => setOpen(!open)}
      >
        <span className="text-[#475569] w-3">{(step.input || step.output) ? (open ? '▾' : '▸') : ' '}</span>
        <span className="text-[#94a3b8]">{step.from}</span>
        <span className="text-[#475569]">→</span>
        <span className="text-white">{step.to}</span>
        {step.model && <span className="text-[#fb923c] text-[9px]">{step.model}</span>}
        <span className="text-[#64748b] ml-auto font-mono">{Math.round(step.dur)}ms</span>
      </div>
      {open && (step.input !== undefined || step.output !== undefined) && (
        <div className="flex gap-2 px-3 pb-2">
          <div className="flex-1 min-w-0">
            <div className="text-[9px] text-[#7dd3fc] mb-0.5">Input</div>
            <div className="text-[10px] text-[#cbd5e1] bg-[#0a0a1a] rounded p-2 max-h-32 overflow-auto whitespace-pre-wrap break-words">
              {formatValue(step.input)}
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[9px] text-[#4ade80] mb-0.5">Output</div>
            <div className="text-[10px] text-[#cbd5e1] bg-[#0a0a1a] rounded p-2 max-h-32 overflow-auto whitespace-pre-wrap break-words">
              {formatValue(step.output)}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function TraceRow({ trace, clinicId, onReplay, speed }: { trace: TraceSummary; clinicId: string; onReplay?: (id: string, speed: number) => void; speed: number }) {
  const [open, setOpen] = useState(false)
  const [steps, setSteps] = useState<StepData[] | null>(null)

  const loadSteps = async () => {
    if (steps) { setOpen(!open); return }
    setOpen(true)
    try {
      const data = await tracesApi.detail(clinicId, trace.id)
      // Build readable steps from flow observations
      const readable: StepData[] = []
      const built = buildAnimPath(data.flow)
      const flowMap = new Map(data.flow.map((f) => [f.name, f]))

      for (const animStep of built) {
        if (animStep.links.length === 0) continue
        const [from, to] = animStep.links[0]
        // Find matching observation for input/output
        const obsName = Object.entries(_nameToNode).find(([, v]) => v === to)?.[0] || to
        const obs = flowMap.get(obsName) || flowMap.get(to)
        readable.push({
          from, to,
          dur: animStep.dur,
          input: obs?.input,
          output: obs?.output,
          model: obs?.model || undefined,
          type: obs?.type || undefined,
        })
      }
      setSteps(readable)
    } catch {
      setSteps([])
    }
  }

  const agent = trace.name || '—'
  const userId = trace.userId?.slice(0, 12) || '—'
  const latency = trace.latency ? `${Math.round(trace.latency * 1000)}ms` : '—'

  return (
    <div className="border-b border-[#1e293b]">
      <div
        className="flex items-center gap-2 px-3 py-1.5 text-xs cursor-pointer hover:bg-[#1e293b]/40"
        onClick={loadSteps}
      >
        <span className="text-[#475569]">{open ? '▾' : '▸'}</span>
        <span className="text-[#64748b] w-16 flex-shrink-0">{fmtTime(trace.startTime)}</span>
        <span className="text-[#7dd3fc] font-medium flex-shrink-0 w-24 truncate">{agent}</span>
        <span className="text-[#94a3b8] truncate flex-1">{userId}</span>
        <span className="text-[#64748b] font-mono w-14 text-right flex-shrink-0">{latency}</span>
        <button
          onClick={(e) => { e.stopPropagation(); onReplay?.(trace.id, speed) }}
          className="text-[#facc15] text-[10px] px-1.5 py-0.5 rounded bg-[#facc15]/10 hover:bg-[#facc15]/20 flex-shrink-0 cursor-pointer"
          title="Replay trace animation"
        >
          ▶
        </button>
      </div>
      {open && steps && (
        <div className="px-4 pb-1.5">
          {steps.length === 0 && <div className="text-[10px] text-[#64748b]">No steps</div>}
          {steps.map((s, i) => (
            <StepDetail key={i} step={s} />
          ))}
        </div>
      )}
    </div>
  )
}

const INITIAL_LIMIT = 25
const LOAD_MORE = 10

export function TraceLog({ clinicId, onReplay }: TraceLogProps) {
  const [traces, setTraces] = useState<TraceSummary[]>([])
  const [speed, setSpeed] = useState(1)
  const [loading, setLoading] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [limit, setLimit] = useState(INITIAL_LIMIT)
  const scrollRef = useRef<HTMLDivElement>(null)
  const seenIdsRef = useRef<Set<string>>(new Set())

  // Poll for new traces (top of list)
  useQuery({
    queryKey: ['traces-poll', clinicId],
    queryFn: async () => {
      const fresh = await tracesApi.list(clinicId, undefined, limit)
      // Merge: keep existing order, prepend new ones
      setTraces((prev) => {
        const newTraces: TraceSummary[] = []
        for (const t of fresh) {
          if (!seenIdsRef.current.has(t.id)) {
            seenIdsRef.current.add(t.id)
            newTraces.push(t)
          }
        }
        if (newTraces.length > 0) return [...newTraces, ...prev]
        // Update existing traces (latency may have appeared)
        return fresh.length > 0 ? fresh : prev
      })
      return fresh
    },
    refetchInterval: 5000,
    enabled: !!clinicId,
  })

  // Initial load
  useEffect(() => {
    if (!clinicId) return
    setLoading(true)
    tracesApi.list(clinicId, undefined, INITIAL_LIMIT).then((data) => {
      setTraces(data)
      data.forEach((t) => seenIdsRef.current.add(t.id))
      setHasMore(data.length >= INITIAL_LIMIT)
    }).finally(() => setLoading(false))
  }, [clinicId])

  // Infinite scroll
  const handleScroll = useCallback(() => {
    const el = scrollRef.current
    if (!el || loading || !hasMore) return
    const { scrollTop, scrollHeight, clientHeight } = el
    if (scrollHeight - scrollTop - clientHeight < 50) {
      const newLimit = limit + LOAD_MORE
      setLimit(newLimit)
      setLoading(true)
      tracesApi.list(clinicId, undefined, newLimit).then((data) => {
        setTraces(data)
        data.forEach((t) => seenIdsRef.current.add(t.id))
        setHasMore(data.length >= newLimit)
      }).finally(() => setLoading(false))
    }
  }, [clinicId, limit, loading, hasMore])

  return (
    <div className="flex flex-col h-full bg-[#111127]">
      <div className="px-3 py-1.5 border-b border-[#1e293b] text-xs font-semibold text-[#7dd3fc] flex items-center gap-2 flex-shrink-0">
        Trace Log
        {loading && <span className="text-[#64748b] font-normal">loading...</span>}
        <div className="ml-auto flex items-center gap-1">
          <span className="text-[#64748b] font-normal text-[10px]">Replay:</span>
          {SPEEDS.map((s) => (
            <button
              key={s}
              onClick={() => setSpeed(s)}
              className={`px-1.5 py-0.5 rounded text-[10px] cursor-pointer border ${
                speed === s
                  ? 'bg-[#7dd3fc] text-[#0a0a1a] border-[#7dd3fc]'
                  : 'bg-[#111127] text-[#64748b] border-[#1e293b] hover:text-white'
              }`}
            >
              {s}x
            </button>
          ))}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto" ref={scrollRef} onScroll={handleScroll}>
        {traces.length === 0 && !loading && (
          <div className="text-xs text-[#64748b] px-3 py-4 text-center">
            No traces yet. Send a message or wait for patient activity.
          </div>
        )}
        {traces.map((t) => (
          <TraceRow key={t.id} trace={t} clinicId={clinicId} onReplay={onReplay} speed={speed} />
        ))}
        {loading && traces.length > 0 && (
          <div className="text-[10px] text-[#64748b] px-3 py-2 text-center">Loading more...</div>
        )}
      </div>
    </div>
  )
}
