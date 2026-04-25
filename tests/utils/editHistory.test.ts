import { describe, it, expect } from 'vitest'
import { formatEditEntry, actionLabel } from '../../src/utils/editHistory'
import type { EditEntry } from '../../src/types'

const baseEntry: EditEntry = {
  action: 'resize',
  editedBy: 'teacher-1',
  editedAt: new Date('2026-04-25T08:30:00+10:00'),
  oldValue: { packSize: 5, classesRemaining: 3 },
  newValue: { packSize: 10, classesRemaining: 8 },
}

describe('actionLabel', () => {
  it('describes resize with old→new sizes and remaining', () => {
    expect(actionLabel('resize', baseEntry)).toBe('Resized 5→10 (remaining 3→8)')
  })

  it('describes backdate-dates with date count', () => {
    const dates = [new Date('2026-04-20T00:00:00+10:00'), new Date('2026-04-21T00:00:00+10:00')]
    expect(
      actionLabel('backdate-dates', { ...baseEntry, action: 'backdate-dates', dates })
    ).toBe('Backdated 2 classes by date')
  })

  it('describes backdate-dates with singular for one', () => {
    expect(
      actionLabel('backdate-dates', {
        ...baseEntry,
        action: 'backdate-dates',
        dates: [new Date('2026-04-20T00:00:00+10:00')],
      })
    ).toBe('Backdated 1 class by date')
  })

  it('describes backdate-count with delta', () => {
    expect(
      actionLabel('backdate-count', {
        ...baseEntry,
        action: 'backdate-count',
        oldValue: { packSize: 10, classesRemaining: 10 },
        newValue: { packSize: 10, classesRemaining: 7 },
      })
    ).toBe('Backdated 3 classes by count')
  })
})

describe('formatEditEntry', () => {
  it('formats with AEST DD/MM/YYYY HH:mm and action label', () => {
    expect(formatEditEntry(baseEntry)).toBe('25/04/2026 08:30 — Resized 5→10 (remaining 3→8)')
  })
})
