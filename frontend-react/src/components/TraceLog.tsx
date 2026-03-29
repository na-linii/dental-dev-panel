import { useEffect, useState, useCallback } from 'react'
import { traceApi } from '../api/client'
import type { TraceFlow } from '../types'

interface TraceLogProps {
  traceId: string | null
}

interface TraceStep {
  from: string
  to: string
  duration?: number
  input?: unknown
  output?: unknown
}

const NAME_TO_NODE: Record<string, string> = {
  'Telegram': 'telegram',
  'Chat Gateway': 'chat_gateway',
  'Identity DB': 'db:identity',
  'Checkpointer': 'db:checkpointer',
  'Knowledge Base': 'db:kb',
  'Dental Router': 'router',
  'FAQ Agent': 'faq:agent',
  'Booking Agent': 'booking:agent',
  'Tier 1+2 Search': 'tool:tier1',
  'Handoff': 'tool:handoff',
  'CRM Gateway': 'crm_gateway',
  'Google Sheets': 'google_sheets',
  'get_availability': 'tool:get_availability',
  'book_appointment': 'tool:book_appointment',
  'cancel_appointment': 'tool:cancel_appointment',
  'get_existing_bookings': 'tool:get_existing_bookings',
  'register_patient': 'tool:register_patient',
}

// Same tool names as old trace.js
const TOOL_NAMES = [
  'get_availability',
  'book_appointment',
  'cancel_appointment',
  'get_existing_bookings',
  'register_patient',
]

function buildSteps(flow: TraceFlow[]): { steps: TraceStep[]; agentName: string | null; totalDur: number; startTime: string | null; endTime: string | null } {
  const root = flow.find((o) => !o.parentId) || flow[0]
  const routerObs = flow.find((o) => o.name === 'router')
  const routerParent = routerObs?.parentId
  const faqObs = flow.find((o) => o.name === 'faq' && o.parentId === routerParent)
  const bookingObs = flow.find((o) => o.name === 'booking' && o.parentId === routerParent)
  const agentName = faqObs ? 'FAQ Agent' : bookingObs ? 'Booking Agent' : null
  const agentObs = faqObs || bookingObs
  const hookObs = flow.find((o) => o.name === 'pre_model_hook')
  const llmObs =
    flow.find((o) => o.name === 'ChatOpenAI' && (!routerObs || o.parentId !== routerObs.id)) ||
    flow.find((o) => o.name === 'ChatOpenAI')

  const steps: TraceStep[] = []

  function obsDur(obs?: TraceFlow | { startTime?: string; endTime?: string }): number | undefined {
    if (obs?.startTime && obs?.endTime) {
      return Math.round(new Date(obs.endTime).getTime() - new Date(obs.startTime).getTime())
    }
    return undefined
  }

  function addStep(from: string, to: string, obs?: TraceFlow | { startTime?: string; endTime?: string }) {
    steps.push({ from, to, duration: obsDur(obs), input: (obs as TraceFlow)?.input, output: (obs as TraceFlow)?.output })
  }

  addStep('Telegram', 'Chat Gateway', root)
  addStep('Chat Gateway', 'Identity DB')
  addStep('Identity DB', 'Chat Gateway')
  if (routerObs) addStep('Chat Gateway', 'Dental Router', routerObs)
  if (agentName && agentObs) addStep('Dental Router', agentName, agentObs)
  if (hookObs && agentName) {
    addStep(agentName, 'Tier 1+2 Search', hookObs)
    addStep('Tier 1+2 Search', 'Knowledge Base', hookObs)
    addStep('Knowledge Base', agentName, hookObs)
  }
  if (llmObs && agentName) {
    addStep(agentName, `LLM (${llmObs.model || 'gpt-5.4-mini'})`, llmObs)
  }
  flow.forEach((obs) => {
    if (obs.name && TOOL_NAMES.includes(obs.name)) {
      addStep(agentName || 'Booking Agent', obs.name, obs)
      addStep(obs.name, 'CRM Gateway', obs)
    }
  })
  const handoffObs = flow.find((o) => o.name?.includes('handoff'))
  if (handoffObs) {
    addStep(agentName || '?', 'Handoff', handoffObs)
    addStep('Handoff', 'Chat Gateway', handoffObs)
  }
  if (agentName && agentObs) addStep(agentName, 'Chat Gateway', agentObs)
  addStep('Chat Gateway', 'Telegram', root)

  let totalDur = 0
  if (root?.startTime && root?.endTime) {
    totalDur = Math.round(new Date(root.endTime).getTime() - new Date(root.startTime).getTime())
  }

  const startTime = root?.startTime || null
  const endTime = root?.endTime || null

  return { steps, agentName, totalDur, startTime, endTime }
}

interface TraceEntry {
  traceId: string
  agentName: string | null
  stepCount: number
  totalDur: number
  steps: TraceStep[]
  startTime: string | null
  endTime: string | null
}

function fmtTime(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    + '.' + String(d.getMilliseconds()).padStart(3, '0')
}

