/**
 * Sales Tools & Resources Module
 * Handles calculators, templates, and resources for the sales portal
 */

import { supabase } from './supabase.js';
import { toast } from './notifications.js';

// ==========================================
// ROI CALCULATOR
// ==========================================
export function openROICalculator() {
  const modal = document.getElementById('roi-calculator-modal');
  if (modal) {
    modal.classList.remove('hidden');
    if (window.lucide) lucide.createIcons();
    // Reset form
    document.getElementById('roi-current-cost')?.value = '';
    document.getElementById('roi-proposed-cost')?.value = '';
    document.getElementById('roi-setup-cost')?.value = '';
    document.getElementById('roi-results')?.classList.add('hidden');
  }
}

export function calculateROI() {
  const currentCost = parseFloat(document.getElementById('roi-current-cost')?.value || 0);
  const proposedCost = parseFloat(document.getElementById('roi-proposed-cost')?.value || 0);
  const setupCost = parseFloat(document.getElementById('roi-setup-cost')?.value || 0);

  if (!currentCost || !proposedCost) {
    toast.error('Please enter current and proposed monthly costs', 'Error');
    return;
  }

  const monthlySavings = currentCost - proposedCost;
  const annualSavings = monthlySavings * 12;
  const totalFirstYearSavings = annualSavings - setupCost;
  const roiPercentage = setupCost > 0 ? ((totalFirstYearSavings / setupCost) * 100).toFixed(1) : '∞';
  const paybackMonths = monthlySavings > 0 ? (setupCost / monthlySavings).toFixed(1) : 'N/A';

  const resultsDiv = document.getElementById('roi-results');
  if (resultsDiv) {
    resultsDiv.classList.remove('hidden');
    resultsDiv.innerHTML = `
      <div class="space-y-4">
        <div class="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
          <div class="flex items-center justify-between mb-2">
            <span class="text-sm font-medium text-gray-700 dark:text-gray-300">Monthly Savings</span>
            <span class="text-lg font-bold text-green-600 dark:text-green-400">$${monthlySavings.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          </div>
          <div class="flex items-center justify-between mb-2">
            <span class="text-sm font-medium text-gray-700 dark:text-gray-300">Annual Savings</span>
            <span class="text-lg font-bold text-green-600 dark:text-green-400">$${annualSavings.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          </div>
          <div class="flex items-center justify-between mb-2">
            <span class="text-sm font-medium text-gray-700 dark:text-gray-300">First Year Savings (after setup)</span>
            <span class="text-lg font-bold text-green-600 dark:text-green-400">$${totalFirstYearSavings.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          </div>
          <div class="flex items-center justify-between">
            <span class="text-sm font-medium text-gray-700 dark:text-gray-300">ROI</span>
            <span class="text-lg font-bold text-green-600 dark:text-green-400">${roiPercentage}%</span>
          </div>
        </div>
        <div class="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <div class="flex items-center justify-between">
            <span class="text-sm font-medium text-gray-700 dark:text-gray-300">Payback Period</span>
            <span class="text-lg font-bold text-blue-600 dark:text-blue-400">${paybackMonths} months</span>
          </div>
        </div>
      </div>
    `;
  }
}

// ==========================================
// COMMISSION CALCULATOR
// ==========================================
export async function openCommissionCalculator() {
  try {
    // Get current user profile to check role
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error('Not authenticated', 'Error');
      return;
    }

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    // Check if user has access (reps, managers, admins)
    if (!profile || !['rep', 'manager', 'admin', 'super_admin'].includes(profile.role)) {
      toast.warning('Commission calculator is only available for sales reps and managers', 'Access Restricted');
      return;
    }

    const modal = document.getElementById('commission-calculator-modal');
    if (modal) {
      modal.classList.remove('hidden');
      if (window.lucide) lucide.createIcons();
      // Reset form
      document.getElementById('commission-deal-value')?.value = '';
      document.getElementById('commission-rate')?.value = '10'; // Default 10%
      document.getElementById('commission-results')?.classList.add('hidden');
    }
  } catch (error) {
    console.error('[Sales Tools] Error opening commission calculator:', error);
    toast.error('Failed to open commission calculator', 'Error');
  }
}

