import { test, expect } from '@playwright/test'
import {
  signInAsTeacher,
  resetStudentData,
  createActiveSubscription,
  STUDENT,
} from './helpers'

test.describe('US-5 — edit history on student profile', () => {
  test.beforeEach(async () => {
    await resetStudentData()
  })

  test('renders entries in reverse chronological order', async ({ page }) => {
    await createActiveSubscription({ packSize: 5, classesRemaining: 5 })

    await signInAsTeacher(page)
    await page.goto(`/teacher/students/${STUDENT.uid}`)

    // Two edits in sequence: backdate-count(2) → resize(5→10).
    await page.getByRole('button', { name: /add past attendance/i }).click()
    await page.getByLabel(/already used/i).fill('2')
    await page.getByRole('button', { name: /confirm/i }).click()
    // Dialog closes once the callable resolves. Wait for that as the success signal.
    await expect(page.getByLabel(/already used/i)).toBeHidden({ timeout: 10_000 })

    // Tiny delay so editedAt timestamps are distinct (formatter is minute-resolution).
    await page.waitForTimeout(1100)

    await page.getByRole('button', { name: /edit pack/i }).click()
    await page.getByLabel(/new pack size/i).selectOption('10')
    await page.getByRole('button', { name: /confirm/i }).click()
    await expect(page.getByLabel(/new pack size/i)).toBeHidden({ timeout: 10_000 })

    // Expand history strip
    await page.getByRole('button', { name: /history/i }).click()

    // The most recent entry (resize) should appear before the older one (backdate-count)
    // in the rendered list. Testing-library would do reverse-DOM ordering; here we just
    // assert both labels are present and resize text appears before backdate text.
    const html = await page.content()
    const resizeIdx = html.indexOf('Resized 5→10')
    const backdateIdx = html.indexOf('Backdated 2 classes by count')
    expect(resizeIdx).toBeGreaterThan(-1)
    expect(backdateIdx).toBeGreaterThan(-1)
    expect(resizeIdx).toBeLessThan(backdateIdx)
  })
})
