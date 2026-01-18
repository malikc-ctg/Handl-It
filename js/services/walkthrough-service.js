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
 * Send walkthrough welcome email via Resend
 * @param {Object} businessData - Business/account information
 * @param {Object} contactData - Contact information
 * @param {Object} options - Additional options including booking time
 * @param {string} options.bookingDate - Booking date (YYYY-MM-DD format)
 * @param {string} options.bookingTime - Booking time (HH:MM format)
 * @returns {Promise<boolean>} Success status
 */
export async function sendWalkthroughWelcomeEmail(businessData, contactData, options = {}) {
  try {
    // Generate email content (plain text)
    const emailContent = generateWalkthroughWelcomeEmail(businessData, contactData, options);
    
    const recipientEmail = contactData.email || contactData.contact_email;
    if (!recipientEmail) {
      throw new Error('Recipient email address is required');
    }

    const subject = 'Welcome to Northern Facilities Group';

    console.log('[Walkthrough Service] Sending welcome email via Resend...');
    console.log('To:', recipientEmail);
    console.log('Subject:', subject);

    // Send email via Supabase Edge Function (which uses Resend)
    const { data, error } = await supabase.functions.invoke('send-walkthrough-welcome-email', {
      method: 'POST',
      body: {
        to: recipientEmail,
        subject: subject,
        emailContent: emailContent,
        bookingDate: options.bookingDate || null,
        bookingTime: options.bookingTime || null,
      },
    });

    if (error) {
      console.error('[Walkthrough Service] Edge Function invoke error:', error);
      throw new Error(`Failed to call email service: ${error.message || JSON.stringify(error)}`);
    }

    // Handle both success and error responses
    if (data) {
      if (data.success) {
        console.log('[Walkthrough Service] Welcome email sent successfully via Resend!', data);
        return true;
      } else if (data.error) {
        console.error('[Walkthrough Service] Edge Function returned error:', data.error);
        throw new Error(data.error);
      }
    }

    throw new Error('Failed to send email: Unknown error from email service');
  } catch (error) {
    console.error('[Walkthrough Service] Error sending welcome email:', error);
    throw error;
  }
}
