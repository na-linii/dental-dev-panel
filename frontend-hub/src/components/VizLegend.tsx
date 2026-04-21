import { useState, useRef, useCallback, useEffect } from 'react'
import { ShapeIcon } from './ShapeIcon'
import { settingsApi } from '../api/client'
import { LABELS } from '../config/viz'
import type { VizConfigEntry } from '../types'

const GROUP_ORDER = ['router', 'agent', 'tool', 'gateway', 'plugin', 'storage']
const SHAPE_OPTIONS = ['sphere', 'tetrahedron', 'octahedron', 'box', 'dodecahedron', 'icosahedron']

interface VizLegendProps {
  vizConfig: Record<string, VizConfigEntry>
  onConfigChange?: (newConfig: Record<string, VizConfigEntry>) => void
}

export function VizLegend({ vizConfig, onConfigChange }: VizLegendProps) {
  const [settingsOpen, setSettingsOpen] = useState(false)
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // On mount, load from DB — DB config takes priority over graph data
  useEffect(() => {
    settingsApi.getVizConfig().then((dbConfig) => {
      if (Object.keys(dbConfig).length > 0) {
        onConfigChange?.(dbConfig)
      }
    }).catch(() => {})
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleChange = useCallback((group: string, field: keyof VizConfigEntry, value: string | number) => {
    const updated = {
      ...vizConfig,
      [group]: { ...vizConfig[group], [field]: value },
    }
    onConfigChange?.(updated)

    // Debounce save to GitHub
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
    saveTimeoutRef.current = setTimeout(() => {
      settingsApi.saveVizConfig(updated).catch(() => {})
    }, 1000)
  }, [vizConfig, onConfigChange])

  const groups = GROUP_ORDER.filter((g) => vizConfig[g])
  if (groups.length === 0) return null

  return (
    <div className="absolute top-3 left-3 z-10 select-none" style={{ maxWidth: 240 }}>
      <div
        className="rounded-md px-3 py-2"
        style={{ background: 'rgba(0,0,0,0.75)', border: '1px solid rgba(100,116,139,0.2)' }}
      >
        {/* Header: Legend + settings gear */}
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[10px] text-[#64748b] uppercase tracking-wider font-medium">Legend</span>
          <button
            onClick={() => setSettingsOpen(!settingsOpen)}
            className="w-5 h-5 flex items-center justify-center rounded cursor-pointer border-0 p-0 transition-colors"
            style={{
              background: settingsOpen ? 'rgba(125,211,252,0.15)' : 'transparent',
              color: settingsOpen ? '#7dd3fc' : '#64748b',
            }}
            title="Customize colors, shapes, sizes"
          >
            <svg width="12" height="12" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
            </svg>
          </button>
        </div>

        {/* Legend rows — always visible */}
        {groups.map((group) => {
          const entry = vizConfig[group]
          if (!entry) return null
          return (
            <div key={group}>
              {/* Legend row — shape icon is already colored */}
              <div className="flex items-center gap-2 py-[3px]">
                <ShapeIcon shape={entry.shape} color={entry.color} size={16} />
                <span className="text-[11px] text-[#cbd5e1] flex-1">
                  {LABELS[group] || group}
                </span>
              </div>

              {/* Settings row — only when gear is open */}
              {settingsOpen && (
                <div className="ml-5 mb-2 mt-0.5 flex flex-col gap-1.5">
                  {/* Color */}
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] text-[#475569] w-8">Color</span>
                    <input
                      type="color"
                      value={entry.color}
                      onChange={(e) => handleChange(group, 'color', e.target.value)}
                      className="w-5 h-4 rounded cursor-pointer border border-[#475569] p-0"
                      style={{ background: 'transparent' }}
                    />
                    <span className="text-[9px] text-[#475569] font-mono">{entry.color}</span>
                  </div>
                  {/* Shape */}
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] text-[#475569] w-8">Shape</span>
                    <select
                      value={entry.shape}
                      onChange={(e) => handleChange(group, 'shape', e.target.value)}
                      className="text-[10px] bg-[#0a0a1a] text-[#cbd5e1] border border-[#1e293b] rounded px-1 py-0.5 cursor-pointer"
                    >
                      {SHAPE_OPTIONS.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>
                  {/* Size */}
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] text-[#475569] w-8">Size</span>
                    <input
                      type="range"
                      min={2}
                      max={20}
                      value={entry.val}
                      onChange={(e) => handleChange(group, 'val', parseInt(e.target.value))}
                      className="flex-1 h-1 accent-[#7dd3fc]"
                    />
                    <span className="text-[9px] text-[#475569] font-mono w-4 text-right">{entry.val}</span>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
