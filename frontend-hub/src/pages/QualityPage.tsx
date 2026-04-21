import { useState, useEffect } from 'react'
import { qualityApi, langfuseApi } from '../api/client'
import type { QualitySummary, QualityRunHistory } from '../types'

const CATEGORY_LABELS: Record<string, string> = {
  booking: 'Booking',
  faq: 'FAQ',
  security: 'Security',
  confirmation: 'Confirmation',
  routing: 'Routing',
  production: 'Production',
  'multi-turn': 'Multi-turn',
}

const CATEGORY_COLORS: Record<string, string> = {
  booking: '#7dd3fc',
  faq: '#a78bfa',
  security: '#f87171',
  confirmation: '#34d399',
  routing: '#fbbf24',
  production: '#fb923c',
  'multi-turn': '#f472b6',
}

function SummaryCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="bg-[#111127] border border-[#1e293b] rounded-lg p-4">
      <div className="text-[0.7rem] text-[#64748b] mb-1">{label}</div>
      <div className={`text-2xl font-bold tabular-nums ${color || 'text-white'}`}>{value}</div>
      {sub && <div className="text-[0.65rem] text-[#475569] mt-1">{sub}</div>}
    </div>
  )
}

function CategoryBar({ name, passed, failed }: { name: string; passed: number; failed: number }) {
  const total = passed + failed
  const passRate = total > 0 ? Math.round((passed / total) * 100) : 0
  const color = CATEGORY_COLORS[name] || '#94a3b8'
  const label = CATEGORY_LABELS[name] || name

  return (
    <div className="flex items-center gap-3 py-2">
      <div className="w-24 text-[0.78rem] text-[#e2e8f0] truncate">{label}</div>
      <div className="flex-1 h-5 bg-[#1e293b] rounded-full overflow-hidden flex">
        {passed > 0 && (
          <div
            className="h-full transition-all duration-500"
            style={{ width: `${(passed / total) * 100}%`, backgroundColor: color }}
            title={`Pass: ${passed}`}
          />
        )}
        {failed > 0 && (
          <div
            className="h-full bg-red-500/60 transition-all duration-500"
            style={{ width: `${(failed / total) * 100}%` }}
            title={`Fail: ${failed}`}
          />
        )}
      </div>
      <div className="w-20 text-right">
        <span className={`text-[0.78rem] font-mono tabular-nums ${passRate >= 80 ? 'text-emerald-400' : passRate >= 50 ? 'text-yellow-400' : 'text-red-400'}`}>
          {passRate}%
        </span>
        <span className="text-[0.6rem] text-[#475569] ml-1">({passed}/{total})</span>
      </div>
    </div>
  )
}

function TrendArrow({ current, previous }: { current: number; previous: number }) {
  if (previous === 0) return <span className="text-[#475569]">--</span>
  const diff = current - previous
  if (diff > 0) return <span className="text-emerald-400">+{diff.toFixed(1)}%</span>
  if (diff < 0) return <span className="text-red-400">{diff.toFixed(1)}%</span>
  return <span className="text-[#475569]">=</span>
}

