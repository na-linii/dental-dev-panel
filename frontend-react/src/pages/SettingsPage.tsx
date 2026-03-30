import { useState, useEffect } from 'react'
import { settingsApi } from '../api/client'
import type { VizConfigEntry } from '../types'

const GROUPS = ['router', 'agent', 'tool', 'gateway', 'plugin', 'storage']
const SHAPE_OPTIONS = ['sphere', 'tetrahedron', 'octahedron', 'box', 'dodecahedron', 'icosahedron']

const DEFAULT_CONFIG: Record<string, VizConfigEntry> = {
  router: { shape: 'icosahedron', color: '#22d3ee', val: 14 },
  agent: { shape: 'sphere', color: '#facc15', val: 12 },
  tool: { shape: 'tetrahedron', color: '#a855f7', val: 6 },
  gateway: { shape: 'dodecahedron', color: '#22c55e', val: 10 },
  plugin: { shape: 'octahedron', color: '#f97316', val: 8 },
  storage: { shape: 'box', color: '#ec4899', val: 8 },
}

export function SettingsPage() {
  const [config, setConfig] = useState<Record<string, VizConfigEntry>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  useEffect(() => {
    settingsApi.getVizConfig()
      .then((data) => {
        // Merge with defaults for any missing groups
        const merged: Record<string, VizConfigEntry> = {}
        for (const group of GROUPS) {
          merged[group] = data[group] || DEFAULT_CONFIG[group]
        }
        setConfig(merged)
        setLoading(false)
      })
      .catch(() => {
        setConfig({ ...DEFAULT_CONFIG })
        setLoading(false)
      })
  }, [])

  const updateGroup = (group: string, field: keyof VizConfigEntry, value: string | number) => {
    setConfig((prev) => ({
      ...prev,
      [group]: { ...prev[group], [field]: value },
    }))
    setStatus(null)
  }

  const handleSave = async () => {
    setSaving(true)
    setStatus(null)
    try {
      await settingsApi.saveVizConfig(config)
      setStatus({ type: 'success', message: 'Saved. Changes will apply on next graph.json generation.' })
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to save'
      setStatus({ type: 'error', message: msg })
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center" style={{ height: 'calc(100vh - 48px)' }}>
        <span className="text-sm text-[#64748b]">Loading settings...</span>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-xl font-bold text-white mb-6">Settings</h1>

      {/* Design Architecture section */}
      <div className="bg-[#111127] border border-[#1e293b] rounded-lg p-5">
        <h2 className="text-base font-semibold text-[#7dd3fc] mb-4">Design Architecture</h2>
        <p className="text-xs text-[#64748b] mb-4">
          Configure visualization styles for each module group. Changes are committed to dental-core via GitHub API.
        </p>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[#64748b] text-xs border-b border-[#1e293b]">
                <th className="text-left py-2 pr-4 font-medium">Group</th>
                <th className="text-left py-2 pr-4 font-medium">Shape</th>
                <th className="text-left py-2 pr-4 font-medium">Color</th>
                <th className="text-left py-2 font-medium">Size</th>
              </tr>
            </thead>
            <tbody>
              {GROUPS.map((group) => {
                const entry = config[group]
                if (!entry) return null
                return (
                  <tr key={group} className="border-b border-[#1e293b]/50">
                    <td className="py-3 pr-4">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full flex-shrink-0"
                          style={{ background: entry.color }}
                        />
                        <span className="text-white font-medium capitalize">{group}</span>
                      </div>
                    </td>
                    <td className="py-3 pr-4">
                      <select
                        value={entry.shape}
                        onChange={(e) => updateGroup(group, 'shape', e.target.value)}
                        className="bg-[#0a0a1a] border border-[#1e293b] rounded px-2 py-1 text-white text-xs focus:outline-none focus:border-[#7dd3fc] cursor-pointer"
                      >
                        {SHAPE_OPTIONS.map((s) => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                    </td>
                    <td className="py-3 pr-4">
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={entry.color}
                          onChange={(e) => updateGroup(group, 'color', e.target.value)}
                          className="w-7 h-7 rounded border border-[#1e293b] bg-transparent cursor-pointer"
                          style={{ padding: 0 }}
                        />
                        <code className="text-[#94a3b8] text-xs">{entry.color}</code>
                      </div>
                    </td>
                    <td className="py-3">
                      <div className="flex items-center gap-2">
                        <input
                          type="range"
                          min={2}
                          max={20}
                          value={entry.val}
                          onChange={(e) => updateGroup(group, 'val', Number(e.target.value))}
                          className="w-24 accent-[#7dd3fc] cursor-pointer"
                        />
                        <span className="text-[#94a3b8] text-xs w-5 text-right">{entry.val}</span>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        <div className="mt-5 flex items-center gap-3">
          <button
            onClick={handleSave}
            disabled={saving}
            className={`px-4 py-2 rounded text-sm font-medium cursor-pointer transition-colors ${
              saving
                ? 'bg-[#1e293b] text-[#64748b] cursor-not-allowed'
                : 'bg-[#7dd3fc] text-[#0a0a1a] hover:bg-[#5ebed6]'
            }`}
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
          {status && (
            <span className={`text-xs ${status.type === 'success' ? 'text-[#4ade80]' : 'text-red-400'}`}>
              {status.message}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
