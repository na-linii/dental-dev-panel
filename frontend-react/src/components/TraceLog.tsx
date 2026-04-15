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

// Graph state — built dynamically from /graph API data
let _nameToNode: Record<string, string> = {}
let _graphLinks: [string, string][] = []
let _knownNodeIds: Set<string> = new Set()

/**
 * Register graph structure from clinic's /graph endpoint.
 * Must be called before buildAnimPath to enable dynamic node matching.
 */
export function initAnimGraph(
  nodes: Array<{ id: string; name: string; group: string }>,
  links: Array<{ source: string; target: string }>,
) {
  _nameToNode = {}
  _graphLinks = links.map((l) => [l.source, l.target] as [string, string])
  _knownNodeIds = new Set()

  for (const n of nodes) {
    _knownNodeIds.add(n.id)
    _nameToNode[n.name] = n.id
    // Also map by short ID (e.g. "tier1" from "tool:tier1")
    const shortId = n.id.includes(':') ? n.id.split(':').pop()! : n.id
    if (shortId !== n.id) _nameToNode[shortId] = n.id
  }
}

/**
 * Resolve an observation name to a graph node ID.
 * Checks: exact node ID → display name mapping → short name mapping.
 */
function resolveNodeId(name: string): string | null {
  if (!name) return null
  if (_knownNodeIds.has(name)) return name
  return _nameToNode[name] || null
}

function detectProvider(obs: TraceFlow): 'openai' | 'openrouter' {
  if (!obs.model) return 'openai'
  const m = obs.model.toLowerCase()
  if (m.includes('openrouter') || m.includes('anthropic') || m.includes('mistral') || m.includes('claude')) {
    return 'openrouter'
  }
  return 'openai'
}

function obsDur(obs: Pick<TraceFlow, 'startTime' | 'endTime'>): number {
  if (obs.startTime && obs.endTime) {
    return Math.max(
      Math.round(new Date(obs.endTime).getTime() - new Date(obs.startTime).getTime()),
      50,
    )
  }
  return 150
}

/**
 * Build animation path from Langfuse trace observations.
 *
 * Produces two types of AnimStep:
 *  1. Data flow  — links: [[source, target], ...] — particles travel along graph edges
 *  2. Thinking   — llmNodes: {nodeId: provider}  — node border changes color
 *
 * Both use real observation timestamps for accurate timing.
 * Animation adapts to any clinic's graph structure via initAnimGraph().
 */
export function buildAnimPath(flow: TraceFlow[]): AnimStep[] {
  if (!flow?.length) return []

  // Sort by startTime (fallback to 0 if missing)
  const sorted = [...flow]
    .filter((o) => !!o.name)
    .sort((a, b) => {
      const ta = a.startTime ? new Date(a.startTime).getTime() : 0
      const tb = b.startTime ? new Date(b.startTime).getTime() : 0
      return ta - tb
    })

  const path: AnimStep[] = []

  for (const obs of sorted) {
    if (obs.type === 'llm') {
      // Thinking animation: the parent node (e.g. 'router', 'faq') is "thinking"
      // while this LLM observation is active. ChatOpenAI itself is not a graph node.
      const parentObs = flow.find((o) => o.id === obs.parentId)
      const thinkingId = parentObs ? resolveNodeId(parentObs.name) : null
      if (!thinkingId) continue

      // Animate incoming edges + node thinking glow simultaneously
      const incoming = _graphLinks.filter(([, t]) => t === thinkingId)
      path.push({
        links: incoming,
        dur: obsDur(obs),
        llmNodes: { [thinkingId]: detectProvider(obs) },
      })
    } else {
      // Data flow animation: find the graph node and animate its incoming edges
      const nodeId = resolveNodeId(obs.name)
      if (!nodeId) continue

      const incoming = _graphLinks.filter(([, t]) => t === nodeId)
      if (incoming.length > 0) {
        path.push({ links: incoming, dur: obsDur(obs) })
      }
    }
  }

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

function TraceRow({
  trace,
  clinicId,
  onReplay,
  speed,
}: {
  trace: TraceSummary
  clinicId: string
  onReplay?: (id: string, speed: number) => void
  speed: number
}) {
  const [open, setOpen] = useState(false)
  const [steps, setSteps] = useState<StepData[] | null>(null)

  const loadSteps = async () => {
    if (steps) { setOpen(!open); return }
    setOpen(true)
    try {
      const data = await tracesApi.detail(clinicId, trace.id)
      const animSteps = buildAnimPath(data.flow)
      const flowByName = new Map(data.flow.map((f) => [f.name, f]))
      const flowById = new Map(data.flow.map((f) => [f.id, f]))

      const readable: StepData[] = []
      for (const animStep of animSteps) {
        if (animStep.links.length === 0) continue
        const [from, to] = animStep.links[0]
        // Find matching observation by resolved node ID
        const obs = flowByName.get(to) ||
          [...flowById.values()].find((f) => resolveNodeId(f.name) === to)
        readable.push({
          from,
          to,
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

  useQuery({
    queryKey: ['traces-poll', clinicId],
    queryFn: async () => {
      const fresh = await tracesApi.list(clinicId, undefined, limit)
      setTraces((prev) => {
        const newTraces: TraceSummary[] = []
        for (const t of fresh) {
          if (!seenIdsRef.current.has(t.id)) {
            seenIdsRef.current.add(t.id)
            newTraces.push(t)
          }
        }
        if (newTraces.length > 0) return [...newTraces, ...prev]
        return fresh.length > 0 ? fresh : prev
      })
      return fresh
    },
    refetchInterval: 5000,
    enabled: !!clinicId,
  })

  useEffect(() => {
    if (!clinicId) return
    setLoading(true)
    tracesApi.list(clinicId, undefined, INITIAL_LIMIT).then((data) => {
      setTraces(data)
      data.forEach((t) => seenIdsRef.current.add(t.id))
      setHasMore(data.length >= INITIAL_LIMIT)
    }).finally(() => setLoading(false))
  }, [clinicId])

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
