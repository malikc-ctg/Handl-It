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
    // Reset simple quote form
    const titleInput = document.getElementById('simple-quote-title');
    if (titleInput) titleInput.value = '';
    // Reset quote engine fields
    resetQuoteEngineForm();
    // Setup quote engine listeners for auto-calculation
    setupQuoteEngineListeners();
  }
  
  if (window.lucide) lucide.createIcons();
}

/**
 * Ensure quote engine listeners are attached and run calculation once.
 * Call this when the quote modal is opened from deal detail (sales.js) so the Calculated Quote section updates.
 */
export function ensureQuoteEngineListenersAndCalculate() {
  setupQuoteEngineListeners();
  calculateQuoteFromEngine();
}

// Reset the quote engine form to defaults
function resetQuoteEngineForm() {
  const fields = {
    'quote-service-type': '',
    'quote-sqft-estimate': '',
    'quote-frequency-per-month': '4',
    'quote-urgency-days': '30',
    'quote-flooring': 'mostly_hard',
    'quote-notes': ''
  };
  
  for (const [id, value] of Object.entries(fields)) {
    const el = document.getElementById(id);
    if (el) el.value = value;
  }
  
  // Reset checkboxes
  const checkboxes = {
    'quote-after-hours': false,
    'quote-supplies-included': true,
    'quote-high-touch-disinfection': false
  };
  
  for (const [id, checked] of Object.entries(checkboxes)) {
    const el = document.getElementById(id);
    if (el) el.checked = checked;
  }
  
  // Reset all touchpoint number inputs to 0/1
  document.querySelectorAll('.quote-touchpoint').forEach(el => {
    if (el.type === 'number') {
      el.value = el.id === 'quote-num-floors' ? '1' : '0';
    } else if (el.type === 'checkbox') {
      el.checked = false;
    }
  });
  
  // Hide touchpoints section
  updateTouchpointsForServiceType(null);
  
  // Reset calculation display
  const calcResult = document.getElementById('quote-calculation-result');
  if (calcResult) {
    const monthly = calcResult.querySelector('#calc-monthly-ex-hst');
    const perVisit = calcResult.querySelector('#calc-per-visit');
    const hst = calcResult.querySelector('#calc-hst');
    const total = calcResult.querySelector('#calc-total');
    const assumptions = calcResult.querySelector('#calc-assumptions');
    
    if (monthly) monthly.textContent = '$0.00';
    if (perVisit) perVisit.textContent = '$0.00';
    if (hst) hst.textContent = '$0.00';
    if (total) total.textContent = '$0.00';
    if (assumptions) assumptions.textContent = '';
  }
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

// Show/hide service-specific touchpoint fields
function updateTouchpointsForServiceType(serviceType) {
  const section = document.getElementById('quote-touchpoints-section');
  const allTouchpoints = document.querySelectorAll('[id^="touchpoints-"]');
  
  // Hide all touchpoint sections
  allTouchpoints.forEach(tp => tp.classList.add('hidden'));
  
  if (!serviceType) {
    section?.classList.add('hidden');
    return;
  }
  
  // Show the section and the relevant touchpoints
  section?.classList.remove('hidden');
  const specificTouchpoints = document.getElementById(`touchpoints-${serviceType}`);
  if (specificTouchpoints) {
    specificTouchpoints.classList.remove('hidden');
  }
}

// Get touchpoint data based on current service type
function getTouchpointData(serviceType) {
  const data = {
    num_washrooms: 0,
    num_treatment_rooms: 0,
    has_reception: false,
    has_kitchen: false
  };
  
  switch (serviceType) {
    case 'commercial_office':
      data.num_workstations = parseInt(document.getElementById('quote-num-workstations')?.value) || 0;
      data.num_meeting_rooms = parseInt(document.getElementById('quote-num-meeting-rooms')?.value) || 0;
      data.num_washrooms = parseInt(document.getElementById('quote-num-washrooms')?.value) || 0;
      data.has_kitchen = document.getElementById('quote-has-kitchen')?.checked || false;
      data.has_reception = document.getElementById('quote-has-reception')?.checked || false;
      // Map to treatment rooms equivalent for calculation
      data.num_treatment_rooms = data.num_meeting_rooms;
      break;
      
    case 'medical_clinic':
      data.num_exam_rooms = parseInt(document.getElementById('quote-num-exam-rooms')?.value) || 0;
      data.num_washrooms = parseInt(document.getElementById('quote-num-washrooms-med')?.value) || 0;
      data.has_waiting = document.getElementById('quote-has-waiting-med')?.checked || false;
      data.has_lab = document.getElementById('quote-has-lab')?.checked || false;
      data.num_treatment_rooms = data.num_exam_rooms;
      data.has_reception = data.has_waiting;
      break;
      
    case 'physio_chiro':
      data.num_treatment_rooms = parseInt(document.getElementById('quote-num-treatment-rooms')?.value) || 0;
      data.num_washrooms = parseInt(document.getElementById('quote-num-washrooms-physio')?.value) || 0;
      data.has_gym = document.getElementById('quote-has-gym')?.checked || false;
      data.has_waiting = document.getElementById('quote-has-waiting-physio')?.checked || false;
      data.has_reception = data.has_waiting;
      break;
      
    case 'dental':
      data.num_operatories = parseInt(document.getElementById('quote-num-operatories')?.value) || 0;
      data.num_washrooms = parseInt(document.getElementById('quote-num-washrooms-dental')?.value) || 0;
      data.has_sterilization = document.getElementById('quote-has-sterilization')?.checked || false;
      data.has_xray = document.getElementById('quote-has-xray')?.checked || false;
      data.num_treatment_rooms = data.num_operatories;
      data.has_reception = true;
      break;
      
    case 'optical':
      data.num_exam_rooms = parseInt(document.getElementById('quote-num-exam-optical')?.value) || 0;
      data.num_washrooms = parseInt(document.getElementById('quote-num-washrooms-optical')?.value) || 0;
      data.has_retail = document.getElementById('quote-has-retail-optical')?.checked || false;
      data.has_lab = document.getElementById('quote-has-lab-optical')?.checked || false;
      data.num_treatment_rooms = data.num_exam_rooms;
      data.has_reception = data.has_retail;
      break;
      
    case 'industrial':
      data.num_warehouse_bays = parseInt(document.getElementById('quote-num-warehouse-bays')?.value) || 0;
      data.num_washrooms = parseInt(document.getElementById('quote-num-washrooms-ind')?.value) || 0;
      data.has_office = document.getElementById('quote-has-office-ind')?.checked || false;
      data.has_break_room = document.getElementById('quote-has-break-ind')?.checked || false;
      data.has_kitchen = data.has_break_room;
      break;
      
    case 'residential_common_area':
      data.num_floors = parseInt(document.getElementById('quote-num-floors')?.value) || 1;
      data.num_elevators = parseInt(document.getElementById('quote-num-elevators')?.value) || 0;
      data.has_lobby = document.getElementById('quote-has-lobby')?.checked || false;
      data.has_gym = document.getElementById('quote-has-gym-res')?.checked || false;
      data.has_reception = data.has_lobby;
      data.num_treatment_rooms = data.num_elevators;
      break;
      
    case 'restaurant':
      data.seating_capacity = parseInt(document.getElementById('quote-seating-capacity')?.value) || 0;
      data.num_washrooms = parseInt(document.getElementById('quote-num-washrooms-rest')?.value) || 0;
      data.has_commercial_kitchen = document.getElementById('quote-has-commercial-kitchen')?.checked || false;
      data.has_bar = document.getElementById('quote-has-bar')?.checked || false;
      data.has_kitchen = data.has_commercial_kitchen;
      // Estimate rooms from seating
      data.num_treatment_rooms = Math.ceil(data.seating_capacity / 50);
      break;
      
    case 'residential_home':
      data.num_bedrooms = parseInt(document.getElementById('quote-num-bedrooms')?.value) || 0;
      data.num_bathrooms = parseInt(document.getElementById('quote-num-bathrooms')?.value) || 0;
      data.num_floors = parseInt(document.getElementById('quote-num-home-floors')?.value) || 1;
      data.has_basement = document.getElementById('quote-has-basement')?.checked || false;
      data.has_garage = document.getElementById('quote-has-garage')?.checked || false;
      data.has_pets = document.getElementById('quote-has-pets')?.checked || false;
      // Map to standard calculation fields
      data.num_washrooms = data.num_bathrooms;
      data.num_treatment_rooms = data.num_bedrooms;
      data.has_kitchen = true;
      break;
      
    case 'realtor':
      data.num_bedrooms = parseInt(document.getElementById('quote-num-bedrooms-realtor')?.value) || 0;
      data.num_bathrooms = parseInt(document.getElementById('quote-num-bathrooms-realtor')?.value) || 0;
      data.cleaning_type = document.getElementById('quote-realtor-cleaning-type')?.value || 'move_out';
      data.is_vacant = document.getElementById('quote-is-vacant')?.checked || false;
      data.appliance_cleaning = document.getElementById('quote-appliance-cleaning')?.checked || false;
      data.window_cleaning = document.getElementById('quote-window-cleaning')?.checked || false;
      // Map to standard calculation fields
      data.num_washrooms = data.num_bathrooms;
      data.num_treatment_rooms = data.num_bedrooms;
      data.has_kitchen = data.appliance_cleaning;
      // Deep clean and move-out require more work
      if (data.cleaning_type === 'deep_clean' || data.cleaning_type === 'move_out') {
        data.deep_clean_multiplier = 1.5;
      }
      break;
      
    case 'property_manager':
      data.num_units = parseInt(document.getElementById('quote-num-units')?.value) || 1;
      data.avg_bedrooms = parseFloat(document.getElementById('quote-avg-bedrooms')?.value) || 2;
      data.pm_service_type = document.getElementById('quote-pm-service-type')?.value || 'turnover';
      data.turnovers_per_month = parseInt(document.getElementById('quote-turnovers-per-month')?.value) || 2;
      data.has_common_areas = document.getElementById('quote-has-common-areas')?.checked || false;
      data.priority_response = document.getElementById('quote-priority-response')?.checked || false;
      // Map to standard calculation fields based on service type
      if (data.pm_service_type === 'turnover') {
        data.num_treatment_rooms = Math.ceil(data.avg_bedrooms * data.turnovers_per_month);
        data.num_washrooms = data.turnovers_per_month;
      } else if (data.pm_service_type === 'common_areas') {
        data.num_treatment_rooms = Math.ceil(data.num_units / 10);
        data.has_reception = true;
      } else {
        // Full service
        data.num_treatment_rooms = Math.ceil(data.avg_bedrooms * data.turnovers_per_month) + Math.ceil(data.num_units / 10);
        data.num_washrooms = data.turnovers_per_month + 2;
        data.has_reception = true;
      }
      data.has_kitchen = true;
      break;
  }
  
  return data;
}

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
  const flooring = document.getElementById('quote-flooring');
  const afterHours = document.getElementById('quote-after-hours');
  const suppliesIncluded = document.getElementById('quote-supplies-included');
  const highTouchDisinfection = document.getElementById('quote-high-touch-disinfection');
  const urgencyDays = document.getElementById('quote-urgency-days');
  const notes = document.getElementById('quote-notes');
  
  // Service type change - show/hide touchpoints
  if (serviceType) {
    serviceType.addEventListener('change', (e) => {
      updateTouchpointsForServiceType(e.target.value);
      calculateQuoteFromEngine();
    });
  }

  // Add event listeners to basic inputs
  [serviceType, sqftEstimate, frequencyPerMonth, flooring, urgencyDays, notes].forEach(input => {
    if (input) {
      input.addEventListener('input', calculateQuoteFromEngine);
      input.addEventListener('change', calculateQuoteFromEngine);
    }
  });

  // Add event listeners to checkboxes
  [afterHours, suppliesIncluded, highTouchDisinfection].forEach(checkbox => {
    if (checkbox) {
      checkbox.addEventListener('change', calculateQuoteFromEngine);
    }
  });
  
  // Add listeners to all dynamic touchpoint inputs using event delegation
  document.getElementById('quote-touchpoints-section')?.addEventListener('input', calculateQuoteFromEngine);
  document.getElementById('quote-touchpoints-section')?.addEventListener('change', calculateQuoteFromEngine);

  quoteEngineListenersSetup = true;
}

