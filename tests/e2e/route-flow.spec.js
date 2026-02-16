/**
 * E2E Test: Route Start/Stop and Door Outcomes Sync
 * Route create -> start -> door outcomes -> appointment set -> lead created -> follow-up task created
 * Skipped in CI: requires authenticated session and backend (Supabase).
 */

import { test, expect } from '@playwright/test'

test.describe('Route Flow', () => {
  test('complete route flow: create -> start -> outcomes -> appointment -> lead -> follow-up', async ({ page }) => {
    if (process.env.CI) test.skip(true, 'E2E requires authenticated session and backend')
    // Step 1: Create route
    await page.goto('/routes.html')
    await page.click('#create-route-btn')
    await page.waitForSelector('#create-route-modal:not(.hidden)', { state: 'visible', timeout: 10000 })

    await page.fill('#route-name', 'Downtown Route')
    await page.fill('#route-date', new Date().toISOString().split('T')[0])
    // Assign to Rep is required; use first option if any (empty in CI)
    const repSelect = page.locator('#route-assigned-rep')
    await repSelect.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {})
    const options = await page.locator('#route-assigned-rep option').allTextContents()
    if (options.filter(Boolean).length > 0) {
      await page.selectOption('#route-assigned-rep', { index: 1 })
    }

    await page.click('#create-route-form button[type="submit"]')
    
    // Step 2: Start route (may redirect to route-detail.html after create)
    await page.waitForURL(/route-detail\.html|routes\.html/, { timeout: 15000 }).catch(() => {})
    await page.click('button:has-text("Start Route")')
    await expect(page.locator('text=Route Active')).toBeVisible()
    
    // Step 3: Record door outcomes
    await page.click('button:has-text("Record Outcome")')
    await page.selectOption('select[name="outcome"]', 'not_home')
    await page.fill('textarea[name="notes"]', 'Left door hanger')
    await page.click('button:has-text("Save")')
    
    // Step 4: Set appointment
    await page.click('button:has-text("Set Appointment")')
    await page.fill('input[name="appointment_date"]', new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
    await page.fill('input[name="appointment_time"]', '10:00')
    await page.click('button:has-text("Confirm")')
    
    // Step 5: Verify lead created
    await page.goto('/sites.html')
    await expect(page.locator('text=123 Main St')).toBeVisible()
    
    // Step 6: Verify follow-up task created
    await page.goto('/jobs.html')
    await expect(page.locator('text=Follow-up: 123 Main St')).toBeVisible()
    
    // Step 7: Complete route
    await page.goto('/routes.html')
    await page.click('button:has-text("Complete Route")')
    await expect(page.locator('text=Route Completed')).toBeVisible()
  })
})
