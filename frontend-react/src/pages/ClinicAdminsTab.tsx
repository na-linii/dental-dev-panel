import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import { clinicsApi } from '../api/client'
import type { AdminUser } from '../types'

export function ClinicAdminsTab() {
  const { clinicId } = useParams<{ clinicId: string }>()
  const [admins, setAdmins] = useState<AdminUser[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [error, setError] = useState('')
  const [newAdmin, setNewAdmin] = useState({ username: '', full_name: '', password: '', role: 'operator' })
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null)

  const loadAdmins = useCallback(async () => {
    if (!clinicId) return
    try {
      const list = await clinicsApi.admins(clinicId)
      setAdmins(list)
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [clinicId])

  useEffect(() => { loadAdmins() }, [loadAdmins])

  const handleAdd = async () => {
    if (!newAdmin.username || !newAdmin.password || !clinicId) return
    setError('')
    try {
      await clinicsApi.createAdmin(clinicId, {
        username: newAdmin.username,
        password: newAdmin.password,
        full_name: newAdmin.full_name || newAdmin.username,
        role: newAdmin.role,
      })
      setNewAdmin({ username: '', full_name: '', password: '', role: 'operator' })
      setShowAdd(false)
      loadAdmins()
    } catch (e: any) {
      setError(e.response?.data?.detail || 'Failed to create admin')
    }
  }

  const handleDelete = async (adminId: number) => {
    if (!clinicId) return
    if (confirmDeleteId !== adminId) {
      setConfirmDeleteId(adminId)
      return
    }
    try {
      await clinicsApi.deleteAdmin(clinicId, adminId)
      setConfirmDeleteId(null)
      loadAdmins()
    } catch {
      setConfirmDeleteId(null)
    }
  }

  if (loading) {
    return <div className="p-6 text-[#64748b] text-sm">Loading...</div>
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-white">Administrators</h3>
          <p className="text-xs text-[#64748b]">
            Manage admin panel access for {clinicId}
          </p>
        </div>
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="px-3 py-1.5 rounded-lg bg-[#7dd3fc] text-[#0a0a1a] text-xs font-semibold cursor-pointer hover:bg-[#38bdf8]"
        >
          + Add Admin
        </button>
      </div>

      {/* Add form */}
      {showAdd && (
        <div className="mb-4 p-4 bg-[#111127] border border-[#7dd3fc]/30 rounded-xl">
          <div className="grid grid-cols-2 gap-3 mb-3">
            <input
              value={newAdmin.username}
              onChange={(e) => setNewAdmin({ ...newAdmin, username: e.target.value })}
              placeholder="Username"
              className="px-3 py-1.5 text-xs bg-[#0a0a1a] border border-[#1e293b] rounded-lg text-white placeholder-[#475569] focus:border-[#7dd3fc] outline-none"
            />
            <input
              value={newAdmin.full_name}
              onChange={(e) => setNewAdmin({ ...newAdmin, full_name: e.target.value })}
              placeholder="Full name"
              className="px-3 py-1.5 text-xs bg-[#0a0a1a] border border-[#1e293b] rounded-lg text-white placeholder-[#475569] focus:border-[#7dd3fc] outline-none"
            />
            <input
              value={newAdmin.password}
              onChange={(e) => setNewAdmin({ ...newAdmin, password: e.target.value })}
              placeholder="Password"
              type="password"
              className="px-3 py-1.5 text-xs bg-[#0a0a1a] border border-[#1e293b] rounded-lg text-white placeholder-[#475569] focus:border-[#7dd3fc] outline-none"
            />
            <select
              value={newAdmin.role}
              onChange={(e) => setNewAdmin({ ...newAdmin, role: e.target.value })}
              className="px-3 py-1.5 text-xs bg-[#0a0a1a] border border-[#1e293b] rounded-lg text-white focus:border-[#7dd3fc] outline-none"
            >
              <option value="operator">Operator</option>
              <option value="admin">Admin</option>
              <option value="superadmin">Superadmin</option>
            </select>
          </div>
          {error && (
            <div className="text-xs text-[#f87171] mb-2">{error}</div>
          )}
          <div className="flex gap-2">
            <button
              onClick={handleAdd}
              disabled={!newAdmin.username || !newAdmin.password}
              className="px-3 py-1.5 rounded-lg bg-[#7dd3fc] text-[#0a0a1a] text-xs font-semibold cursor-pointer hover:bg-[#38bdf8] disabled:opacity-40 disabled:cursor-default"
            >
              Create
            </button>
            <button
              onClick={() => { setShowAdd(false); setError('') }}
              className="px-3 py-1.5 text-xs text-[#64748b] hover:text-white cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Admin list */}
      <div className="bg-[#111127] border border-[#1e293b] rounded-xl overflow-hidden">
        {admins.length === 0 ? (
          <div className="px-4 py-8 text-center text-xs text-[#64748b]">
            No administrators yet. Click "+ Add Admin" to create one.
          </div>
        ) : (
          <div className="divide-y divide-[#1e293b]">
            {admins.map((a) => (
              <div key={a.id} className={`flex items-center justify-between px-4 py-3 transition-colors ${
                confirmDeleteId === a.id ? 'bg-[#dc2626]/5' : ''
              }`}>
                <div>
                  <span className="text-xs text-white font-medium">{a.full_name || a.username}</span>
                  <span className="text-[10px] text-[#64748b] ml-2">@{a.username}</span>
                  {!a.clinic_id && (
                    <span className="text-[9px] text-[#facc15] ml-2">global</span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                    a.role === 'superadmin' ? 'bg-[#7dd3fc]/10 text-[#7dd3fc]' :
                    a.role === 'admin' ? 'bg-[#a855f7]/10 text-[#a855f7]' :
                    'bg-[#1e293b] text-[#94a3b8]'
                  }`}>
                    {a.role}
                  </span>
                  {confirmDeleteId === a.id ? (
                    <>
                      <button
                        onClick={() => setConfirmDeleteId(null)}
                        className="px-2 py-0.5 text-[10px] text-[#64748b] hover:text-white cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => handleDelete(a.id)}
                        className="px-2.5 py-0.5 rounded text-[10px] font-semibold bg-[#dc2626] text-white cursor-pointer animate-pulse"
                      >
                        Confirm Remove
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => handleDelete(a.id)}
                      className="px-2 py-0.5 rounded text-[10px] text-[#64748b] hover:text-[#fca5a5] hover:bg-[#991b1b]/30 cursor-pointer transition-colors"
                    >
                      Remove
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
