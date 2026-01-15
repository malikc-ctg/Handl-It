// Quote Builder Wizard Integration
// Handles step navigation, form handling, and data submission

import * as quotesModule from './quotes.js';
import { toast } from './notifications.js';
import { calculateQuote } from './quote-engine/calculator.js';
import { generateQuoteEmail, generateWalkthroughWelcomeEmail } from './quote-engine/email-template.js';
import { createWalkthroughRequest, sendWalkthroughWelcomeEmail } from './services/walkthrough-service.js';

let currentWizardStep = 1;
let currentQuoteId = null;
let accountType = null; // 'new' or 'existing'
let wizardData = {
  account_id: null,
  new_account_data: null,
  primary_contact_id: null,
  deal_id: null,
  quote_type: 'standard',
  revision_data: {},
  line_items: [],
  cleaning_metrics: {
    square_footage: 0,
    restrooms: 0,
    kitchens: 0,
    floors: 1,
    frequency: 'weekly',
    per_sqft_rate: 0,
    services: []
  }
};

// Initialize wizard
export function initQuoteWizard() {
  const modal = document.getElementById('quote-builder-modal');
  const closeBtn = document.getElementById('close-quote-builder-modal');
  const cancelBtn = document.getElementById('wizard-cancel-btn');
  const backBtn = document.getElementById('wizard-back-btn');
  const nextBtn = document.getElementById('wizard-next-btn');
  const sendBtn = document.getElementById('wizard-send-btn');
  const saveDraftBtn = document.getElementById('wizard-save-draft-btn');
  const quoteTypeSelect = document.getElementById('quote-type-select');
  const includeRangeCheckbox = document.getElementById('include-range-estimate');

  // Close modal handlers
  if (closeBtn) {
    closeBtn.addEventListener('click', closeWizard);
  }
  if (cancelBtn) {
    cancelBtn.addEventListener('click', closeWizard);
  }

  // Navigation handlers
  if (backBtn) {
    backBtn.addEventListener('click', () => navigateStep(-1));
  }
  if (nextBtn) {
    nextBtn.addEventListener('click', () => navigateStep(1));
  }
  if (sendBtn) {
    sendBtn.addEventListener('click', handleSendQuote);
  }
  if (saveDraftBtn) {
    saveDraftBtn.addEventListener('click', handleSaveDraft);
  }

  // Quote type change handler
  if (quoteTypeSelect) {
    quoteTypeSelect.addEventListener('change', (e) => {
      wizardData.quote_type = e.target.value;
      updateStep2UI();
    });
  }

  // Range estimate checkbox
  if (includeRangeCheckbox) {
    includeRangeCheckbox.addEventListener('change', (e) => {
      const fields = document.getElementById('range-estimate-fields');
      if (fields) {
        fields.classList.toggle('hidden', !e.target.checked);
      }
    });
  }

  // Line items handlers
  setupLineItemsHandlers();

  // Auto-calculate pricing from cleaning metrics
  setupAutoCalculatePricing();

  // Account type selection handlers
  const newAccountBtn = document.getElementById('account-type-new');
  const existingAccountBtn = document.getElementById('account-type-existing');
  if (newAccountBtn) {
    newAccountBtn.addEventListener('click', () => selectAccountType('new'));
  }
  if (existingAccountBtn) {
    existingAccountBtn.addEventListener('click', () => selectAccountType('existing'));
  }

  // Close on backdrop click
  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        closeWizard();
      }
    });
  }

  // Quote send confirmation modal handlers
  const confirmationModal = document.getElementById('quote-send-confirmation-modal');
  const closeConfirmationBtn = document.getElementById('close-quote-send-confirmation-modal');
  const cancelConfirmationBtn = document.getElementById('cancel-quote-send-btn');
  const confirmSendBtn = document.getElementById('confirm-quote-send-btn');

  if (closeConfirmationBtn) {
    closeConfirmationBtn.addEventListener('click', closeQuoteSendConfirmation);
  }
  if (cancelConfirmationBtn) {
    cancelConfirmationBtn.addEventListener('click', closeQuoteSendConfirmation);
  }
  if (confirmSendBtn) {
    confirmSendBtn.addEventListener('click', confirmAndSendQuote);
  }
  if (confirmationModal) {
    confirmationModal.addEventListener('click', (e) => {
      if (e.target === confirmationModal) {
        closeQuoteSendConfirmation();
      }
    });
  }
}

// Open wizard
export function openQuoteWizard() {
  resetWizard();
  currentWizardStep = 1;
  updateWizardUI();
  populateDropdowns();
  populateCleaningServices();
  
  const modal = document.getElementById('quote-builder-modal');
  if (modal) {
    modal.classList.remove('hidden');
  }
  
  if (window.lucide) lucide.createIcons();
}

// Close wizard
function closeWizard() {
  const modal = document.getElementById('quote-builder-modal');
  if (modal) {
    modal.classList.add('hidden');
  }
  resetWizard();
}

