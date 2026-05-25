import { useState } from 'react'

interface ReminderScheduleEditorProps {
  times: number[] // e.g. [11, 17]
  onSave: (times: number[]) => Promise<void>
  primaryTime?: number // protected primary reminder (default 11)
  isLoading?: boolean
  error?: string | null
}

export function ReminderScheduleEditor({ times, onSave, primaryTime = 11, isLoading = false, error = null }: ReminderScheduleEditorProps) {
  const [editTimes, setEditTimes] = useState<number[]>(times || [11, 17])
  const [newTimeInput, setNewTimeInput] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(error)
  const [saveSuccess, setSaveSuccess] = useState(false)

  const handleAddTime = () => {
    const hour = parseInt(newTimeInput, 10)
    if (isNaN(hour) || hour < 0 || hour > 23) {
      setSaveError('Hour must be between 0 and 23')
      return
    }
    if (editTimes.includes(hour)) {
      setSaveError('This hour already exists')
      return
    }
    const sorted = [...editTimes, hour].sort((a, b) => a - b)
    setEditTimes(sorted)
    setNewTimeInput('')
    setSaveError(null)
  }

  const handleRemoveTime = (hour: number) => {
    // Cannot delete primary reminder time
    if (hour === primaryTime) {
      setSaveError(`Cannot delete primary reminder time (${String(primaryTime).padStart(2, '0')}:00)`)
      return
    }
    const newTimes = editTimes.filter(h => h !== hour)
    if (newTimes.length === 0) {
      setSaveError('Must keep at least one reminder time')
      return
    }
    setEditTimes(newTimes)
    setSaveError(null)
  }

  const handleSave = async () => {
    if (editTimes.length === 0) {
      setSaveError('Must have at least one reminder time')
      return
    }
    setIsSaving(true)
    setSaveError(null)
    setSaveSuccess(false)
    try {
      await onSave(editTimes)
      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 3000)
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Failed to save')
    } finally {
      setIsSaving(false)
    }
  }

  const handleCancel = () => {
    setEditTimes(times || [11, 17])
    setNewTimeInput('')
    setSaveError(null)
  }

  const isModified = JSON.stringify(editTimes.sort()) !== JSON.stringify((times || [11, 17]).sort())

  return (
    <div className="bg-[#0a0a1a] rounded-lg p-4 space-y-4 border border-[#1e293b]">
      <div>
        <h4 className="text-xs font-semibold text-white uppercase tracking-wider mb-2">Reminder Schedule</h4>
        <p className="text-[10px] text-[#64748b] mb-3">
          Current reminder times (MSK). Primary time ({String(primaryTime).padStart(2, '0')}:00) cannot be deleted.
        </p>

        {/* Current times display */}
        <div className="flex flex-wrap gap-2 mb-4">
          {editTimes.length === 0 ? (
            <span className="text-xs text-[#64748b]">No times configured</span>
          ) : (
            editTimes.map((hour, idx) => (
              <div
                key={hour}
                className="flex items-center gap-2 bg-[#111127] border border-[#1e293b] rounded-lg px-3 py-1.5"
              >
                <span className="text-sm font-semibold text-white">
                  {String(hour).padStart(2, '0')}:00
                </span>
                {hour === primaryTime ? (
                  <span className="text-[10px] text-[#fbbf24] ml-1">(primary)</span>
                ) : editTimes.length > 1 ? (
                  <button
                    onClick={() => handleRemoveTime(hour)}
                    className="text-[#f87171] hover:text-[#fca5a5] cursor-pointer text-sm font-bold ml-1"
                    title="Remove"
                  >
                    ✕
                  </button>
                ) : null}
              </div>
            ))
          )}
        </div>

        {/* Add new time */}
        <div className="flex items-center gap-2 mb-3">
          <input
            type="number"
            min="0"
            max="23"
            value={newTimeInput}
            onChange={(e) => setNewTimeInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleAddTime()}
            placeholder="Hour (0-23)"
            className="bg-[#111127] border border-[#1e293b] rounded px-2 py-1.5 text-white text-xs focus:outline-none focus:border-[#7dd3fc] w-20"
          />
          <button
            onClick={handleAddTime}
            disabled={!newTimeInput || isLoading || isSaving}
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