function StepRow({ step }: { step: TraceStep }) {
  const [open, setOpen] = useState(false)

  return (
    <div>
      <div
        className="flex items-center gap-2 px-3 py-1 text-xs cursor-pointer hover:bg-[#1e293b]/50"
        onClick={(e) => {
          e.stopPropagation()
          setOpen(!open)
        }}
      >
        <span className="text-[#94a3b8]">{step.from}</span>
        <span className="text-[#475569]">&rarr;</span>
        <span className="text-white">{step.to}</span>
        {step.duration != null && (
          <span className="text-[#64748b] ml-auto">{step.duration}ms</span>
        )}
      </div>
      {open && (
        <div className="flex gap-2 px-4 pb-2">
          <pre className="flex-1 text-[10px] text-[#94a3b8] bg-[#0a0a1a] rounded p-2 overflow-auto max-h-40">
            {step.input ? 'INPUT:\n' + JSON.stringify(step.input, null, 2) : '\u2014'}
          </pre>
          <pre className="flex-1 text-[10px] text-[#94a3b8] bg-[#0a0a1a] rounded p-2 overflow-auto max-h-40">
            {step.output ? 'OUTPUT:\n' + JSON.stringify(step.output, null, 2) : '\u2014'}
          </pre>
        </div>
      )}
    </div>
  )
}

function TraceEntryRow({ entry }: { entry: TraceEntry }) {
  const [open, setOpen] = useState(false)

  return (
    <div>
      <div
        className="flex items-center gap-2 px-3 py-1.5 text-xs cursor-pointer hover:bg-[#1e293b]/60 border-b border-[#1e293b]"
        onClick={() => setOpen(!open)}
      >
        <span className="text-[#475569]">{open ? '▾' : '▸'}</span>
        <span className="text-[#7dd3fc] font-semibold">{entry.agentName || 'Router'}</span>
        <span className="text-[#94a3b8]">{entry.stepCount} steps</span>
        <span className="text-[#475569] text-[10px]">
          {fmtTime(entry.startTime)} → {fmtTime(entry.endTime)}
        </span>
        {entry.totalDur > 0 && (
          <span className="text-[#64748b] ml-auto font-mono">{entry.totalDur}ms</span>
        )}
      </div>
      {open && (
        <div className="border-b border-[#1e293b]">
          {entry.steps.map((step, i) => (
            <StepRow key={i} step={step} />
          ))}
        </div>
      )}
    </div>
  )
}

export function TraceLog({ traceId }: TraceLogProps) {
  const [entries, setEntries] = useState<TraceEntry[]>([])
  const [loading, setLoading] = useState(false)
  const loadedRef = new Set<string>()

  const loadTrace = useCallback(
    async (id: string) => {
      if (loadedRef.has(id)) return
      loadedRef.add(id)
      setLoading(true)
      try {
        const data = await traceApi.get(id)
        if (!data.flow?.length) return
        const { steps, agentName, totalDur, startTime, endTime } = buildSteps(data.flow)
        setEntries((prev) => [
          ...prev,
          { traceId: id, agentName, stepCount: steps.length, totalDur, steps, startTime, endTime },
        ])
      } catch {
        // silently ignore trace fetch errors
      } finally {
        setLoading(false)
      }
    },
    // loadedRef is intentionally not in deps - it's a persistent set
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )

  useEffect(() => {
    if (traceId) loadTrace(traceId)
  }, [traceId, loadTrace])

  return (
    <div className="flex flex-col h-full bg-[#111127] border-t border-[#1e293b]">
      <div className="px-3 py-1.5 border-b border-[#1e293b] text-xs font-semibold text-[#7dd3fc] flex items-center gap-2">
        Trace Log
        {loading && <span className="text-[#64748b] font-normal">loading...</span>}
      </div>
      <div className="flex-1 overflow-y-auto">
        {entries.length === 0 && !loading && (
          <div className="text-xs text-[#64748b] px-3 py-4 text-center">
            Send a message to see trace steps here
          </div>
        )}
        {entries.map((entry, i) => (
          <TraceEntryRow key={i} entry={entry} />
        ))}
      </div>
    </div>
  )
}

/**
 * Build animation path from trace flow data.
 * Returns AnimStep[] where each step has links [[source, target]] and duration in ms.
 */
export function buildAnimPath(flow: TraceFlow[]): Array<{ links: [string, string][]; dur: number }> {
  if (!flow?.length) return []
  const { steps } = buildSteps(flow)
  const path: Array<{ links: [string, string][]; dur: number }> = []

  for (const step of steps) {
    const src = NAME_TO_NODE[step.from] || step.from.toLowerCase().replace(/\s+/g, '_')
    const tgt = NAME_TO_NODE[step.to] || step.to.toLowerCase().replace(/\s+/g, '_')
    const dur = step.duration || 150  // default 150ms per step if no timing
    path.push({ links: [[src, tgt]], dur })
  }

  return path
}

export { NAME_TO_NODE }