// Select account type
function selectAccountType(type) {
  accountType = type;
  
  // Update button styles
  const newBtn = document.getElementById('account-type-new');
  const existingBtn = document.getElementById('account-type-existing');
  
  if (newBtn && existingBtn) {
    if (type === 'new') {
      newBtn.classList.add('border-nfgblue', 'dark:border-blue-400', 'bg-nfglight', 'dark:bg-blue-900/30');
      newBtn.classList.remove('border-nfgray', 'dark:border-gray-600');
      existingBtn.classList.remove('border-nfgblue', 'dark:border-blue-400', 'bg-nfglight', 'dark:bg-blue-900/30');
      existingBtn.classList.add('border-nfgray', 'dark:border-gray-600');
    } else {
      existingBtn.classList.add('border-nfgblue', 'dark:border-blue-400', 'bg-nfglight', 'dark:bg-blue-900/30');
      existingBtn.classList.remove('border-nfgray', 'dark:border-gray-600');
      newBtn.classList.remove('border-nfgblue', 'dark:border-blue-400', 'bg-nfglight', 'dark:bg-blue-900/30');
      newBtn.classList.add('border-nfgray', 'dark:border-gray-600');
    }
  }
  
  // Move to next step after a brief delay for visual feedback
  setTimeout(() => {
    navigateStep(1);
  }, 300);
}

// Reset wizard data
function resetWizard() {
  currentWizardStep = 1;
  currentQuoteId = null;
  accountType = null;
  wizardData = {
    account_id: null,
    new_account_data: null,
    primary_contact_id: null,
    deal_id: null,
    quote_type: 'standard',
    revision_data: {},
    line_items: [],
    cleaning_metrics: {
      square_footage: 0,
      restrooms: 0,
      kitchens: 0,
      floors: 1,
      frequency: 'weekly',
      per_sqft_rate: 0,
      services: []
    }
  };
  
  // Reset new account form fields
  const newAccountFields = ['new-account-name', 'new-account-address', 'new-account-city', 
                            'new-account-province', 'new-account-postal-code', 'new-account-phone', 'new-account-email'];
  newAccountFields.forEach(fieldId => {
    const field = document.getElementById(fieldId);
    if (field) field.value = '';
  });
  
  // Reset cleaning metrics form fields
  const squareFootage = document.getElementById('quote-square-footage');
  const restrooms = document.getElementById('quote-restrooms');
  const kitchens = document.getElementById('quote-kitchens');
  const floors = document.getElementById('quote-floors');
  const frequency = document.getElementById('quote-cleaning-frequency');
  const perSqftRate = document.getElementById('quote-per-sqft-rate');
  
  if (squareFootage) squareFootage.value = '';
  if (restrooms) restrooms.value = '';
  if (kitchens) kitchens.value = '';
  if (floors) floors.value = '1';
  if (frequency) frequency.value = 'weekly';
  if (perSqftRate) perSqftRate.value = '';
  
  // Uncheck all service checkboxes
  document.querySelectorAll('.quote-service-checkbox').forEach(cb => cb.checked = false);
}

// Navigate between steps
function navigateStep(direction) {
  const newStep = currentWizardStep + direction;
  
  if (newStep < 1 || newStep > 4) return;

  // Validate current step before moving forward
  if (direction > 0 && !validateCurrentStep()) {
    return;
  }

  // Save current step data
  saveCurrentStepData();

  currentWizardStep = newStep;
  updateWizardUI();
}

// Validate current step
function validateCurrentStep() {
  if (currentWizardStep === 1) {
    if (!accountType) {
      toast.error('Please select an account type', 'Validation Error');
      return false;
    }
    return true;
  } else if (currentWizardStep === 2) {
    const quoteTypeSelect = document.getElementById('quote-type-select');
    
    if (!quoteTypeSelect?.value) {
      toast.error('Please select a quote type', 'Validation Error');
      return false;
    }
    
    // Validate account selection for existing accounts
    if (accountType === 'existing') {
      const accountSelect = document.getElementById('quote-account-select');
      if (!accountSelect?.value) {
        toast.error('Please select an account', 'Validation Error');
        return false;
      }
    } else if (accountType === 'new') {
      // Validate new account fields
      const accountName = document.getElementById('new-account-name')?.value?.trim();
      const accountAddress = document.getElementById('new-account-address')?.value?.trim();
      
      if (!accountName) {
        toast.error('Please enter an account name', 'Validation Error');
        return false;
      }
      if (!accountAddress) {
        toast.error('Please enter an address', 'Validation Error');
        return false;
      }
    }
    
    return true;
  } else if (currentWizardStep === 3) {
    const quoteType = wizardData.quote_type;
    
    if (quoteType === 'walkthrough_required') {
      // Walkthrough - just need basic info, will send welcome email
      return true;
    } else {
      // Standard Quote - validate quote engine inputs
      const serviceType = document.getElementById('quote-service-type')?.value;
      const frequencyPerMonth = parseInt(document.getElementById('quote-frequency-per-month')?.value);
      
      if (!serviceType) {
        toast.error('Please select a service type', 'Validation Error');
        return false;
      }
      if (!frequencyPerMonth || frequencyPerMonth <= 0) {
        toast.error('Please enter a valid frequency (visits per month)', 'Validation Error');
        return false;
      }
      
      // Check if calculation was successful
      if (!wizardData.quote_calculation || !wizardData.quote_calculation.result) {
        toast.error('Please fill in the quote form to calculate pricing', 'Validation Error');
        return false;
      }
      
      // Check if walkthrough is required
      if (wizardData.quote_calculation.result.walkthrough_required) {
        toast.warning('A walkthrough is recommended for accurate pricing. You can still proceed, but consider scheduling a walkthrough.', 'Walkthrough Recommended');
      }
    }
    return true;
  } else if (currentWizardStep === 4) {
    const expiryDays = document.getElementById('quote-expiry-days')?.value;
    if (!expiryDays || parseInt(expiryDays) < 1) {
      toast.error('Please enter a valid expiry (days)', 'Validation Error');
      return false;
    }
    return true;
  }
  return true;
}