export function calculateCommission() {
  const dealValue = parseFloat(document.getElementById('commission-deal-value')?.value || 0);
  const rate = parseFloat(document.getElementById('commission-rate')?.value || 0);

  if (!dealValue || dealValue <= 0) {
    toast.error('Please enter a valid deal value', 'Error');
    return;
  }

  if (!rate || rate <= 0 || rate > 100) {
    toast.error('Please enter a valid commission rate (0-100%)', 'Error');
    return;
  }

  const commission = (dealValue * rate) / 100;

  const resultsDiv = document.getElementById('commission-results');
  if (resultsDiv) {
    resultsDiv.classList.remove('hidden');
    resultsDiv.innerHTML = `
      <div class="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
        <div class="flex items-center justify-between mb-2">
          <span class="text-sm font-medium text-gray-700 dark:text-gray-300">Deal Value</span>
          <span class="text-lg font-bold text-gray-900 dark:text-white">$${dealValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
        </div>
        <div class="flex items-center justify-between mb-2">
          <span class="text-sm font-medium text-gray-700 dark:text-gray-300">Commission Rate</span>
          <span class="text-lg font-bold text-gray-900 dark:text-white">${rate}%</span>
        </div>
        <div class="border-t border-green-200 dark:border-green-800 pt-2 mt-2">
          <div class="flex items-center justify-between">
            <span class="text-base font-semibold text-gray-900 dark:text-white">Your Commission</span>
            <span class="text-2xl font-bold text-green-600 dark:text-green-400">$${commission.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          </div>
        </div>
      </div>
    `;
  }
}

// ==========================================
// PRICING GUIDE
// ==========================================
export function openPricingGuide() {
  const modal = document.getElementById('pricing-guide-modal');
  if (modal) {
    modal.classList.remove('hidden');
    if (window.lucide) lucide.createIcons();
    loadPricingGuide();
  }
}

async function loadPricingGuide() {
  // This could load from database or use static data
  const pricingData = [
    { service: 'Commercial Cleaning', frequency: 'Weekly', priceRange: '$500 - $2,000/month' },
    { service: 'Commercial Cleaning', frequency: 'Bi-weekly', priceRange: '$300 - $1,500/month' },
    { service: 'Commercial Cleaning', frequency: 'Monthly', priceRange: '$200 - $1,000/month' },
    { service: 'Window Cleaning', frequency: 'Monthly', priceRange: '$150 - $800/month' },
    { service: 'Carpet Cleaning', frequency: 'Quarterly', priceRange: '$300 - $1,200/visit' },
    { service: 'Deep Cleaning', frequency: 'One-time', priceRange: '$500 - $3,000' },
    { service: 'Floor Care', frequency: 'Monthly', priceRange: '$400 - $1,500/month' },
    { service: 'Restroom Sanitization', frequency: 'Weekly', priceRange: '$200 - $800/month' }
  ];

  const tbody = document.getElementById('pricing-guide-table-body');
  if (tbody) {
    tbody.innerHTML = pricingData.map(item => `
      <tr class="border-b border-nfgray dark:border-gray-700">
        <td class="px-4 py-3 font-medium text-gray-900 dark:text-white">${item.service}</td>
        <td class="px-4 py-3 text-gray-600 dark:text-gray-400">${item.frequency}</td>
        <td class="px-4 py-3 text-nfgblue dark:text-blue-400 font-semibold">${item.priceRange}</td>
      </tr>
    `).join('');
  }
}

// ==========================================
// EMAIL TEMPLATES
// ==========================================
export function openEmailTemplates() {
  const modal = document.getElementById('email-templates-modal');
  if (modal) {
    modal.classList.remove('hidden');
    if (window.lucide) lucide.createIcons();
    loadEmailTemplates();
  }
}

