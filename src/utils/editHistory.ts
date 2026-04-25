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

export function formatEditEntry(entry: EditEntry): string {
  const date = formatDateDDMMYYYY(entry.editedAt)
  const aest = getAESTDate(entry.editedAt)
  const hh = String(aest.getHours()).padStart(2, '0')
  const mm = String(aest.getMinutes()).padStart(2, '0')
  return `${date} ${hh}:${mm} — ${actionLabel(entry.action, entry)}`
}
