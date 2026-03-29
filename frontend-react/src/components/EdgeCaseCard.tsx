import { useState } from 'react'
import { clinicsApi } from '../api/client'
import type { EdgeCaseItem, ChatResponse } from '../types'

interface Props {
  item: EdgeCaseItem
  clinicId: string
  langfuseUrl: string
}

export function EdgeCaseCard({ item, clinicId, langfuseUrl }: Props) {
  const [expanded, setExpanded] = useState(false)
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState<ChatResponse | null>(null)
  const [error, setError] = useState('')

  const run = async () => {
    setRunning(true)
    setError('')
    try {
      const res = await clinicsApi.chat(clinicId, {
        message: item.message,
        clinic_id: clinicId,
        channel: 'tg_bot',
        channel_user_id: 'edge-case-tester',
        thread_id: `ec-${item.id}-${Date.now()}`,
        phone: item.patient_phone || undefined,
        name: item.patient_name || undefined,
      })
      setResult(res)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed')
    } finally {
      setRunning(false)
    }
  }

  return (
    <div className="bg-[#111127] border border-[#1e293b] rounded-lg mb-1.5 px-3 py-2">
      {/* Header */}
      <div
        className="flex justify-between items-center cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div>
          <div className="text-xs text-white">{item.id}</div>
          <div className="text-[10px] text-[#64748b] mt-0.5">{item.message}</div>
        </div>
        <div className="text-[10px] text-[#64748b]">
          {running ? '⏳' : result ? '✓' : expanded ? '▾' : '▸'}
        </div>
      </div>

      {/* Expandable detail */}
      {expanded && (
        <div className="mt-2 pt-2 border-t border-[#1e293b]">
          {/* Patient */}
          <div className="mb-1.5">
            <div className="text-[9px] text-[#7dd3fc] uppercase mb-0.5">Patient</div>
            <div className="text-[10px] text-[#94a3b8]">
              {item.patient_name || <span className="text-[#475569]">unknown</span>}
              {' | '}
              {item.patient_phone || <span className="text-[#475569]">no phone</span>}
              {' | '}
              {item.is_identified ? (
                <span className="text-[#4ade80]">identified</span>
              ) : (
                <span className="text-[#facc15]">not identified</span>
              )}
            </div>
          </div>

          {/* History */}
          {item.history.length > 0 && (
            <div className="mb-1.5">
              <div className="text-[9px] text-[#7dd3fc] uppercase mb-0.5">History</div>
              {item.history.map((msg, i) => (
                <div
                  key={i}
                  className={`text-[10px] py-0.5 ${
                    msg.role === 'user' ? 'text-[#e2e8f0]' : 'text-[#94a3b8]'
                  }`}
                >
                  {msg.role === 'user' ? '🧑' : '🤖'} {msg.content}
                </div>
              ))}
            </div>
          )}

          {/* Message */}
          <div className="mb-1.5">
            <div className="text-[9px] text-[#7dd3fc] uppercase mb-0.5">Message</div>
            <div className="text-[11px] text-white bg-white/5 px-2 py-1.5 rounded">
              {item.message}
            </div>
          </div>

          {/* Expected */}
          <div className="mb-2">
            <div className="text-[9px] text-[#7dd3fc] uppercase mb-0.5">Expected</div>
            <div className="text-[10px] text-[#94a3b8]">{item.expected}</div>
          </div>

          {/* Run button */}
          <button
            onClick={(e) => {
              e.stopPropagation()
              run()
            }}
            disabled={running}
            className="px-2.5 py-1 rounded border border-[#1e293b] bg-[#111127] text-white text-[10px] cursor-pointer hover:bg-[#1e293b] disabled:opacity-50 mb-1.5"
          >
            {running ? '⏳ Running...' : '▶ Run'}
          </button>

          {/* Result */}
          {result && (
            <div className="mt-1">
              <div className="text-[9px] text-[#7dd3fc] uppercase mb-0.5">Response</div>
              <div className="text-[11px] text-[#e2e8f0] bg-white/5 p-2 rounded whitespace-pre-wrap max-h-36 overflow-y-auto">
                {result.response}
              </div>
              {result.trace_id && langfuseUrl && (
                <div className="mt-1">
                  <a
                    href={`${langfuseUrl}/trace/${result.trace_id}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[9px] text-[#7dd3fc]"
                  >
                    🔍 Trace in Langfuse
                  </a>
                </div>
              )}
            </div>
          )}

          {error && (
            <div className="text-[10px] text-[#f87171] mt-1">{error}</div>
          )}
        </div>
      )}
    </div>
  )
}