function loadEmailTemplates() {
  const templates = [
    {
      id: 'follow-up-1',
      name: 'Follow-up After Meeting',
      category: 'Follow-up',
      content: `Subject: Following Up on Our Discussion

Hi [Name],

Thank you for taking the time to meet with me today. I wanted to follow up on our conversation about [topic].

As discussed, I've attached the proposal we reviewed. Please let me know if you have any questions or would like to schedule a follow-up call.

I'm available at [your phone] or [your email] to discuss next steps.

Best regards,
[Your Name]`
    },
    {
      id: 'proposal-1',
      name: 'Proposal Submission',
      category: 'Proposal',
      content: `Subject: Proposal for [Company Name]

Hi [Name],

I'm excited to share our proposal for [service type]. Based on our discussion, I've prepared a customized solution that addresses your specific needs.

Key highlights:
- [Benefit 1]
- [Benefit 2]
- [Benefit 3]

The proposal is attached for your review. I'd be happy to walk through it with you at your convenience.

Looking forward to your feedback.

Best regards,
[Your Name]`
    },
    {
      id: 'thank-you-1',
      name: 'Thank You After Deal',
      category: 'Thank You',
      content: `Subject: Thank You for Your Business

Hi [Name],

Thank you for choosing [Company Name]! We're thrilled to have you as a client and look forward to serving you.

Your account manager, [Manager Name], will be in touch shortly to coordinate the onboarding process.

If you have any questions in the meantime, please don't hesitate to reach out.

Thank you again for your trust in us.

Best regards,
[Your Name]`
    }
  ];

  const container = document.getElementById('email-templates-list');
  if (container) {
    container.innerHTML = templates.map(template => `
      <div class="border border-nfgray dark:border-gray-700 rounded-lg p-4 hover:bg-nfglight dark:hover:bg-gray-700 transition cursor-pointer" onclick="window.salesTools?.viewEmailTemplate('${template.id}')">
        <div class="flex items-start justify-between mb-2">
          <div>
            <h4 class="font-semibold text-gray-900 dark:text-white">${template.name}</h4>
            <span class="text-xs text-gray-500 dark:text-gray-400">${template.category}</span>
          </div>
          <button class="text-nfgblue dark:text-blue-400 hover:text-nfgdark dark:hover:text-blue-300" onclick="event.stopPropagation(); window.salesTools?.copyEmailTemplate('${template.id}')">
            <i data-lucide="copy" class="w-4 h-4"></i>
          </button>
        </div>
        <p class="text-sm text-gray-600 dark:text-gray-400 line-clamp-2">${template.content.substring(0, 100)}...</p>
      </div>
    `).join('');
    if (window.lucide) lucide.createIcons();
  }
}

export function viewEmailTemplate(templateId) {
  // This would show full template in a modal or expand view
  toast.info('Template viewer coming soon', 'Info');
}

export function copyEmailTemplate(templateId) {
  // This would copy template to clipboard
  toast.success('Template copied to clipboard', 'Success');
}

// ==========================================
// CALL SCRIPTS
// ==========================================
export function openCallScripts() {
  const modal = document.getElementById('call-scripts-modal');
  if (modal) {
    modal.classList.remove('hidden');
    if (window.lucide) lucide.createIcons();
    loadCallScripts();
  }
}

function loadCallScripts() {
  const scripts = [
    {
      id: 'cold-call',
      name: 'Cold Call Script',
      category: 'Cold Call',
      content: `Opening:
"Hi [Name], this is [Your Name] from [Company]. I'm reaching out because we help businesses like yours [benefit]. Do you have a quick minute?"

Discovery Questions:
- What's your biggest challenge with [relevant area]?
- How are you currently handling [service]?
- What would make the biggest difference for your business?

Value Proposition:
"Based on what you've told me, I think we could help you [specific benefit]. Would you be open to a brief conversation about how this might work for you?"

Close:
"Great! How does [day/time] work for you? I can send you a calendar invite."`
    },
    {
      id: 'follow-up',
      name: 'Follow-up Call Script',
      category: 'Follow-up',
      content: `Opening:
"Hi [Name], this is [Your Name] following up on [previous interaction]. I wanted to check in and see if you had any questions about [topic]."

Check-in:
- Did you have a chance to review [material]?
- What are your thoughts so far?
- Are there any concerns I can address?

Next Steps:
"Based on our conversation, I think the next step would be [action]. Does that work for you?"`
    },
    {
      id: 'objection-handling',
      name: 'Objection Handling',
      category: 'Objections',
      content: `Common Objections & Responses:

"We're not interested"
"I understand. Many of our clients felt the same way initially. What specifically concerns you?"

"It's too expensive"
"I appreciate that concern. Let me show you the ROI - most clients see [benefit] within [timeframe]. Would that make it worthwhile?"

"We already have a provider"
"That's great! What do you like about your current provider? What would you change if you could?"

"We need to think about it"
"Of course. What specific information would help you make a decision? I'm happy to provide that."`
    }
  ];

  const container = document.getElementById('call-scripts-list');
  if (container) {
    container.innerHTML = scripts.map(script => `
      <div class="border border-nfgray dark:border-gray-700 rounded-lg p-4 hover:bg-nfglight dark:hover:bg-gray-700 transition">
        <div class="flex items-start justify-between mb-3">
          <div>
            <h4 class="font-semibold text-gray-900 dark:text-white mb-1">${script.name}</h4>
            <span class="text-xs text-gray-500 dark:text-gray-400">${script.category}</span>
          </div>
          <button class="text-nfgblue dark:text-blue-400 hover:text-nfgdark dark:hover:text-blue-300" onclick="window.salesTools?.copyCallScript('${script.id}')">
            <i data-lucide="copy" class="w-4 h-4"></i>
          </button>
        </div>
        <div class="text-sm text-gray-600 dark:text-gray-400 whitespace-pre-line">${script.content}</div>
      </div>
    `).join('');
    if (window.lucide) lucide.createIcons();
  }
}

