import type { EditEntry, SubscriptionEditAction } from '../types'
import { formatDateDDMMYYYY, getAESTDate } from './dates'

export function actionLabel(action: SubscriptionEditAction, entry: EditEntry): string {
  if (action === 'resize') {
    const { oldValue, newValue } = entry
    return `Resized ${oldValue.packSize}→${newValue.packSize} (remaining ${oldValue.classesRemaining}→${newValue.classesRemaining})`
  }
  if (action === 'backdate-dates') {
    const n = entry.dates?.length ?? 0
    return `Backdated ${n} ${n === 1 ? 'class' : 'classes'} by date`
  }
  const n = entry.oldValue.classesRemaining - entry.newValue.classesRemaining
  return `Backdated ${n} ${n === 1 ? 'class' : 'classes'} by count`
}

/** Coerce Firestore Timestamp / millis-second / Date to a JS Date. */
function toDate(v: unknown): Date {
  if (v instanceof Date) return v
  if (v && typeof v === 'object' && 'toDate' in v && typeof (v as { toDate: () => Date }).toDate === 'function') {
    return (v as { toDate: () => Date }).toDate()
  }
  if (v && typeof v === 'object' && 'seconds' in v) {
    return new Date((v as { seconds: number }).seconds * 1000)
  }
  return new Date(0)
}

export function formatEditEntry(entry: EditEntry): string {
  const editedAt = toDate(entry.editedAt as unknown)
  const date = formatDateDDMMYYYY(editedAt)
  const aest = getAESTDate(editedAt)
  const hh = String(aest.getHours()).padStart(2, '0')
  const mm = String(aest.getMinutes()).padStart(2, '0')
  return `${date} ${hh}:${mm} — ${actionLabel(entry.action, entry)}`
}
