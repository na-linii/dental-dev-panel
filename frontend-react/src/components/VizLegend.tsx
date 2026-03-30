import { useState, useRef, useCallback } from 'react'
import { ShapeIcon } from './ShapeIcon'
import { settingsApi } from '../api/client'
import { LABELS } from '../config/viz'
import type { VizConfigEntry } from '../types'

const GROUP_ORDER = ['router', 'agent', 'tool', 'gateway', 'plugin', 'storage']

interface VizLegendProps {
  vizConfig: Record<string, VizConfigEntry>
  onConfigChange?: (newConfig: Record<string, VizConfigEntry>) => void
}

function ColorSwatch({ color, onChange }: { color: string; onChange: (c: string) => void }) {
  const inputRef = useRef<HTMLInputElement>(null)
  return (
    <>
      <button
        type="button"
        className="w-4 h-4 rounded-full border border-[#475569] cursor-pointer hover:border-white transition-colors p-0 flex-shrink-0"
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
    </>
  )
}

export function VizLegend({ vizConfig, onConfigChange }: VizLegendProps) {
  const [expanded, setExpanded] = useState(true)
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleColorChange = useCallback((group: string, newColor: string) => {
    const updated = {
      ...vizConfig,
      [group]: { ...vizConfig[group], color: newColor },
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
    <div
      className="absolute top-3 left-3 z-10 select-none"
      style={{ maxWidth: 200 }}
    >
      <button
        onClick={() => setExpanded(!expanded)}
        className="px-2.5 py-1 rounded-md text-[11px] font-medium cursor-pointer border-0"
        style={{
          background: 'rgba(0,0,0,0.7)',
          color: '#94a3b8',
          border: '1px solid rgba(100,116,139,0.2)',
        }}
      >
        {expanded ? '▾ Legend' : '▸ Legend'}
      </button>

      {expanded && (
        <div
          className="mt-1.5 rounded-md px-2.5 py-2"
          style={{
            background: 'rgba(0,0,0,0.7)',
            border: '1px solid rgba(100,116,139,0.2)',
          }}
        >
          {groups.map((group) => {
            const entry = vizConfig[group]
            if (!entry) return null
            return (
              <div key={group} className="flex items-center gap-2 py-[3px]">
                <ColorSwatch
                  color={entry.color}
                  onChange={(c) => handleColorChange(group, c)}
                />
                <ShapeIcon shape={entry.shape} color={entry.color} size={14} />
                <span className="text-[11px] text-[#cbd5e1]">
                  {LABELS[group] || group}
                </span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
