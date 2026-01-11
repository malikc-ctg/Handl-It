/**
 * E2E Test: Route Start/Stop and Door Outcomes Sync
 * Route create -> start -> door outcomes -> appointment set -> lead created -> follow-up task created
 */

import { test, expect } from '@playwright/test'

test.describe('Route Flow', () => {
  test('complete route flow: create -> start -> outcomes -> appointment -> lead -> follow-up', async ({ page }) => {
    // Step 1: Create route
    await page.goto('/routes.html') // Would need routes page
    await page.click('button:has-text("New Route")')
    
    // Fill route form
    await page.fill('input[name="route_name"]', 'Downtown Route')
    await page.fill('input[name="date"]', new Date().toISOString().split('T')[0])
    
    // Add stops
    await page.click('button:has-text("Add Stop")')
    await page.fill('input[name="stop_address"]', '123 Main St')
    
    await page.click('button[type="submit"]')
    
    // Step 2: Start route
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
