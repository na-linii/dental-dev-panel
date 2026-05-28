import { useState, useEffect } from 'react'

interface ReminderScheduleEditorProps {
  hours: number[]
  onSave: (hours: number[]) => Promise<void>
  isLoading?: boolean
  error?: string | null
}

const sortHours = (xs: number[]) => [...xs].sort((a, b) => a - b)

export function ReminderScheduleEditor({ hours, onSave, isLoading = false, error = null }: ReminderScheduleEditorProps) {
  const [editHours, setEditHours] = useState<number[]>(sortHours(hours || [11, 17]))
  const [newHourInput, setNewHourInput] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(error)
  const [saveSuccess, setSaveSuccess] = useState(false)

  // Sync local state when parent's `hours` prop changes (e.g. after invalidateQueries refetch).
  useEffect(() => {
    setEditHours(sortHours(hours || [11, 17]))
  }, [hours])

  const handleAddHour = () => {
    const hour = parseInt(newHourInput, 10)
    if (isNaN(hour) || hour < 0 || hour > 23) {
      setSaveError('Hour must be between 0 and 23')
      return
    }
    if (editHours.includes(hour)) {
      setSaveError('This hour already exists')
      return
    }
    setEditHours(sortHours([...editHours, hour]))
    setNewHourInput('')
    setSaveError(null)
  }

  const handleRemoveHour = (hour: number) => {
    if (editHours.length <= 1) {
      setSaveError('Must keep at least one reminder hour')
      return
    }
    setEditHours(editHours.filter((h) => h !== hour))
    setSaveError(null)
  }

  const handleSave = async () => {
    if (editHours.length === 0) {
      setSaveError('Must have at least one reminder hour')
      return
    }
    setIsSaving(true)
    setSaveError(null)
    setSaveSuccess(false)
    try {
      await onSave(editHours)
      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 3000)
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Failed to save')
    } finally {
      setIsSaving(false)
    }
  }

  const handleCancel = () => {
    setEditHours(sortHours(hours || [11, 17]))
    setNewHourInput('')
    setSaveError(null)
  }

  const isModified =
    JSON.stringify(sortHours(editHours)) !== JSON.stringify(sortHours(hours || [11, 17]))

  return (
    <div className="bg-[#0a0a1a] rounded-lg p-4 space-y-4 border border-[#1e293b]">
      <div>
        <h4 className="text-xs font-semibold text-white uppercase tracking-wider mb-2">Reminder Schedule</h4>
        <p className="text-[10px] text-[#64748b] mb-3">
          Reminder hours (MSK). At least one hour is required.
        </p>

        {/* Current hours display */}
        <div className="flex flex-wrap gap-2 mb-4">
          {editHours.length === 0 ? (
            <span className="text-xs text-[#64748b]">No hours configured</span>
          ) : (
            editHours.map((hour) => (
              <div
                key={hour}
                className="flex items-center gap-2 bg-[#111127] border border-[#1e293b] rounded-lg px-3 py-1.5"
              >
                <span className="text-sm font-semibold text-white">
                  {String(hour).padStart(2, '0')}:00
                </span>
                {editHours.length > 1 && (
                  <button
                    onClick={() => handleRemoveHour(hour)}
                    className="text-[#f87171] hover:text-[#fca5a5] cursor-pointer text-sm font-bold ml-1"
                    title="Remove"
                  >
                    ✕
                  </button>
                )}
              </div>
            ))
          )}
        </div>

        {/* Add new hour */}
        <div className="flex items-center gap-2 mb-3">
          <input
            type="number"
            min="0"
            max="23"
            value={newHourInput}
            onChange={(e) => setNewHourInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleAddHour()}
            placeholder="Hour (0-23)"
            className="bg-[#111127] border border-[#1e293b] rounded px-2 py-1.5 text-white text-xs focus:outline-none focus:border-[#7dd3fc] w-20"
          />
          <button
            onClick={handleAddHour}
            disabled={!newHourInput || isLoading || isSaving}
            className="px-3 py-1.5 bg-[#1e293b] hover:bg-[#2a3f5f] text-white text-xs font-semibold rounded cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            +
          </button>
        </div>

        {/* Status messages */}
        {saveError && (
          <div className="px-3 py-1.5 bg-[#dc2626]/10 border border-[#dc2626]/20 rounded text-[10px] text-[#f87171] mb-2">
            {saveError}
          </div>
        )}
        {saveSuccess && (
          <div className="px-3 py-1.5 bg-[#052e16]/10 border border-[#4ade80]/20 rounded text-[10px] text-[#4ade80] mb-2">
            ✓ Saved successfully
          </div>
        )}

        {/* Action buttons */}
        {isModified && (
          <div className="flex gap-2 pt-2 border-t border-[#1e293b]">
            <button
              onClick={handleSave}
              disabled={isSaving || isLoading}
              className="flex-1 px-3 py-1.5 bg-[#22c55e] hover:bg-[#16a34a] text-[#0a0a1a] text-xs font-semibold rounded cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSaving ? 'Saving...' : 'Save Changes'}
            </button>
            <button
              onClick={handleCancel}
              disabled={isSaving || isLoading}
              className="flex-1 px-3 py-1.5 bg-[#1e293b] hover:bg-[#2a3f5f] text-white text-xs font-semibold rounded cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
