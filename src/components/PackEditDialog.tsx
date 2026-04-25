import { useMemo, useState } from 'react'
import type { PackSize } from '../types'
import { formatDateDDMMYYYY, getAESTDate } from '../utils/dates'

const VALID_SIZES: PackSize[] = [5, 10, 20]
const MAX_BACKDATE_DAYS = 90

export type PackEditMode = 'resize' | 'backdate-count' | 'backdate-dates'

export type PackEditConfirmPayload =
  | { mode: 'resize'; newPackSize: PackSize; newClassesRemaining: number }
  | { mode: 'backdate-count'; usedCount: number }
  | { mode: 'backdate-dates'; dates: Date[] }

interface Props {
  mode: PackEditMode
  currentPackSize: PackSize
  currentRemaining: number
  onClose: () => void
  onConfirm: (payload: PackEditConfirmPayload) => Promise<void>
}

function isoDate(d: Date): string {
  const aest = getAESTDate(d)
  const y = aest.getFullYear()
  const m = String(aest.getMonth() + 1).padStart(2, '0')
  const day = String(aest.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function PackEditDialog({
  mode, currentPackSize, currentRemaining, onClose, onConfirm,
}: Props) {
  const today = useMemo(() => getAESTDate(new Date()), [])
  const minDate = useMemo(() => {
    const d = new Date(today)
    d.setDate(d.getDate() - MAX_BACKDATE_DAYS)
    return d
  }, [today])

  const [newPackSize, setNewPackSize] = useState<PackSize>(currentPackSize)
  const [newRemaining, setNewRemaining] = useState<number>(currentRemaining)
  function changePackSize(size: PackSize) {
    setNewPackSize(size)
    const delta = size - currentPackSize
    setNewRemaining(Math.max(0, Math.min(size, currentRemaining + delta)))
  }

  const [usedCount, setUsedCount] = useState<number>(0)

  const [dates, setDates] = useState<Date[]>([])
  const [pickerValue, setPickerValue] = useState<string>(isoDate(today))
  function addDate() {
    if (!pickerValue) return
    const [y, m, d] = pickerValue.split('-').map(Number)
    const candidate = new Date(y, m - 1, d)
    const minDay = new Date(minDate.getFullYear(), minDate.getMonth(), minDate.getDate())
    const todayDay = new Date(today.getFullYear(), today.getMonth(), today.getDate())
    if (candidate < minDay || candidate > todayDay) return
    if (dates.some((existing) => isoDate(existing) === pickerValue)) return
    setDates([...dates, candidate])
  }
  function removeDate(target: Date) {
    setDates(dates.filter((d) => isoDate(d) !== isoDate(target)))
  }

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const canConfirm = (() => {
    if (submitting) return false
    if (mode === 'resize') {
      const validSize = VALID_SIZES.includes(newPackSize)
      const validRemaining = newRemaining >= 0 && newRemaining <= newPackSize
      const differs = newPackSize !== currentPackSize || newRemaining !== currentRemaining
      return validSize && validRemaining && differs
    }
    if (mode === 'backdate-count') {
      return Number.isInteger(usedCount) && usedCount >= 1 && usedCount <= currentRemaining
    }
    return dates.length >= 1 && dates.length <= currentRemaining
  })()

  async function handleConfirm() {
    if (!canConfirm) return
    setSubmitting(true)
    setError(null)
    try {
      if (mode === 'resize') {
        await onConfirm({ mode, newPackSize, newClassesRemaining: newRemaining })
      } else if (mode === 'backdate-count') {
        await onConfirm({ mode, usedCount })
      } else {
        await onConfirm({ mode, dates })
      }
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save changes.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 px-4 pb-8">
      <div className="w-full max-w-sm rounded-2xl bg-[#1A1A2E] border border-white/10 p-6 space-y-4">
        <h3 className="text-base font-semibold">
          {mode === 'resize' && 'Edit pack size'}
          {mode === 'backdate-count' && 'Backdate by count'}
          {mode === 'backdate-dates' && 'Backdate by date'}
        </h3>

        {mode === 'resize' && (
          <>
            <div className="text-sm text-white/60">
              Current: {currentPackSize}-pack, {currentRemaining} remaining
            </div>
            <label className="block">
              <span className="text-xs uppercase tracking-wider text-[#00BCD4]">New pack size</span>
              <select
                aria-label="New pack size"
                className="mt-1 w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-sm"
                value={newPackSize}
                onChange={(e) => changePackSize(Number(e.target.value) as PackSize)}
              >
                {VALID_SIZES.map((s) => (
                  <option key={s} value={s}>{s}-class pack</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-xs uppercase tracking-wider text-[#00BCD4]">New remaining</span>
              <input
                aria-label="New remaining"
                type="number"
                min={0}
                max={newPackSize}
                value={newRemaining}
                onChange={(e) => setNewRemaining(Number(e.target.value))}
                className="mt-1 w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-sm"
              />
            </label>
          </>
        )}

        {mode === 'backdate-count' && (
          <label className="block">
            <span className="text-xs uppercase tracking-wider text-[#00BCD4]">Already used</span>
            <input
              aria-label="Already used"
              type="number"
              min={0}
              max={currentRemaining}
              value={usedCount}
              onChange={(e) => setUsedCount(Number(e.target.value))}
              className="mt-1 w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-sm"
            />
            <span className="mt-1 block text-xs text-white/40">
              Out of {currentRemaining} remaining
            </span>
          </label>
        )}

        {mode === 'backdate-dates' && (
          <>
            <div className="flex items-end gap-2">
              <label className="flex-1">
                <span className="text-xs uppercase tracking-wider text-[#00BCD4]">Add date</span>
                <input
                  aria-label="Add date"
                  type="date"
                  min={isoDate(minDate)}
                  max={isoDate(today)}
                  value={pickerValue}
                  onChange={(e) => setPickerValue(e.target.value)}
                  className="mt-1 w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-sm"
                />
              </label>
              <button
                type="button"
                onClick={addDate}
                className="rounded-xl bg-[#7B2D8B] px-4 py-2 text-sm"
              >
                Add
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {dates.map((d) => {
                const label = formatDateDDMMYYYY(d)
                return (
                  <button
                    key={isoDate(d)}
                    type="button"
                    onClick={() => removeDate(d)}
                    aria-label={`Remove ${label}`}
                    className="rounded-full bg-white/10 px-3 py-1 text-xs"
                  >
                    {label} ✕
                  </button>
                )
              })}
            </div>
            <div className="text-xs text-white/40">
              {dates.length}/{currentRemaining} max
            </div>
          </>
        )}

        {error && (
          <div className="rounded-xl bg-red-500/15 border border-red-500/30 px-3 py-2 text-sm text-red-400">
            {error}
          </div>
        )}

        <div className="flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-xl border border-white/20 py-2.5 text-sm font-medium text-white/70"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!canConfirm}
            className="flex-1 rounded-xl bg-[#FF6F00] py-2.5 text-sm font-semibold text-white disabled:opacity-50"
          >
            {submitting ? 'Saving…' : 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  )
}
