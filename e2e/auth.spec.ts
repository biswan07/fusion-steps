import { test } from '@playwright/test'
import { signInAsTeacher, expect } from './helpers'

test.describe('auth — sanity', () => {
  test('teacher can sign in and see the dashboard', async ({ page }) => {
    await signInAsTeacher(page)
    await expect(page).toHaveURL(/\/teacher\/dashboard/)
  })
})