export function copyCallScript(scriptId) {
  toast.success('Script copied to clipboard', 'Success');
}

// ==========================================
// QUOTE TEMPLATES
// ==========================================
export function openQuoteTemplates() {
  // This would link to the Quotes tab and show templates
  if (window.switchTab) {
    window.switchTab('quotes');
    toast.info('Navigate to Quotes tab to access templates', 'Info');
  }
}

// ==========================================
// TRAINING & DOCUMENTATION
// ==========================================
export function openSalesPlaybooks() {
  const modal = document.getElementById('sales-playbooks-modal');
  if (modal) {
    modal.classList.remove('hidden');
    if (window.lucide) lucide.createIcons();
    loadSalesPlaybooks();
  }
}

function loadSalesPlaybooks() {
  const playbooks = [
    { name: 'Discovery Process', description: 'Step-by-step guide to uncovering customer needs' },
    { name: 'Proposal Best Practices', description: 'How to create winning proposals' },
    { name: 'Closing Techniques', description: 'Effective closing strategies and tactics' },
    { name: 'Objection Handling', description: 'How to address common objections' },
    { name: 'Follow-up Sequences', description: 'Best practices for follow-up communication' }
  ];

  const container = document.getElementById('sales-playbooks-list');
  if (container) {
    container.innerHTML = playbooks.map(playbook => `
      <div class="border border-nfgray dark:border-gray-700 rounded-lg p-4 hover:bg-nfglight dark:hover:bg-gray-700 transition cursor-pointer">
        <h4 class="font-semibold text-gray-900 dark:text-white mb-1">${playbook.name}</h4>
        <p class="text-sm text-gray-600 dark:text-gray-400">${playbook.description}</p>
      </div>
    `).join('');
  }
}

export function openProductKnowledge() {
  const modal = document.getElementById('product-knowledge-modal');
  if (modal) {
    modal.classList.remove('hidden');
    if (window.lucide) lucide.createIcons();
    loadProductKnowledge();
  }
}

function loadProductKnowledge() {
  const products = [
    { name: 'Commercial Cleaning', description: 'Comprehensive cleaning services for commercial spaces' },
    { name: 'Window Cleaning', description: 'Professional window cleaning for all building types' },
    { name: 'Carpet Cleaning', description: 'Deep cleaning and maintenance for carpets' },
    { name: 'Floor Care', description: 'Stripping, waxing, and maintenance services' },
    { name: 'Restroom Sanitization', description: 'Specialized sanitization and maintenance' }
  ];

  const container = document.getElementById('product-knowledge-list');
  if (container) {
    container.innerHTML = products.map(product => `
      <div class="border border-nfgray dark:border-gray-700 rounded-lg p-4 hover:bg-nfglight dark:hover:bg-gray-700 transition cursor-pointer">
        <h4 class="font-semibold text-gray-900 dark:text-white mb-1">${product.name}</h4>
        <p class="text-sm text-gray-600 dark:text-gray-400">${product.description}</p>
      </div>
    `).join('');
  }
}

export function openVideoTutorials() {
  const modal = document.getElementById('video-tutorials-modal');
  if (modal) {
    modal.classList.remove('hidden');
    if (window.lucide) lucide.createIcons();
    loadVideoTutorials();
  }
}

function loadVideoTutorials() {
  const tutorials = [
    { name: 'Sales Portal Overview', description: 'Introduction to the sales portal features' },
    { name: 'Creating Your First Deal', description: 'Step-by-step guide to deal creation' },
    { name: 'Building Quotes', description: 'How to create and customize quotes' },
    { name: 'Managing Contacts', description: 'Best practices for contact management' }
  ];

  const container = document.getElementById('video-tutorials-list');
  if (container) {
    container.innerHTML = tutorials.map(tutorial => `
      <div class="border border-nfgray dark:border-gray-700 rounded-lg p-4 hover:bg-nfglight dark:hover:bg-gray-700 transition cursor-pointer">
        <div class="flex items-center gap-3">
          <i data-lucide="play-circle" class="w-8 h-8 text-nfgblue dark:text-blue-400"></i>
          <div>
            <h4 class="font-semibold text-gray-900 dark:text-white mb-1">${tutorial.name}</h4>
            <p class="text-sm text-gray-600 dark:text-gray-400">${tutorial.description}</p>
          </div>
        </div>
      </div>
    `).join('');
    if (window.lucide) lucide.createIcons();
  }
}

