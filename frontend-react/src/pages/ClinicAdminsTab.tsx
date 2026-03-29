import { useState } from 'react'
import { useParams } from 'react-router-dom'

interface AdminUser {
  id: string
  username: string
  full_name: string
  role: string
  clinic_id: string
}

export function ClinicAdminsTab() {
  const { clinicId } = useParams<{ clinicId: string }>()
  const [admins, setAdmins] = useState<AdminUser[]>([])
  const [showAdd, setShowAdd] = useState(false)
  const [newAdmin, setNewAdmin] = useState({ username: '', full_name: '', password: '', role: 'operator' })

  const handleAdd = () => {
    if (!newAdmin.username || !newAdmin.password) return
    // TODO: call Hub API to create admin
    const admin: AdminUser = {
      id: crypto.randomUUID(),
      username: newAdmin.username,
      full_name: newAdmin.full_name || newAdmin.username,
      role: newAdmin.role,
      clinic_id: clinicId || '',
    }
    setAdmins([...admins, admin])
    setNewAdmin({ username: '', full_name: '', password: '', role: 'operator' })
    setShowAdd(false)
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
          <div className="flex gap-2">
            <button
              onClick={handleAdd}
              disabled={!newAdmin.username || !newAdmin.password}
              className="px-3 py-1.5 rounded-lg bg-[#7dd3fc] text-[#0a0a1a] text-xs font-semibold cursor-pointer hover:bg-[#38bdf8] disabled:opacity-40 disabled:cursor-default"
            >
              Create
            </button>
            <button
              onClick={() => setShowAdd(false)}
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
              <div key={a.id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <span className="text-xs text-white font-medium">{a.full_name || a.username}</span>
                  <span className="text-[10px] text-[#64748b] ml-2">@{a.username}</span>
                </div>
                <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                  a.role === 'superadmin' ? 'bg-[#7dd3fc]/10 text-[#7dd3fc]' :
                  a.role === 'admin' ? 'bg-[#a855f7]/10 text-[#a855f7]' :
                  'bg-[#1e293b] text-[#94a3b8]'
                }`}>
                  {a.role}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
