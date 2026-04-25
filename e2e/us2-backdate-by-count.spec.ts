import { test } from '@playwright/test'
import {
  signInAsTeacher,
  resetStudentData,
  getActiveSub,
  getBackdatedAttendanceCount,
  STUDENT,
  expect,
} from './helpers'

test.describe('US-2 — backdate by count when assigning a new pack', () => {
  test.beforeEach(async () => {
    await resetStudentData()
  })

  test('creates a sub with classesRemaining = packSize − used and no attendance docs', async ({ page }) => {
    await signInAsTeacher(page)
    await page.goto(`/teacher/students/${STUDENT.uid}/subscribe`)

    await page.getByRole('button', { name: /10 classes/i }).click()
    await page.getByRole('button', { name: /already attended/i }).click()
    await page.getByRole('tab', { name: /by count/i }).click()
    await page.getByLabel(/already used/i).fill('3')
    await page.getByRole('button', { name: /assign pack/i }).click()

    await page.waitForURL(new RegExp(`/teacher/students/${STUDENT.uid}$`), { timeout: 15_000 })

    const sub = await getActiveSub()
    expect(sub).not.toBeNull()
    expect((sub as Record<string, unknown>).packSize).toBe(10)
    expect((sub as Record<string, unknown>).classesRemaining).toBe(7)
    expect((sub as Record<string, unknown>).isActive).toBe(true)
    const editHistory = (sub as Record<string, unknown>).editHistory as Record<string, unknown>[]
    expect(editHistory).toHaveLength(1)
    expect(editHistory[0].action).toBe('backdate-count')
    expect(editHistory[0].oldValue).toEqual({ packSize: 10, classesRemaining: 10 })
    expect(editHistory[0].newValue).toEqual({ packSize: 10, classesRemaining: 7 })

    expect(await getBackdatedAttendanceCount()).toBe(0)
  })

  test('flips isActive=false when usedCount equals packSize', async ({ page }) => {
    await signInAsTeacher(page)
    await page.goto(`/teacher/students/${STUDENT.uid}/subscribe`)

    await page.getByRole('button', { name: /5 classes/i }).click()
    await page.getByRole('button', { name: /already attended/i }).click()
    await page.getByRole('tab', { name: /by count/i }).click()
    await page.getByLabel(/already used/i).fill('5')
    await page.getByRole('button', { name: /assign pack/i }).click()

    await page.waitForURL(new RegExp(`/teacher/students/${STUDENT.uid}$`), { timeout: 15_000 })

    // No active sub because we set isActive=false at zero remaining.
    const active = await getActiveSub()
    expect(active).toBeNull()
  })
})
