/**
 * Quote Email Template Generator
 * Generates professional quote emails with all required information
 */

import { getScopeBullets } from './calculator.js';

/**
 * Generate quote email (plain text)
 * @param {Object} quoteResult - Result from calculateQuote()
 * @param {Object} businessData - Business/account information
 * @param {Object} contactData - Contact information
 * @param {Object} inputs - Original quote inputs
 * @returns {string} Plain text email
 */
export function generateQuoteEmail(quoteResult, businessData, contactData, inputs) {
  const businessName = businessData.name || businessData.company_name || 'Valued Client';
  const address = businessData.address || 'Your Location';
  const contactName = contactData.full_name || contactData.name || 'Dear Client';
  const contactEmail = contactData.email || '';
  const contactPhone = contactData.phone || '';
  
  const frequency = inputs.frequency_per_month || 4;
  const frequencyText = frequency === 4 ? 'Weekly' : 
                       frequency === 8 ? 'Twice Weekly' :
                       frequency === 12 ? 'Three Times Weekly' :
                       frequency + ' times per month';
  
  const scopeBullets = getScopeBullets(inputs.service_type, inputs);
  
  // Format currency
  const formatCurrency = (amount) => {
    return '$' + amount.toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };
  
  // Format service type for display
  const serviceTypeDisplay = inputs.service_type.replace(/_/g, ' ').split(' ').map(word => 
    word.charAt(0).toUpperCase() + word.slice(1)
  ).join(' ');
  
  const serviceTypeSimple = inputs.service_type.replace(/_/g, ' ');
  
  // Build assumptions line
  let assumptionsLine = 'This quote assumes up to ' + quoteResult.assumptions.sqft_cap.toLocaleString() + ' sq ft';
  if (quoteResult.assumptions.supplies_included) {
    assumptionsLine += ', all supplies included';
  }
  if (quoteResult.assumptions.healthcare_disinfection) {
    assumptionsLine += ', healthcare-focused disinfection on high-touch points';
  }
  assumptionsLine += '.';
  
  // Start date promise
  let startDatePromise = '';
  if (inputs.urgency_start_days !== undefined && inputs.urgency_start_days <= 7) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() + inputs.urgency_start_days);
    const startDateStr = startDate.toLocaleDateString('en-CA', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
    startDatePromise = '\n\nWe can begin service as early as ' + startDateStr + '.';
  }
  
  // Format scope bullets
  const scopeBulletsText = scopeBullets.map(bullet => '• ' + bullet).join('\n');
  
  // Build walkthrough message
  const walkthroughMessage = quoteResult.walkthrough_required 
    ? 'We recommend scheduling a site walkthrough to ensure we capture all specific requirements and provide the most accurate quote for your facility.'
    : 'No walkthrough required. If you\'re ready to proceed, simply reply to this email or give us a call to get started.';
  
  // Format date
  const generatedDate = new Date().toLocaleDateString('en-CA', { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });
  
  // Build email using string concatenation to avoid template literal issues
  const email = businessName + '\n' +
    address + '\n\n' +
    'Dear ' + contactName + ',\n\n' +
    'Thank you for your interest in Northern Facilities Group\'s commercial cleaning services. We\'re pleased to provide you with a quote for your ' + serviceTypeSimple + ' facility.\n\n' +
    'SERVICE DETAILS:\n' +
    '- Frequency: ' + frequencyText + ' (' + frequency + ' visits per month)\n' +
    '- Service Type: ' + serviceTypeDisplay + '\n\n' +
    'SCOPE OF SERVICES:\n' +
    scopeBulletsText + '\n\n' +
    'INVESTMENT:\n' +
    'Monthly Service Fee (ex-HST): ' + formatCurrency(quoteResult.monthly_price_ex_hst) + '\n' +
    'HST (13%): ' + formatCurrency(quoteResult.hst_amount) + '\n' +
    'Monthly Service Fee (inc-HST): ' + formatCurrency(quoteResult.monthly_price_inc_hst) + '\n' +
    'Per-Visit Rate: ' + formatCurrency(quoteResult.per_visit_price) + '\n\n' +
    assumptionsLine + startDatePromise + '\n\n' +
    'This quote is valid for ' + quoteResult.quote_valid_for_days + ' days from the date of this email.\n\n' +
    'NEXT STEPS:\n' +
    walkthroughMessage + '\n\n' +
    'We\'re here to answer any questions you may have. Please don\'t hesitate to reach out.\n\n' +
    'Best regards,\n\n' +
    'Northern Facilities Group\n' +
    'Phone: (416) 555-0100\n' +
    'Email: info@northernfacilitiesgroup.ca\n' +
    'Website: www.northernfacilitiesgroup.ca\n\n' +
    '---\n' +
    'This quote was generated on ' + generatedDate + '.';

  return email;
}

/**
 * Generate walkthrough welcome email
 * @param {Object} businessData - Business/account information
 * @param {Object} contactData - Contact information
 * @returns {string} Plain text email
 */
export function generateWalkthroughWelcomeEmail(businessData, contactData) {
  const businessName = businessData.name || businessData.company_name || 'Valued Client';
  const contactName = contactData.full_name || contactData.name || 'Dear Client';
  
  const email = businessName + '\n\n' +
    'Dear ' + contactName + ',\n\n' +
    'Thank you for your interest in Northern Facilities Group\'s commercial cleaning services!\n\n' +
    'We\'ve received your request and would love to learn more about your facility\'s specific needs. To provide you with the most accurate quote and service plan, we\'d like to schedule a complimentary site walkthrough.\n\n' +
    'During the walkthrough, we\'ll:\n' +
    '• Assess your facility\'s unique requirements\n' +
    '• Identify high-traffic areas and special considerations\n' +
    '• Discuss your cleaning priorities and schedule preferences\n' +
    '• Provide a detailed, customized quote\n\n' +
    'Our team will contact you within 24 hours to schedule a convenient time for the walkthrough.\n\n' +
    'In the meantime, if you have any questions or specific requirements you\'d like to discuss, please don\'t hesitate to reach out.\n\n' +
    'Best regards,\n\n' +
    'Northern Facilities Group\n' +
    'Phone: (416) 555-0100\n' +
    'Email: info@northernfacilitiesgroup.ca\n' +
    'Website: www.northernfacilitiesgroup.ca';

  return email;
}
