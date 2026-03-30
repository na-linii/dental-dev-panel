import { useState, useEffect } from 'react'
import { roadmapApi, type JiraTask } from '../api/client'

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

interface MigrationArea {
  name: string
  weight: number
  readiness: number
  note: string
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

/* ── Migration readiness data (AI Agent → Dental Core) ── */

const migrationAreas: MigrationArea[] = [
  { name: 'Core Agent (Router/Booking/FAQ/Confirm)', weight: 25, readiness: 100, note: 'Полный паритет + FAQ Agent новый' },
  { name: 'CRM Integration (IDENT)', weight: 15, readiness: 40, note: 'Google Sheets done, IDENT не реализован' },
  { name: 'Каналы (TG Bot, TG Biz, MAX)', weight: 20, readiness: 45, note: 'TG Bot done, TG Business WIP' },
  { name: 'База данных', weight: 10, readiness: 75, note: 'Схема лучше, confirmation_runs нужна' },
  { name: 'Admin Panel', weight: 10, readiness: 10, note: 'Операторский UI не перенесён' },
  { name: 'Background Tasks', weight: 5, readiness: 80, note: 'asyncio scheduler заменяет Celery' },
  { name: 'Dev Tools', weight: 3, readiness: 15, note: 'Developer mode не перенесён' },
  { name: 'Observability', weight: 5, readiness: 95, note: 'Langfuse v4 + streaming' },
  { name: 'Тесты', weight: 5, readiness: 70, note: '22 unit + 2 E2E' },
  { name: 'Deployment / Infra', weight: 2, readiness: 90, note: 'Docker + CI/CD + Helm' },
]

const migrationTotal = Math.round(
  migrationAreas.reduce((sum, a) => sum + a.weight * a.readiness / 100, 0)
)

const projectComparison = {
  old: { name: 'AI Agent', created: '19.01.2026', commits: 673, loc: '40,247', days: 56, perDay: 12, langraph: '0.2', python: '3.11', deploy: 'Heroku' },
  new: { name: 'Dental Core', created: '26.03.2026', commits: 224, loc: '7,781', days: 5, perDay: 45, langraph: '1.1', python: '3.12', deploy: 'Docker + YC' },
}

const migrationPlan = [
  { phase: 'День 1-2', tasks: 'IDENT CRM adapter + TG Business + Confirmation runs' },
  { phase: 'День 2-3', tasks: 'Admin panel API + блоклист + developer mode' },
  { phase: 'День 3-4', tasks: 'Data migration + E2E тесты + hardening → переключение трафика' },
]

type CompStatus = 'done' | 'new' | 'better' | 'partial' | 'no' | 'na' | 'hub'

interface CompRow {
  feature: string
  oldVal: string
  newVal: string
  status: CompStatus
}

interface CompSection {
  title: string
  readiness: string
  rows: CompRow[]
  comment: string
}

const COMP_STATUS_STYLES: Record<CompStatus, string> = {
  done: 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30',
  new: 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30',
  better: 'bg-blue-500/20 text-blue-400 border border-blue-500/30',
  partial: 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30',
  no: 'bg-red-500/20 text-red-400 border border-red-500/30',
  na: 'bg-[#334155]/50 text-[#64748b] border border-[#334155]',
  hub: 'bg-purple-500/20 text-purple-400 border border-purple-500/30',
}

const COMP_STATUS_LABELS: Record<CompStatus, string> = {
  done: 'Готово',
  new: 'Новое',
  better: 'Улучшено',
  partial: 'Частично',
  no: 'Не готово',
  na: 'Не нужно',
  hub: 'В Hub',
}

const comparisonSections: CompSection[] = [
  {
    title: 'Core Agent (Router + Agents)',
    readiness: '100%',
    comment: 'Полный паритет с AI Agent плюс новый FAQ Agent, которого в старой системе не было вообще. Промпты полностью вынесены в Langfuse — в AI Agent они лежали в Jinja2-файлах на диске, что делало невозможным A/B тестирование и быструю итерацию без деплоя. Reschedule/Cancel упрощён: вместо отдельного агента — те же tools внутри Booking Agent, меньше кода, меньше багов.',
    rows: [
      { feature: 'Router (LLM intent)', oldVal: 'Dispatcher → Router/Booking/Reschedule', newVal: 'Dental Router → FAQ/Booking/Confirmation', status: 'done' },
      { feature: 'Booking Agent', oldVal: 'LangGraph node + tools', newVal: 'LangGraph + 7 CRM tools', status: 'done' },
      { feature: 'FAQ Agent', oldVal: 'Нет отдельного', newVal: 'Tier1 YAML + Tier2 pgvector', status: 'new' },
      { feature: 'Confirmation Agent', oldVal: 'RetellAI classifier', newVal: 'LLM-based + scheduler', status: 'done' },
      { feature: 'Reschedule/Cancel', oldVal: 'Отдельный агент', newVal: 'Через Booking Agent tools', status: 'better' },
      { feature: 'Промпты', oldVal: 'Jinja2 файлы + Langfuse fallback', newVal: '100% Langfuse, 0 хардкода', status: 'better' },
      { feature: 'Handoff to operator', oldVal: 'state: "human" + cooldown', newVal: 'controller: bot/operator/closed + cooldown', status: 'done' },
      { feature: 'Message debouncing', oldVal: '5s aggregation', newVal: 'Per-channel: tg_bot=3s, voice=0.5s', status: 'better' },
    ],
  },
  {
    title: 'CRM Интеграция',
    readiness: '40%',
    comment: 'В AI Agent CRM-логика была намертво привязана к конкретному провайдеру — при подключении новой клиники приходилось копировать и адаптировать код. В Dental Core введён CRM Protocol — абстракция, за которой стоит конкретный адаптер (Google Sheets, IDENT, и любой будущий). Подключение новой CRM = один файл-адаптер без изменения остального кода. IDENT ещё не реализован, но архитектура под него полностью готова.',
    rows: [
      { feature: 'IDENT/MedFlex', oldVal: 'python_gateway HTTP client', newVal: 'adapter_ident (module заявлен)', status: 'no' },
      { feature: 'Google Sheets', oldVal: 'Нет', newVal: '286 LOC, полный CRUD', status: 'new' },
      { feature: 'CRM Protocol', oldVal: 'Нет абстракции', newVal: 'Protocol + Registry + Types', status: 'new' },
    ],
  },
  {
    title: 'Каналы связи',
    readiness: '45%',
    comment: 'Telegram Bot работает полностью. Каналы в Dental Core — подключаемые плагины: добавить новый канал = реализовать один модуль, не трогая ядро. В AI Agent добавление канала означало правки в 5-6 файлах по всему проекту. TG Business и MAX — следующие в очереди, архитектура готова.',
    rows: [
      { feature: 'Telegram Bot', oldVal: 'Webhook + polling', newVal: 'Polling, полная интеграция', status: 'done' },
      { feature: 'Telegram Business', oldVal: 'Telethon fallback (24h limit)', newVal: 'Module заявлен', status: 'no' },
      { feature: 'MAX messenger', oldVal: 'max_client + max_handler', newVal: 'Module заявлен', status: 'no' },
      { feature: 'Voice (LiveKit)', oldVal: 'RetellAI client', newVal: 'Module заявлен (LiveKit)', status: 'no' },
    ],
  },
  {
    title: 'База данных',
    readiness: '75%',
    comment: 'В AI Agent всё хранилось в одной таблице wazzup_chat_states — пользователи, сессии, состояния, всё вперемешку. Dental Core имеет нормализованную схему: users, user_channels, chat_sessions, chat_messages — каждая сущность в своей таблице. Это проще поддерживать, быстрее работают запросы, и появилась Knowledge Base на pgvector для семантического поиска по FAQ.',
    rows: [
      { feature: 'Users/Patients', oldVal: 'wazzup_chat_states (embedded)', newVal: 'users + user_channels (нормализовано)', status: 'better' },
      { feature: 'Chat Sessions', oldVal: 'wazzup_chat_states', newVal: 'chat_sessions (отдельная)', status: 'better' },
      { feature: 'Chat Messages', oldVal: 'chat_messages', newVal: 'chat_messages', status: 'done' },
      { feature: 'Confirmations', oldVal: 'confirmation_runs (13 статусов)', newVal: 'confirmation_status в session', status: 'partial' },
      { feature: 'Administrator Action Queue', oldVal: 'Нет', newVal: 'action_queue', status: 'new' },
      { feature: 'KB / Embeddings', oldVal: 'Нет', newVal: 'kb_documents + pgvector', status: 'new' },
      { feature: 'Admin Users', oldVal: 'admin_users', newVal: 'Нет (в Hub)', status: 'hub' },
      { feature: 'Blocked Contacts', oldVal: 'blocked_contacts', newVal: 'Нет', status: 'no' },
      { feature: 'Patient Channel Mapping', oldVal: 'patient_channel_mapping', newVal: 'user_channels', status: 'better' },
    ],
  },
  {
    title: 'Admin Panel',
    readiness: '10%',
    comment: 'Admin panel из AI Agent — отдельное React-приложение с JWT-аутентификацией, привязанное к старому бэкенду. В Dental Core операторский UI будет частью Dental Hub — единая точка входа, единая авторизация через GitHub, все клиники в одном месте. Функционал тот же (dashboard, чаты, confirmations), но архитектурно чище.',
    rows: [
      { feature: 'Frontend', oldVal: 'React 18 + TS (18 файлов)', newVal: 'Нет (через Hub)', status: 'hub' },
      { feature: 'Dashboard', oldVal: 'Stat cards, awaiting operator', newVal: 'Нет', status: 'no' },
      { feature: 'Confirmations list', oldVal: 'Пагинация, фильтры, автообновление', newVal: 'Нет', status: 'no' },
      { feature: 'Chat history', oldVal: 'Просмотр + отправка сообщений', status: 'no', newVal: 'Нет' },
      { feature: 'Red Button (бот вкл/выкл)', oldVal: 'Superadmin only', newVal: 'Нет', status: 'no' },
      { feature: 'Blocklist', oldVal: 'По телефону + telegram_id', newVal: 'Нет', status: 'no' },
    ],
  },
  {
    title: 'Background Tasks',
    readiness: '80%',
    comment: 'AI Agent использовал Celery + Redis — отдельный воркер, отдельный брокер, отдельная инфраструктура для каждой клиники. Dental Core заменил это на asyncio scheduler внутри процесса агента. Результат: минус два сервиса (Celery worker + Redis) на каждую клинику, проще деплой, меньше точек отказа. Функциональность та же — confirmations отправляются по расписанию.',
    rows: [
      { feature: 'Task runner', oldVal: 'Celery worker + Redis', newVal: 'asyncio scheduler (in-process)', status: 'better' },
      { feature: 'Scheduled confirmations', oldVal: 'Celery beat (MSK timezone)', newVal: 'asyncio scheduler (in-process)', status: 'done' },
      { feature: 'Retry logic', oldVal: 'Celery retry + Redis', newVal: 'В scheduler', status: 'done' },
    ],
  },
  {
    title: 'Observability',
    readiness: '95%',
    comment: 'В AI Agent трейсинг был ручной — декораторы в коде, легко забыть, неполная картина. Dental Core использует Langfuse v4 с автоматической инструментацией — каждый LLM-вызов, каждый tool call записывается без единой строчки дополнительного кода. Плюс SSE streaming — пациент видит ответ в реальном времени, а не ждёт пока бот \"думает\". 3D-визуализация архитектуры — бонус для понимания системы всей командой.',
    rows: [
      { feature: 'Langfuse tracing', oldVal: 'v2, decorator-based', newVal: 'v4, auto-instrumentation', status: 'better' },
      { feature: 'Streaming', oldVal: 'Нет', newVal: 'SSE streaming', status: 'new' },
      { feature: '3D graph visualization', oldVal: 'Нет', newVal: 'graph.json + Hub', status: 'new' },
    ],
  },
]

const advantages = [
  'Модульная архитектура — 34 модуля с registry vs монолит',
  'LangGraph 1.1 vs 0.2 — новый API, лучшая производительность',
  'Langfuse v4 auto-instrumentation vs v2 ручной',
  'Промпты 100% в Langfuse vs Jinja2 файлы на диске',
  'Мульти-клиника из коробки — YAML + 1 контейнер = 1 клиника',
  'graph.json — автоматическая визуализация архитектуры',
  'Нормализованная БД — users + user_channels vs embedded chat_states',
  'SSE streaming ответов в реальном времени',
  'Knowledge Base — pgvector FAQ (tier 1 + tier 2)',
  'Velocity 3.7x выше по коммитам/день',
]

const gaps = [
  { task: 'IDENT CRM adapter', complexity: 'Высокая', estimate: '6-8 ч' },
  { task: 'Telegram Business (полный flow)', complexity: 'Средняя', estimate: '3-4 ч' },
  { task: 'Confirmation runs таблица', complexity: 'Средняя', estimate: '2-3 ч' },
  { task: 'Admin API endpoints', complexity: 'Средняя', estimate: '4-6 ч' },
  { task: 'MAX messenger канал', complexity: 'Низкая', estimate: '2 ч' },
  { task: 'Blocked contacts', complexity: 'Низкая', estimate: '1-2 ч' },
  { task: 'Developer mode', complexity: 'Низкая', estimate: '1-2 ч' },
  { task: 'Admin panel frontend', complexity: 'Средняя', estimate: '4-6 ч' },
  { task: 'E2E тесты расширение', complexity: 'Средняя', estimate: '3-4 ч' },
  { task: 'Data migration script', complexity: 'Средняя', estimate: '3-4 ч' },
]

const risks = [
  'IDENT — нужен доступ к python_gateway API docs или живому инстансу',
  'Admin panel — операторы привыкли к текущему UI, нужна обратная совместимость или обучение',
  'Data migration — 13 статусов confirmation_runs, сложная миграция данных',
]

/* ── Component status matrix ── */

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
      { name: 'Administrator Action Queue (manual ops)', status: 'ok', label: 'Готово' },
    ],
  },
  {
    title: 'Plugins (channels + CRM)',
    rows: [
      { name: 'Telegram Bot (polling)', status: 'ok', label: 'Готово' },
      { name: 'Google Sheets CRM adapter', status: 'ok', label: 'Готово' },
      { name: 'Telegram Business', status: 'wip', label: 'Parse готов' },
      { name: 'IDENT CRM Adapter', status: 'no', label: 'Миграция' },
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
      { name: 'Admin Panel (операторы)', status: 'no', label: 'Миграция' },
      { name: 'Blocked contacts', status: 'no', label: 'Миграция' },
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
    desc: 'PostgreSQL storage (3 модуля), Confirmation Agent + Administrator Action Queue, Chat Gateway + Telegram Bot + streaming. Удалены ВСЕ хардкод-keywords — только LLM-роутинг. Self-describing modules, /config endpoint.',
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
    state: 'done',
    date: '30 марта',
    title: 'Полный аудит: Dental Core vs AI Agent',
    desc: 'Сравнение 40K LOC (2 мес) vs 7.8K LOC (5 дней). 63% готовность к переезду. Velocity 3.7x. Оставшиеся 37% = 3-4 дня при 2 разработчиках.',
  },
  {
    state: 'wip',
    date: '30 марта',
    title: 'E2E тестирование + подключение Зубатка',
    desc: 'Полный цикл: запись, перенос, отмена, подтверждение. Telegram Bot + Google Sheets CRM.',
  },
  // Все остальные задачи подтягиваются динамически из Jira (🔵 задачи)
]

