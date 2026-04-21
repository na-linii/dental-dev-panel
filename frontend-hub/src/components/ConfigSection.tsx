import { useState } from 'react'

interface ConfigSectionProps {
  title: string
  color: string
  defaultOpen?: boolean
  children: React.ReactNode
}

export function ConfigSection({ title, color, defaultOpen = true, children }: ConfigSectionProps) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="bg-[#111127] border border-[#1e293b] rounded-xl overflow-hidden" style={{ borderLeftColor: color, borderLeftWidth: 3 }}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-3 px-5 py-3.5 hover:bg-[#1a1a3a] transition-colors cursor-pointer"
      >
        <div className="w-1 h-5 rounded-full" style={{ backgroundColor: color }} />
        <span className="text-sm font-semibold text-white flex-1 text-left">{title}</span>
        <span className={`text-[#475569] text-xs transition-transform ${open ? 'rotate-180' : ''}`}>
          {'\u25BC'}
        </span>
      </button>
      {open && <div className="px-5 pb-5 space-y-4">{children}</div>}
    </div>
  )
}

export const SECTION_COLORS: Record<string, string> = {
  basic: '#818cf8',
  server: '#38bdf8',
  modules: '#a78bfa',
  channels: '#f472b6',
  booking: '#fb923c',
  confirmation: '#4ade80',
  handoff: '#f87171',
  llm: '#facc15',
  knowledge: '#2dd4bf',
  import: '#94a3b8',
}
