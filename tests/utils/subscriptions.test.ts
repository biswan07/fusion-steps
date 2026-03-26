import { describe, it, expect } from 'vitest'
import { getBalanceColor, getBalanceLabel, isLowBalance } from '../../src/utils/subscriptions'

describe('getBalanceColor', () => {
  it('returns red for 0-2 classes', () => {
    expect(getBalanceColor(0)).toBe('red')
    expect(getBalanceColor(1)).toBe('red')
    expect(getBalanceColor(2)).toBe('red')
  })

  it('returns orange for 3-4 classes', () => {
    expect(getBalanceColor(3)).toBe('orange')
    expect(getBalanceColor(4)).toBe('orange')
  })

  it('returns green for 5+ classes', () => {
    expect(getBalanceColor(5)).toBe('green')
    expect(getBalanceColor(20)).toBe('green')
  })
})

describe('isLowBalance', () => {
  it('returns true for 2 or fewer', () => {
    expect(isLowBalance(2)).toBe(true)
    expect(isLowBalance(0)).toBe(true)
  })

  it('returns false for 3 or more', () => {
    expect(isLowBalance(3)).toBe(false)
  })
})
