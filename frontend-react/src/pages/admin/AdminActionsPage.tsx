import { RefreshCw, CheckCircle } from 'lucide-react'
import { updateAdminAction } from '../../api/adminClient'
import { useAdminActions } from '../../hooks/useAdminQueries'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { format } from 'date-fns'
import type { AdminAction } from '../../api/adminClient'

const TYPE_LABELS: Record<string, string> = {
  cancel_appointment: 'Отменить запись',
  cancel: 'Пациент отказался',
  reschedule: 'Перенести визит',
  confirm: 'Подтвердить визит',
  update_booking_status: 'Обновить статус',
  book_appointment: 'Новая запись',
  register_patient: 'Регистрация пациента',
}

export function AdminActionsPage() {
  const { data, isLoading, error: queryError, refetch } = useAdminActions({ status: 'pending' })
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const actions: AdminAction[] = Array.isArray(data) ? data : []
  const error = queryError ? 'Не удалось загрузить действия' : null

  const handleAction = async (e: React.MouseEvent, actionId: string) => {
    e.stopPropagation()
    try {
      await updateAdminAction(actionId, 'done')
      queryClient.invalidateQueries({ queryKey: ['admin', 'actions'] })
      queryClient.invalidateQueries({ queryKey: ['admin', 'dashboard'] })
    } catch (err) {
      if (import.meta.env.DEV) console.error('Action update error:', err)
    }
  }

  const handleRowClick = (action: AdminAction) => {
    if (action.session_id) navigate(`/admin/chats/${action.session_id}`)
  }

  const PatientCell = ({ action }: { action: AdminAction }) => (
    <div className="min-w-0">
      <div className="text-sm text-white truncate">{action.patient_name || '—'}</div>
      {action.patient_phone && (
        <div className="text-xs text-[#64748b] truncate">{action.patient_phone}</div>
      )}
    </div>
  )

  const AppointmentCell = ({ action }: { action: AdminAction }) => {
    if (!action.appointment_date) return <span className="text-sm text-[#64748b]">—</span>
    return (
      <div className="min-w-0">
        <div className="text-sm text-white whitespace-nowrap">
          {action.appointment_date}{action.appointment_time ? `, ${action.appointment_time}` : ''}
        </div>
        {action.doctor_name && (
          <div className="text-xs text-[#64748b] truncate">{action.doctor_name}</div>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Действия</h1>
          <p className="text-[#64748b] mt-1">Задачи, требующие выполнения</p>
        </div>
        <button
          onClick={() => refetch()}
          className="flex items-center gap-2 px-4 py-2 bg-white/[0.04] border border-white/[0.08] rounded-xl text-sm text-[#94a3b8] hover:text-white hover:border-[#51ff97]/20 transition-all duration-200"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          Обновить
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-sm text-amber-300">
          {error}
        </div>
      )}

      {/* Mobile cards */}
      <div className="sm:hidden space-y-2">
        {actions.map((a) => (
          <div
            key={a.id}
            onClick={() => handleRowClick(a)}
            className={`p-3 rounded-xl border bg-white/[0.02] border-white/[0.06] ${a.session_id ? 'cursor-pointer hover:bg-white/[0.04]' : ''} transition-all duration-150`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-[#51ff97]">{TYPE_LABELS[a.action_type] || a.action_type}</span>
              {a.created_at && (
                <span className="text-[10px] text-[#475569]">{format(new Date(a.created_at), 'dd.MM HH:mm')}</span>
              )}
            </div>
            <div className="flex items-center gap-3 mb-2">
              <div className="flex-1 min-w-0">
                <div className="text-sm text-white truncate">{a.patient_name || '—'}</div>
                {a.patient_phone && <div className="text-xs text-[#64748b]">{a.patient_phone}</div>}
              </div>
              {a.appointment_date && (
                <div className="text-right shrink-0">
                  <div className="text-xs text-white">{a.appointment_date}{a.appointment_time ? `, ${a.appointment_time}` : ''}</div>
                  {a.doctor_name && <div className="text-[10px] text-[#64748b]">{a.doctor_name}</div>}
                </div>
              )}
            </div>
            {a.status === 'pending' && (
              <button
                onClick={(e) => handleAction(e, a.id)}
                className="w-full flex items-center justify-center gap-1 py-1.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-lg text-xs font-medium"
              >
                <CheckCircle className="w-3 h-3" /> Готово
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="hidden sm:block bg-white/[0.02] border border-white/[0.06] rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/[0.06]">
                <th className="text-left px-4 py-3.5 text-xs font-semibold text-[#64748b] uppercase tracking-wider">Тип</th>
                <th className="text-left px-4 py-3.5 text-xs font-semibold text-[#64748b] uppercase tracking-wider">Пациент</th>
                <th className="text-left px-4 py-3.5 text-xs font-semibold text-[#64748b] uppercase tracking-wider">Запись</th>
                <th className="text-left px-4 py-3.5 text-xs font-semibold text-[#64748b] uppercase tracking-wider hidden md:table-cell">Создано</th>
                <th className="text-right px-4 py-3.5 text-xs font-semibold text-[#64748b] uppercase tracking-wider w-[100px]"></th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-[#64748b]">
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-4 h-4 border-2 border-[#51ff97] border-t-transparent rounded-full animate-spin" />
                      Загрузка...
                    </div>
                  </td>
                </tr>
              ) : actions.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-[#64748b]">
                    Нет задач
                  </td>
                </tr>
              ) : actions.map((action) => (
                <tr
                  key={action.id}
                  onClick={() => handleRowClick(action)}
                  className={`border-b border-white/[0.04] hover:bg-white/[0.03] transition-colors duration-150 ${action.session_id ? 'cursor-pointer' : ''}`}
                >
                  <td className="px-4 py-3 text-sm text-[#51ff97] font-medium whitespace-nowrap">
                    {TYPE_LABELS[action.action_type] || action.action_type}
                  </td>
                  <td className="px-4 py-3">
                    <PatientCell action={action} />
                  </td>
                  <td className="px-4 py-3">
                    <AppointmentCell action={action} />
                  </td>
                  <td className="px-4 py-3 text-sm text-[#64748b] hidden md:table-cell whitespace-nowrap">
                    {action.created_at ? format(new Date(action.created_at), 'dd.MM.yyyy HH:mm') : '—'}
                  </td>
                  <td className="px-4 py-3">
                    {action.status === 'pending' && (
                      <div className="flex justify-end">
                        <button
                          onClick={(e) => handleAction(e, action.id)}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-lg text-xs font-medium hover:bg-emerald-500/15 transition-colors"
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
