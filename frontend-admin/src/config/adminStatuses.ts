import {
  Bell, ClipboardCheck, CircleCheck, Ban, CircleX, Timer,
  RefreshCw, MessageCircle, AlertCircle, MessageSquare,
  LayoutDashboard, CalendarCheck, ClipboardList, Settings, BookOpen, Phone,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

// ── Status config (source of truth for all pages including Guide) ──

export interface StatusConfig {
  label: string
  description: string
  icon: LucideIcon
  badge: string
  dot: string
  category: 'incoming' | 'outgoing'
}

export const STATUS_CONFIG: Record<string, StatusConfig> = {
  // ── Confirmation statuses (outgoing) ──
  sent:                { label: 'Напоминание о визите',       description: 'Агент отправил напоминание, ждёт ответа от клиента',                                                           icon: Bell,           badge: 'bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-500/25', dot: 'bg-emerald-500 dark:bg-emerald-400', category: 'outgoing' },
  awaiting_confirm:    { label: 'Подтвердите в МИС',          description: 'Клиент ответил, что придёт. Подтвердите в IDENT и нажмите «Готово» на странице «Действия»',                      icon: ClipboardCheck, badge: 'bg-orange-50 dark:bg-orange-500/15 text-orange-700 dark:text-orange-300 border-orange-200 dark:border-orange-500/25',    dot: 'bg-orange-500 dark:bg-orange-400', category: 'outgoing' },
  confirmed:           { label: 'Визит подтверждён',           description: 'Визит подтверждён',                                                                                            icon: CircleCheck,    badge: 'bg-gray-100 dark:bg-gray-500/15 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-500/25',         dot: 'bg-gray-500 dark:bg-gray-400',     category: 'outgoing' },
  no_response:         { label: 'Визит не подтверждён',        description: 'Пациент не ответил на напоминания',                                                                             icon: AlertCircle,    badge: 'bg-red-50 dark:bg-red-500/15 text-red-700 dark:text-red-300 border-red-200 dark:border-red-500/25',            dot: 'bg-red-500 dark:bg-red-400',       category: 'outgoing' },

  // ── Shared statuses (incoming + outgoing) ──
  awaiting_cancel:     { label: 'Отмените в МИС',             description: 'Пациент попросил отменить визит. Отмените в IDENT и нажмите «Готово» на странице «Действия»',                     icon: Ban,            badge: 'bg-orange-50 dark:bg-orange-500/15 text-orange-700 dark:text-orange-300 border-orange-200 dark:border-orange-500/25',    dot: 'bg-orange-500 dark:bg-orange-400', category: 'incoming' },
  cancelled:           { label: 'Отменён',                     description: 'Запись отменена',                                                                                               icon: CircleX,        badge: 'bg-gray-100 dark:bg-gray-500/15 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-500/25',         dot: 'bg-gray-500 dark:bg-gray-400',     category: 'incoming' },
  awaiting_reschedule: { label: 'Перенесите в МИС',           description: 'Пациент попросил перенести. Перенесите в IDENT и нажмите «Готово» на странице «Действия»',                        icon: Timer,          badge: 'bg-orange-50 dark:bg-orange-500/15 text-orange-700 dark:text-orange-300 border-orange-200 dark:border-orange-500/25',    dot: 'bg-orange-500 dark:bg-orange-400', category: 'incoming' },
  rescheduled:         { label: 'Перенесён',                   description: 'Визит перенесён на другое время',                                                                               icon: RefreshCw,      badge: 'bg-gray-100 dark:bg-gray-500/15 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-500/25',         dot: 'bg-gray-500 dark:bg-gray-400',     category: 'incoming' },

  // ── Chat controller statuses (incoming) ──
  bot:                 { label: 'Разговор с агентом',          description: 'Пациент сам написал агенту, идёт диалог',                                                                       icon: MessageCircle,  badge: 'bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-500/25', dot: 'bg-emerald-500 dark:bg-emerald-400', category: 'incoming' },
  operator:            { label: 'Ожидает администратора',      description: 'Агент не справился или клиент попросил перевести на администратора',                                             icon: AlertCircle,    badge: 'bg-red-50 dark:bg-red-500/15 text-red-700 dark:text-red-300 border-red-200 dark:border-red-500/25',            dot: 'bg-red-500 dark:bg-red-400',       category: 'incoming' },
  operator_active:     { label: 'Разговор с администратором',  description: 'Администратор общается с клиентом',                                                                             icon: MessageCircle,  badge: 'bg-blue-50 dark:bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-500/25',          dot: 'bg-blue-500 dark:bg-blue-400',     category: 'incoming' },
  closed:              { label: 'Чат завершён',                description: 'Разговор завершён',                                                                                             icon: MessageSquare,  badge: 'bg-gray-100 dark:bg-gray-500/15 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-500/25',         dot: 'bg-gray-500 dark:bg-gray-400',     category: 'incoming' },
}

// ── Guide: statuses grouped by category ──

export const GUIDE_INCOMING_STATUSES = ['bot', 'awaiting_cancel', 'cancelled', 'awaiting_reschedule', 'rescheduled', 'operator', 'operator_active', 'closed'] as const
export const GUIDE_OUTGOING_STATUSES = ['sent', 'awaiting_confirm', 'confirmed', 'no_response'] as const

// ── Controller labels (for dropdown in chat detail header) ──
// PD-378: 4 пункта в дропдауне. operator_active = «взять чат на себя» без отправки сообщения,
// маппится бэкендом в БД на controller='operator' + operator_id=user.username.

export const CONTROLLER_LABELS: Record<string, string> = {
  bot: 'Разговор с агентом',
  operator: 'Ожидает администратора',
  operator_active: 'Разговор с администратором',
  closed: 'Чат завершён',
}

export const CONTROLLER_COLORS: Record<string, string> = {
  bot: 'bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-500/25',
  operator: 'bg-red-50 dark:bg-red-500/15 text-red-700 dark:text-red-300 border-red-200 dark:border-red-500/25',
  operator_active: 'bg-blue-50 dark:bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-500/25',
  closed: 'bg-gray-100 dark:bg-gray-500/15 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-500/25',
}

// ── Display status helper (shared between chats list and chat detail) ──

export function getDisplayStatus(s: { controller: string; operator_id?: string | null }): string {
  if (s.controller === 'operator' && s.operator_id) return 'operator_active'
  return s.controller
}

export function isAwaitingOperator(s: { controller: string; operator_id?: string | null }): boolean {
  return s.controller === 'operator' && !s.operator_id
}

/**
 * PD-393: returns the confirmation status to display in the UI badge.
 *
 * `confirmation_status` is the ACTIVE-cycle cache on chat_sessions (transient:
 * 'sent', 'awaiting_*', or a terminal during the current cycle). The 24h
 * sweep clears it to NULL so fresh bookings the next day start cleanly.
 * `last_run_status` is the most recent terminal outcome from
 * `booking_confirmation_runs` — the historical "didn't respond" indicator
 * survives the sweep through here.
 *
 * Active cycle wins over history: if both are set, the in-flight status is
 * the more useful signal.
 */
export function getDisplayConfirmationStatus(
  s: { confirmation_status?: string | null; last_run_status?: string | null },
): string | null {
  return s.confirmation_status ?? s.last_run_status ?? null
}

// ── Controller filter tags (short labels for filter buttons) ──

export const CONTROLLER_FILTER_TAGS = [
  { value: '', label: 'Все' },
  { value: 'bot', label: 'Разговор с агентом' },
  { value: 'operator', label: 'Ожидает администратора' },
  { value: 'operator_active', label: 'Разговор с администратором' },
  { value: 'closed', label: 'Чат завершён' },
] as const

// ── Confirmation filter options ──

export const CONFIRMATION_FILTERS = [
  { value: '', label: 'Все' },
  { value: 'sent', label: 'Напоминание о визите' },
  { value: 'awaiting_confirm', label: 'Подтвердите в МИС' },
  { value: 'awaiting_cancel', label: 'Отмените в МИС' },
  { value: 'awaiting_reschedule', label: 'Перенесите в МИС' },
  { value: 'confirmed', label: 'Визит подтверждён' },
  { value: 'cancelled', label: 'Отменён' },
  { value: 'rescheduled', label: 'Перенесён' },
  { value: 'no_response', label: 'Визит не подтверждён' },
] as const

// ── Confirmation run status config (for Appointments tab) ──

export const RUN_STATUS_CONFIG: Record<string, { label: string; badge: string; dot: string }> = {
  sent:        { label: 'Отправлено',   badge: 'bg-orange-50 dark:bg-orange-500/15 text-orange-700 dark:text-orange-300 border border-orange-200 dark:border-orange-500/25',   dot: 'bg-orange-500' },
  no_response: { label: 'Нет ответа',   badge: 'bg-gray-100 dark:bg-gray-500/15 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-500/25',             dot: 'bg-gray-500'   },
  confirmed:   { label: 'Подтверждено', badge: 'bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/25', dot: 'bg-emerald-500' },
  cancelled:   { label: 'Отменено',     badge: 'bg-red-50 dark:bg-red-500/15 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-500/25',                    dot: 'bg-red-500'    },
  rescheduled: { label: 'Перенос',      badge: 'bg-blue-50 dark:bg-blue-500/15 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-500/25',              dot: 'bg-blue-500'   },
}

// ── Action types (linked to statuses) ──

export const ACTION_TYPES: Record<string, { label: string; relatedStatus?: string }> = {
  cancel_appointment: { label: 'Отменить запись',       relatedStatus: 'awaiting_cancel' },
  cancel:             { label: 'Пациент отказался',     relatedStatus: 'awaiting_cancel' },
  reschedule:         { label: 'Перенести визит',       relatedStatus: 'awaiting_reschedule' },
  confirm:            { label: 'Подтвердить визит',     relatedStatus: 'awaiting_confirm' },
  update_booking_status: { label: 'Обновить статус' },
  book_appointment:   { label: 'Новая запись' },
  register_patient:   { label: 'Регистрация пациента' },
  // PD-414: voice patient asked for operator; bot promised but cannot transfer mid-call.
  // Admin should call the patient back. data jsonb carries caller_phone + livekit_room.
  voice_handoff:      { label: 'Звонок: перезвонить пациенту', relatedStatus: 'operator' },
}

// ── Dashboard stat labels ──

export const DASHBOARD_LABELS = {
  totalSessions: 'Всего диалогов',
  confirmed: 'Подтверждено',
  rescheduled: 'Перенесено',
  cancelled: 'Отменено',
  operator: 'Ожидает администратора',
  totalPatients: 'Всего переписок',
  prevMonth: 'Прошлый месяц',
} as const

// ── CRM booking status styles (separate system from confirmation statuses) ──

export const BOOKING_STATUS_STYLES: Record<string, string> = {
  'подтверждён': 'bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-500/25',
  'отменён': 'bg-red-50 dark:bg-red-500/15 text-red-700 dark:text-red-300 border-red-200 dark:border-red-500/25',
  'завершён': 'bg-gray-100 dark:bg-gray-500/15 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-500/25',
}

// ── Channel display config (shared between chats list and chat detail) ──

export const CHANNEL_CONFIG: Record<string, { text: string; cls: string }> = {
  tg_bot:      { text: 'TG Bot',  cls: 'bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400' },
  tg_business: { text: 'TG Biz',  cls: 'bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400' },
  max:         { text: 'MaxBot', cls: 'bg-violet-50 dark:bg-violet-500/10 text-violet-600 dark:text-violet-400' },
}

// ── Navigation items ──

export const NAV_ITEMS = [
  { to: '/dashboard', label: 'Дашборд', icon: LayoutDashboard },
  { to: '/chats', label: 'Переписка', icon: MessageCircle },
  { to: '/calls', label: 'Звонки', icon: Phone },
  { to: '/confirmations', label: 'Подтверждения', icon: CalendarCheck, superadminOnly: true },
  { to: '/actions', label: 'Действия', icon: ClipboardList },
  { to: '/settings', label: 'Настройки', icon: Settings },
  { to: '/guide', label: 'Инструкция', icon: BookOpen },
] as const