// ==========================================
// QUICK LINKS & RESOURCES
// ==========================================
export function openExternalTools() {
  const modal = document.getElementById('external-tools-modal');
  if (modal) {
    modal.classList.remove('hidden');
    if (window.lucide) lucide.createIcons();
    loadExternalTools();
  }
}

function loadExternalTools() {
  const tools = [
    { name: 'CRM System', url: '#', description: 'Access your CRM dashboard' },
    { name: 'Email Client', url: '#', description: 'Open email application' },
    { name: 'Calendar', url: '#', description: 'Schedule and manage appointments' },
    { name: 'Communication Platform', url: '#', description: 'Team communication tools' }
  ];

  const container = document.getElementById('external-tools-list');
  if (container) {
    container.innerHTML = tools.map(tool => `
      <div class="border border-nfgray dark:border-gray-700 rounded-lg p-4 hover:bg-nfglight dark:hover:bg-gray-700 transition">
        <div class="flex items-center justify-between">
          <div>
            <h4 class="font-semibold text-gray-900 dark:text-white mb-1">${tool.name}</h4>
            <p class="text-sm text-gray-600 dark:text-gray-400">${tool.description}</p>
          </div>
          <a href="${tool.url}" target="_blank" class="text-nfgblue dark:text-blue-400 hover:text-nfgdark dark:hover:text-blue-300">
            <i data-lucide="external-link" class="w-5 h-5"></i>
          </a>
        </div>
      </div>
    `).join('');
    if (window.lucide) lucide.createIcons();
  }
}

export function openCompanyResources() {
  const modal = document.getElementById('company-resources-modal');
  if (modal) {
    modal.classList.remove('hidden');
    if (window.lucide) lucide.createIcons();
    loadCompanyResources();
  }
}

function loadCompanyResources() {
  const resources = [
    { name: 'Employee Handbook', description: 'Company policies and procedures' },
    { name: 'Sales Policies', description: 'Sales-specific policies and guidelines' },
    { name: 'Support Contacts', description: 'Who to contact for different issues' },
    { name: 'Internal Wiki', description: 'Company knowledge base' }
  ];

  const container = document.getElementById('company-resources-list');
  if (container) {
    container.innerHTML = resources.map(resource => `
      <div class="border border-nfgray dark:border-gray-700 rounded-lg p-4 hover:bg-nfglight dark:hover:bg-gray-700 transition cursor-pointer">
        <h4 class="font-semibold text-gray-900 dark:text-white mb-1">${resource.name}</h4>
        <p class="text-sm text-gray-600 dark:text-gray-400">${resource.description}</p>
      </div>
    `).join('');
  }
}

export function openHelpSupport() {
  const modal = document.getElementById('help-support-modal');
  if (modal) {
    modal.classList.remove('hidden');
    if (window.lucide) lucide.createIcons();
    loadHelpSupport();
  }
}

function loadHelpSupport() {
  const faqs = [
    { question: 'How do I create a new deal?', answer: 'Navigate to the Deals tab and click "New Deal". Fill in the required information and save.' },
    { question: 'How do I create a quote?', answer: 'Go to the Quotes tab, click "New Quote", and select a template or create from scratch.' },
    { question: 'How do I add a contact?', answer: 'In the Contacts tab, click "New Account" and choose between Account or Contact type.' },
    { question: 'Where can I see my commission?', answer: 'Use the Commission Calculator in Tools & Resources, or check your reports in the Reports section.' }
  ];

  const container = document.getElementById('help-support-faq');
  if (container) {
    container.innerHTML = faqs.map((faq, index) => `
      <div class="border border-nfgray dark:border-gray-700 rounded-lg p-4 mb-3">
        <h4 class="font-semibold text-gray-900 dark:text-white mb-2">${faq.question}</h4>
        <p class="text-sm text-gray-600 dark:text-gray-400">${faq.answer}</p>
      </div>
    `).join('');
  }
}

// Export module
const salesToolsModule = {
  openROICalculator,
  calculateROI,
  openCommissionCalculator,
  calculateCommission,
  openPricingGuide,
  openEmailTemplates,
  viewEmailTemplate,
  copyEmailTemplate,
  openCallScripts,
  copyCallScript,
  openQuoteTemplates,
  openSalesPlaybooks,
  openProductKnowledge,
  openVideoTutorials,
  openExternalTools,
  openCompanyResources,
  openHelpSupport
};

window.salesTools = salesToolsModule;
export default salesToolsModule;
