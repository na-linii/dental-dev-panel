import { useState, useEffect, useRef } from 'react'
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

const GROUP_LABELS: Record<string, string> = {
  router: 'Router',
  agent: 'Agent',
  tool: 'Tool',
  gateway: 'Gateway',
  plugin: 'Plugin',
  storage: 'Storage',
}

/** Inline SVG preview for each shape */
function ShapePreview({ shape, color }: { shape: string; color: string }) {
  const size = 20
  const half = size / 2
  const common = { width: size, height: size, viewBox: `0 0 ${size} ${size}`, className: 'flex-shrink-0' }

  switch (shape) {
    case 'sphere':
      return <svg {...common}><circle cx={half} cy={half} r={7} fill={color} opacity={0.8} /></svg>
    case 'tetrahedron':
      return <svg {...common}><polygon points={`${half},2 ${size - 2},${size - 2} 2,${size - 2}`} fill={color} opacity={0.8} /></svg>
    case 'octahedron':
      return <svg {...common}><polygon points={`${half},1 ${size - 2},${half} ${half},${size - 1} 2,${half}`} fill={color} opacity={0.8} /></svg>
    case 'box':
      return <svg {...common}><rect x={3} y={3} width={14} height={14} rx={1} fill={color} opacity={0.8} /></svg>
    case 'dodecahedron':
      // Pentagon
      return (
        <svg {...common}>
          <polygon
            points={`${half},2 ${size - 2},7 ${size - 4},${size - 2} 4,${size - 2} 2,7`}
            fill={color} opacity={0.8}
          />
        </svg>
      )
    case 'icosahedron':
      // Hexagon
      return (
        <svg {...common}>
          <polygon
            points={`${half},1 ${size - 2},5 ${size - 2},${size - 5} ${half},${size - 1} 2,${size - 5} 2,5`}
            fill={color} opacity={0.8}
          />
        </svg>
      )
    default:
      return <svg {...common}><circle cx={half} cy={half} r={7} fill={color} opacity={0.8} /></svg>
  }
}

/** Color swatch that opens native color picker */
function ColorSwatch({ color, onChange }: { color: string; onChange: (c: string) => void }) {
  const inputRef = useRef<HTMLInputElement>(null)
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        className="w-7 h-7 rounded-full border-2 border-[#1e293b] cursor-pointer hover:border-[#475569] transition-colors p-0"
        style={{ background: color }}
        onClick={() => inputRef.current?.click()}
        title={color}
      />
      <input
        ref={inputRef}
        type="color"
        value={color}
        onChange={(e) => onChange(e.target.value)}
        className="sr-only"
      />
      <code className="text-[#64748b] text-[0.65rem]">{color}</code>
    </div>
  )
}

export function SettingsPage() {
  const [config, setConfig] = useState<Record<string, VizConfigEntry>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  useEffect(() => {
    settingsApi.getVizConfig()
      .then((data) => {
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
    <div className="p-6 max-w-3xl mx-auto">
      <h1 className="text-xl font-bold text-white mb-1">Settings</h1>
      <p className="text-xs text-[#64748b] mb-6">
        Configure visualization styles for each module group. Changes are committed to dental-core via GitHub API.
      </p>

      {/* Group cards */}
      <div className="space-y-3">
        {GROUPS.map((group) => {
          const entry = config[group]
          if (!entry) return null
          return (
            <div
              key={group}
              className="bg-[#111127] border border-[#1e293b] rounded-lg overflow-hidden flex"
            >
              {/* Colored left border */}
              <div className="w-1 flex-shrink-0 rounded-l-lg" style={{ background: entry.color }} />

              <div className="flex-1 p-4">
                {/* Group name */}
                <div className="flex items-center gap-2 mb-3">
                  <ShapePreview shape={entry.shape} color={entry.color} />
                  <span className="text-white font-semibold text-sm">{GROUP_LABELS[group] || group}</span>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  {/* Shape */}
                  <div>
                    <label className="text-[0.62rem] text-[#64748b] uppercase tracking-wider block mb-1.5">Shape</label>
                    <div className="flex items-center gap-2">
                      <select
                        value={entry.shape}
                        onChange={(e) => updateGroup(group, 'shape', e.target.value)}
                        className="bg-[#0a0a1a] border border-[#1e293b] rounded px-2 py-1.5 text-white text-xs focus:outline-none focus:border-[#7dd3fc] cursor-pointer flex-1"
                      >
                        {SHAPE_OPTIONS.map((s) => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                      <ShapePreview shape={entry.shape} color={entry.color} />
                    </div>
                  </div>

                  {/* Color */}
                  <div>
                    <label className="text-[0.62rem] text-[#64748b] uppercase tracking-wider block mb-1.5">Color</label>
                    <ColorSwatch
                      color={entry.color}
                      onChange={(c) => updateGroup(group, 'color', c)}
                    />
                  </div>

                  {/* Size */}
                  <div>
                    <label className="text-[0.62rem] text-[#64748b] uppercase tracking-wider block mb-1.5">Size</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="range"
                        min={2}
                        max={20}
                        value={entry.val}
                        onChange={(e) => updateGroup(group, 'val', Number(e.target.value))}
                        className="flex-1 accent-[#7dd3fc] cursor-pointer"
                      />
                      <span className="text-[#94a3b8] text-xs font-mono w-5 text-right">{entry.val}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Save button */}
      <div className="mt-6 flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={saving}
          className={`px-5 py-2 rounded-lg text-sm font-medium cursor-pointer transition-all ${
            saving
              ? 'bg-[#1e293b] text-[#64748b] cursor-not-allowed'
              : 'bg-[#7dd3fc] text-[#0a0a1a] hover:bg-[#5ebed6] active:scale-[0.98]'
          }`}
        >
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
        {status && (
          <div className={`flex items-center gap-1.5 text-xs ${status.type === 'success' ? 'text-[#4ade80]' : 'text-red-400'}`}>
            {status.type === 'success' ? (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            )}
            <span>{status.message}</span>
          </div>
        )}
      </div>
    </div>
  )
}
