type Status = 'ok' | 'wip' | 'no' | 'skip'
type TimelineState = 'done' | 'wip' | 'todo'

interface ComponentRow {
  name: string
  status: Status
  label: string
}

interface ComponentSection {
  title: string
  rows: ComponentRow[]
}

interface TimelineItem {
  state: TimelineState
  date: string
  title: string
  desc: string
}

const STATUS_STYLES: Record<Status, string> = {
  ok: 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30',
  wip: 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30',
  no: 'bg-red-500/20 text-red-400 border border-red-500/30',
  skip: 'bg-[#334155]/50 text-[#64748b] border border-[#334155]',
}

const DOT_STYLES: Record<TimelineState, string> = {
  done: 'bg-emerald-400',
  wip: 'bg-yellow-400',
  todo: 'bg-red-400',
}

const sections: ComponentSection[] = [
  {
    title: 'Router + Agents',
    rows: [
      { name: 'Dental Router (LLM intent)', status: 'ok', label: 'Готово' },
      { name: 'FAQ Agent + Tier 1/2 KB', status: 'ok', label: 'Готово' },
      { name: 'Booking Agent + 7 CRM tools', status: 'ok', label: 'Готово' },
      { name: 'Confirmation Agent (LLM)', status: 'ok', label: 'Готово' },
      { name: 'Confirmation reply handling', status: 'ok', label: 'Готово' },
    ],
  },
  {
    title: 'Tools',
    rows: [
      { name: 'CRM: get_availability, book, cancel', status: 'ok', label: 'Готово' },
      { name: 'CRM: get_bookings, register_patient', status: 'ok', label: 'Готово' },
      { name: 'CRM: update_status, get_tomorrow', status: 'ok', label: 'Готово' },
      { name: 'Chat: send_message, handoff', status: 'ok', label: 'Готово' },
      { name: 'Action: create_action', status: 'ok', label: 'Готово' },
      { name: 'Knowledge: Tier 1 YAML, Tier 2 pgvector', status: 'ok', label: 'Готово' },
    ],
  },
  {
    title: 'Gateways',
    rows: [
      { name: 'Identity (resolve + session + save)', status: 'ok', label: 'Готово' },
      { name: 'Chat Gateway (delivery only)', status: 'ok', label: 'Готово' },
      { name: 'CRM Gateway + Protocol', status: 'ok', label: 'Готово' },
      { name: 'Scheduler (confirmation)', status: 'ok', label: 'Готово' },
      { name: 'Debounce + Operator Cooldown', status: 'ok', label: 'Готово' },
      { name: 'ChatSession (state machine)', status: 'ok', label: 'Готово' },
    ],
  },
  {
    title: 'Storage (PostgreSQL)',
    rows: [
      { name: 'Identity DB (users + channels)', status: 'ok', label: 'Готово' },
      { name: 'Chat Sessions (controller, status)', status: 'ok', label: 'Готово' },
      { name: 'Chat Messages (audit trail)', status: 'ok', label: 'Готово' },
      { name: 'Checkpointer (LangGraph state)', status: 'ok', label: 'Готово' },
      { name: 'Knowledge Base (pgvector)', status: 'ok', label: 'Готово' },
      { name: 'Action Queue (manual ops)', status: 'ok', label: 'Готово' },
    ],
  },
  {
    title: 'Plugins (channels + CRM)',
    rows: [
      { name: 'Telegram Bot (polling)', status: 'ok', label: 'Готово' },
      { name: 'Google Sheets CRM adapter', status: 'ok', label: 'Готово' },
      { name: 'Telegram Business', status: 'wip', label: 'Parse готов' },
      { name: 'IDENT CRM Adapter', status: 'no', label: 'Планируется' },
      { name: 'MAX Messenger', status: 'skip', label: 'Потом' },
      { name: 'Voice (LiveKit)', status: 'skip', label: 'Потом' },
    ],
  },
  {
    title: 'Prompts (Langfuse)',
    rows: [
      { name: 'dental-router (intent classification)', status: 'ok', label: 'Готово' },
      { name: 'dental-booking (запись + guardrails)', status: 'ok', label: 'Готово' },
      { name: 'dental-faq (консультация)', status: 'ok', label: 'Готово' },
      { name: 'dental-confirmation (подтверждение)', status: 'ok', label: 'Готово' },
    ],
  },
  {
    title: 'Infra + Platform',
    rows: [
      { name: 'LLM Fallback (OpenRouter)', status: 'ok', label: 'Готово' },
      { name: 'CI/CD (GitHub Actions)', status: 'ok', label: 'Готово' },
      { name: 'Dental Hub + Langfuse', status: 'ok', label: 'Готово' },
      { name: 'Hub: конфигурация клиник', status: 'ok', label: 'Готово' },
      { name: 'Langfuse prompt sync', status: 'ok', label: 'Готово' },
      { name: 'Module registry (34 модуля)', status: 'ok', label: 'Готово' },
      { name: 'K8s architecture (Helm chart)', status: 'ok', label: 'Готово' },
      { name: 'Admin Panel', status: 'no', label: 'Планируется' },
      { name: 'Metabase analytics', status: 'skip', label: 'Потом' },
    ],
  },
]

