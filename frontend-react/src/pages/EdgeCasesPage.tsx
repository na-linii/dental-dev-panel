import { useState, useEffect, useMemo } from 'react'
import { clinicsApi, edgeCasesApi, langfuseApi } from '../api/client'
import type { EdgeCaseRunResult } from '../api/client'
import type { Clinic, EdgeCaseItem } from '../types'

const CATEGORIES = ['all', 'booking', 'faq', 'security', 'confirmation', 'production', 'routing', 'multi-turn'] as const
type Category = (typeof CATEGORIES)[number]

const CATEGORY_STYLES: Record<string, { badge: string }> = {
  booking:      { badge: 'bg-blue-500/20 text-blue-400 border border-blue-500/30' },
  faq:          { badge: 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' },
  security:     { badge: 'bg-red-500/20 text-red-400 border border-red-500/30' },
  confirmation: { badge: 'bg-purple-500/20 text-purple-400 border border-purple-500/30' },
  production:   { badge: 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30' },
  other:        { badge: 'bg-[#334155]/50 text-[#94a3b8] border border-[#334155]' },
}

function getCategoryStyle(cat: string) {
  return CATEGORY_STYLES[cat] || CATEGORY_STYLES.other
}

export function EdgeCasesPage() {
  const [clinics, setClinics] = useState<Clinic[]>([])
  const [selectedClinic, setSelectedClinic] = useState('')
  const [items, setItems] = useState<EdgeCaseItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [langfuseUrl, setLangfuseUrl] = useState('')
  const [filter, setFilter] = useState<Category>('all')

  // Results keyed by case_id
  const [results, setResults] = useState<Record<string, EdgeCaseRunResult>>({})
  const [runningCases, setRunningCases] = useState<Set<string>>(new Set())
  const [runningAll, setRunningAll] = useState(false)

  // Load clinics, edge cases, langfuse URL
  useEffect(() => {
    const load = async () => {
      setLoading(true)
      setError('')
      try {
        const [cls, ec, lf] = await Promise.all([
          clinicsApi.list(),
          edgeCasesApi.list(),
          langfuseApi.url(),
        ])
        setClinics(cls)
        if (cls.length > 0 && !selectedClinic) {
          setSelectedClinic(cls[0].id)
        }
        if (ec.error) {
          setError(ec.error)
        }
        setItems(ec.items || [])
        setLangfuseUrl(lf)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load data')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const filteredItems = useMemo(() => {
    if (filter === 'all') return items
    return items.filter((i) => i.category === filter)
  }, [items, filter])

  const runSingleCase = async (item: EdgeCaseItem) => {
    if (!selectedClinic) return
    setRunningCases((prev) => new Set(prev).add(item.id))
    try {
      const result = await edgeCasesApi.run(selectedClinic, {
        case_id: item.id,
        message: item.message,
        patient_phone: item.patient_phone,
        patient_name: item.patient_name,
        history: item.history,
      })
      setResults((prev) => ({ ...prev, [item.id]: result }))
    } catch (e) {
      setResults((prev) => ({
        ...prev,
        [item.id]: {
          case_id: item.id,
          response: e instanceof Error ? e.message : 'Failed',
          error: true,
        },
      }))
    } finally {
      setRunningCases((prev) => {
        const next = new Set(prev)
        next.delete(item.id)
        return next
      })
    }
  }

  const runAllCases = async () => {
    if (!selectedClinic || filteredItems.length === 0) return
    setRunningAll(true)
    setResults({})

    // Mark all as running
    const allIds = new Set(filteredItems.map((i) => i.id))
    setRunningCases(allIds)

    try {
      const res = await edgeCasesApi.runAll(selectedClinic, filteredItems)
      const newResults: Record<string, EdgeCaseRunResult> = {}
      for (const r of res) {
        newResults[r.case_id] = r
      }
      setResults(newResults)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Run All failed')
    } finally {
      setRunningAll(false)
      setRunningCases(new Set())
    }
  }

  const passCount = Object.values(results).filter((r) => !r.error).length
  const failCount = Object.values(results).filter((r) => r.error).length
  const totalResults = Object.keys(results).length

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center h-64">
        <div className="text-[#64748b] text-sm">Loading edge cases...</div>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-white">Edge Cases</h1>
          <p className="text-sm text-[#64748b] mt-1">
            {items.length} test scenarios from Langfuse dataset
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Clinic selector */}
          <select
            value={selectedClinic}
            onChange={(e) => {
              setSelectedClinic(e.target.value)
              setResults({})
            }}
            className="bg-[#111127] border border-[#1e293b] text-white text-sm rounded px-3 py-1.5 focus:outline-none focus:border-[#7dd3fc]"
          >
            {clinics.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name || c.clinic_id}
              </option>
            ))}
          </select>

          {/* Run All button */}
          <button
            onClick={runAllCases}
            disabled={runningAll || !selectedClinic || filteredItems.length === 0}
            className="px-4 py-1.5 rounded bg-[#7dd3fc] text-[#0a0a1a] text-sm font-medium hover:bg-[#67c5f0] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {runningAll ? 'Running...' : `Run All (${filteredItems.length})`}
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 px-4 py-2 bg-red-500/10 border border-red-500/30 rounded text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Category filter */}
      <div className="flex gap-2 mb-4">
        {CATEGORIES.map((cat) => {
          const count = cat === 'all' ? items.length : items.filter((i) => i.category === cat).length
          const isActive = filter === cat
          return (
            <button
              key={cat}
              onClick={() => setFilter(cat)}
              className={`px-3 py-1 rounded text-xs transition-colors ${
                isActive
                  ? 'bg-[#7dd3fc]/20 text-[#7dd3fc] border border-[#7dd3fc]/30'
                  : 'bg-[#111127] text-[#64748b] border border-[#1e293b] hover:text-white'
              }`}
            >
              {cat === 'all' ? 'All' : cat.charAt(0).toUpperCase() + cat.slice(1)} ({count})
            </button>
          )
        })}
      </div>

      {/* Summary bar (when results exist) */}
      {totalResults > 0 && (
        <div className="mb-4 flex items-center gap-4 px-4 py-2 bg-[#111127] border border-[#1e293b] rounded">
          <span className="text-sm text-[#94a3b8]">Results:</span>
          <span className="text-sm text-emerald-400">{passCount} passed</span>
          <span className="text-sm text-red-400">{failCount} errors</span>
          <span className="text-sm text-[#64748b]">{totalResults} / {filteredItems.length} total</span>
        </div>
      )}

      {/* Results table */}
      <div className="bg-[#111127] border border-[#1e293b] rounded-lg overflow-hidden">
        {/* Table header */}
        <div className="grid grid-cols-[140px_80px_1fr_1fr_80px_100px] gap-2 px-4 py-2.5 border-b border-[#1e293b] text-[10px] text-[#64748b] uppercase tracking-wider">
          <div>Case</div>
          <div>Category</div>
          <div>Message</div>
          <div>Response</div>
          <div>Status</div>
          <div>Actions</div>
        </div>

        {/* Table rows */}
        {filteredItems.length === 0 ? (
          <div className="px-4 py-8 text-center text-[#64748b] text-sm">
            No edge cases found
          </div>
        ) : (
          filteredItems.map((item) => {
            const result = results[item.id]
            const isRunning = runningCases.has(item.id)
            const catStyle = getCategoryStyle(item.category)

            return (
              <div
                key={item.id}
                className="grid grid-cols-[140px_80px_1fr_1fr_80px_100px] gap-2 px-4 py-2.5 border-b border-[#1e293b]/50 last:border-0 hover:bg-white/[0.02] items-start"
              >
                {/* Case ID */}
                <div>
                  <div className="text-xs text-white font-medium">{item.id}</div>
                  {item.patient_name && (
                    <div className="text-[10px] text-[#64748b] mt-0.5">{item.patient_name}</div>
                  )}
                </div>

                {/* Category */}
                <div>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded ${catStyle.badge}`}>
                    {item.category}
                  </span>
                </div>

                {/* Message */}
                <div className="text-xs text-[#e2e8f0] leading-relaxed">
                  {item.history.length > 0 && (
                    <div className="text-[10px] text-[#475569] mb-1">
                      [{item.history.length} prior message{item.history.length > 1 ? 's' : ''}]
                    </div>
                  )}
                  {item.message}
                  <div className="text-[10px] text-[#475569] mt-1 italic">
                    Expected: {item.expected}
                  </div>
                </div>

                {/* Response */}
                <div className="text-xs leading-relaxed">
                  {isRunning ? (
                    <span className="text-[#64748b]">Running...</span>
                  ) : result ? (
                    <div>
                      <div className={`whitespace-pre-wrap max-h-24 overflow-y-auto ${result.error ? 'text-red-400' : 'text-[#94a3b8]'}`}>
                        {result.response}
                      </div>
                      {result.trace_id && langfuseUrl && (
                        <a
                          href={`${langfuseUrl}/trace/${result.trace_id}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[10px] text-[#7dd3fc] hover:underline mt-1 inline-block"
                        >
                          View trace
                        </a>
                      )}
                    </div>
                  ) : (
                    <span className="text-[#334155]">--</span>
                  )}
                </div>

                {/* Status */}
                <div>
                  {isRunning ? (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-yellow-500/20 text-yellow-400 border border-yellow-500/30">
                      running
                    </span>
                  ) : result ? (
                    result.error ? (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/20 text-red-400 border border-red-500/30">
                        error
                      </span>
                    ) : (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                        done
                      </span>
                    )
                  ) : null}
                </div>

                {/* Actions */}
                <div>
                  <button
                    onClick={() => runSingleCase(item)}
                    disabled={isRunning || runningAll}
                    className="px-2 py-1 rounded border border-[#1e293b] bg-[#0a0a1a] text-white text-[10px] hover:bg-[#1e293b] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {isRunning ? 'Running...' : 'Run'}
                  </button>
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