// Calculate quote using Quote Engine v2
function calculateQuoteFromEngine() {
  // Get basic form inputs
  const serviceType = document.getElementById('quote-service-type')?.value;
  const sqftEstimate = parseFloat(document.getElementById('quote-sqft-estimate')?.value) || null;
  const frequencyPerMonth = parseInt(document.getElementById('quote-frequency-per-month')?.value) || 4;
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
  
  // Get service-specific touchpoint data
  const touchpointData = getTouchpointData(serviceType);

  try {
    // Calculate quote using engine
    const inputs = {
      service_type: serviceType,
      sqft_estimate: sqftEstimate,
      frequency_per_month: frequencyPerMonth,
      num_washrooms: touchpointData.num_washrooms,
      num_treatment_rooms: touchpointData.num_treatment_rooms,
      has_reception: touchpointData.has_reception,
      has_kitchen: touchpointData.has_kitchen,
      flooring: flooring,
      after_hours_required: afterHours,
      supplies_included: suppliesIncluded,
      high_touch_disinfection: highTouchDisinfection,
      urgency_start_days: urgencyDays,
      notes: notes,
      // Include all service-specific data for reference
      service_specific: touchpointData
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
  if (!result) return;

  // Normalize numeric fields with safe defaults to avoid undefined errors
  const monthlyExHst = Number(result.monthly_price_ex_hst) || 0;
  const hstAmount = Number(result.hst_amount) || 0;
  const monthlyIncHst = Number(result.monthly_price_inc_hst) || 0;
  const perVisitPrice = Number(result.per_visit_price) || 0;

  const resultDiv = document.getElementById('quote-calculation-result');
  if (!resultDiv) return;

  // Show result div
  resultDiv.classList.remove('hidden');

  // Display monthly price (ex-HST)
  const monthlyExHstEl = document.getElementById('calc-monthly-ex-hst');
  if (monthlyExHstEl) {
    monthlyExHstEl.textContent = `$${monthlyExHst.toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  // Display HST amount
  const hstEl = document.getElementById('calc-hst');
  if (hstEl) {
    hstEl.textContent = `$${hstAmount.toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  // Display total (inc-HST)
  const totalEl = document.getElementById('calc-total');
  if (totalEl) {
    totalEl.textContent = `$${monthlyIncHst.toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  // Display per-visit price
  const perVisitPriceEl = document.getElementById('calc-per-visit');
  if (perVisitPriceEl) {
    perVisitPriceEl.textContent = `$${perVisitPrice.toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  // Display assumptions
  const assumptionsEl = document.getElementById('calc-assumptions');
  if (assumptionsEl) {
    let assumptionsText = '';
    if (result.assumptions?.sqft_cap) {
      assumptionsText = `Up to ${result.assumptions.sqft_cap.toLocaleString()} sq ft`;
    }
    if (result.assumptions?.supplies_included) {
      assumptionsText += assumptionsText ? ', supplies included' : 'Supplies included';
    }
    if (result.assumptions?.healthcare_disinfection) {
      assumptionsText += assumptionsText ? ', healthcare-focused disinfection' : 'Healthcare-focused disinfection';
    }
    assumptionsEl.textContent = assumptionsText || 'Standard service';
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

// Handle save draft (simplified - saves quote calculation only)
async function handleSaveDraft() {
  try {
    // Get the quote title
    const titleInput = document.getElementById('simple-quote-title');
    const title = titleInput?.value?.trim() || 'Untitled Quote';
    
    // Gather quote engine data
    const serviceType = document.getElementById('quote-service-type')?.value;
    const sqft = parseInt(document.getElementById('quote-sqft-estimate')?.value) || 0;
    const frequency = parseInt(document.getElementById('quote-frequency-per-month')?.value) || 4;
    const urgency = parseInt(document.getElementById('quote-urgency-days')?.value) || 30;
    const flooring = document.getElementById('quote-flooring')?.value || 'mostly_hard';
    const afterHours = document.getElementById('quote-after-hours')?.checked || false;
    const suppliesIncluded = document.getElementById('quote-supplies-included')?.checked || true;
    const highTouchDisinfection = document.getElementById('quote-high-touch-disinfection')?.checked || false;
    const notes = document.getElementById('quote-notes')?.value || '';
    
    // Get service-specific touchpoint data
    const touchpointData = serviceType ? getTouchpointData(serviceType) : {};
    
    // Get calculated values from display
    const monthlyExHst = parseFloat(document.getElementById('calc-monthly-ex-hst')?.textContent?.replace(/[^0-9.]/g, '')) || 0;
    const perVisit = parseFloat(document.getElementById('calc-per-visit')?.textContent?.replace(/[^0-9.]/g, '')) || 0;
    const hst = parseFloat(document.getElementById('calc-hst')?.textContent?.replace(/[^0-9.]/g, '')) || 0;
    const total = parseFloat(document.getElementById('calc-total')?.textContent?.replace(/[^0-9.]/g, '')) || 0;

    if (!serviceType) {
      toast.error('Please select a service type', 'Error');
      return;
    }
    
    if (monthlyExHst === 0) {
      toast.error('Please fill in quote details to calculate pricing', 'Error');
      return;
    }

    // Create quote without account (simplified)
    const quote = await quotesModule.createQuote({
      account_id: null,
      primary_contact_id: null,
      deal_id: null,
      quote_type: 'standard'
    });
    currentQuoteId = quote.id;

    // Save revision with calculation data
    const revisionData = {
      revision_type: 'final_quote',
      is_binding: true,
      scope_summary: title,
      assumptions: notes,
      quote_engine_version: '2.0',
      quote_calculation_inputs: {
        service_type: serviceType,
        sqft_estimate: sqft,
        frequency_per_month: frequency,
        urgency_days: urgency,
        flooring: flooring,
        after_hours: afterHours,
        supplies_included: suppliesIncluded,
        high_touch_disinfection: highTouchDisinfection,
        // Include service-specific touchpoint data
        ...touchpointData
      },
      quote_calculation_outputs: {
        monthly_price_ex_hst: monthlyExHst,
        per_visit_price: perVisit,
        hst_amount: hst,
        monthly_price_inc_hst: total
      }
    };

    // Create a line item for the service
    const lineItems = [{
      description: title || `${serviceType} Cleaning Service`,
      quantity: frequency,
      unit_price: perVisit,
      line_total: monthlyExHst
    }];

    await quotesModule.saveRevision(currentQuoteId, 1, revisionData, lineItems);

    toast.success('Quote saved successfully', 'Success');
    closeWizard();
    
    // Reload quotes list
    if (window.loadQuotes && typeof window.loadQuotes === 'function') {
      await window.loadQuotes();
    } else {
      // Try dispatching a custom event
      window.dispatchEvent(new CustomEvent('quotes-updated'));
    }
  } catch (error) {
    console.error('[Quote Wizard] Error saving quote:', error);
    toast.error('Failed to save quote: ' + (error.message || error), 'Error');
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