const timeline: TimelineItem[] = [
  {
    state: 'done',
    date: '26 марта, 18:46',
    title: 'Старт проекта',
    desc: 'Инициализация: LangGraph + Langfuse self-hosted. Базовая структура агента.',
  },
  {
    state: 'done',
    date: '27 марта, 10:10 — 15:21',
    title: 'Ядро: Router, Agents, Identity, Knowledge Base',
    desc: 'Dental Router (LLM), FAQ Agent + pgvector, Booking Agent + 7 CRM tools. Identity resolution (6-step flow). Клинические конфиги YAML. Параллельная работа двух разработчиков.',
  },
  {
    state: 'done',
    date: '28 марта, 22:00 — 23:55',
    title: 'CRM + Channels + Confirmation',
    desc: 'PostgreSQL storage (3 модуля), Confirmation Agent + Action Queue, Chat Gateway + Telegram Bot + streaming. Удалены ВСЕ хардкод-keywords — только LLM-роутинг. Self-describing modules, /config endpoint.',
  },
  {
    state: 'done',
    date: '29 марта, 00:00 — 00:10',
    title: 'Dental Hub: 3D-визуализация',
    desc: 'Подбор цветов, форм, wireframes для 3D-графа. Единый viz-config.',
  },
  {
    state: 'done',
    date: '29 марта, 13:32 — 14:33',
    title: 'Оптимизация агентов + ChatSession',
    desc: 'Все промпты в Langfuse (zero hardcode), sanitized tool output, patient identity. ChatSession state machine, operator cooldown (per-clinic), message debouncing (per-channel), confirmation reply flow. 213 тестов.',
  },
  {
    state: 'done',
    date: '29 марта, 20:08 — 22:56',
    title: 'Модульная архитектура',
    desc: '34 модуля с типизированными I/O схемами. Registry-driven tool binding — tools привязываются к агентам через реестр. Graph.json генерируется из registry автоматически.',
  },
  {
    state: 'done',
    date: '29 марта, 23:08',
    title: 'K8s deployment architecture',
    desc: 'Helm chart, CI update. Подготовка к Kubernetes.',
  },
  {
    state: 'done',
    date: '29 марта, 23:47',
    title: 'Линейный message pipeline',
    desc: 'Рефакторинг: Plugin -> Identity -> Debounce -> Router -> Agent. Debounce + operator cooldown объединены (два таймера тишины). Chat Gateway облегчён до транспорта. 216 тестов.',
  },
  {
    state: 'wip',
    date: 'ЭТАП 6 -- 30 марта',
    title: 'E2E тестирование + подключение Зубатка',
    desc: 'Полный цикл: запись, перенос, отмена, подтверждение. Telegram Bot + Google Sheets CRM.',
  },
  {
    state: 'todo',
    date: 'ЭТАП 7 -- Апрель',
    title: 'Admin Panel + IDENT + 10 клиник',
    desc: 'Admin panel, IDENT CRM adapter, blocked patients, Telegram Business full flow. Metabase analytics.',
  },
  {
    state: 'todo',
    date: 'ЭТАП 8 -- Апрель-Май',
    title: 'Multi-channel + Voice',
    desc: 'MAX Messenger, Voice (LiveKit), multi-clinic deploy через Hub.',
  },
]

const systemCards = [
  {
    title: 'Dental Core',
    text: 'Инстанс клиники. 1 Docker = 1 клиника. Pipeline: Plugin \u2192 Identity \u2192 Debounce \u2192 Router (LLM) \u2192 FAQ / Booking / Confirmation Agent \u2192 CRM Gateway. 34 модуля, registry-driven tool binding. PostgreSQL: Identity DB, Checkpointer, Knowledge Base, Action Queue. gpt-5.4-mini + OpenRouter fallback.',
  },
  {
    title: 'Dental Hub',
    text: 'Платформа управления. Langfuse (shared), Hub API (proxy, управление клиниками). 3D визуализатор, live trace animation, конфигурация клиник. Архитектура строится из graph.json (GitHub API, main branch). Промпты из Langfuse.',
  },
  {
    title: 'Разворачивание клиники',
    text: 'YAML конфиг + env vars \u2192 docker compose up \u2192 CLINIC_ID выбирает клинику \u2192 agent подключается к Langfuse через Hub. 3-4 клиники на один сервер Yandex. CI/CD: push в main \u2192 pytest \u2192 auto-deploy. Готовится K8s.',
  },
]

