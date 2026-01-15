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
                       `${frequency} times per month`;
  
  const scopeBullets = getScopeBullets(inputs.service_type, inputs);
  
  // Format currency
  const formatCurrency = (amount) => {
    return `$${amount.toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };
  
  // Format service type for display
  const formatServiceType = (serviceType) => {
    return serviceType.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };
  
  // Format scope bullets (avoid nested template literal)
  const scopeBulletsText = scopeBullets.map(bullet => '• ' + bullet).join('\n');
  
  // Build assumptions line
  let assumptionsLine = `This quote assumes up to ${quoteResult.assumptions.sqft_cap.toLocaleString()} sq ft`;
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
    startDatePromise = `\n\nWe can begin service as early as ${startDateStr}.`;
  }
  
  const serviceTypeDisplay = formatServiceType(inputs.service_type);
  const serviceTypeSimple = inputs.service_type.replace(/_/g, ' ');
  
  // Build email
  const email = `
${businessName}
${address}

Dear ${contactName},

Thank you for your interest in Northern Facilities Group's commercial cleaning services. We're pleased to provide you with a quote for your ${serviceTypeSimple} facility.

SERVICE DETAILS:
- Frequency: ${frequencyText} (${frequency} visits per month)
- Service Type: ${serviceTypeDisplay}

SCOPE OF SERVICES:
${scopeBulletsText}

INVESTMENT:
Monthly Service Fee (ex-HST): ${formatCurrency(quoteResult.monthly_price_ex_hst)}
HST (13%): ${formatCurrency(quoteResult.hst_amount)}
Monthly Service Fee (inc-HST): ${formatCurrency(quoteResult.monthly_price_inc_hst)}
Per-Visit Rate: ${formatCurrency(quoteResult.per_visit_price)}

${assumptionsLine}${startDatePromise}

This quote is valid for ${quoteResult.quote_valid_for_days} days from the date of this email.

NEXT STEPS:
${quoteResult.walkthrough_required ? 'We recommend scheduling a site walkthrough to ensure we capture all specific requirements and provide the most accurate quote for your facility.' : 'No walkthrough required. If you're ready to proceed, simply reply to this email or give us a call to get started.'}

We're here to answer any questions you may have. Please don't hesitate to reach out.

Best regards,

Northern Facilities Group
Phone: (416) 555-0100
Email: info@northernfacilitiesgroup.ca
Website: www.northernfacilitiesgroup.ca

---
This quote was generated on ${new Date().toLocaleDateString('en-CA', { year: 'numeric', month: 'long', day: 'numeric' })}.
`.trim();

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
  
  const email = `
${businessName}

Dear ${contactName},

Thank you for your interest in Northern Facilities Group's commercial cleaning services!

We've received your request and would love to learn more about your facility's specific needs. To provide you with the most accurate quote and service plan, we'd like to schedule a complimentary site walkthrough.

During the walkthrough, we'll:
• Assess your facility's unique requirements
• Identify high-traffic areas and special considerations
• Discuss your cleaning priorities and schedule preferences
• Provide a detailed, customized quote

Our team will contact you within 24 hours to schedule a convenient time for the walkthrough.

In the meantime, if you have any questions or specific requirements you'd like to discuss, please don't hesitate to reach out.

Best regards,

Northern Facilities Group
Phone: (416) 555-0100
Email: info@northernfacilitiesgroup.ca
Website: www.northernfacilitiesgroup.ca
`.trim();

  return email;
}