// Save current step data
function saveCurrentStepData() {
  if (currentWizardStep === 1) {
    // Account type is already saved when selected
  } else if (currentWizardStep === 2) {
    if (accountType === 'existing') {
      wizardData.account_id = document.getElementById('quote-account-select')?.value || null;
    } else {
      wizardData.account_id = null; // New account
    }
    wizardData.primary_contact_id = document.getElementById('quote-contact-select')?.value || null;
    wizardData.deal_id = document.getElementById('quote-deal-select')?.value || null;
    wizardData.quote_type = document.getElementById('quote-type-select')?.value || 'walkthrough_required';
  } else if (currentWizardStep === 3) {
    const quoteType = wizardData.quote_type;
    
    // Save cleaning metrics (for all quote types)
    const cleaningMetrics = {
      square_footage: parseInt(document.getElementById('quote-square-footage')?.value || 0),
      restrooms: parseInt(document.getElementById('quote-restrooms')?.value || 0),
      kitchens: parseInt(document.getElementById('quote-kitchens')?.value || 0),
      floors: parseInt(document.getElementById('quote-floors')?.value || 1),
      frequency: document.getElementById('quote-cleaning-frequency')?.value || 'weekly',
      per_sqft_rate: parseFloat(document.getElementById('quote-per-sqft-rate')?.value || 0),
      services: Array.from(document.querySelectorAll('.quote-service-checkbox:checked')).map(cb => cb.value)
    };
    wizardData.cleaning_metrics = cleaningMetrics;
    
    if (quoteType === 'walkthrough_required') {
      wizardData.revision_data = {
        service_schedule_summary: document.getElementById('quote-service-schedule')?.value || '',
        scope_summary: document.getElementById('quote-scope-summary')?.value || '',
        assumptions: document.getElementById('quote-assumptions')?.value || '',
        exclusions: document.getElementById('quote-exclusions')?.value || '',
        cleaning_metrics: cleaningMetrics
      };
      
      // Range estimate
      const includeRange = document.getElementById('include-range-estimate')?.checked;
      if (includeRange) {
        const rangeLow = parseFloat(document.getElementById('quote-range-low')?.value || 0);
        const rangeHigh = parseFloat(document.getElementById('quote-range-high')?.value || 0);
        if (rangeLow > 0 && rangeHigh > rangeLow) {
          wizardData.line_items = [{
            name: 'Estimated Range',
            unit: 'range',
            range_low: rangeLow,
            range_high: rangeHigh,
            quantity: 1
          }];
        }
      }
    } else {
      // Standard Quote - line items are already in wizardData.line_items
    }
  } else if (currentWizardStep === 4) {
    wizardData.revision_data.billing_frequency = document.getElementById('quote-billing-frequency')?.value || 'monthly';
    wizardData.revision_data.contract_term_months = parseInt(document.getElementById('quote-contract-term')?.value || 12);
    const startDate = document.getElementById('quote-start-date')?.value;
    if (startDate) {
      wizardData.revision_data.start_date_proposed = startDate;
    }
  }
}

// Update wizard UI based on current step
function updateWizardUI() {
  // Update step indicators
  for (let i = 1; i <= 4; i++) {
    const indicator = document.getElementById(`wizard-step-${i}-indicator`);
    const label = indicator?.nextElementSibling;
    if (indicator) {
      if (i === currentWizardStep) {
        indicator.classList.remove('bg-gray-300', 'dark:bg-gray-600', 'text-gray-600', 'dark:text-gray-300');
        indicator.classList.add('bg-nfgblue', 'text-white');
        if (label) {
          label.classList.remove('text-gray-500', 'dark:text-gray-400');
          label.classList.add('text-nfgblue', 'dark:text-blue-400');
        }
      } else if (i < currentWizardStep) {
        indicator.classList.remove('bg-gray-300', 'dark:bg-gray-600', 'text-gray-600', 'dark:text-gray-300');
        indicator.classList.add('bg-green-500', 'text-white');
        if (label) {
          label.classList.remove('text-gray-500', 'dark:text-gray-400');
          label.classList.add('text-green-600', 'dark:text-green-400');
        }
      } else {
        indicator.classList.remove('bg-nfgblue', 'bg-green-500', 'text-white');
        indicator.classList.add('bg-gray-300', 'dark:bg-gray-600', 'text-gray-600', 'dark:text-gray-300');
        if (label) {
          label.classList.remove('text-nfgblue', 'dark:text-blue-400', 'text-green-600', 'dark:text-green-400');
          label.classList.add('text-gray-500', 'dark:text-gray-400');
        }
      }
    }
  }

  // Show/hide steps
  for (let i = 1; i <= 4; i++) {
    const step = document.getElementById(`wizard-step-${i}`);
    if (step) {
      step.classList.toggle('hidden', i !== currentWizardStep);
    }
  }

  // Update navigation buttons
  const backBtn = document.getElementById('wizard-back-btn');
  const nextBtn = document.getElementById('wizard-next-btn');
  const sendBtn = document.getElementById('wizard-send-btn');

  if (backBtn) {
    backBtn.classList.toggle('hidden', currentWizardStep === 1);
  }
  if (nextBtn) {
    nextBtn.classList.toggle('hidden', currentWizardStep === 4);
  }
  if (sendBtn) {
    sendBtn.classList.toggle('hidden', currentWizardStep !== 4);
  }

  // Update step 2 UI based on account type
  if (currentWizardStep === 2) {
    updateStep2AccountFields();
    updateStep2UI();
  }
  
  // Update step 3 UI based on quote type
  if (currentWizardStep === 3) {
    updateStep2UI();
    // Calculate quote if form is already filled
    setTimeout(() => calculateQuoteFromEngine(), 100);
  }
}