function StatusBadge({ status, label }: { status: Status; label: string }) {
  return (
    <span className={`text-[0.65rem] px-1.5 py-0.5 rounded ${STATUS_STYLES[status]}`}>
      {label}
    </span>
  )
}

// Count totals for progress bar
function computeProgress() {
  let ok = 0, wip = 0, no = 0, skip = 0
  for (const s of sections) {
    for (const r of s.rows) {
      if (r.status === 'ok') ok++
      else if (r.status === 'wip') wip++
      else if (r.status === 'no') no++
      else skip++
    }
  }
  const total = ok + wip + no + skip
  return { ok, wip, no, skip, total }
}

export function RoadmapPage() {
  const { ok, wip, no, skip, total } = computeProgress()

  return (
    <div className="overflow-y-auto p-6" style={{ height: 'calc(100vh - 48px)' }}>
      <div className="max-w-[1100px] mx-auto">
        <h2 className="text-lg font-semibold mb-1">Roadmap</h2>
        <p className="text-xs text-[#64748b] mb-4">v0.1.0 — Обновлено 29.03.2026</p>

        {/* Progress bar */}
        <div className="flex h-3 rounded-full overflow-hidden mb-6 bg-[#1e293b]">
          {ok > 0 && (
            <div
              className="bg-emerald-500 transition-all"
              style={{ width: `${(ok / total) * 100}%` }}
              title={`Готово: ${ok}`}
            />
          )}
          {wip > 0 && (
            <div
              className="bg-yellow-500 transition-all"
              style={{ width: `${(wip / total) * 100}%` }}
              title={`WIP: ${wip}`}
            />
          )}
          {no > 0 && (
            <div
              className="bg-red-500 transition-all"
              style={{ width: `${(no / total) * 100}%` }}
              title={`Планируется: ${no}`}
            />
          )}
          {skip > 0 && (
            <div
              className="bg-[#334155] transition-all"
              style={{ width: `${(skip / total) * 100}%` }}
              title={`Потом: ${skip}`}
            />
          )}
        </div>
        <div className="flex gap-4 text-[0.68rem] text-[#94a3b8] mb-6">
          <span><span className="inline-block w-2 h-2 rounded-full bg-emerald-500 mr-1" />Готово: {ok}</span>
          <span><span className="inline-block w-2 h-2 rounded-full bg-yellow-500 mr-1" />WIP: {wip}</span>
          <span><span className="inline-block w-2 h-2 rounded-full bg-red-500 mr-1" />Планируется: {no}</span>
          <span><span className="inline-block w-2 h-2 rounded-full bg-[#334155] mr-1" />Потом: {skip}</span>
        </div>

        {/* System overview */}
        <h3 className="text-[0.9rem] text-[#7dd3fc] mt-4 mb-2">Как работает система</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
          {systemCards.map((card) => (
            <div key={card.title} className="bg-[#111127] border border-[#1e293b] rounded-lg p-4">
              <h3 className="text-[#7dd3fc] text-sm font-medium mb-2">{card.title}</h3>
              <p className="text-[0.75rem] text-[#94a3b8] leading-relaxed">{card.text}</p>
            </div>
          ))}
        </div>

        {/* Component status matrix */}
        <h3 className="text-[0.9rem] text-[#7dd3fc] mt-6 mb-2">Компоненты</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mb-6">
          {sections.map((section) => (
            <div key={section.title} className="bg-[#111127] border border-[#1e293b] rounded-lg p-4">
              <h3 className="text-white text-sm font-medium mb-3">{section.title}</h3>
              <table className="w-full">
                <tbody>
                  {section.rows.map((row) => (
                    <tr key={row.name} className="border-b border-[#1e293b] last:border-0">
                      <td className="text-[0.72rem] text-[#94a3b8] py-1.5 pr-2">{row.name}</td>
                      <td className="text-right py-1.5">
                        <StatusBadge status={row.status} label={row.label} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>

        {/* Timeline */}
        <h3 className="text-[0.9rem] text-[#7dd3fc] mt-6 mb-4">Таймлайн</h3>
        <div className="relative ml-4 mb-8">
          {/* Vertical line */}
          <div className="absolute left-0 top-0 bottom-0 w-px bg-[#1e293b]" />

          {timeline.map((item, i) => (
            <div key={i} className="relative pl-8 pb-6 last:pb-0">
              {/* Dot */}
              <div
                className={`absolute left-0 top-1 w-3 h-3 rounded-full -translate-x-1/2 border-2 border-[#0a0a1a] ${DOT_STYLES[item.state]}`}
              />
              <div className="text-[0.68rem] text-[#64748b] mb-1">{item.date}</div>
              <div className="text-sm text-white font-medium mb-1">{item.title}</div>
              <div className="text-[0.75rem] text-[#94a3b8] leading-relaxed">{item.desc}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
