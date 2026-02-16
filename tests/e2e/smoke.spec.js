/**
 * Smoke E2E: App and key pages load.
 * Always runs; flow tests are skipped in CI (require auth/backend).
 */

import { test, expect } from '@playwright/test'

test.describe('Smoke', () => {
  test('homepage loads', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveTitle(/NFG|Northern|Handl|Login|Sign/i)
  })

  test('routes page loads', async ({ page }) => {
    await page.goto('/routes.html')
    await expect(page.locator('h1, [class*="title"]').first()).toContainText(/Route/i, { timeout: 15000 })
  })
})
