import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { tracesApi } from '../api/client'
import type { TraceSummary, TraceFlow } from '../types'

// Animation path types (shared with ForceGraph3D)
export interface AnimStep {
  links: [string, string][]
  dur: number
}

// Name → graph node ID mapping
const NAME_TO_NODE: Record<string, string> = {
  'Telegram': 'telegram',
  'Chat Gateway': 'chat_gateway',
  'Identity DB': 'db:identity',
  'Checkpointer': 'db:checkpointer',
  'Knowledge Base': 'db:kb',
  'Dental Router': 'router',
  'FAQ Agent': 'faq:agent',
  'Booking Agent': 'booking:agent',
  'Confirmation Agent': 'confirm:agent',
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

const TOOL_NAMES = [
  'get_availability', 'book_appointment', 'cancel_appointment',
  'get_existing_bookings', 'register_patient',
]

function toNodeId(name: string): string {
  return NAME_TO_NODE[name] || name.toLowerCase().replace(/\s+/g, '_')
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
  const hookObs = flow.find((o) => o.name === 'pre_model_hook')

  const path: AnimStep[] = []

  function add(from: string, to: string, obs?: TraceFlow | typeof root) {
    path.push({ links: [[toNodeId(from), toNodeId(to)]], dur: obsDur(obs as { startTime?: string; endTime?: string }) })
  }

  // Forward path: Telegram → Gateway → Router → Agent
  add('Telegram', 'Chat Gateway', root)
  add('Chat Gateway', 'Identity DB')
  add('Identity DB', 'Chat Gateway')
  if (routerObs) add('Chat Gateway', 'Dental Router', routerObs)
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
  }

  // CRM tools: agent → tool → crm_gateway (real graph links)
  flow.forEach((obs) => {
    if (obs.name && TOOL_NAMES.includes(obs.name)) {
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

interface TraceLogProps {
  clinicId: string
  onReplay?: (traceId: string) => void
}

function TraceRow({ trace, clinicId, onReplay }: { trace: TraceSummary; clinicId: string; onReplay?: (id: string) => void }) {
  const [open, setOpen] = useState(false)
  const [steps, setSteps] = useState<Array<{ from: string; to: string; dur: number }> | null>(null)

  const loadSteps = async () => {
    if (steps) { setOpen(!open); return }
    setOpen(true)
    try {
      const data = await tracesApi.detail(clinicId, trace.id)
      const built = buildAnimPath(data.flow)
      setSteps(built.map((s) => ({
        from: s.links[0]?.[0] || '?',
        to: s.links[0]?.[1] || '?',
        dur: s.dur,
      })))
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
          onClick={(e) => { e.stopPropagation(); onReplay?.(trace.id) }}
          className="text-[#facc15] text-[10px] px-1.5 py-0.5 rounded bg-[#facc15]/10 hover:bg-[#facc15]/20 flex-shrink-0 cursor-pointer"
          title="Replay trace animation"
        >
          ▶
        </button>
      </div>
      {open && steps && (
        <div className="px-6 pb-2">
          {steps.length === 0 && <div className="text-[10px] text-[#64748b]">No steps</div>}
          {steps.map((s, i) => (
            <div key={i} className="flex items-center gap-1.5 text-[10px] py-0.5">
              <span className="text-[#94a3b8]">{s.from}</span>
              <span className="text-[#475569]">→</span>
              <span className="text-white">{s.to}</span>
              <span className="text-[#64748b] ml-auto">{s.dur}ms</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export function TraceLog({ clinicId, onReplay }: TraceLogProps) {
  const { data: traces, isLoading } = useQuery({
    queryKey: ['traces', clinicId],
    queryFn: () => tracesApi.list(clinicId),
    refetchInterval: 5000,
    enabled: !!clinicId,
  })

  return (
    <div className="flex flex-col h-full bg-[#111127]">
      <div className="px-3 py-1.5 border-b border-[#1e293b] text-xs font-semibold text-[#7dd3fc] flex items-center gap-2 flex-shrink-0">
        Trace Log
        <span className="text-[#64748b] font-normal">
          {traces?.length || 0} traces
        </span>
        {isLoading && <span className="text-[#64748b] font-normal">polling...</span>}
      </div>
      <div className="flex-1 overflow-y-auto">
        {(!traces || traces.length === 0) && !isLoading && (
          <div className="text-xs text-[#64748b] px-3 py-4 text-center">
            No traces yet. Send a message or wait for patient activity.
          </div>
        )}
        {traces?.map((t) => (
          <TraceRow key={t.id} trace={t} clinicId={clinicId} onReplay={onReplay} />
        ))}
      </div>
    </div>
  )
}