export function QualityPage() {
  const [summary, setSummary] = useState<QualitySummary | null>(null)
  const [history, setHistory] = useState<QualityRunHistory[]>([])
  const [langfuseUrl, setLangfuseUrl] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([
      qualityApi.summary(),
      qualityApi.history(undefined, 15),
      langfuseApi.url(),
    ])
      .then(([sum, hist, url]) => {
        if (sum.error) {
          setError(sum.error)
        } else {
          setSummary(sum)
        }
        setHistory(hist)
        setLangfuseUrl(url)
      })
      .catch((err) => {
        setError(err?.response?.data?.error || err?.message || 'Failed to load quality data')
      })
      .finally(() => setLoading(false))
  }, [])

  const passRate = summary && summary.total > 0
    ? Math.round((summary.passed / summary.total) * 100)
    : 0

  const failRate = summary && summary.total > 0
    ? Math.round((summary.failed / summary.total) * 100)
    : 0

  const categories = summary?.categories
    ? Object.entries(summary.categories).sort(([a], [b]) => a.localeCompare(b))
    : []

  return (
    <div className="overflow-y-auto p-6" style={{ height: 'calc(100vh - 48px)' }}>
      <div className="max-w-[1600px] mx-auto">
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-lg font-semibold">Quality Dashboard</h2>
          {langfuseUrl && (
            <a
              href={`${langfuseUrl}/project`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[0.75rem] px-3 py-1.5 rounded bg-[#1e293b] text-[#7dd3fc] hover:bg-[#334155] no-underline transition-colors"
            >
              Open Langfuse
            </a>
          )}
        </div>
        <p className="text-xs text-[#64748b] mb-5">
          LLM-as-Judge evaluation results from Langfuse experiments
          {summary?.run_name && (
            <span className="ml-2 text-[#475569]">
              Last run: <span className="text-[#94a3b8]">{summary.run_name}</span>
              {summary.run_at && (
                <span className="ml-1">
                  ({new Date(summary.run_at).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })})
                </span>
              )}
            </span>
          )}
        </p>

        {/* Loading */}
        {loading && (
          <div className="text-[0.78rem] text-[#64748b] mb-4">Loading...</div>
        )}

        {/* Error */}
        {error && !loading && (
          <div className="text-[0.75rem] text-[#64748b] mb-4 bg-[#111127] border border-[#1e293b] rounded-lg p-4">
            {error}. Run <code className="text-[#7dd3fc]">python scripts/run_eval.py</code> to generate quality data.
          </div>
        )}

        {/* Summary Cards */}
        {!loading && summary && summary.total > 0 && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <SummaryCard label="Total Cases" value={String(summary.total)} />
              <SummaryCard
                label="Pass Rate"
                value={`${passRate}%`}
                sub={`${summary.passed} passed`}
                color={passRate >= 80 ? 'text-emerald-400' : passRate >= 50 ? 'text-yellow-400' : 'text-red-400'}
              />
              <SummaryCard
                label="Fail Rate"
                value={`${failRate}%`}
                sub={`${summary.failed} failed`}
                color={failRate === 0 ? 'text-emerald-400' : failRate <= 20 ? 'text-yellow-400' : 'text-red-400'}
              />
              <SummaryCard
                label="Latency"
                value={summary.latency_p50 > 0 ? `${summary.latency_p50}s` : '--'}
                sub={summary.latency_p95 > 0 ? `p95: ${summary.latency_p95}s` : 'No data'}
              />
            </div>

            {/* Category Breakdown */}
            {categories.length > 0 && (
              <div className="bg-[#111127] border border-[#1e293b] rounded-lg p-4 mb-6">
                <h3 className="text-sm font-medium text-[#e2e8f0] mb-3">Category Breakdown</h3>
                <div className="space-y-1">
                  {categories.map(([cat, data]) => (
                    <CategoryBar key={cat} name={cat} passed={data.passed} failed={data.failed} />
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {/* Empty state */}
        {!loading && !error && summary && summary.total === 0 && (
          <div className="text-[0.75rem] text-[#64748b] mb-4 bg-[#111127] border border-[#1e293b] rounded-lg p-4">
            No evaluation runs found. Run <code className="text-[#7dd3fc]">python scripts/run_eval.py</code> to start.
          </div>
        )}

        {/* History Table */}
        {!loading && history.length > 0 && (
          <div className="bg-[#111127] border border-[#1e293b] rounded-lg overflow-hidden">
            <div className="p-4 border-b border-[#1e293b]">
              <h3 className="text-sm font-medium text-[#e2e8f0]">Run History</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-[0.78rem]">
                <thead>
                  <tr className="border-b border-[#1e293b] text-[#64748b]">
                    <th className="text-left py-2.5 px-4 font-medium">Run</th>
                    <th className="text-left py-2.5 px-4 font-medium">Date</th>
                    <th className="text-right py-2.5 px-4 font-medium">Total</th>
                    <th className="text-right py-2.5 px-4 font-medium">Passed</th>
                    <th className="text-right py-2.5 px-4 font-medium">Failed</th>
                    <th className="text-right py-2.5 px-4 font-medium">Pass Rate</th>
                    <th className="text-right py-2.5 px-4 font-medium">Trend</th>
                    <th className="text-right py-2.5 px-4 font-medium">Avg Latency</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((run, idx) => (
                    <tr key={run.name} className="border-b border-[#1e293b]/50 hover:bg-[#1e293b]/30 transition-colors">
                      <td className="py-2.5 px-4 text-[#7dd3fc] font-mono text-[0.7rem]">
                        {langfuseUrl ? (
                          <a
                            href={`${langfuseUrl}/project`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[#7dd3fc] hover:underline no-underline"
                          >
                            {run.name}
                          </a>
                        ) : (
                          run.name
                        )}
                      </td>
                      <td className="py-2.5 px-4 text-[#94a3b8]">
                        {run.created_at
                          ? new Date(run.created_at).toLocaleDateString('ru-RU', {
                              day: 'numeric',
                              month: 'short',
                              hour: '2-digit',
                              minute: '2-digit',
                            })
                          : '--'}
                      </td>
                      <td className="py-2.5 px-4 text-right text-[#e2e8f0] tabular-nums">{run.total}</td>
                      <td className="py-2.5 px-4 text-right text-emerald-400 tabular-nums">{run.passed}</td>
                      <td className="py-2.5 px-4 text-right text-red-400 tabular-nums">{run.failed}</td>
                      <td className="py-2.5 px-4 text-right tabular-nums">
                        <span className={
                          run.pass_rate >= 80 ? 'text-emerald-400' :
                          run.pass_rate >= 50 ? 'text-yellow-400' : 'text-red-400'
                        }>
                          {run.pass_rate}%
                        </span>
                      </td>
                      <td className="py-2.5 px-4 text-right text-[0.7rem] tabular-nums">
                        {idx < history.length - 1 ? (
                          <TrendArrow current={run.pass_rate} previous={history[idx + 1].pass_rate} />
                        ) : (
                          <span className="text-[#475569]">--</span>
                        )}
                      </td>
                      <td className="py-2.5 px-4 text-right text-[#94a3b8] tabular-nums">
                        {run.avg_latency > 0 ? `${run.avg_latency}s` : '--'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