const systemCards = [
  {
    title: 'Dental Core',
    text: 'Инстанс клиники. 1 Docker = 1 клиника. Pipeline: Plugin \u2192 Identity \u2192 Debounce \u2192 Router (LLM) \u2192 FAQ / Booking / Confirmation Agent \u2192 CRM Gateway. 34 модуля, registry-driven tool binding. PostgreSQL: Identity DB, Checkpointer, Knowledge Base, Administrator Action Queue. gpt-5.4-mini + OpenRouter fallback.',
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

// Jira status → color mapping
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

export function RoadmapPage() {
  const { ok, wip, no, skip, total } = computeProgress()
  const [jiraTasks, setJiraTasks] = useState<JiraTask[]>([])
  const [jiraLoading, setJiraLoading] = useState(true)
  const [jiraError, setJiraError] = useState<string | null>(null)

  useEffect(() => {
    roadmapApi.tasks()
      .then((tasks) => {
        setJiraTasks(tasks)
        setJiraError(null)
      })
      .catch((err) => {
        setJiraError(err?.response?.status === 503 ? 'Jira не настроена' : 'Ошибка загрузки')
        setJiraTasks([])
      })
      .finally(() => setJiraLoading(false))

    // Auto-refresh every 30s
    const interval = setInterval(() => {
      roadmapApi.tasks()
        .then((tasks) => { setJiraTasks(tasks); setJiraError(null) })
        .catch(() => {})
    }, 30_000)
    return () => clearInterval(interval)
  }, [])

  // Split Jira tasks: done goes up into timeline, rest stays in active list
  const doneTasks = jiraTasks.filter((t) => t.statusCategory === 'done')
  const activeTasks = jiraTasks.filter((t) => t.statusCategory !== 'done')

  return (
    <div className="overflow-y-auto p-6" style={{ height: 'calc(100vh - 48px)' }}>
      <div className="max-w-[1100px] mx-auto">
        <h2 className="text-lg font-semibold mb-1">Roadmap</h2>
        <p className="text-xs text-[#64748b] mb-4">v0.2.0 — Обновлено 30.03.2026</p>

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

        {/* Migration readiness */}
        <h3 className="text-[0.9rem] text-[#7dd3fc] mt-4 mb-2">Готовность к переезду с AI Agent: {migrationTotal}%</h3>
        <div className="bg-[#111127] border border-[#1e293b] rounded-lg p-4 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {migrationAreas.map((area) => (
              <div key={area.name} className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[0.7rem] text-[#94a3b8]">{area.name}</span>
                  <span className={`text-[0.65rem] font-mono tabular-nums ${
                    area.readiness >= 80 ? 'text-emerald-400' :
                    area.readiness >= 50 ? 'text-yellow-400' : 'text-red-400'
                  }`}>
                    {area.readiness}%
                  </span>
                </div>
                <div className="flex h-2 rounded-full overflow-hidden bg-[#1e293b]">
                  <div
                    className={`transition-all rounded-full ${
                      area.readiness >= 80 ? 'bg-emerald-500' :
                      area.readiness >= 50 ? 'bg-yellow-500' : 'bg-red-500'
                    }`}
                    style={{ width: `${area.readiness}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
          {/* Comparison table */}
          <div className="mt-4 pt-3 border-t border-[#1e293b]">
            <table className="w-full text-[0.72rem]">
              <thead>
                <tr className="border-b border-[#1e293b]">
                  <th className="text-left text-[#64748b] py-2 font-normal w-[40%]">Метрика</th>
                  <th className="text-center text-[#64748b] py-2 font-normal w-[30%]">AI Agent (старый)</th>
                  <th className="text-center text-[#7dd3fc] py-2 font-normal w-[30%]">Dental Core (новый)</th>
                </tr>
              </thead>
              <tbody>
                {([
                  ['Разработка', `${projectComparison.old.days} дней`, `${projectComparison.new.days} дней`],
                  ['Коммитов', `${projectComparison.old.commits}`, `${projectComparison.new.commits}`],
                  ['LOC', projectComparison.old.loc, projectComparison.new.loc],
                  ['Коммитов/день', `${projectComparison.old.perDay}`, `${projectComparison.new.perDay}`],
                  ['LangGraph', projectComparison.old.langraph, projectComparison.new.langraph],
                  ['Python', projectComparison.old.python, projectComparison.new.python],
                  ['Deploy', projectComparison.old.deploy, projectComparison.new.deploy],
                ] as [string, string, string][]).map(([label, old, neu]) => (
                  <tr key={label} className="border-b border-[#1e293b]/50 last:border-0">
                    <td className="text-[#94a3b8] py-1.5">{label}</td>
                    <td className="text-center text-[#64748b] py-1.5 font-mono tabular-nums">{old}</td>
                    <td className="text-center text-white py-1.5 font-mono tabular-nums">{neu}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {/* Migration plan */}
          <div className="mt-4 pt-3 border-t border-[#1e293b]">
            <div className="text-[0.72rem] text-[#94a3b8] mb-2">Plan: полный паритет за 3-4 дня (2 разработчика, ~90 коммитов/день)</div>
            {migrationPlan.map((p) => (
              <div key={p.phase} className="flex gap-2 text-[0.68rem] py-1">
                <span className="text-[#7dd3fc] w-20 shrink-0">{p.phase}</span>
                <span className="text-[#94a3b8]">{p.tasks}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Detailed feature comparison tables */}
        <h3 className="text-[0.9rem] text-[#7dd3fc] mt-6 mb-3">Детальное сравнение: AI Agent vs Dental Core</h3>
        <div className="space-y-4 mb-6">
          {comparisonSections.map((section) => (
            <div key={section.title} className="bg-[#111127] border border-[#1e293b] rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-white text-sm font-medium">{section.title}</h4>
                <span className={`text-[0.65rem] px-2 py-0.5 rounded font-mono ${
                  parseInt(section.readiness) >= 80 ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
                  parseInt(section.readiness) >= 50 ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30' :
                  'bg-red-500/20 text-red-400 border border-red-500/30'
                }`}>
                  {section.readiness}
                </span>
              </div>
              <table className="w-full text-[0.7rem]">
                <thead>
                  <tr className="border-b border-[#1e293b]">
                    <th className="text-left text-[#64748b] py-1.5 pr-2 font-normal w-[20%]">Фича</th>
                    <th className="text-left text-[#64748b] py-1.5 pr-2 font-normal w-[30%]">AI Agent</th>
                    <th className="text-left text-[#64748b] py-1.5 pr-2 font-normal w-[30%]">Dental Core</th>
                    <th className="text-right text-[#64748b] py-1.5 font-normal w-[20%]">Статус</th>
                  </tr>
                </thead>
                <tbody>
                  {section.rows.map((row) => (
                    <tr key={row.feature} className="border-b border-[#1e293b]/50 last:border-0">
                      <td className="text-[#e2e8f0] py-1.5 pr-2">{row.feature}</td>
                      <td className="text-[#64748b] py-1.5 pr-2">{row.oldVal}</td>
                      <td className="text-[#94a3b8] py-1.5 pr-2">{row.newVal}</td>
                      <td className="text-right py-1.5">
                        <span className={`text-[0.6rem] px-1.5 py-0.5 rounded ${COMP_STATUS_STYLES[row.status]}`}>
                          {COMP_STATUS_LABELS[row.status]}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {section.comment && (
                <div className="mt-3 pt-3 border-t border-[#1e293b]">
                  <p className="text-[0.72rem] text-[#94a3b8] leading-relaxed italic">{section.comment}</p>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Advantages */}
        <h3 className="text-[0.9rem] text-[#7dd3fc] mt-6 mb-3">Ключевые преимущества Dental Core</h3>
        <div className="bg-[#111127] border border-[#1e293b] rounded-lg p-4 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {advantages.map((adv, i) => (
              <div key={i} className="flex items-start gap-2 text-[0.72rem]">
                <span className="text-emerald-400 mt-0.5 shrink-0">+</span>
                <span className="text-[#94a3b8]">{adv}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Summary comment */}
        <div className="bg-[#0f1729] border border-[#7dd3fc]/20 rounded-lg p-4 mb-6">
          <h4 className="text-[#7dd3fc] text-sm font-medium mb-2">Почему переезд, а не доработка AI Agent?</h4>
          <p className="text-[0.75rem] text-[#94a3b8] leading-relaxed mb-3">
            AI Agent создавался как MVP — быстро, с фокусом на результат. За 2 месяца он вырос до 40K строк кода, обслуживает реальных пациентов и приносит пользу. Но архитектура осталась монолитной: добавление новой клиники — это ручная работа на несколько дней, каждый канал связи требует правок по всему проекту, а CRM-логика завязана на конкретного провайдера.
          </p>
          <p className="text-[0.75rem] text-[#94a3b8] leading-relaxed mb-3">
            Dental Core — это тот же продукт, но спроектированный под масштабирование. 34 модуля с чёткими интерфейсами, 1 клиника = 1 Docker-контейнер, конфигурация через YAML. Подключить новую клинику — это создать файл конфига и запустить контейнер. Добавить новый канал — написать один плагин.
          </p>
          <p className="text-[0.75rem] text-[#e2e8f0] leading-relaxed font-medium">
            Главное: 63% функционала AI Agent воспроизведено за 5 дней. При двух разработчиках полный паритет — вопрос 3-4 дней. Мы не теряем ничего из того, что работает, но получаем архитектуру, которая выдержит 10-50-100 клиник.
          </p>
        </div>

        {/* GAP analysis */}
        <h3 className="text-[0.9rem] text-[#7dd3fc] mt-6 mb-3">GAP-анализ: что доделать для переезда</h3>
        <div className="bg-[#111127] border border-[#1e293b] rounded-lg p-4 mb-6">
          <table className="w-full text-[0.7rem]">
            <thead>
              <tr className="border-b border-[#1e293b]">
                <th className="text-left text-[#64748b] py-1.5 font-normal">Задача</th>
                <th className="text-center text-[#64748b] py-1.5 font-normal">Сложность</th>
                <th className="text-right text-[#64748b] py-1.5 font-normal">Оценка</th>
              </tr>
            </thead>
            <tbody>
              {gaps.map((g, i) => (
                <tr key={g.task} className="border-b border-[#1e293b]/50 last:border-0">
                  <td className="text-[#94a3b8] py-1.5">
                    <span className="text-[#64748b] mr-2">{i + 1}.</span>
                    {g.task}
                  </td>
                  <td className="text-center py-1.5">
                    <span className={`text-[0.6rem] px-1.5 py-0.5 rounded ${
                      g.complexity === 'Высокая' ? 'bg-red-500/20 text-red-400 border border-red-500/30' :
                      g.complexity === 'Средняя' ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30' :
                      'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    }`}>{g.complexity}</span>
                  </td>
                  <td className="text-right text-[#e2e8f0] py-1.5 font-mono">{g.estimate}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Risks */}
        <h3 className="text-[0.9rem] text-[#7dd3fc] mt-6 mb-3">Риски</h3>
        <div className="bg-[#111127] border border-[#1e293b] rounded-lg p-4 mb-6">
          {risks.map((risk, i) => (
            <div key={i} className="flex items-start gap-2 text-[0.72rem] py-1">
              <span className="text-red-400 mt-0.5 shrink-0">!</span>
              <span className="text-[#94a3b8]">{risk}</span>
            </div>
          ))}
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

        {/* Timeline — hardcoded done items */}
        <h3 className="text-[0.9rem] text-[#7dd3fc] mt-6 mb-4">Таймлайн</h3>
        <div className="relative ml-4 mb-4">
          <div className="absolute left-0 top-0 bottom-0 w-px bg-[#1e293b]" />

          {timeline.map((item, i) => (
            <div key={i} className="relative pl-8 pb-6 last:pb-0">
              <div
                className={`absolute left-0 top-1 w-3 h-3 rounded-full -translate-x-1/2 border-2 border-[#0a0a1a] ${DOT_STYLES[item.state]}`}
              />
              <div className="text-[0.68rem] text-[#64748b] mb-1">{item.date}</div>
              <div className="text-sm text-white font-medium mb-1">{item.title}</div>
              <div className="text-[0.75rem] text-[#94a3b8] leading-relaxed">{item.desc}</div>
            </div>
          ))}

          {/* Done Jira tasks — merged into timeline */}
          {doneTasks.map((task) => (
            <div key={task.key} className="relative pl-8 pb-6">
              <div className="absolute left-0 top-1 w-3 h-3 rounded-full -translate-x-1/2 border-2 border-[#0a0a1a] bg-emerald-400" />
              <div className="text-[0.68rem] text-[#64748b] mb-1">
                {new Date(task.updated).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })}
              </div>
              <div className="flex items-center gap-2 mb-1">
                <div className="text-sm text-white font-medium">{task.summary.replace('🔵 ', '')}</div>
                <a href={task.url} target="_blank" rel="noopener noreferrer"
                   className="text-[0.6rem] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/30 no-underline">
                  {task.key}
                </a>
              </div>
              {task.assignee && (
                <div className="text-[0.68rem] text-[#64748b]">{task.assignee}</div>
              )}
            </div>
          ))}
        </div>

        {/* Active Jira tasks — dynamic from board */}
        <h3 className="text-[0.9rem] text-[#7dd3fc] mt-6 mb-4">
          Задачи из Jira
          {jiraLoading && <span className="text-[0.68rem] text-[#64748b] ml-2">загрузка...</span>}
        </h3>
        {jiraError ? (
          <div className="text-[0.75rem] text-[#64748b] mb-4 bg-[#111127] border border-[#1e293b] rounded-lg p-4">
            {jiraError}. Задачи отображаются из Jira Kanban доски автоматически после настройки JIRA_API_TOKEN.
          </div>
        ) : (
          <div className="space-y-2 mb-8">
            {activeTasks.map((task) => {
              const style = getJiraStyle(task.status)
              return (
                <div key={task.key} className="bg-[#111127] border border-[#1e293b] rounded-lg p-3 flex items-center gap-3">
                  {/* Status dot */}
                  <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${style.dot}`} />
                  {/* Task info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[0.78rem] text-white truncate">{task.summary.replace('🔵 ', '')}</span>
                    </div>
                    {task.assignee && (
                      <div className="flex items-center gap-1.5 mt-0.5">
                        {task.assigneeAvatar && (
                          <img src={task.assigneeAvatar} alt="" className="w-4 h-4 rounded-full" />
                        )}
                        <span className="text-[0.65rem] text-[#64748b]">{task.assignee}</span>
                      </div>
                    )}
                  </div>
                  {/* Status badge */}
                  <span className={`text-[0.6rem] px-1.5 py-0.5 rounded shrink-0 ${style.badge}`}>
                    {style.label}
                  </span>
                  {/* Jira link */}
                  <a href={task.url} target="_blank" rel="noopener noreferrer"
                     className="text-[0.6rem] px-1.5 py-0.5 rounded bg-[#1e293b] text-[#7dd3fc] hover:bg-[#334155] no-underline shrink-0">
                    {task.key}
                  </a>
                </div>
              )
            })}
            {activeTasks.length === 0 && !jiraLoading && (
              <div className="text-[0.75rem] text-[#64748b]">Все задачи выполнены</div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
