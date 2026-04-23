import { useState } from 'react'
import { RefreshCw, CheckCircle, ClipboardList } from 'lucide-react'
import { updateAdminAction } from '../../api/client'
import { usePendingAdminWork, type PendingRow } from '../../hooks/useAdminQueries'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { format } from 'date-fns'
import { ACTION_TYPES, STATUS_CONFIG } from '../../config/adminStatuses'

function StatusBadge({ statusKey }: { statusKey: string }) {
  const cfg = STATUS_CONFIG[statusKey]
  if (!cfg) return null
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-medium ${cfg.badge}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  )
}

function ActionTypeBadge({ actionType }: { actionType: string }) {
  const relatedStatus = ACTION_TYPES[actionType]?.relatedStatus
  if (relatedStatus && STATUS_CONFIG[relatedStatus]) return <StatusBadge statusKey={relatedStatus} />
  return <span className="text-sm text-text-secondary">{ACTION_TYPES[actionType]?.label || actionType}</span>
}

type RowView = {
  key: string
  patientId: string | null
  patientName: string | null
  patientPhone: string | null
  appointmentDate: string | null
  appointmentTime: string | null
  doctorName: string | null
  dateTs: string | null
  badge: React.ReactNode
  actionIdForDone: string | null
}

function toView(row: PendingRow): RowView {
  if (row.kind === 'action') {
    const a = row.data
    // PD-362: navigate via users.public_id, not CRM ident_patient_id (broken lookup).
    const navId = a.patient_public_id != null ? String(a.patient_public_id) : null
    return {
      key: a.id,
      patientId: navId,
      patientName: a.patient_name,
      patientPhone: a.patient_phone,
      appointmentDate: a.appointment_date,
      appointmentTime: a.appointment_time,
      doctorName: a.doctor_name,
      dateTs: a.created_at,
      badge: <ActionTypeBadge actionType={a.action_type} />,
      actionIdForDone: a.status === 'pending' ? a.id : null,
    }
  }
  const s = row.data
  return {
    key: 'op-' + s.id,
    patientId: s.public_id != null ? String(s.public_id) : s.id,
    patientName: s.name,
    patientPhone: s.phone,
    appointmentDate: null,
    appointmentTime: null,
    doctorName: null,
    dateTs: s.last_activity_at,
    badge: <StatusBadge statusKey="operator" />,
    actionIdForDone: null,
  }
}

const EMPTY_COPY = 'Когда клиент попросит администратора или агент создаст действие, требующее выполнения в МИС (отмена, перенос, подтверждение), задача появится здесь'

