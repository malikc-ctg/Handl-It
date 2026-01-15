/**
 * Walkthrough Service
 * Handles walkthrough requests and welcome emails
 */

import { supabase } from '../supabase.js';
import { generateWalkthroughWelcomeEmail } from '../quote-engine/email-template.js';

/**
 * Create a walkthrough request (not a quote)
 * @param {Object} data - Walkthrough request data
 * @returns {Promise<Object>} Created walkthrough request
 */
export async function createWalkthroughRequest(data) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    // Create walkthrough request record
    // Note: You may want to create a walkthrough_requests table, or store in a different way
    // For now, we'll create a draft quote with special type
    const { data: walkthrough, error } = await supabase
      .from('quotes')
      .insert({
        account_id: data.account_id,
        primary_contact_id: data.primary_contact_id,
        deal_id: data.deal_id,
        quote_type: 'walkthrough_required',
        status: 'walkthrough_requested',
        created_by: user.id,
        metadata: {
          walkthrough_request: true,
          service_schedule: data.service_schedule,
          scope_summary: data.scope_summary,
          assumptions: data.assumptions,
          exclusions: data.exclusions
        }
      })
      .select()
      .single();

    if (error) throw error;

    return walkthrough;
  } catch (error) {
    console.error('[Walkthrough Service] Error creating walkthrough request:', error);
    throw error;
  }
}

/**
 * Send walkthrough welcome email
 * @param {Object} businessData - Business/account information
 * @param {Object} contactData - Contact information
 * @returns {Promise<boolean>} Success status
 */
export async function sendWalkthroughWelcomeEmail(businessData, contactData) {
  try {
    // Generate email content
    const emailContent = generateWalkthroughWelcomeEmail(businessData, contactData);
    
    // TODO: Integrate with your email service (SendGrid, AWS SES, etc.)
    // For now, we'll log it and you can implement the actual sending
    console.log('[Walkthrough Service] Welcome email generated:');
    console.log('To:', contactData.email || contactData.contact_email);
    console.log('Subject: Welcome to Northern Facilities Group - Let\'s Schedule Your Walkthrough');
    console.log('Content:', emailContent);
    
    // In production, you would:
    // 1. Call your email API
    // 2. Log the email send event
    // 3. Update the walkthrough request status
    
    return true;
  } catch (error) {
    console.error('[Walkthrough Service] Error sending welcome email:', error);
    throw error;
  }
}
