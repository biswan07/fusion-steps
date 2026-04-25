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

test.describe('US-3 — backdate by count on an existing active pack', () => {
  test.beforeEach(async () => {
    await resetStudentData()
  })

  test('decrements classesRemaining via editSubscription callable and appends editHistory', async ({ page }) => {
    await createActiveSubscription({ packSize: 10, classesRemaining: 10 })

    await signInAsTeacher(page)
    await page.goto(`/teacher/students/${STUDENT.uid}`)

    await page.getByRole('button', { name: /add past attendance/i }).click()
    await page.getByLabel(/already used/i).fill('2')
    await page.getByRole('button', { name: /confirm/i }).click()

    const sub = await waitFor(
      async () => {
        const s = await getActiveSub()
        return s && (s as Record<string, unknown>).classesRemaining === 8 ? s : null
      },
      { description: 'sub decremented to 8' }
    )
    const editHistory = (sub as Record<string, unknown>).editHistory as Record<string, unknown>[]
    expect(editHistory).toHaveLength(1)
    expect(editHistory[0].action).toBe('backdate-count')
    expect(editHistory[0].oldValue).toEqual({ packSize: 10, classesRemaining: 10 })
    expect(editHistory[0].newValue).toEqual({ packSize: 10, classesRemaining: 8 })
  })
})
