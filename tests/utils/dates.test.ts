import { describe, it, expect } from 'vitest'
import { formatDateDDMMYYYY, getGreeting, getAESTDate } from '../../src/utils/dates'

describe('formatDateDDMMYYYY', () => {
  it('formats a date as DD/MM/YYYY', () => {
    const date = new Date('2026-03-25T10:00:00Z')
    expect(formatDateDDMMYYYY(date)).toBe('25/03/2026')
  })

  it('pads single-digit day and month', () => {
    const date = new Date('2026-01-05T10:00:00Z')
    expect(formatDateDDMMYYYY(date)).toBe('05/01/2026')
  })
})

describe('getGreeting', () => {
  it('returns Good morning before noon', () => {
    expect(getGreeting(9)).toBe('Good morning')
  })

  it('returns Good afternoon between noon and 5pm', () => {
    expect(getGreeting(14)).toBe('Good afternoon')
  })

  it('returns Good evening after 5pm', () => {
    expect(getGreeting(19)).toBe('Good evening')
  })
})
