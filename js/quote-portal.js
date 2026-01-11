// Public Quote Portal JavaScript
// Handles token-based quote viewing, accepting, and declining

import { supabase } from './supabase.js';
import * as quotesModule from './quotes.js';

// Get token from URL
const urlParams = new URLSearchParams(window.location.search);
const token = urlParams.get('token') || window.location.pathname.split('/').pop();

let currentRevision = null;
let quoteId = null;
let revisionNumber = null;

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
  if (!token) {
    showError();
    return;
  }

  await loadQuoteByToken(token);
});

async function loadQuoteByToken(token) {
  try {
    showLoading();

    // Load revision by token
    const revision = await quotesModule.getRevisionByToken(token);
    
    if (!revision) {
      showError();
      return;
    }

    if (revision.expired) {
      showExpired();
      return;
    }

    currentRevision = revision;
    quoteId = revision.quotes.id;
    revisionNumber = revision.revision_number;

    // Log view event
    await quotesModule.logPortalEvent(token, 'viewed');

    // Hide loading
    document.getElementById('loading-state').classList.add('hidden');

    // Render based on revision type
    if (revision.revision_type === 'walkthrough_proposal') {
      renderWalkthroughProposal(revision);
    } else {
      renderFinalQuote(revision);
    }

    // Initialize expiry timer if applicable
    if (revision.expires_at) {
      initializeExpiryTimer(revision.expires_at);
    }

    if (window.lucide) lucide.createIcons();
  } catch (error) {
    console.error('[Quote Portal] Error loading quote:', error);
    showError();
  }
}

function renderWalkthroughProposal(revision) {
  const view = document.getElementById('walkthrough-proposal-view');
  view.classList.remove('hidden');

  const quote = revision.quotes;
  const site = quote.account_id;

  // Account info
  document.getElementById('proposal-account-info').innerHTML = `
    <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
      <div>
        <h3 class="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Account</h3>
        <p class="text-lg font-semibold text-gray-900 dark:text-gray-100">${site?.name || 'N/A'}</p>
        ${site?.address ? `<p class="text-sm text-gray-600 dark:text-gray-400">${site.address}</p>` : ''}
      </div>
      <div>
        <h3 class="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Contact</h3>
        ${site?.contact_email ? `<p class="text-gray-700 dark:text-gray-300">${site.contact_email}</p>` : ''}
        ${site?.contact_phone ? `<p class="text-gray-700 dark:text-gray-300">${site.contact_phone}</p>` : ''}
      </div>
    </div>
  `;

  // Service schedule
  document.getElementById('proposal-service-schedule').textContent = revision.service_schedule_summary || 'Not specified';

  // Scope summary
  document.getElementById('proposal-scope-summary').textContent = revision.scope_summary || 'Not specified';

  // Range estimate (if exists)
  if (revision.lineItems && revision.lineItems.length > 0) {
    const rangeItem = revision.lineItems.find(item => item.unit === 'range');
    if (rangeItem && rangeItem.range_low && rangeItem.range_high) {
      document.getElementById('proposal-range-estimate').classList.remove('hidden');
      document.getElementById('proposal-range-display').textContent = 
        `$${Number(rangeItem.range_low).toLocaleString()} - $${Number(rangeItem.range_high).toLocaleString()}`;
    }
  }

  // Assumptions & exclusions
  if (revision.assumptions) {
    document.getElementById('proposal-assumptions-section').classList.remove('hidden');
    document.getElementById('proposal-assumptions').textContent = revision.assumptions;
  }
  if (revision.exclusions) {
    document.getElementById('proposal-exclusions-section').classList.remove('hidden');
    document.getElementById('proposal-exclusions').textContent = revision.exclusions;
  }

  // Event listeners
  document.getElementById('book-walkthrough-btn').addEventListener('click', () => {
    // TODO: Implement walkthrough booking
    alert('Walkthrough booking will be implemented');
  });

  document.getElementById('download-proposal-pdf-btn').addEventListener('click', async () => {
    await downloadPDF(token);
  });
}