export function AdminActionsPage() {
  const { rows, isLoading, error: queryError, refetch } = usePendingAdminWork()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const views: RowView[] = rows.map(toView)
  const error = queryError ? 'Не удалось загрузить действия' : null
  const [confirmingActionId, setConfirmingActionId] = useState<string | null>(null)

  const handleActionClick = (e: React.MouseEvent, actionId: string) => {
    e.stopPropagation()
    setConfirmingActionId(actionId)
  }

  const handleConfirm = async () => {
    if (!confirmingActionId) return
    try {
      await updateAdminAction(confirmingActionId, 'done')
      queryClient.invalidateQueries({ queryKey: ['admin', 'actions'] })
      queryClient.invalidateQueries({ queryKey: ['admin', 'dashboard'] })
    } catch (err) {
      if (import.meta.env.DEV) console.error('Action update error:', err)
    } finally {
      setConfirmingActionId(null)
    }
  }

  const handleRowClick = (patientId: string | null) => {
    if (patientId) navigate(`/chats/${patientId}`)
  }

  const PatientCell = ({ view }: { view: RowView }) => (
    <div className="min-w-0">
      <div className="text-sm text-text-primary truncate">{view.patientName || '—'}</div>
      {view.patientPhone && (
        <div className="text-xs text-text-tertiary truncate">{view.patientPhone}</div>
      )}
    </div>
  )

  const AppointmentCell = ({ view }: { view: RowView }) => {
    if (!view.appointmentDate) return <span className="text-sm text-text-tertiary">—</span>
    return (
      <div className="min-w-0">
        <div className="text-sm text-text-primary whitespace-nowrap">
          {view.appointmentDate}{view.appointmentTime ? `, ${view.appointmentTime}` : ''}
        </div>
        {view.doctorName && (
          <div className="text-xs text-text-tertiary truncate">{view.doctorName}</div>
        )}
      </div>
    )
  }

  const showEmpty = !isLoading && views.length === 0
  const showSpinnerRow = isLoading && views.length === 0

  return (
    <div className="space-y-6">
      {/* Confirm dialog */}
      {confirmingActionId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white dark:bg-[#1a1a2e] border border-gray-200 dark:border-white/[0.1] rounded-2xl p-6 shadow-2xl w-full max-w-sm mx-4">
            <h3 className="text-base font-semibold text-text-primary mb-2">Подтвердите действие</h3>
            <p className="text-sm text-text-tertiary mb-5">
              Отметить задачу как выполненную? Это действие нельзя отменить.
            </p>
            <div className="flex gap-3">
              <button
                onClick={handleConfirm}
                className="flex-1 px-4 py-2.5 bg-accent text-white rounded-xl text-sm font-medium hover:bg-accent/90 transition-colors"
              >
                Подтвердить
              </button>
              <button
                onClick={() => setConfirmingActionId(null)}
                className="flex-1 px-4 py-2.5 bg-surface-secondary dark:bg-white/[0.04] border border-border dark:border-white/[0.08] text-text-secondary rounded-xl text-sm hover:bg-surface-tertiary dark:hover:bg-white/[0.08] transition-colors"
              >
                Отменить
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Действия</h1>
          <p className="text-text-tertiary mt-1">Задачи, требующие выполнения</p>
        </div>
        <button
          onClick={() => refetch()}
          className="flex items-center gap-2 px-4 py-2 bg-surface-secondary dark:bg-white/[0.04] border border-border dark:border-white/[0.08] rounded-xl text-sm text-text-secondary hover:text-text-primary hover:border-accent/20 transition-all duration-200"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          Обновить
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="p-3 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 rounded-xl text-sm text-amber-700 dark:text-amber-300">
          {error}
        </div>
      )}

      {/* Mobile cards */}
      {showEmpty && (
        <div className="sm:hidden px-4 py-16 text-center">
          <ClipboardList className="w-10 h-10 text-text-muted mx-auto mb-3" />
          <p className="text-text-tertiary font-medium">Нет задач</p>
          <p className="text-text-muted text-xs mt-1">{EMPTY_COPY}</p>
        </div>
      )}
      <div className="sm:hidden space-y-2">
        {views.map((v) => (
          <div
            key={v.key}
            onClick={() => handleRowClick(v.patientId)}
            className={`p-3 rounded-xl border bg-white dark:bg-white/[0.02] border-gray-200 dark:border-white/[0.06] shadow-sm dark:shadow-none ${v.patientId ? 'cursor-pointer hover:bg-gray-50 dark:hover:bg-white/[0.04]' : ''} transition-all duration-150`}
          >
            <div className="flex items-center justify-between mb-2">
              {v.badge}
              {v.dateTs && (
                <span className="text-[10px] text-text-muted">{format(new Date(v.dateTs), 'dd.MM HH:mm')}</span>
              )}
            </div>
            <div className="flex items-center gap-3 mb-2">
              <div className="flex-1 min-w-0">
                <div className="text-sm text-text-primary truncate">{v.patientName || '—'}</div>
                {v.patientPhone && <div className="text-xs text-text-tertiary">{v.patientPhone}</div>}
              </div>
              {v.appointmentDate && (
                <div className="text-right shrink-0">
                  <div className="text-xs text-text-primary">{v.appointmentDate}{v.appointmentTime ? `, ${v.appointmentTime}` : ''}</div>
                  {v.doctorName && <div className="text-[10px] text-text-tertiary">{v.doctorName}</div>}
                </div>
              )}
            </div>
            {v.actionIdForDone && (
              <button
                onClick={(e) => handleActionClick(e, v.actionIdForDone!)}
                className="w-full flex items-center justify-center gap-1 py-1.5 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 text-emerald-600 dark:text-emerald-400 rounded-lg text-xs font-medium hover:bg-emerald-100 dark:hover:bg-emerald-500/15"
              >
                <CheckCircle className="w-3 h-3" /> Готово
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="hidden sm:block bg-white dark:bg-white/[0.02] border border-gray-200 dark:border-white/[0.06] rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border-light dark:border-white/[0.04]">
                <th className="text-left px-4 py-3.5 text-xs font-semibold text-text-tertiary uppercase tracking-wider">Тип</th>
                <th className="text-left px-4 py-3.5 text-xs font-semibold text-text-tertiary uppercase tracking-wider">Пациент</th>
                <th className="text-left px-4 py-3.5 text-xs font-semibold text-text-tertiary uppercase tracking-wider">Запись</th>
                <th className="text-left px-4 py-3.5 text-xs font-semibold text-text-tertiary uppercase tracking-wider hidden md:table-cell">Создано</th>
                <th className="text-right px-4 py-3.5 text-xs font-semibold text-text-tertiary uppercase tracking-wider w-[100px]"></th>
              </tr>
            </thead>
            <tbody>
              {showSpinnerRow ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-text-tertiary">
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-4 h-4 border-2 border-accent border-t-transparent rounded-full animate-spin" />
                      Загрузка...
                    </div>
                  </td>
                </tr>
              ) : showEmpty ? (
                <tr>
                  <td colSpan={5} className="px-4 py-16 text-center">
                    <ClipboardList className="w-10 h-10 text-text-muted mx-auto mb-3" />
                    <p className="text-text-tertiary font-medium">Нет задач</p>
                    <p className="text-text-muted text-xs mt-1 max-w-xs mx-auto">{EMPTY_COPY}</p>
                  </td>
                </tr>
              ) : views.map((v) => (
                <tr
                  key={v.key}
                  onClick={() => handleRowClick(v.patientId)}
                  className={`border-b border-border-light dark:border-white/[0.04] hover:bg-gray-50 dark:hover:bg-white/[0.03] transition-colors duration-150 ${v.patientId ? 'cursor-pointer' : ''}`}
                >
                  <td className="px-4 py-3">
                    {v.badge}
                  </td>
                  <td className="px-4 py-3">
                    <PatientCell view={v} />
                  </td>
                  <td className="px-4 py-3">
                    <AppointmentCell view={v} />
                  </td>
                  <td className="px-4 py-3 text-sm text-text-tertiary hidden md:table-cell whitespace-nowrap">
                    {v.dateTs ? format(new Date(v.dateTs), 'dd.MM.yyyy HH:mm') : '—'}
                  </td>
                  <td className="px-4 py-3">
                    {v.actionIdForDone && (
                      <div className="flex justify-end">
                        <button
                          onClick={(e) => handleActionClick(e, v.actionIdForDone!)}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 text-emerald-600 dark:text-emerald-400 rounded-lg text-xs font-medium hover:bg-emerald-100 dark:hover:bg-emerald-500/15 transition-colors"
                        >
                          <CheckCircle className="w-3.5 h-3.5" />
                          Готово
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
