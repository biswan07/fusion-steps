import { test } from '@playwright/test'
import {
  signInAsTeacher,
  resetStudentData,
  getActiveSub,
  getBackdatedAttendanceCount,
  waitFor,
  STUDENT,
  expect,
} from './helpers'

test.describe('US-1 — backdate by date when assigning a new pack', () => {
  test.beforeEach(async () => {
    await resetStudentData()
  })

  test('writes isBackdated attendance docs and trigger leaves classesRemaining = packSize − N', async ({ page }) => {
    await signInAsTeacher(page)
    await page.goto(`/teacher/students/${STUDENT.uid}/subscribe`)

    // Choose 10-pack
    await page.getByRole('button', { name: /10 classes/i }).click()

    // Open the "Already attended" section
    await page.getByRole('button', { name: /already attended/i }).click()

    // Default tab is "By date" — add 2 dates within the past 30 days.
    const today = new Date()
    function isoDaysAgo(days: number) {
      const d = new Date(today.getFullYear(), today.getMonth(), today.getDate())
      d.setDate(d.getDate() - days)
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    }

    await page.getByLabel(/add date/i).fill(isoDaysAgo(7))
    await page.getByRole('button', { name: /^add$/i }).click()
    await page.getByLabel(/add date/i).fill(isoDaysAgo(14))
    await page.getByRole('button', { name: /^add$/i }).click()

    await page.getByRole('button', { name: /assign pack/i }).click()

    // Lands on the student profile after submit
    await page.waitForURL(new RegExp(`/teacher/students/${STUDENT.uid}$`), { timeout: 15_000 })

    // Two attendance docs exist with isBackdated=true
    await waitFor(async () => (await getBackdatedAttendanceCount()) === 2 ? true : null, {
      description: 'two backdated attendance docs',
    })

    // Trigger ran twice, decremented FIFO from 10 → 8, appended 2 backdate-dates entries
    const sub = await waitFor(
      async () => {
        const s = await getActiveSub()
        return s && (s as Record<string, unknown>).classesRemaining === 8 ? s : null
      },
      { description: 'active sub at 8 remaining after two backdated triggers' }
    )

    expect((sub as Record<string, unknown>).packSize).toBe(10)
    expect((sub as Record<string, unknown>).classesRemaining).toBe(8)
    expect((sub as Record<string, unknown>).isActive).toBe(true)
    const editHistory = (sub as Record<string, unknown>).editHistory as Record<string, unknown>[]
    expect(editHistory).toBeInstanceOf(Array)
    expect(editHistory.length).toBe(2)
    expect(editHistory.every((e) => e.action === 'backdate-dates')).toBe(true)
  })
})
