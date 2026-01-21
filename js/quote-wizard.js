// Quote Builder Wizard Integration
// Handles step navigation, form handling, and data submission

import * as quotesModule from './quotes.js';
import { toast } from './notifications.js';
import { calculateQuote } from './quote-engine/calculator.js';
import { createWalkthroughRequest } from './services/walkthrough-service.js';
import { supabase } from './supabase.js';

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

  // Quote send confirmation modal handlers
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

  // Account type selection handlers
  const newAccountBtn = document.getElementById('account-type-new');
  const existingAccountBtn = document.getElementById('account-type-existing');
  
  if (newAccountBtn) {
    newAccountBtn.addEventListener('click', () => {
      accountType = 'new';
      selectAccountType('new');
      updateStep2UI();
    });
  }
  
  if (existingAccountBtn) {
    existingAccountBtn.addEventListener('click', () => {
      accountType = 'existing';
      selectAccountType('existing');
      updateStep2UI();
    });
  }
  
  if (window.lucide) lucide.createIcons();
}

export function openQuoteWizard() {
  resetWizard();
  const modal = document.getElementById('quote-builder-modal');
  if (modal) {
    modal.classList.remove('hidden');
    populateDropdowns();
    updateWizardUI();
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
  
  updateStep2UI();
}

// Reset wizard to initial state
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
  updateWizardUI();
}

// Navigate between steps
function navigateStep(direction) {
  if (!validateCurrentStep()) {
    return;
  }
  
  saveCurrentStepData();
  
  const newStep = currentWizardStep + direction;
  if (newStep < 1 || newStep > 4) {
    return;
  }
  
  currentWizardStep = newStep;
  updateWizardUI();
}

