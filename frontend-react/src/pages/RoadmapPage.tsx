import { useState, useEffect } from 'react'
import { roadmapApi } from '../api/client'
import type { Epic, EpicTask } from '../types'

// Jira status -> color mapping
const JIRA_STATUS_STYLES: Record<string, { dot: string; badge: string; label: string }> = {
  'Backlog':       { dot: 'bg-[#475569]',   badge: 'bg-[#334155]/50 text-[#94a3b8] border border-[#334155]', label: 'Backlog' },
  'К выполнению':  { dot: 'bg-blue-400',    badge: 'bg-blue-500/20 text-blue-400 border border-blue-500/30', label: 'To Do' },
  'В работе':      { dot: 'bg-yellow-400',  badge: 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30', label: 'In Progress' },
  'На проверке':   { dot: 'bg-purple-400',  badge: 'bg-purple-500/20 text-purple-400 border border-purple-500/30', label: 'Review' },
  'ON REVIEW':     { dot: 'bg-purple-400',  badge: 'bg-purple-500/20 text-purple-400 border border-purple-500/30', label: 'Review' },
  'Готово':        { dot: 'bg-emerald-400', badge: 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30', label: 'Done' },
}

function getJiraStyle(statusName: string) {
  return JIRA_STATUS_STYLES[statusName] || JIRA_STATUS_STYLES['К выполнению']
}

function TaskRow({ task }: { task: EpicTask }) {
  const style = getJiraStyle(task.status)
  return (
    <div className="flex items-center gap-3 py-2 px-3 border-b border-[#1e293b]/50 last:border-0">
      <div className={`w-2 h-2 rounded-full shrink-0 ${style.dot}`} />
      <div className="flex-1 min-w-0">
        <span className="text-[0.78rem] text-[#e2e8f0] truncate block">
          {task.summary.replace(/^🔵\s*/, '')}
        </span>
        {task.assignee && (
          <div className="flex items-center gap-1.5 mt-0.5">
            {task.assigneeAvatar && (
              <img src={task.assigneeAvatar} alt="" className="w-4 h-4 rounded-full" />
            )}
            <span className="text-[0.65rem] text-[#64748b]">{task.assignee}</span>
          </div>
        )}
      </div>
      <span className={`text-[0.6rem] px-1.5 py-0.5 rounded shrink-0 ${style.badge}`}>
        {style.label}
      </span>
      <a
        href={task.url}
        target="_blank"
        rel="noopener noreferrer"
        className="text-[0.6rem] px-1.5 py-0.5 rounded bg-[#1e293b] text-[#7dd3fc] hover:bg-[#334155] no-underline shrink-0"
      >
        {task.key}
      </a>
    </div>
  )
}

function EpicCard({ epic }: { epic: Epic }) {
  const [expanded, setExpanded] = useState(false)
  const { progress } = epic

  return (
    <div className="bg-[#111127] border border-[#1e293b] rounded-lg overflow-hidden">
      {/* Header — clickable */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full text-left p-4 cursor-pointer bg-transparent border-0"
      >
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="text-[0.65rem] text-[#64748b] font-mono">{epic.key}</span>
            <h3 className="text-white text-sm font-medium">{epic.summary}</h3>
          </div>
          <svg
            className={`w-4 h-4 text-[#64748b] transition-transform ${expanded ? 'rotate-180' : ''}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </div>

        {/* Progress bar */}
        <div className="flex h-2.5 rounded-full overflow-hidden bg-[#1e293b]">
          {progress.done > 0 && (
            <div
              className="bg-emerald-500 transition-all"
              style={{ width: `${(progress.done / progress.total) * 100}%` }}
              title={`Done: ${progress.done}`}
            />
          )}
          {progress.review > 0 && (
            <div
              className="bg-purple-500 transition-all"
              style={{ width: `${(progress.review / progress.total) * 100}%` }}
              title={`Review: ${progress.review}`}
            />
          )}
          {progress.in_progress > 0 && (
            <div
              className="bg-yellow-500 transition-all"
              style={{ width: `${(progress.in_progress / progress.total) * 100}%` }}
              title={`In Progress: ${progress.in_progress}`}
            />
          )}
          {progress.todo > 0 && (
            <div
              className="bg-blue-500 transition-all"
              style={{ width: `${(progress.todo / progress.total) * 100}%` }}
              title={`To Do: ${progress.todo}`}
            />
          )}
          {progress.backlog > 0 && (
            <div
              className="bg-[#334155] transition-all"
              style={{ width: `${(progress.backlog / progress.total) * 100}%` }}
              title={`Backlog: ${progress.backlog}`}
            />
          )}
        </div>

        {/* Progress text */}
        <div className="flex items-center justify-between mt-2">
          <div className="flex flex-wrap gap-x-3 gap-y-1 text-[0.65rem] text-[#94a3b8]">
            {progress.done > 0 && <span><span className="inline-block w-2 h-2 rounded-full bg-emerald-500 mr-1" />Done: {progress.done}</span>}
            {progress.review > 0 && <span><span className="inline-block w-2 h-2 rounded-full bg-purple-500 mr-1" />Review: {progress.review}</span>}
            {progress.in_progress > 0 && <span><span className="inline-block w-2 h-2 rounded-full bg-yellow-500 mr-1" />In Progress: {progress.in_progress}</span>}
            {progress.todo > 0 && <span><span className="inline-block w-2 h-2 rounded-full bg-blue-500 mr-1" />To Do: {progress.todo}</span>}
            {progress.backlog > 0 && <span><span className="inline-block w-2 h-2 rounded-full bg-[#334155] mr-1" />Backlog: {progress.backlog}</span>}
          </div>
          <span className={`text-[0.7rem] font-mono tabular-nums ${
            progress.percent >= 80 ? 'text-emerald-400' :
            progress.percent >= 40 ? 'text-yellow-400' : 'text-[#94a3b8]'
          }`}>
            {progress.done}/{progress.total} done ({progress.percent}%)
          </span>
        </div>
      </button>

      {/* Task list — expandable */}
      {expanded && epic.tasks.length > 0 && (
        <div className="border-t border-[#1e293b]">
          {epic.tasks.map((task) => (
            <TaskRow key={task.key} task={task} />
          ))}
        </div>
      )}
    </div>
  )
}

export function RoadmapPage() {
  const [epics, setEpics] = useState<Epic[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    roadmapApi.epics()
      .then((data) => {
        setEpics(data)
        setError(null)
      })
      .catch((err) => {
        setError(err?.response?.status === 503 ? 'Jira не настроена' : 'Ошибка загрузки')
        setEpics([])
      })
      .finally(() => setLoading(false))

    const interval = setInterval(() => {
      roadmapApi.epics()
        .then((data) => { setEpics(data); setError(null) })
        .catch(() => {})
    }, 30_000)
    return () => clearInterval(interval)
  }, [])

  // Overall progress across all epics
  const totals = epics.reduce(
    (acc, e) => ({
      total: acc.total + e.progress.total,
      done: acc.done + e.progress.done,
      review: acc.review + e.progress.review,
      in_progress: acc.in_progress + e.progress.in_progress,
      todo: acc.todo + e.progress.todo,
      backlog: acc.backlog + e.progress.backlog,
    }),
    { total: 0, done: 0, review: 0, in_progress: 0, todo: 0, backlog: 0 },
  )
  const overallPercent = totals.total > 0 ? Math.round((totals.done / totals.total) * 100) : 0

  return (
    <div className="overflow-y-auto p-6" style={{ height: 'calc(100vh - 48px)' }}>
      <div className="max-w-[1100px] mx-auto">
        <h2 className="text-lg font-semibold mb-1">Project Board</h2>
        <p className="text-xs text-[#64748b] mb-6">Jira epics and tasks</p>

        {/* Loading state */}
        {loading && (
          <div className="text-[0.78rem] text-[#64748b] mb-4">Loading...</div>
        )}

        {/* Error state */}
        {error && (
          <div className="text-[0.75rem] text-[#64748b] mb-4 bg-[#111127] border border-[#1e293b] rounded-lg p-4">
            {error}. Tasks will appear automatically once JIRA_API_TOKEN is configured.
          </div>
        )}

        {/* Overall progress (only when we have data) */}
        {!loading && !error && epics.length > 0 && (
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[0.78rem] text-[#94a3b8]">Overall progress</span>
              <span className={`text-[0.78rem] font-mono tabular-nums ${
                overallPercent >= 80 ? 'text-emerald-400' :
                overallPercent >= 40 ? 'text-yellow-400' : 'text-[#94a3b8]'
              }`}>
                {totals.done}/{totals.total} tasks ({overallPercent}%)
              </span>
            </div>
            <div className="flex h-2.5 rounded-full overflow-hidden bg-[#1e293b]">
              {totals.done > 0 && (
                <div className="bg-emerald-500 transition-all" style={{ width: `${(totals.done / totals.total) * 100}%` }} title={`Done: ${totals.done}`} />
              )}
              {totals.review > 0 && (
                <div className="bg-purple-500 transition-all" style={{ width: `${(totals.review / totals.total) * 100}%` }} title={`Review: ${totals.review}`} />
              )}
              {totals.in_progress > 0 && (
                <div className="bg-yellow-500 transition-all" style={{ width: `${(totals.in_progress / totals.total) * 100}%` }} title={`In Progress: ${totals.in_progress}`} />
              )}
              {totals.todo > 0 && (
                <div className="bg-blue-500 transition-all" style={{ width: `${(totals.todo / totals.total) * 100}%` }} title={`To Do: ${totals.todo}`} />
              )}
              {totals.backlog > 0 && (
                <div className="bg-[#334155] transition-all" style={{ width: `${(totals.backlog / totals.total) * 100}%` }} title={`Backlog: ${totals.backlog}`} />
              )}
            </div>
          </div>
        )}

        {/* Epic cards */}
        {!loading && !error && (
          <div className="space-y-4">
            {epics.map((epic) => (
              <EpicCard key={epic.key} epic={epic} />
            ))}
            {epics.length === 0 && (
              <div className="text-[0.75rem] text-[#64748b]">No epics found</div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