// Update step 2 account fields based on account type
function updateStep2AccountFields() {
  const existingFields = document.getElementById('existing-account-fields');
  const newFields = document.getElementById('new-account-fields');
  
  if (accountType === 'existing') {
    if (existingFields) existingFields.classList.remove('hidden');
    if (newFields) newFields.classList.add('hidden');
    const accountSelect = document.getElementById('quote-account-select');
    if (accountSelect) accountSelect.required = true;
  } else {
    if (existingFields) existingFields.classList.add('hidden');
    if (newFields) newFields.classList.remove('hidden');
    const accountSelect = document.getElementById('quote-account-select');
    if (accountSelect) accountSelect.required = false;
  }
}

// Update step 2 UI based on quote type
function updateStep2UI() {
  const quoteTypeSelect = document.getElementById('quote-type-select');
  const quoteType = quoteTypeSelect?.value || wizardData.quote_type || 'standard';
  const walkthroughSection = document.getElementById('walkthrough-scope-section');
  const bindingSection = document.getElementById('binding-line-items-section');
  const quoteEngineForm = document.getElementById('quote-engine-form-section');

  if (quoteType === 'walkthrough_required') {
    if (walkthroughSection) walkthroughSection.classList.remove('hidden');
    if (bindingSection) bindingSection.classList.add('hidden');
    if (quoteEngineForm) quoteEngineForm.classList.add('hidden');
  } else {
    // Standard quote - use quote engine form
    if (walkthroughSection) walkthroughSection.classList.add('hidden');
    if (bindingSection) bindingSection.classList.add('hidden'); // Hide old line items builder
    if (quoteEngineForm) quoteEngineForm.classList.remove('hidden');
    
    // Setup event listeners for quote engine form
    setupQuoteEngineListeners();
    // Trigger calculation when form becomes visible
    setTimeout(() => calculateQuoteFromEngine(), 200);
  }
}