// Validate current step
function validateCurrentStep() {
  if (currentWizardStep === 1) {
    // Validate account type selected
    if (!accountType) {
      toast.error('Please select an account type', 'Validation Error');
      return false;
    }
    
    return true;
  } else if (currentWizardStep === 2) {
    // Step 2: Context - validate account, contact, quote type selection
    
    // Validate account selection based on account type
    if (accountType === 'existing') {
      const accountSelect = document.getElementById('quote-account-select')?.value;
      if (!accountSelect) {
        toast.error('Please select an account', 'Validation Error');
        return false;
      }
    } else if (accountType === 'new') {
      const accountName = document.getElementById('new-account-name')?.value;
      const accountAddress = document.getElementById('new-account-address')?.value;
      if (!accountName || !accountAddress) {
        toast.error('Please fill in required account fields (Name and Address)', 'Validation Error');
        return false;
      }
    }
    
    // Validate quote type is selected
    const quoteType = document.getElementById('quote-type-select')?.value || wizardData.quote_type;
    if (!quoteType) {
      toast.error('Please select a quote type', 'Validation Error');
      return false;
    }
    
    return true;
  } else if (currentWizardStep === 3) {
    // Step 3: Pricing - validate based on quote type
    const quoteType = wizardData.quote_type;
    
    if (quoteType === 'walkthrough_required') {
      // Walkthrough - validate booking date and time
      const bookingDate = document.getElementById('quote-walkthrough-booking-date')?.value;
      const bookingTime = document.getElementById('quote-walkthrough-booking-time')?.value;
      
      if (!bookingDate) {
        toast.error('Please select a booking date', 'Validation Error');
        return false;
      }
      if (!bookingTime) {
        toast.error('Please select a booking time', 'Validation Error');
        return false;
      }
      
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
      wizardData.new_account_data = null; // Clear new account data
    } else {
      wizardData.account_id = null; // New account - will be created later
      // Save new account data for later creation
      wizardData.new_account_data = {
        name: document.getElementById('new-account-name')?.value || '',
        address: document.getElementById('new-account-address')?.value || '',
        city: document.getElementById('new-account-city')?.value || '',
        province: document.getElementById('new-account-province')?.value || '',
        postal_code: document.getElementById('new-account-postal-code')?.value || '',
        contact_phone: document.getElementById('new-account-phone')?.value || '',
        contact_email: document.getElementById('new-account-email')?.value || ''
      };
    }
    wizardData.primary_contact_id = document.getElementById('quote-contact-select')?.value || null;
    wizardData.deal_id = document.getElementById('quote-deal-select')?.value || null;
    wizardData.quote_type = document.getElementById('quote-type-select')?.value || 'standard';
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
      // Extract booking date/time from revision_data (they're only needed for email, not DB storage)
      const { booking_date: _bookingDate, booking_time: _bookingTime, ...revisionDataForDB } = wizardData.revision_data || {};

      wizardData.revision_data = {
        service_schedule_summary: document.getElementById('quote-service-schedule')?.value || '',
        scope_summary: document.getElementById('quote-scope-summary')?.value || '',
        assumptions: document.getElementById('quote-assumptions')?.value || '',
        exclusions: document.getElementById('quote-exclusions')?.value || '',
        cleaning_metrics: cleaningMetrics,
        booking_date: document.getElementById('quote-walkthrough-booking-date')?.value || '',
        booking_time: document.getElementById('quote-walkthrough-booking-time')?.value || ''
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
    const stepDiv = document.getElementById(`wizard-step-${i}`);
    
    if (indicator) {
      if (i < currentWizardStep) {
        indicator.classList.add('completed');
        indicator.classList.remove('active');
      } else if (i === currentWizardStep) {
        indicator.classList.add('active');
        indicator.classList.remove('completed');
      } else {
        indicator.classList.remove('active', 'completed');
      }
    }
    
    if (stepDiv) {
      stepDiv.classList.toggle('hidden', i !== currentWizardStep);
    }
  }
  
  // Update navigation buttons
  const backBtn = document.getElementById('wizard-back-btn');
  const nextBtn = document.getElementById('wizard-next-btn');
  const sendBtn = document.getElementById('wizard-send-btn');
  
  if (backBtn) backBtn.style.display = currentWizardStep === 1 ? 'none' : 'block';
  if (nextBtn) nextBtn.style.display = currentWizardStep === 4 ? 'none' : 'block';
  if (sendBtn) sendBtn.style.display = currentWizardStep === 4 ? 'block' : 'none';
  
  // Update step-specific UI
  updateStep2UI();
  
  if (currentWizardStep === 3) {
    const quoteType = wizardData.quote_type;
    if (quoteType === 'standard') {
      // Trigger calculation when step 3 becomes visible
      setTimeout(() => calculateQuoteFromEngine(), 100);
    }
  }
}

// Update step 2 UI based on account type and quote type
function updateStep2UI() {
  // Handle account type fields (new vs existing)
  const existingAccountFields = document.getElementById('existing-account-fields');
  const newAccountFields = document.getElementById('new-account-fields');
  const primaryContactSelect = document.getElementById('quote-contact-select');
  const primaryContactLabel = primaryContactSelect?.previousElementSibling;
  
  if (accountType === 'new') {
    // Show new account fields, hide existing account dropdown
    if (existingAccountFields) existingAccountFields.classList.add('hidden');
    if (newAccountFields) newAccountFields.classList.remove('hidden');
    // For new accounts, make contact field optional or show a different input
    if (primaryContactSelect) {
      primaryContactSelect.required = false;
      primaryContactSelect.disabled = false;
    }
  } else if (accountType === 'existing') {
    // Show existing account dropdown, hide new account fields
    if (existingAccountFields) existingAccountFields.classList.remove('hidden');
    if (newAccountFields) newAccountFields.classList.add('hidden');
    // For existing accounts, contact is selected from dropdown
    if (primaryContactSelect) {
      primaryContactSelect.required = false;
      primaryContactSelect.disabled = false;
    }
  } else {
    // No account type selected yet - hide both
    if (existingAccountFields) existingAccountFields.classList.add('hidden');
    if (newAccountFields) newAccountFields.classList.add('hidden');
  }

  // Handle quote type fields (walkthrough vs standard)
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

function populateCleaningServices() {
  const servicesList = document.getElementById('quote-services-list');
  if (!servicesList) return;

  const services = [
    'Office Cleaning (Daily)',
    'Office Cleaning (Weekly)',
    'Restroom Sanitizing & Deep Cleaning',
    'Kitchen & Lunchroom Cleaning',
    'Garbage & Recycling Removal',
    'Touch-Point Disinfecting',
    'Desk & Equipment Wipe-Down',
    'Spot Cleaning (Walls, Doors, Glass)',
    'High Dusting (Vents, Ledges, Fixtures)',
    'Carpet, Rug & Upholstery Cleaning',
    'Interior & Exterior Window Cleaning',
    'Elevator Cab & Track Cleaning',
    'Entrance Detailing & Glass Polishing',
    'Janitorial Inspections & Quality Audits'
  ];

  servicesList.innerHTML = services.map(service => `
    <label class="flex items-center space-x-2 cursor-pointer">
      <input type="checkbox" class="quote-service-checkbox" value="${service}" data-price="0">
      <span class="text-sm text-gray-700 dark:text-gray-300">${service}</span>
    </label>
  `).join('');
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

// Track if quote engine listeners are set up to prevent duplicates
let quoteEngineListenersSetup = false;

// Setup event listeners for quote engine form inputs
function setupQuoteEngineListeners() {
  // Prevent duplicate listeners
  if (quoteEngineListenersSetup) {
    return;
  }

  // Get all quote engine form inputs
  const serviceType = document.getElementById('quote-service-type');
  const sqftEstimate = document.getElementById('quote-sqft-estimate');
  const frequencyPerMonth = document.getElementById('quote-frequency-per-month');
  const numWashrooms = document.getElementById('quote-num-washrooms');
  const numTreatmentRooms = document.getElementById('quote-num-treatment-rooms');
  const hasReception = document.getElementById('quote-has-reception');
  const hasKitchen = document.getElementById('quote-has-kitchen');
  const flooring = document.getElementById('quote-flooring');
  const afterHours = document.getElementById('quote-after-hours');
  const suppliesIncluded = document.getElementById('quote-supplies-included');
  const highTouchDisinfection = document.getElementById('quote-high-touch-disinfection');
  const urgencyDays = document.getElementById('quote-urgency-days');
  const notes = document.getElementById('quote-notes');

  // Add event listeners to all inputs
  [serviceType, sqftEstimate, frequencyPerMonth, numWashrooms, numTreatmentRooms, flooring, urgencyDays, notes].forEach(input => {
    if (input) {
      input.addEventListener('input', calculateQuoteFromEngine);
      input.addEventListener('change', calculateQuoteFromEngine);
    }
  });

  // Add event listeners to checkboxes
  [hasReception, hasKitchen, afterHours, suppliesIncluded, highTouchDisinfection].forEach(checkbox => {
    if (checkbox) {
      checkbox.addEventListener('change', calculateQuoteFromEngine);
    }
  });

  quoteEngineListenersSetup = true;
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

  // Show result div
  resultDiv.classList.remove('hidden');

  // Display monthly price (ex-HST)
  const monthlyExHstEl = document.getElementById('calc-monthly-ex-hst');
  if (monthlyExHstEl) {
    monthlyExHstEl.textContent = `$${result.monthly_price_ex_hst.toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  // Display HST amount
  const hstEl = document.getElementById('calc-hst');
  if (hstEl) {
    hstEl.textContent = `$${result.hst_amount.toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  // Display total (inc-HST)
  const totalEl = document.getElementById('calc-total');
  if (totalEl) {
    totalEl.textContent = `$${result.monthly_price_inc_hst.toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  // Display per-visit price
  const perVisitPriceEl = document.getElementById('calc-per-visit');
  if (perVisitPriceEl) {
    perVisitPriceEl.textContent = `$${result.per_visit_price.toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  // Display assumptions
  const assumptionsEl = document.getElementById('calc-assumptions');
  if (assumptionsEl) {
    let assumptionsText = `Up to ${result.assumptions.sqft_cap.toLocaleString()} sq ft`;
    if (result.assumptions.supplies_included) {
      assumptionsText += ', supplies included';
    }
    if (result.assumptions.healthcare_disinfection) {
      assumptionsText += ', healthcare-focused disinfection';
    }
    assumptionsEl.textContent = assumptionsText;
  }

  // Display walkthrough recommendation
  const walkthroughEl = document.getElementById('calc-walkthrough-warning');
  if (walkthroughEl) {
    if (result.walkthrough_required) {
      walkthroughEl.classList.remove('hidden');
    } else {
      walkthroughEl.classList.add('hidden');
    }
  }
}

// Setup line items handlers
function setupLineItemsHandlers() {
  const addLineItemBtn = document.getElementById('add-line-item-btn');
  if (addLineItemBtn) {
    addLineItemBtn.addEventListener('click', addLineItem);
  }

  // Handle line item changes
  document.addEventListener('change', (e) => {
    if (e.target.classList.contains('line-item-quantity') || 
        e.target.classList.contains('line-item-price') ||
        e.target.classList.contains('line-item-unit')) {
      updateLineItemsTotals();
    }
  });

  // Handle line item removal
  document.addEventListener('click', (e) => {
    if (e.target.classList.contains('remove-line-item')) {
      const itemId = e.target.dataset.itemId;
      removeLineItem(itemId);
    }
  });
}

// Add line item
function addLineItem() {
  const itemId = Date.now();
  const lineItemsList = document.getElementById('quote-line-items-list');
  
  if (!lineItemsList) return;

  const itemHTML = `
    <div class="line-item flex items-center space-x-4 p-3 border border-nfgray dark:border-gray-700 rounded-lg" data-item-id="${itemId}">
      <input type="text" class="line-item-name flex-1 px-3 py-2 border border-nfgray dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800" placeholder="Item name" data-item-id="${itemId}">
      <input type="number" class="line-item-quantity w-20 px-3 py-2 border border-nfgray dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800" placeholder="Qty" value="1" min="1" data-item-id="${itemId}">
      <select class="line-item-unit w-32 px-3 py-2 border border-nfgray dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800" data-item-id="${itemId}">
        <option value="each">Each</option>
        <option value="hour">Per Hour</option>
        <option value="month">Per Month</option>
        <option value="range">Range</option>
      </select>
      <input type="number" class="line-item-price w-32 px-3 py-2 border border-nfgray dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800" placeholder="Price" step="0.01" min="0" data-item-id="${itemId}">
      <button type="button" class="remove-line-item text-red-500 hover:text-red-700" data-item-id="${itemId}">
        <i data-lucide="trash-2" class="w-4 h-4"></i>
      </button>
    </div>
  `;

  lineItemsList.insertAdjacentHTML('beforeend', itemHTML);
  
  if (window.lucide) lucide.createIcons();
  updateLineItemsTotals();
}

// Remove line item
function removeLineItem(itemId) {
  const item = document.querySelector(`.line-item[data-item-id="${itemId}"]`);
  if (item) {
    item.remove();
    updateLineItemsTotals();
  }
}

// Update line items totals
function updateLineItemsTotals() {
  let subtotal = 0;
  let tax = 0;
  let total = 0;

  // Check if we have quote engine calculation results
  if (wizardData.quote_calculation && wizardData.quote_calculation.result) {
    const calc = wizardData.quote_calculation.result;
    subtotal = calc.monthly_price_ex_hst || 0;
    tax = calc.hst_amount || 0;
    total = calc.monthly_price_inc_hst || 0;
  } else {
    // Calculate from line items in DOM or wizardData
    const lineItems = wizardData.line_items || [];
    lineItems.forEach(item => {
      const qty = parseFloat(item.quantity || 1);
      const price = parseFloat(item.unit_price || 0);
      if (item.unit !== 'range') {
        subtotal += qty * price;
      }
    });

    // Also check DOM for manual line items
    const lineItemRows = document.querySelectorAll('.line-item');
    lineItemRows.forEach(row => {
      const qty = parseFloat(row.querySelector('.line-item-quantity')?.value || 1);
      const price = parseFloat(row.querySelector('.line-item-price')?.value || 0);
      const unit = row.querySelector('.line-item-unit')?.value || 'each';
      if (unit !== 'range') {
        subtotal += qty * price;
      }
    });
    
    tax = subtotal * 0.13; // 13% HST
    total = subtotal + tax;
  }

  // Update UI
  const subtotalEl = document.getElementById('quote-subtotal');
  const taxEl = document.getElementById('quote-tax');
  const totalEl = document.getElementById('quote-total');

  if (subtotalEl) subtotalEl.textContent = `$${subtotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  if (taxEl) taxEl.textContent = `$${tax.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  if (totalEl) totalEl.textContent = `$${total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
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

    // Extract booking date/time from revision_data (they're only needed for email, not DB storage)
    const { booking_date: _bookingDate, booking_time: _bookingTime, ...revisionDataForDB } = wizardData.revision_data || {};

    // Save revision as draft
    const revisionData = {
      ...revisionDataForDB,
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
    
    // Reload deals if on deals tab (since quote auto-creates a deal)
    await refreshDealsIfOnDealsTab();
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
  
  let subtotal = 0;
  let tax = 0;
  let total = 0;

  // Priority 1: Check if we have quote engine calculation results (most accurate)
  if (wizardData.quote_calculation && wizardData.quote_calculation.result) {
    const calc = wizardData.quote_calculation.result;
    subtotal = calc.monthly_price_ex_hst || 0;
    tax = calc.hst_amount || 0;
    total = calc.monthly_price_inc_hst || 0;
    console.log('[Quote Confirmation] Read from quote_calculation:', { subtotal, tax, total });
  } else {
    // Priority 2: Try to read from displayed totals in DOM
    const subtotalEl = document.getElementById('quote-subtotal');
    const taxEl = document.getElementById('quote-tax');
    const totalEl = document.getElementById('quote-total');

    if (subtotalEl && taxEl && totalEl) {
      const subtotalText = subtotalEl.textContent.replace(/[^0-9.]/g, '');
      const taxText = taxEl.textContent.replace(/[^0-9.]/g, '');
      const totalText = totalEl.textContent.replace(/[^0-9.]/g, '');
      
      subtotal = parseFloat(subtotalText) || 0;
      tax = parseFloat(taxText) || 0;
      total = parseFloat(totalText) || 0;

      console.log('[Quote Confirmation] Read from displayed totals:', { subtotal, tax, total });
    }

    // Priority 3: Fallback to calculating from wizardData line items
    if (subtotal === 0 && wizardData.line_items && wizardData.line_items.length > 0) {
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
  const subtotalElConfirmation = document.getElementById('confirmation-subtotal');
  const taxElConfirmation = document.getElementById('confirmation-tax');
  const totalElConfirmation = document.getElementById('confirmation-total');

  if (subtotalElConfirmation) subtotalElConfirmation.textContent = `$${subtotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  if (taxElConfirmation) taxElConfirmation.textContent = `$${tax.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  if (totalElConfirmation) totalElConfirmation.textContent = `$${total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

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

// Handle create quote - shows confirmation first
async function handleSendQuote() {
  if (!validateCurrentStep()) {
    return;
  }

  saveCurrentStepData();
  
  // Show confirmation modal with final price
  showQuoteSendConfirmation();
}

// Actually create the quote (called after confirmation)
async function confirmAndSendQuote() {
  closeQuoteSendConfirmation();

  try {
    // Create new account/site if needed before creating quote
    if (!wizardData.account_id && wizardData.new_account_data && accountType === 'new') {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('User not authenticated');

        // Create new site/account
        const { data: newSite, error: siteError } = await supabase
          .from('sites')
          .insert({
            name: wizardData.new_account_data.name,
            address: wizardData.new_account_data.address,
            contact_phone: wizardData.new_account_data.contact_phone || null,
            contact_email: wizardData.new_account_data.contact_email || null,
            status: 'Active',
            created_by: user.id
          })
          .select()
          .single();

        if (siteError) {
          console.error('[Quote Wizard] Error creating new site:', siteError);
          toast.error('Failed to create account. Please try again.', 'Error');
          throw siteError;
        }

        // Set account_id for quote creation
        wizardData.account_id = newSite.id;
        console.log('[Quote Wizard] Created new site/account:', newSite.id);
      } catch (error) {
        console.error('[Quote Wizard] Error creating account:', error);
        throw error;
      }
    }

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

    // Extract booking date/time from revision_data (they're stored in DB for walkthrough quotes)
    const { booking_date, booking_time, ...revisionDataForDB } = wizardData.revision_data || {};

    // Save revision
    const revisionData = {
      ...revisionDataForDB,
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

    toast.success('Quote created successfully', 'Success');

    closeWizard();
    
    // Reload quotes list
    if (typeof loadQuotes === 'function') {
      await loadQuotes();
    }
    
    // Navigate to deals tab and refresh kanban board (since quote auto-creates a deal)
    if (typeof window.switchTab === 'function') {
      window.switchTab('deals');
      // Give it a moment for the tab to switch, then load deals
      setTimeout(async () => {
        await refreshDealsIfOnDealsTab();
      }, 300);
    } else {
      // Fallback: just refresh if already on deals tab
      await refreshDealsIfOnDealsTab();
    }
  } catch (error) {
    console.error('[Quote Wizard] Error creating quote:', error);
    toast.error('Failed to create quote', 'Error');
  }
}

// Refresh deals on Kanban board if currently on deals tab
async function refreshDealsIfOnDealsTab() {
  try {
    // Check if we're on the deals tab by looking for the deals-kanban element
    const dealsKanban = document.getElementById('deals-kanban');
    const dealsTab = document.querySelector('[data-tab="deals"]');
    const isDealsTabActive = dealsTab && dealsTab.classList.contains('active');
    
    if (dealsKanban || isDealsTabActive) {
      // Check if loadDealsForDashboard and renderDealsKanban are available (from sales.html)
      if (typeof window.loadDealsForDashboard === 'function' && typeof window.renderDealsKanban === 'function') {
        const dealsData = await window.loadDealsForDashboard();
        window.renderDealsKanban(dealsData);
        console.log('[Quote Wizard] Refreshed deals Kanban board');
      } else if (window.sales && typeof window.sales.loadDeals === 'function') {
        // Fallback to sales module
        await window.sales.loadDeals();
        console.log('[Quote Wizard] Refreshed deals via sales module');
      }
    }
  } catch (error) {
    console.warn('[Quote Wizard] Could not refresh deals:', error);
    // Don't throw - this is a nice-to-have refresh
  }
}
