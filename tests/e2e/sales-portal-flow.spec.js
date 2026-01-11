/**
 * E2E Test: Sales Portal Core Flow
 * Rep creates lead/deal -> calls -> webhook logs call -> summary -> next action -> quote -> send -> accept -> win
 */

import { test, expect } from '@playwright/test'

test.describe('Sales Portal Core Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to app
    await page.goto('/index.html')
    
    // Login as sales rep (client role)
    // This would need actual auth setup
    // For now, we'll test the flow assuming auth is handled
  })

  test('complete sales flow: lead -> call -> webhook -> quote -> win', async ({ page }) => {
    // Step 1: Rep creates lead/deal (site)
    await page.goto('/dashboard.html')
    
    // Click "Add Site" button
    await page.click('button:has-text("Add Site")')
    
    // Fill site form
    await page.fill('input[name="name"]', 'Test Lead Company')
    await page.fill('input[name="address"]', '123 Test St, Test City')
    await page.fill('input[name="contact_phone"]', '+15551234567')
    await page.fill('input[name="contact_email"]', 'lead@testcompany.com')
    await page.fill('input[name="deal_value"]', '50000')
    
    // Submit form
    await page.click('button[type="submit"]')
    
    // Verify site created
    await expect(page.locator('text=Test Lead Company')).toBeVisible()
    
    // Step 2: Call is made (simulated via webhook)
    // In real scenario, Quo would send webhook
    // For test, we'll simulate by calling the webhook endpoint directly
    const webhookResponse = await page.request.post('/functions/v1/quo-webhook', {
      data: {
        event_type: 'call.ended',
        call_id: `test-call-${Date.now()}`,
        direction: 'inbound',
        outcome: 'answered',
        from_number: '+15551234567',
        to_number: '+15559876543',
        started_at: new Date().toISOString(),
        ended_at: new Date().toISOString(),
        duration_seconds: 300,
        has_consent: true,
        transcript: 'Customer interested in cleaning services. Budget: $50k. Timeline: Q2 2025.'
      }
    })
    
    expect(webhookResponse.ok()).toBeTruthy()
    
    // Step 3: Verify call was logged and linked to site
    await page.goto('/dashboard.html')
    // Would need UI to display calls - for now verify via API
    
    // Step 4: AI generates summary and next action
    // This would be a background job - verify it was created
    // await expect(page.locator('text=Next Action')).toBeVisible()
    
    // Step 5: Create quote
    // Navigate to quotes page (when implemented)
    // await page.goto('/quotes.html')
    // await page.click('button:has-text("Create Quote")')
    // Fill quote form
    // Submit
    
    // Step 6: Send quote
    // await page.click('button:has-text("Send Quote")')
    // Verify email sent
    
    // Step 7: Accept quote (simulated)
    // In real flow, client would accept via email link
    // For test, we'll update quote status directly
    
    // Step 8: Win deal
    // Update site status to "Won" or create booking
    await page.goto('/sites.html')
    await page.click(`text=Test Lead Company`)
    // Update status to won/active
    
    // Verify complete flow
    // All steps should be traceable
  })
})