// Populate dropdowns
async function populateDropdowns() {
  // Populate accounts (sites) - only for existing accounts
  const accountSelect = document.getElementById('quote-account-select');
  if (accountSelect && window.quotesModule) {
    const sites = window.quotesModule.sites || [];
    accountSelect.innerHTML = '<option value="">Select an account...</option>' +
      sites.map(site => `<option value="${site.id}">${site.name}</option>`).join('');
  }

  // Populate contacts
  const contactSelect = document.getElementById('quote-contact-select');
  if (contactSelect && window.quotesModule) {
    const contacts = window.quotesModule.contacts || [];
    contactSelect.innerHTML = '<option value="">Select a contact...</option>' +
      contacts.map(contact => `<option value="${contact.id}">${contact.full_name || contact.email}</option>`).join('');
  }

  // Populate deals
  const dealSelect = document.getElementById('quote-deal-select');
  if (dealSelect && window.quotesModule) {
    const deals = window.quotesModule.deals || [];
    dealSelect.innerHTML = '<option value="">Link to a deal...</option>' +
      deals.map(deal => `<option value="${deal.id}">${deal.title || `Deal #${deal.id}`}</option>`).join('');
  }
}

// Populate cleaning services checklist
function populateCleaningServices() {
  const servicesList = document.getElementById('quote-services-list');
  if (!servicesList || !window.quotesModule) return;

  const services = window.quotesModule.services || [];
  const categories = window.quotesModule.serviceCategories || [];

  if (services.length === 0) {
    servicesList.innerHTML = '<p class="text-sm text-gray-500 dark:text-gray-400">No services available</p>';
    return;
  }

  // Group services by category
  const servicesByCategory = {};
  categories.forEach(cat => {
    servicesByCategory[cat.id] = {
      category: cat,
      services: services.filter(s => s.category_id === cat.id)
    };
  });

  // Render services grouped by category
  let html = '';
  categories.forEach(cat => {
    const catServices = servicesByCategory[cat.id]?.services || [];
    if (catServices.length === 0) return;

    html += `
      <div class="mb-3">
        <div class="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1 uppercase tracking-wide">${cat.name}</div>
        <div class="space-y-1 pl-2">
          ${catServices.map(service => `
            <label class="flex items-center text-sm cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 p-1 rounded">
              <input type="checkbox" class="quote-service-checkbox mr-2 rounded" value="${service.id}" data-service-name="${service.name}">
              <span class="text-gray-700 dark:text-gray-300">${service.name}</span>
            </label>
          `).join('')}
        </div>
      </div>
    `;
  });

  servicesList.innerHTML = html || '<p class="text-sm text-gray-500 dark:text-gray-400">No services available</p>';
  
  // Re-setup auto-calculate after services are populated
  setupAutoCalculatePricing();
}

// Track if auto-calculate is set up to prevent duplicate listeners
let autoCalculateSetup = false;

// Setup auto-calculate pricing from cleaning metrics
function setupAutoCalculatePricing() {
  // Remove old listeners first to prevent duplicates
  const squareFootage = document.getElementById('quote-square-footage');
  const restrooms = document.getElementById('quote-restrooms');
  const kitchens = document.getElementById('quote-kitchens');
  const floors = document.getElementById('quote-floors');
  const frequency = document.getElementById('quote-cleaning-frequency');
  const perSqftRate = document.getElementById('quote-per-sqft-rate');
  const serviceCheckboxes = document.querySelectorAll('.quote-service-checkbox');

  // Remove existing listeners if already set up
  if (autoCalculateSetup) {
    [squareFootage, restrooms, kitchens, floors, frequency, perSqftRate].forEach(input => {
      if (input) {
        input.removeEventListener('input', calculatePriceFromMetrics);
        input.removeEventListener('change', calculatePriceFromMetrics);
      }
    });
    serviceCheckboxes.forEach(checkbox => {
      checkbox.removeEventListener('change', calculatePriceFromMetrics);
    });
  }

  // Add event listeners to all metric inputs
  [squareFootage, restrooms, kitchens, floors, frequency, perSqftRate].forEach(input => {
    if (input) {
      input.addEventListener('input', calculatePriceFromMetrics);
      input.addEventListener('change', calculatePriceFromMetrics);
    }
  });

  // Add event listeners to service checkboxes
  serviceCheckboxes.forEach(checkbox => {
    checkbox.addEventListener('change', calculatePriceFromMetrics);
  });

  autoCalculateSetup = true;
}

// Calculate quote using Quote Engine v2
function calculateQuoteFromEngine() {
  const quoteType = wizardData.quote_type || 'standard';
  
  // Only calculate for standard quotes
  if (quoteType !== 'standard') {
    return;
  }

  // Get form inputs
  const serviceType = document.getElementById('quote-service-type')?.value;
  const sqftEstimate = parseFloat(document.getElementById('quote-sqft-estimate')?.value) || null;
  const frequencyPerMonth = parseInt(document.getElementById('quote-frequency-per-month')?.value) || 4;
  const numWashrooms = parseInt(document.getElementById('quote-num-washrooms')?.value) || 0;
  const numTreatmentRooms = parseInt(document.getElementById('quote-num-treatment-rooms')?.value) || 0;
  const hasReception = document.getElementById('quote-has-reception')?.checked || false;
  const hasKitchen = document.getElementById('quote-has-kitchen')?.checked || false;
  const flooring = document.getElementById('quote-flooring')?.value || 'mostly_hard';
  const afterHours = document.getElementById('quote-after-hours')?.checked || false;
  const suppliesIncluded = document.getElementById('quote-supplies-included')?.checked !== false;
  const highTouchDisinfection = document.getElementById('quote-high-touch-disinfection')?.checked || false;
  const urgencyDays = parseInt(document.getElementById('quote-urgency-days')?.value) || 30;
  const notes = document.getElementById('quote-notes')?.value || '';

  // Validate required fields
  if (!serviceType || !frequencyPerMonth) {
    document.getElementById('quote-calculation-result')?.classList.add('hidden');
    return;
  }

  try {
    // Calculate quote using engine
    const inputs = {
      service_type: serviceType,
      sqft_estimate: sqftEstimate,
      frequency_per_month: frequencyPerMonth,
      num_washrooms: numWashrooms,
      num_treatment_rooms: numTreatmentRooms,
      has_reception: hasReception,
      has_kitchen: hasKitchen,
      flooring: flooring,
      after_hours_required: afterHours,
      supplies_included: suppliesIncluded,
      high_touch_disinfection: highTouchDisinfection,
      urgency_start_days: urgencyDays,
      notes: notes
    };

    const quoteResult = calculateQuote(inputs);

    // Store result in wizardData
    wizardData.quote_calculation = {
      inputs: inputs,
      result: quoteResult,
      engine_version: 'v2'
    };

    // Update line items from calculation
    wizardData.line_items = quoteResult.line_items || [];

    // Display results
    displayQuoteCalculation(quoteResult);

    // Update totals
    updateLineItemsTotals();

  } catch (error) {
    console.error('[Quote Engine] Calculation error:', error);
    toast.error(error.message || 'Failed to calculate quote', 'Error');
  }
}

// Display quote calculation results
function displayQuoteCalculation(result) {
  const resultDiv = document.getElementById('quote-calculation-result');
  if (!resultDiv) return;

  if (result.status === 'requires_walkthrough') {
    resultDiv.classList.remove('hidden');
    document.getElementById('calc-walkthrough-warning')?.classList.remove('hidden');
    return;
  }

  resultDiv.classList.remove('hidden');
  document.getElementById('calc-walkthrough-warning')?.classList.add('hidden');

  // Update displayed values
  const formatCurrency = (val) => `$${val.toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  
  document.getElementById('calc-monthly-ex-hst').textContent = formatCurrency(result.monthly_price_ex_hst);
  document.getElementById('calc-per-visit').textContent = formatCurrency(result.per_visit_price);
  document.getElementById('calc-hst').textContent = formatCurrency(result.hst_amount);
  document.getElementById('calc-total').textContent = formatCurrency(result.monthly_price_inc_hst);

  // Update assumptions
  const assumptionsEl = document.getElementById('calc-assumptions');
  if (assumptionsEl) {
    let assumptionsText = `Assumes up to ${result.assumptions.sqft_cap.toLocaleString()} sq ft (${result.assumptions.band_label})`;
    if (result.assumptions.supplies_included) {
      assumptionsText += ', all supplies included';
    }
    if (result.assumptions.healthcare_disinfection) {
      assumptionsText += ', healthcare-focused disinfection';
    }
    assumptionsEl.textContent = assumptionsText;
  }
}

// Legacy function name for backward compatibility
function calculatePriceFromMetrics() {
  calculateQuoteFromEngine();

  // Calculate base monthly price
  const baseMonthlyPrice = squareFootage * perSqftRate;

  // Frequency multiplier (convert to monthly equivalent)
  const frequencyMultipliers = {
    'daily': 30,      // 30x monthly
    'weekly': 4,      // 4x monthly
    'bi-weekly': 2,   // 2x monthly
    'monthly': 1,     // 1x monthly
    'quarterly': 0.33 // 0.33x monthly
  };
  const frequencyMultiplier = frequencyMultipliers[frequency] || 1;

  // Calculate adjusted base price
  const adjustedBasePrice = baseMonthlyPrice * frequencyMultiplier;

  // Additional costs
  const restroomCost = restrooms * 25 * frequencyMultiplier; // $25 per restroom per cleaning
  const kitchenCost = kitchens * 50 * frequencyMultiplier;   // $50 per kitchen per cleaning
  const floorCost = (floors - 1) * 100 * frequencyMultiplier; // $100 per additional floor per cleaning

  // Service add-ons (flat monthly rates that scale with frequency)
  const serviceAddOns = {
    'Carpet, Rug & Upholstery Cleaning': 200,
    'Desk & Equipment Wipe-Down': 150,
    'Elevator Cab & Track Cleaning': 75,
    'Entrance Detailing & Glass Polishing': 100,
    'Garbage & Recycling Removal': 50,
    'High Dusting (Vents, Ledges, Fixtures)': 125,
    'Interior & Exterior Window Cleaning': 300,
    'Touch-Point Disinfecting': 100,
    'Spot Cleaning (Walls, Doors, Glass)': 150
  };

  let serviceCost = 0;
  selectedServices.forEach(service => {
    const addOnPrice = serviceAddOns[service.name] || 0;
    if (addOnPrice > 0) {
      serviceCost += addOnPrice * frequencyMultiplier;
    }
  });

  // Generate line items
  const lineItems = [];

  // Base cleaning service
  if (adjustedBasePrice > 0) {
    lineItems.push({
      name: `Base Cleaning Service (${frequency})`,
      description: `${squareFootage.toLocaleString()} sq ft @ $${perSqftRate.toFixed(2)}/sqft`,
      quantity: 1,
      unit: 'flat',
      unit_price: adjustedBasePrice,
      category: 'Base Service'
    });
  }

  // Restrooms
  if (restrooms > 0 && restroomCost > 0) {
    lineItems.push({
      name: 'Restroom Cleaning',
      description: `${restrooms} restroom${restrooms > 1 ? 's' : ''}`,
      quantity: restrooms,
      unit: 'flat',
      unit_price: 25 * frequencyMultiplier,
      category: 'Additional Services'
    });
  }

  // Kitchens
  if (kitchens > 0 && kitchenCost > 0) {
    lineItems.push({
      name: 'Kitchen Cleaning',
      description: `${kitchens} kitchen${kitchens > 1 ? 's' : ''}`,
      quantity: kitchens,
      unit: 'flat',
      unit_price: 50 * frequencyMultiplier,
      category: 'Additional Services'
    });
  }

  // Additional floors
  if (floors > 1 && floorCost > 0) {
    lineItems.push({
      name: 'Additional Floor Cleaning',
      description: `${floors - 1} additional floor${floors > 2 ? 's' : ''}`,
      quantity: floors - 1,
      unit: 'flat',
      unit_price: 100 * frequencyMultiplier,
      category: 'Additional Services'
    });
  }

  // Selected services
  selectedServices.forEach(service => {
    const addOnPrice = serviceAddOns[service.name];
    if (addOnPrice > 0) {
      lineItems.push({
        name: service.name,
        description: 'Additional service',
        quantity: 1,
        unit: 'flat',
        unit_price: addOnPrice * frequencyMultiplier,
        category: 'Premium Services'
      });
    }
  });

  // Update wizardData with calculated line items
  wizardData.line_items = lineItems;
  
  console.log('[Auto-Calculate] Generated line items:', lineItems);
  console.log('[Auto-Calculate] Total line items:', lineItems.length);
  
  // Re-render line items (only if we're on step 3 and binding section is visible)
  const bindingSection = document.getElementById('binding-line-items-section');
  if (bindingSection && !bindingSection.classList.contains('hidden')) {
    renderLineItems();
    // Update totals
    updateLineItemsTotals();
    console.log('[Auto-Calculate] Line items rendered and totals updated');
  } else {
    console.log('[Auto-Calculate] Binding section not visible - line items saved to wizardData only');
  }
}

// Setup line items handlers
function setupLineItemsHandlers() {
  const addBtn = document.getElementById('add-line-item-btn');
  if (addBtn) {
    addBtn.addEventListener('click', addLineItem);
  }
}

// Add line item
function addLineItem() {
  wizardData.line_items.push({
    name: '',
    description: '',
    quantity: 1,
    unit: 'flat',
    unit_price: 0,
    category: ''
  });
  renderLineItems();
}

// Remove line item
function removeLineItem(index) {
  wizardData.line_items.splice(index, 1);
  renderLineItems();
}

// Render line items
function renderLineItems() {
  const container = document.getElementById('quote-line-items-list');
  if (!container) return;

  if (wizardData.line_items.length === 0) {
    container.innerHTML = '<p class="text-gray-500 text-center py-4">No line items. Click "Add Line Item" to add one.</p>';
    return;
  }

  container.innerHTML = wizardData.line_items.map((item, index) => `
    <div class="border border-nfgray dark:border-gray-700 rounded-lg p-4">
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-3">
        <div>
          <label class="block text-xs text-gray-600 dark:text-gray-400 mb-1">Name</label>
          <input type="text" class="line-item-field w-full px-3 py-2 border border-nfgray dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-sm" 
            data-index="${index}" data-field="name" value="${(item.name || '').replace(/"/g, '&quot;')}" placeholder="Item name">
        </div>
        <div>
          <label class="block text-xs text-gray-600 dark:text-gray-400 mb-1">Category</label>
          <input type="text" class="line-item-field w-full px-3 py-2 border border-nfgray dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-sm" 
            data-index="${index}" data-field="category" value="${(item.category || '').replace(/"/g, '&quot;')}" placeholder="Category">
        </div>
      </div>
      <div class="mb-3">
        <label class="block text-xs text-gray-600 dark:text-gray-400 mb-1">Description</label>
        <textarea class="line-item-field w-full px-3 py-2 border border-nfgray dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-sm" 
          data-index="${index}" data-field="description" rows="2" placeholder="Description">${item.description || ''}</textarea>
      </div>
      <div class="grid grid-cols-4 gap-3">
        <div>
          <label class="block text-xs text-gray-600 dark:text-gray-400 mb-1">Quantity</label>
          <input type="number" class="line-item-field w-full px-3 py-2 border border-nfgray dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-sm" 
            data-index="${index}" data-field="quantity" value="${item.quantity || 1}" min="0" step="0.01">
        </div>
        <div>
          <label class="block text-xs text-gray-600 dark:text-gray-400 mb-1">Unit</label>
          <select class="line-item-field w-full px-3 py-2 border border-nfgray dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-sm" 
            data-index="${index}" data-field="unit">
            <option value="flat" ${item.unit === 'flat' ? 'selected' : ''}>Flat</option>
            <option value="sqft" ${item.unit === 'sqft' ? 'selected' : ''}>Sq Ft</option>
            <option value="unit" ${item.unit === 'unit' ? 'selected' : ''}>Unit</option>
            <option value="visit" ${item.unit === 'visit' ? 'selected' : ''}>Visit</option>
            <option value="hour" ${item.unit === 'hour' ? 'selected' : ''}>Hour</option>
          </select>
        </div>
        <div>
          <label class="block text-xs text-gray-600 dark:text-gray-400 mb-1">Unit Price</label>
          <input type="number" class="line-item-field w-full px-3 py-2 border border-nfgray dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-sm" 
            data-index="${index}" data-field="unit_price" value="${item.unit_price || 0}" min="0" step="0.01">
        </div>
        <div class="flex items-end">
          <button type="button" class="remove-line-item w-full px-3 py-2 bg-red-500 hover:bg-red-600 text-white rounded text-sm" data-index="${index}">
            Remove
          </button>
        </div>
      </div>
    </div>
  `).join('');

  // Attach event listeners
  container.querySelectorAll('.line-item-field').forEach(field => {
    field.addEventListener('input', (e) => {
      const index = parseInt(e.target.dataset.index);
      const fieldName = e.target.dataset.field;
      const value = fieldName === 'quantity' || fieldName === 'unit_price' 
        ? parseFloat(e.target.value) || 0 
        : e.target.value;
      wizardData.line_items[index][fieldName] = value;
      updateLineItemsTotals();
    });
  });

  container.querySelectorAll('.remove-line-item').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const index = parseInt(e.target.dataset.index);
      removeLineItem(index);
    });
  });

  updateLineItemsTotals();
}

// Update line items totals
function updateLineItemsTotals() {
  let subtotal = 0;
  wizardData.line_items.forEach(item => {
    const qty = parseFloat(item.quantity || 1);
    const price = parseFloat(item.unit_price || 0);
    subtotal += qty * price;
  });

  const tax = subtotal * 0.13; // 13% HST
  const total = subtotal + tax;

  const subtotalEl = document.getElementById('quote-subtotal');
  const taxEl = document.getElementById('quote-tax');
  const totalEl = document.getElementById('quote-total');

  if (subtotalEl) subtotalEl.textContent = `$${subtotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
  if (taxEl) taxEl.textContent = `$${tax.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
  if (totalEl) totalEl.textContent = `$${total.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
}

// Handle save draft
async function handleSaveDraft() {
  saveCurrentStepData();

  try {
    // Create quote if not exists
    if (!currentQuoteId) {
      const quote = await quotesModule.createQuote({
        account_id: wizardData.account_id,
        primary_contact_id: wizardData.primary_contact_id,
        deal_id: wizardData.deal_id,
        quote_type: wizardData.quote_type
      });
      currentQuoteId = quote.id;
    }

    // Save revision as draft
    const revisionData = {
      ...wizardData.revision_data,
      revision_type: wizardData.quote_type === 'walkthrough_required' ? 'walkthrough_proposal' : 'final_quote',
      is_binding: wizardData.quote_type === 'standard',
      // Include quote engine calculation data if available
      quote_engine_version: wizardData.quote_calculation?.engine_version || null,
      quote_calculation_inputs: wizardData.quote_calculation?.inputs || null,
      quote_calculation_outputs: wizardData.quote_calculation?.result || null
    };

    // Use line items from quote engine if available, otherwise use manual line items
    const lineItemsToSave = wizardData.quote_calculation?.result?.line_items || wizardData.line_items;

    await quotesModule.saveRevision(currentQuoteId, 1, revisionData, lineItemsToSave);

    toast.success('Quote saved as draft', 'Success');
    closeWizard();
    
    // Reload quotes list if on quotes tab
    if (typeof loadQuotes === 'function') {
      await loadQuotes();
    }
  } catch (error) {
    console.error('[Quote Wizard] Error saving draft:', error);
    toast.error('Failed to save draft', 'Error');
  }
}

// Show quote send confirmation modal
function showQuoteSendConfirmation() {
  // First, save current step data to ensure wizardData is up to date
  saveCurrentStepData();
  
  // Update line items totals first to ensure wizardData is synced with DOM
  updateLineItemsTotals();
  
  // Try to read from the displayed totals first (most reliable)
  const displayedSubtotalEl = document.getElementById('quote-subtotal');
  const displayedTaxEl = document.getElementById('quote-tax');
  const displayedTotalEl = document.getElementById('quote-total');
  
  let subtotal = 0;
  let tax = 0;
  let total = 0;
  
  // If totals are displayed on the page, use those values
  if (displayedSubtotalEl && displayedTaxEl && displayedTotalEl) {
    const subtotalText = displayedSubtotalEl.textContent.replace(/[^0-9.]/g, '');
    const taxText = displayedTaxEl.textContent.replace(/[^0-9.]/g, '');
    const totalText = displayedTotalEl.textContent.replace(/[^0-9.]/g, '');
    
    subtotal = parseFloat(subtotalText) || 0;
    tax = parseFloat(taxText) || 0;
    total = parseFloat(totalText) || 0;
    
    console.log('[Quote Confirmation] Read from displayed totals:', { subtotal, tax, total });
  }
  
  // If displayed totals are 0 or not available, use quote engine results or calculate from wizardData
  if (subtotal === 0 && total === 0) {
    // Try quote engine results first
    if (wizardData.quote_calculation?.result) {
      const result = wizardData.quote_calculation.result;
      subtotal = result.monthly_price_ex_hst || 0;
      tax = result.hst_amount || 0;
      total = result.monthly_price_inc_hst || 0;
      console.log('[Quote Confirmation] Using quote engine results:', { subtotal, tax, total });
    } else {
      // Fallback to calculating from line items
      console.log('[Quote Confirmation] Calculating from wizardData line items');
      wizardData.line_items.forEach((item, index) => {
        const qty = parseFloat(item.quantity || 1);
        const price = parseFloat(item.unit_price || 0);
        subtotal += qty * price;
        console.log(`[Quote Confirmation] Item ${index}: ${item.name || 'Unnamed'}, qty=${qty}, price=${price}, subtotal=${qty * price}`);
      });
      
      tax = subtotal * 0.13; // 13% HST
      total = subtotal + tax;
    }
  }

  // Update confirmation modal with totals
  const subtotalEl = document.getElementById('confirmation-subtotal');
  const taxEl = document.getElementById('confirmation-tax');
  const totalEl = document.getElementById('confirmation-total');

  if (subtotalEl) subtotalEl.textContent = `$${subtotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  if (taxEl) taxEl.textContent = `$${tax.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  if (totalEl) totalEl.textContent = `$${total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  console.log('[Quote Confirmation] Final confirmation totals:', { 
    subtotal, 
    tax, 
    total, 
    lineItemsCount: wizardData.line_items?.length || 0
  });

  // Show modal
  const modal = document.getElementById('quote-send-confirmation-modal');
  if (modal) {
    modal.classList.remove('hidden');
    if (window.lucide) lucide.createIcons();
  }
}

// Close quote send confirmation modal
function closeQuoteSendConfirmation() {
  const modal = document.getElementById('quote-send-confirmation-modal');
  if (modal) {
    modal.classList.add('hidden');
  }
}

// Handle send quote - shows confirmation first
async function handleSendQuote() {
  if (!validateCurrentStep()) {
    return;
  }

  saveCurrentStepData();
  
  // Show confirmation modal with final price
  showQuoteSendConfirmation();
}

// Actually send the quote (called after confirmation)
async function confirmAndSendQuote() {
  closeQuoteSendConfirmation();

  try {
    // Create quote if not exists
    if (!currentQuoteId) {
      const quote = await quotesModule.createQuote({
        account_id: wizardData.account_id,
        primary_contact_id: wizardData.primary_contact_id,
        deal_id: wizardData.deal_id,
        quote_type: wizardData.quote_type
      });
      currentQuoteId = quote.id;
    }

    // Save revision
    const revisionData = {
      ...wizardData.revision_data,
      revision_type: wizardData.quote_type === 'walkthrough_required' ? 'walkthrough_proposal' : 'final_quote',
      is_binding: wizardData.quote_type === 'standard',
      // Include quote engine calculation data if available
      quote_engine_version: wizardData.quote_calculation?.engine_version || null,
      quote_calculation_inputs: wizardData.quote_calculation?.inputs || null,
      quote_calculation_outputs: wizardData.quote_calculation?.result || null
    };

    // Use line items from quote engine if available, otherwise use manual line items
    const lineItemsToSave = wizardData.quote_calculation?.result?.line_items || wizardData.line_items;

    await quotesModule.saveRevision(currentQuoteId, 1, revisionData, lineItemsToSave);

    // Send revision
    const emailsInput = document.getElementById('quote-send-emails')?.value || '';
    const emails = emailsInput.split(',').map(e => e.trim()).filter(e => e);
    const expiryDays = parseInt(document.getElementById('quote-expiry-days')?.value || 7);

    await quotesModule.sendRevision(currentQuoteId, 1, emails, expiryDays);

    toast.success('Quote sent successfully', 'Success');
    closeWizard();
    
    // Reload quotes list
    if (typeof loadQuotes === 'function') {
      await loadQuotes();
    }
  } catch (error) {
    console.error('[Quote Wizard] Error sending quote:', error);
    toast.error('Failed to send quote', 'Error');
  }
}