function renderFinalQuote(revision) {
  const view = document.getElementById('final-quote-view');
  view.classList.remove('hidden');

  const quote = revision.quotes;
  const site = quote.account_id;

  // Account info
  document.getElementById('final-account-info').innerHTML = `
    <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
      <div>
        <h3 class="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Account</h3>
        <p class="text-lg font-semibold text-gray-900 dark:text-gray-100">${site?.name || 'N/A'}</p>
        ${site?.address ? `<p class="text-sm text-gray-600 dark:text-gray-400">${site.address}</p>` : ''}
      </div>
      <div>
        <h3 class="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Contact</h3>
        ${site?.contact_email ? `<p class="text-gray-700 dark:text-gray-300">${site.contact_email}</p>` : ''}
        ${site?.contact_phone ? `<p class="text-gray-700 dark:text-gray-300">${site.contact_phone}</p>` : ''}
      </div>
    </div>
  `;

  // Line items
  const tbody = document.getElementById('final-line-items');
  if (revision.lineItems && revision.lineItems.length > 0) {
    tbody.innerHTML = revision.lineItems.map(item => `
      <tr>
        <td class="px-4 py-3">
          <div class="font-medium text-gray-900 dark:text-gray-100">${item.name || 'Item'}</div>
          ${item.description ? `<div class="text-sm text-gray-500 dark:text-gray-400">${item.description}</div>` : ''}
        </td>
        <td class="px-4 py-3 text-right text-gray-700 dark:text-gray-300">${Number(item.quantity || 1).toLocaleString()}</td>
        <td class="px-4 py-3 text-right text-gray-700 dark:text-gray-300">$${Number(item.unit_price || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
        <td class="px-4 py-3 text-right font-medium text-gray-900 dark:text-gray-100">$${Number(item.line_total || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
      </tr>
    `).join('');
  } else {
    tbody.innerHTML = '<tr><td colspan="4" class="px-4 py-3 text-center text-gray-500">No line items</td></tr>';
  }

  // Totals
  document.getElementById('final-subtotal').textContent = `$${Number(revision.subtotal || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
  document.getElementById('final-tax').textContent = `$${Number(revision.tax || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
  document.getElementById('final-total').textContent = `$${Number(revision.total || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}`;

  // Terms
  const termsDiv = document.getElementById('final-terms');
  const terms = [];
  if (revision.billing_frequency) terms.push(`Billing: ${revision.billing_frequency}`);
  if (revision.contract_term_months) terms.push(`Term: ${revision.contract_term_months} months`);
  if (revision.start_date_proposed) terms.push(`Start: ${new Date(revision.start_date_proposed).toLocaleDateString()}`);
  termsDiv.innerHTML = terms.map(term => `<div>${term}</div>`).join('') || '<div class="text-gray-400">No terms specified</div>';

  // Assumptions & exclusions
  const assumptionsExclusions = document.getElementById('final-assumptions-exclusions');
  const items = [];
  if (revision.assumptions) items.push(`<div><strong>Assumptions:</strong> ${revision.assumptions}</div>`);
  if (revision.exclusions) items.push(`<div><strong>Exclusions:</strong> ${revision.exclusions}</div>`);
  assumptionsExclusions.innerHTML = items.join('') || '<div class="text-gray-400">None specified</div>';

  // Check if already accepted/declined
  if (revision.accepted_at) {
    document.getElementById('quote-response-form').classList.add('hidden');
    document.getElementById('quote-status-badge').classList.remove('hidden');
    document.getElementById('quote-status-badge').innerHTML = `
      <div class="inline-flex items-center px-4 py-2 bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 rounded-lg">
        <i data-lucide="check-circle" class="w-5 h-5 mr-2"></i>
        Accepted on ${new Date(revision.accepted_at).toLocaleDateString()}
      </div>
    `;
  } else if (revision.declined_at) {
    document.getElementById('quote-response-form').classList.add('hidden');
    document.getElementById('quote-status-badge').classList.remove('hidden');
    document.getElementById('quote-status-badge').innerHTML = `
      <div class="inline-flex items-center px-4 py-2 bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200 rounded-lg">
        <i data-lucide="x-circle" class="w-5 h-5 mr-2"></i>
        Declined on ${new Date(revision.declined_at).toLocaleDateString()}
      </div>
    `;
  }

  // Event listeners
  document.getElementById('accept-quote-btn').addEventListener('click', () => {
    document.getElementById('accept-quote-modal').classList.remove('hidden');
  });

  document.getElementById('decline-quote-btn').addEventListener('click', () => {
    document.getElementById('decline-quote-modal').classList.remove('hidden');
  });

  document.getElementById('download-final-pdf-btn').addEventListener('click', async () => {
    await downloadPDF(token);
  });

  // Accept modal
  document.getElementById('cancel-accept-btn').addEventListener('click', () => {
    document.getElementById('accept-quote-modal').classList.add('hidden');
  });

  document.getElementById('confirm-accept-btn').addEventListener('click', async () => {
    const name = document.getElementById('accept-name').value;
    const email = document.getElementById('accept-email').value;
    const acknowledged = document.getElementById('accept-acknowledge').checked;

    if (!name || !email || !acknowledged) {
      alert('Please fill in all required fields and acknowledge the agreement');
      return;
    }

    try {
      await quotesModule.acceptFinalQuote(quoteId, revisionNumber, {
        name,
        email,
        ip: await getClientIP()
      });

      document.getElementById('accept-quote-modal').classList.add('hidden');
      await loadQuoteByToken(token); // Reload to show accepted state
    } catch (error) {
      console.error('[Quote Portal] Error accepting quote:', error);
      alert('Failed to accept quote. Please try again.');
    }
  });

  // Decline modal
  document.getElementById('cancel-decline-btn').addEventListener('click', () => {
    document.getElementById('decline-quote-modal').classList.add('hidden');
  });

  document.getElementById('confirm-decline-btn').addEventListener('click', async () => {
    const reason = document.getElementById('decline-reason').value;
    const notes = document.getElementById('decline-notes').value;

    if (!reason) {
      alert('Please select a reason');
      return;
    }

    try {
      await quotesModule.declineFinalQuote(quoteId, revisionNumber, {
        reason,
        notes
      });

      document.getElementById('decline-quote-modal').classList.add('hidden');
      await loadQuoteByToken(token); // Reload to show declined state
    } catch (error) {
      console.error('[Quote Portal] Error declining quote:', error);
      alert('Failed to decline quote. Please try again.');
    }
  });
}

async function downloadPDF(token) {
  try {
    await quotesModule.logPortalEvent(token, 'pdf_downloaded');
    // TODO: Implement PDF download
    alert('PDF download will be implemented');
  } catch (error) {
    console.error('[Quote Portal] Error downloading PDF:', error);
  }
}

function initializeExpiryTimer(expiresAt) {
  const timerEl = document.getElementById('quote-expiry-timer');
  if (!timerEl) return;

  function updateTimer() {
    const now = new Date();
    const expiry = new Date(expiresAt);
    const diff = expiry - now;

    if (diff <= 0) {
      timerEl.textContent = 'Expired';
      showExpired();
      return;
    }

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    if (days > 0) {
      timerEl.textContent = `${days}d ${hours}h`;
    } else if (hours > 0) {
      timerEl.textContent = `${hours}h ${minutes}m`;
    } else {
      timerEl.textContent = `${minutes}m`;
    }
  }

  updateTimer();
  setInterval(updateTimer, 60000); // Update every minute
}

async function getClientIP() {
  try {
    const response = await fetch('https://api.ipify.org?format=json');
    const data = await response.json();
    return data.ip;
  } catch (error) {
    return null;
  }
}

function showLoading() {
  document.getElementById('loading-state').classList.remove('hidden');
  document.getElementById('error-state').classList.add('hidden');
  document.getElementById('expired-state').classList.add('hidden');
  document.getElementById('walkthrough-proposal-view').classList.add('hidden');
  document.getElementById('final-quote-view').classList.add('hidden');
}

function showError() {
  document.getElementById('loading-state').classList.add('hidden');
  document.getElementById('error-state').classList.remove('hidden');
  document.getElementById('expired-state').classList.add('hidden');
  document.getElementById('walkthrough-proposal-view').classList.add('hidden');
  document.getElementById('final-quote-view').classList.add('hidden');
}

function showExpired() {
  document.getElementById('loading-state').classList.add('hidden');
  document.getElementById('error-state').classList.add('hidden');
  document.getElementById('expired-state').classList.remove('hidden');
  document.getElementById('walkthrough-proposal-view').classList.add('hidden');
  document.getElementById('final-quote-view').classList.add('hidden');
}
