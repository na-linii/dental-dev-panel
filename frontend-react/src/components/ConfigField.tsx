interface ConfigFieldProps {
  label: string
  value: string | number | boolean | undefined | null
  type?: 'text' | 'badge' | 'toggle' | 'list' | 'secret'
}

export function ConfigField({ label, value, type = 'text' }: ConfigFieldProps) {
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-[#1e293b]/50 last:border-0">
      <span className="text-xs text-[#64748b]">{label}</span>
      {type === 'toggle' ? (
        <span className={`text-xs font-medium ${value ? 'text-[#4ade80]' : 'text-[#64748b]'}`}>
          {value ? 'ON' : 'OFF'}
        </span>
      ) : type === 'secret' ? (
        <span className="text-xs text-[#94a3b8] font-mono">{'*'.repeat(8)}</span>
      ) : type === 'badge' ? (
        <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#1e293b] text-[#7dd3fc]">
          {String(value ?? '---')}
        </span>
      ) : (
        <span className="text-xs text-[#e2e8f0]">{String(value ?? '---')}</span>
      )}
    </div>
  )
}
