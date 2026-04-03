import { useState, useEffect } from 'react'
import { RefreshCw, CheckCircle, XCircle } from 'lucide-react'
import { updateAdminAction } from '../../api/adminClient'
import type { AdminAction } from '../../api/adminClient'
import { useAdminActions } from '../../hooks/useAdminQueries'
import { format } from 'date-fns'

const TYPE_LABELS: Record<string, string> = {
  cancel_appointment: 'Отменить запись в IDENT',
  cancel: 'Пациент отказался от визита',
  reschedule: 'Пациент просит перенести визит',
  confirm: 'Пациент подтвердил визит',
  update_booking_status: 'Обновить статус записи в IDENT',
  book_appointment: 'Новая запись',
  register_patient: 'Регистрация пациента',
}

const STATUS_STYLES: Record<string, string> = {
  pending: 'bg-amber-500/15 text-amber-300 border-amber-500/25',
  done: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/25',
  failed: 'bg-red-500/15 text-red-300 border-red-500/25',
}

export function AdminActionsPage() {
  // Role guard — only admin and superadmin
  const userStr = localStorage.getItem('admin_user')
  const userRole = userStr ? JSON.parse(userStr)?.role : null
  if (userRole === 'operator') {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-[#64748b]">Нет доступа</p>
      </div>
    )
  }

  const { data, isLoading, error: queryError, refetch } = useAdminActions({ status: 'pending' })
  const [actions, setActions] = useState<AdminAction[]>([])
  const error = queryError ? 'Не удалось загрузить действия' : null

  // Sync from React Query
  useEffect(() => {
    if (data) setActions(Array.isArray(data) ? data : [])
  }, [data])

  const handleAction = async (actionId: string, status: 'done' | 'failed') => {
    try {
      await updateAdminAction(actionId, status)
      setActions((prev) => prev.map((a) => a.id === actionId ? { ...a, status } : a))
    } catch (e) {
      if (import.meta.env.DEV) console.error('Action update error:', e)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Действия</h1>
          <p className="text-[#64748b] mt-1">Только для администраторов</p>
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
          <div key={a.id} className={`p-3 rounded-xl border ${STATUS_STYLES[a.status] || ''}`}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-semibold text-white">{TYPE_LABELS[a.action_type] || a.action_type}</span>
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-medium ${STATUS_STYLES[a.status] || ''}`}>
                <span className="w-1.5 h-1.5 rounded-full bg-current opacity-60" />
                {a.status === 'pending' ? 'Ожидает' : a.status === 'done' ? 'Выполнено' : 'Ошибка'}
              </span>
            </div>
            {a.description && <p className="text-xs text-[#94a3b8] mb-2 truncate">{a.description}</p>}
            {a.status === 'pending' && (
              <div className="flex gap-2">
                <button onClick={() => handleAction(a.id, 'done')} className="flex-1 flex items-center justify-center gap-1 py-1.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-lg text-xs font-medium">
                  <CheckCircle className="w-3 h-3" /> Готово
                </button>
                <button onClick={() => handleAction(a.id, 'failed')} className="flex-1 flex items-center justify-center gap-1 py-1.5 bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg text-xs font-medium">
                  <XCircle className="w-3 h-3" /> Ошибка
                </button>
              </div>
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
                <th className="text-left px-4 py-3.5 text-xs font-semibold text-[#64748b] uppercase tracking-wider">Описание</th>
                <th className="text-left px-4 py-3.5 text-xs font-semibold text-[#64748b] uppercase tracking-wider hidden sm:table-cell">Дата</th>
                <th className="text-left px-4 py-3.5 text-xs font-semibold text-[#64748b] uppercase tracking-wider">Статус</th>
                <th className="text-right px-4 py-3.5 text-xs font-semibold text-[#64748b] uppercase tracking-wider">Действия</th>
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
                <tr key={action.id} className="border-b border-white/[0.04] hover:bg-white/[0.03] transition-colors duration-150">
                  <td className="px-4 py-3 text-sm text-white whitespace-nowrap">
                    {TYPE_LABELS[action.action_type] || action.action_type}
                  </td>
                  <td className="px-4 py-3 text-sm text-[#94a3b8] max-w-[200px] truncate">
                    {action.description || '---'}
                  </td>
                  <td className="px-4 py-3 text-sm text-[#64748b] hidden sm:table-cell whitespace-nowrap">
                    {action.created_at ? format(new Date(action.created_at), 'dd.MM.yyyy HH:mm') : '---'}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium ${STATUS_STYLES[action.status] || STATUS_STYLES.pending}`}>
                      <span className="w-1.5 h-1.5 rounded-full bg-current opacity-60" />
                      {action.status === 'pending' ? 'Ожидает' : action.status === 'done' ? 'Выполнено' : 'Ошибка'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {action.status === 'pending' && (
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleAction(action.id, 'done')}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-lg text-xs font-medium hover:bg-emerald-500/15 transition-colors"
                        >
                          <CheckCircle className="w-3.5 h-3.5" />
                          Готово
                        </button>
                        <button
                          onClick={() => handleAction(action.id, 'failed')}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg text-xs font-medium hover:bg-red-500/15 transition-colors"
                        >
                          <XCircle className="w-3.5 h-3.5" />
                          Ошибка
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
