import { test } from '@playwright/test'
import {
  signInAsTeacher,
  resetStudentData,
  createActiveSubscription,
  getActiveSub,
  waitFor,
  STUDENT,
  expect,
} from './helpers'

test.describe('US-4 — edit pack size on an active pack', () => {
  test.beforeEach(async () => {
    await resetStudentData()
  })

  test('changes 5-pack with 3 remaining to 10-pack with pre-filled 8 remaining', async ({ page }) => {
    await createActiveSubscription({ packSize: 5, classesRemaining: 3 })

    await signInAsTeacher(page)
    await page.goto(`/teacher/students/${STUDENT.uid}`)

    await page.getByRole('button', { name: /edit pack/i }).click()
    await page.getByLabel(/new pack size/i).selectOption('10')
    // The dialog auto-pre-fills new remaining = 3 + (10 − 5) = 8
    await page.getByRole('button', { name: /confirm/i }).click()

    const sub = await waitFor(
      async () => {
        const s = await getActiveSub()
        return s && (s as Record<string, unknown>).packSize === 10 ? s : null
      },
      { description: 'sub resized to 10-pack' }
    )
    expect((sub as Record<string, unknown>).classesRemaining).toBe(8)
    expect((sub as Record<string, unknown>).isActive).toBe(true)
    const editHistory = (sub as Record<string, unknown>).editHistory as Record<string, unknown>[]
    expect(editHistory).toHaveLength(1)
    expect(editHistory[0].action).toBe('resize')
    expect(editHistory[0].oldValue).toEqual({ packSize: 5, classesRemaining: 3 })
    expect(editHistory[0].newValue).toEqual({ packSize: 10, classesRemaining: 8 })
  })
})
