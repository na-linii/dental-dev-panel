import {
  Bell, ClipboardCheck, CircleCheck, Ban, CircleX, Timer,
  RefreshCw, MessageCircle, AlertCircle, MessageSquare,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

export interface StatusConfig {
  label: string
  icon: LucideIcon
  badge: string
  dot: string
}

/**
 * Single source of truth for all status labels, icons, and colors.
 * Labels match the old admin panel and the Guide page.
 */
export const STATUS_CONFIG: Record<string, StatusConfig> = {
  // ── Confirmation statuses (outgoing) ──
  sent:                { label: 'Напоминание о визите',       icon: Bell,           badge: 'bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-500/25', dot: 'bg-emerald-500 dark:bg-emerald-400' },
  awaiting_confirm:    { label: 'Подтвердите в МИС',          icon: ClipboardCheck, badge: 'bg-orange-50 dark:bg-orange-500/15 text-orange-700 dark:text-orange-300 border-orange-200 dark:border-orange-500/25',    dot: 'bg-orange-500 dark:bg-orange-400' },
  awaiting_cancel:     { label: 'Отмените в МИС',             icon: Ban,            badge: 'bg-orange-50 dark:bg-orange-500/15 text-orange-700 dark:text-orange-300 border-orange-200 dark:border-orange-500/25',    dot: 'bg-orange-500 dark:bg-orange-400' },
  awaiting_reschedule: { label: 'Перенесите в МИС',           icon: Timer,          badge: 'bg-orange-50 dark:bg-orange-500/15 text-orange-700 dark:text-orange-300 border-orange-200 dark:border-orange-500/25',    dot: 'bg-orange-500 dark:bg-orange-400' },
  confirmed:           { label: 'Визит подтверждён',           icon: CircleCheck,    badge: 'bg-gray-100 dark:bg-gray-500/15 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-500/25',         dot: 'bg-gray-500 dark:bg-gray-400' },
  cancelled:           { label: 'Отменён',                     icon: CircleX,        badge: 'bg-gray-100 dark:bg-gray-500/15 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-500/25',         dot: 'bg-gray-500 dark:bg-gray-400' },
  rescheduled:         { label: 'Перенесён',                   icon: RefreshCw,      badge: 'bg-gray-100 dark:bg-gray-500/15 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-500/25',         dot: 'bg-gray-500 dark:bg-gray-400' },
  no_response:         { label: 'Визит не подтверждён',        icon: AlertCircle,    badge: 'bg-red-50 dark:bg-red-500/15 text-red-700 dark:text-red-300 border-red-200 dark:border-red-500/25',            dot: 'bg-red-500 dark:bg-red-400' },

  // ── Chat controller statuses ──
  bot:                 { label: 'Разговор с агентом',          icon: MessageCircle,  badge: 'bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-500/25', dot: 'bg-emerald-500 dark:bg-emerald-400' },
  operator:            { label: 'Ожидает администратора',      icon: AlertCircle,    badge: 'bg-red-50 dark:bg-red-500/15 text-red-700 dark:text-red-300 border-red-200 dark:border-red-500/25',            dot: 'bg-red-500 dark:bg-red-400' },
  operator_active:     { label: 'Разговор с администратором',  icon: MessageCircle,  badge: 'bg-blue-50 dark:bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-500/25',          dot: 'bg-blue-500 dark:bg-blue-400' },
  closed:              { label: 'Чат завершён',                icon: MessageSquare,  badge: 'bg-gray-100 dark:bg-gray-500/15 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-500/25',         dot: 'bg-gray-500 dark:bg-gray-400' },
}

/** Labels for controller dropdown in chat detail header */
export const CONTROLLER_LABELS: Record<string, string> = {
  bot: 'Разговор с агентом',
  operator: 'Ожидает администратора',
  closed: 'Чат завершён',
}

/** Colors for controller badge in chat detail header */
export const CONTROLLER_COLORS: Record<string, string> = {
  bot: 'bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-500/25',
  operator: 'bg-blue-50 dark:bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-500/25',
  closed: 'bg-gray-100 dark:bg-gray-500/15 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-500/25',
}

/** Confirmation filter options (full labels, matching old admin panel) */
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
