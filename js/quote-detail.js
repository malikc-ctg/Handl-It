// Quote Detail Modal Integration
// Handles loading and rendering quote details, revisions, events, and walkthrough status

import * as quotesModule from './quotes.js';
import { toast } from './notifications.js';

let currentQuote = null;

// Open quote detail modal
export async function openQuoteDetail(quoteId) {
  const modal = document.getElementById('quote-detail-modal');
  if (!modal) {
    console.error('[Quote Detail] Modal not found');
    return;
  }

  try {
    // Show modal with loading state
    modal.classList.remove('hidden');
    
    // Load quote detail
    const quote = await quotesModule.loadQuoteDetail(quoteId);
    if (!quote) {
      toast.error('Failed to load quote details', 'Error');
      modal.classList.add('hidden');
      return;
    }

    currentQuote = quote;
    renderQuoteDetail(quote);

    if (window.lucide) lucide.createIcons();
  } catch (error) {
    console.error('[Quote Detail] Error opening quote detail:', error);
    toast.error('Failed to load quote details', 'Error');
    modal.classList.add('hidden');
  }
}

// Render quote detail
function renderQuoteDetail(quote) {
  // Header
  const site = quote.account_id;
  const titleEl = document.getElementById('quote-detail-title');
  const subtitleEl = document.getElementById('quote-detail-subtitle');
  const metaEl = document.getElementById('quote-detail-meta');
  const summaryEl = document.getElementById('quote-summary-card');
  
  if (titleEl) titleEl.textContent = `Quote - ${site?.name || 'Unknown Account'}`;
  
  if (subtitleEl) {
    const statusConfig = {
      draft: { bg: 'bg-gray-500', text: 'Draft', icon: 'file-text' },
      sent: { bg: 'bg-blue-500', text: 'Sent', icon: 'send' },
      viewed: { bg: 'bg-yellow-500', text: 'Viewed', icon: 'eye' },
      accepted: { bg: 'bg-green-500', text: 'Accepted', icon: 'check-circle' },
      declined: { bg: 'bg-red-500', text: 'Declined', icon: 'x-circle' },
      expired: { bg: 'bg-gray-500', text: 'Expired', icon: 'clock' },
      withdrawn: { bg: 'bg-gray-500', text: 'Withdrawn', icon: 'ban' }
    };
    
    const status = quote.status || 'draft';
    const statusInfo = statusConfig[status] || statusConfig.draft;
    const quoteTypeLabel = quote.quote_type === 'walkthrough_required' ? 'Walkthrough Required' : 'Standard';
    const quoteTypeBg = quote.quote_type === 'walkthrough_required' ? 'bg-indigo-500' : 'bg-purple-500';
    
    subtitleEl.innerHTML = `
      <span class="inline-flex items-center gap-2 px-3 py-1.5 ${statusInfo.bg} text-white rounded-full text-sm font-semibold shadow-md">
        <i data-lucide="${statusInfo.icon}" class="w-4 h-4"></i>
        ${statusInfo.text}
      </span>
      <span class="inline-flex items-center gap-2 px-3 py-1.5 ${quoteTypeBg} text-white rounded-full text-sm font-semibold shadow-md">
        <i data-lucide="${quote.quote_type === 'walkthrough_required' ? 'calendar' : 'file-check'}" class="w-4 h-4"></i>
        ${quoteTypeLabel}
      </span>
    `;
  }
  
  // Get latest revision for use in multiple places
  const latestRevision = quote.revisions?.[0];
  
  // Calculate values that will be used in multiple places
  const createdDate = quote.created_at ? new Date(quote.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'N/A';
  const revisionCount = quote.revisions?.length || 0;
  
  // Calculate total amount - check multiple sources
  let totalAmount = 'N/A';
  if (latestRevision) {
    // Priority 1: Use revision.total if available
    if (latestRevision.total != null && latestRevision.total !== 0) {
      totalAmount = `$${Number(latestRevision.total).toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
    }
    // Priority 2: Calculate from subtotal + tax
    else if (latestRevision.subtotal != null) {
      const subtotal = Number(latestRevision.subtotal) || 0;
      const tax = Number(latestRevision.tax) || 0;
      const calculatedTotal = subtotal + tax;
      if (calculatedTotal > 0) {
        totalAmount = `$${calculatedTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
      }
    }
    // Priority 3: Calculate from line items
    else if (quote.lineItems && quote.lineItems.length > 0) {
      const revisionLineItems = quote.lineItems.filter(item => item.revision_number === latestRevision.revision_number);
      let subtotal = 0;
      revisionLineItems.forEach(item => {
        if (item.line_total != null) {
          subtotal += Number(item.line_total) || 0;
        } else if (item.unit_price != null && item.quantity != null) {
          subtotal += (Number(item.unit_price) || 0) * (Number(item.quantity) || 0);
        }
      });
      const tax = subtotal * 0.13; // 13% HST
      const calculatedTotal = subtotal + tax;
      if (calculatedTotal > 0) {
        totalAmount = `$${calculatedTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
      }
    }
  }
  
  const lineItemsCount = latestRevision ? (quote.lineItems?.filter(item => item.revision_number === latestRevision.revision_number).length || 0) : 0;
  
  // Meta information
  if (metaEl) {
    metaEl.innerHTML = `
      <div class="flex items-center gap-2">
        <i data-lucide="calendar" class="w-4 h-4"></i>
        <span>Created: ${createdDate}</span>
      </div>
      <div class="flex items-center gap-2">
        <i data-lucide="file-text" class="w-4 h-4"></i>
        <span>${revisionCount} Revision${revisionCount !== 1 ? 's' : ''}</span>
      </div>
      <div class="flex items-center gap-2">
        <i data-lucide="dollar-sign" class="w-4 h-4"></i>
        <span class="font-semibold">${totalAmount}</span>
      </div>
    `;
  }
  
  // Summary card
  if (summaryEl) {
    if (latestRevision) {
      const sentDate = latestRevision.sent_at ? new Date(latestRevision.sent_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : null;
      const expiresDate = latestRevision.expires_at ? new Date(latestRevision.expires_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : null;
      
      summaryEl.innerHTML = `
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div class="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
            <div class="text-sm text-gray-500 dark:text-gray-400 mb-1">Total Amount</div>
            <div class="text-2xl font-bold text-nfgblue dark:text-blue-400">${totalAmount}</div>
          </div>
        <div class="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
          <div class="text-sm text-gray-500 dark:text-gray-400 mb-1">Line Items</div>
          <div class="text-2xl font-bold text-gray-900 dark:text-gray-100">${lineItemsCount}</div>
        </div>
        <div class="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
          <div class="text-sm text-gray-500 dark:text-gray-400 mb-1">Revision #</div>
          <div class="text-2xl font-bold text-gray-900 dark:text-gray-100">${latestRevision.revision_number}</div>
        </div>
      </div>
      ${sentDate ? `
        <div class="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
          <div class="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
            <i data-lucide="send" class="w-4 h-4"></i>
            <span>Sent: ${sentDate}</span>
          </div>
        </div>
      ` : ''}
      ${expiresDate ? `
        <div class="mt-2 flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
          <i data-lucide="clock" class="w-4 h-4"></i>
          <span>Expires: ${expiresDate}</span>
        </div>
      ` : ''}
    `;
    } else {
      // No revisions yet
      summaryEl.innerHTML = `
        <div class="text-center py-6 text-gray-500 dark:text-gray-400">
          <i data-lucide="file-text" class="w-12 h-12 mx-auto mb-2 opacity-50"></i>
          <p>No revisions available yet</p>
        </div>
      `;
    }
  }

  // Walkthrough block (if walkthrough_required)
  if (quote.quote_type === 'walkthrough_required') {
    renderWalkthroughBlock(quote);
  } else {
    const walkthroughBlock = document.getElementById('quote-walkthrough-block');
    if (walkthroughBlock) walkthroughBlock.classList.add('hidden');
  }

  // Revisions list
  renderRevisions(quote);

  // Events timeline
  renderEvents(quote);

  // Action buttons
  renderActionButtons(quote);
}

// Render walkthrough block
function renderWalkthroughBlock(quote) {
  const block = document.getElementById('quote-walkthrough-block');
  const content = document.getElementById('walkthrough-status-content');
  const actions = document.getElementById('walkthrough-actions');

  if (!block || !content) return;

  block.classList.remove('hidden');

  const walkthrough = quote.walkthrough;
  
  if (!walkthrough) {
    content.innerHTML = `
      <div class="bg-white dark:bg-gray-800 rounded-lg p-4 border border-blue-200 dark:border-blue-800">
        <p class="text-blue-900 dark:text-blue-100 font-medium">No walkthrough scheduled yet.</p>
        <p class="text-sm text-blue-700 dark:text-blue-300 mt-1">Schedule a walkthrough to proceed with the quote.</p>
      </div>
    `;
    if (actions) {
      actions.innerHTML = `
        <button id="schedule-walkthrough-btn" class="inline-flex items-center gap-2 px-5 py-2.5 bg-nfgblue hover:bg-nfgdark text-white rounded-lg font-medium transition shadow-md hover:shadow-lg">
          <i data-lucide="calendar-plus" class="w-4 h-4"></i>
          Schedule Walkthrough
        </button>
      `;
      document.getElementById('schedule-walkthrough-btn')?.addEventListener('click', () => {
        // TODO: Open schedule walkthrough modal
        toast.info('Walkthrough scheduling coming soon', 'Notice');
      });
    }
  } else {
    const statusConfig = {
      scheduled: { bg: 'bg-blue-500', text: 'Scheduled', icon: 'calendar' },
      completed: { bg: 'bg-green-500', text: 'Completed', icon: 'check-circle' },
      no_show: { bg: 'bg-red-500', text: 'No Show', icon: 'x-circle' },
      rescheduled: { bg: 'bg-yellow-500', text: 'Rescheduled', icon: 'calendar-clock' },
      cancelled: { bg: 'bg-gray-500', text: 'Cancelled', icon: 'ban' }
    };
    
    const statusInfo = statusConfig[walkthrough.status] || statusConfig.scheduled;
    const scheduledDate = walkthrough.scheduled_at ? new Date(walkthrough.scheduled_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : null;
    const scheduledTime = walkthrough.scheduled_at ? new Date(walkthrough.scheduled_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : null;

    content.innerHTML = `
      <div class="bg-white dark:bg-gray-800 rounded-lg p-5 border border-blue-200 dark:border-blue-800">
        <div class="flex items-center gap-3 mb-4">
          <div class="w-12 h-12 ${statusInfo.bg} rounded-lg flex items-center justify-center shadow-md">
            <i data-lucide="${statusInfo.icon}" class="w-6 h-6 text-white"></i>
          </div>
          <div>
            <div class="font-semibold text-gray-900 dark:text-gray-100">Status</div>
            <div class="text-sm text-gray-600 dark:text-gray-400">${statusInfo.text}</div>
          </div>
        </div>
        <div class="space-y-3">
          ${scheduledDate ? `
            <div class="flex items-center gap-3">
              <i data-lucide="calendar" class="w-5 h-5 text-blue-600 dark:text-blue-400"></i>
              <div>
                <div class="text-sm text-gray-500 dark:text-gray-400">Scheduled Date</div>
                <div class="font-medium text-gray-900 dark:text-gray-100">${scheduledDate}${scheduledTime ? ` at ${scheduledTime}` : ''}</div>
              </div>
            </div>
          ` : ''}
          ${walkthrough.location_address ? `
            <div class="flex items-center gap-3">
              <i data-lucide="map-pin" class="w-5 h-5 text-blue-600 dark:text-blue-400"></i>
              <div>
                <div class="text-sm text-gray-500 dark:text-gray-400">Location</div>
                <div class="font-medium text-gray-900 dark:text-gray-100">${walkthrough.location_address}</div>
              </div>
            </div>
          ` : ''}
        </div>
      </div>
    `;

    if (actions) {
      actions.innerHTML = '';
      if (walkthrough.status === 'scheduled') {
        actions.innerHTML = `
          <button id="mark-walkthrough-completed-btn" class="inline-flex items-center gap-2 px-5 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition shadow-md hover:shadow-lg">
            <i data-lucide="check-circle" class="w-4 h-4"></i>
            Mark Completed
          </button>
        `;
        document.getElementById('mark-walkthrough-completed-btn')?.addEventListener('click', async () => {
          try {
            await quotesModule.updateWalkthroughStatus(walkthrough.id, 'completed');
            await openQuoteDetail(quote.id); // Reload
          } catch (error) {
            console.error('[Quote Detail] Error updating walkthrough:', error);
          }
        });
      }
    }
  }
}

// Render revisions
function renderRevisions(quote) {
  const container = document.getElementById('quote-revisions-list');
  if (!container) return;

  if (!quote.revisions || quote.revisions.length === 0) {
    container.innerHTML = `
      <div class="text-center py-8 text-gray-500 dark:text-gray-400">
        <i data-lucide="file-text" class="w-12 h-12 mx-auto mb-2 opacity-50"></i>
        <p>No revisions yet</p>
      </div>
    `;
    return;
  }

  container.innerHTML = quote.revisions.map((rev, index) => {
    const sentDate = rev.sent_at ? new Date(rev.sent_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Not sent';
    const typeLabel = rev.revision_type === 'walkthrough_proposal' ? 'Walkthrough Proposal' : 'Final Quote';
    const typeBg = rev.revision_type === 'walkthrough_proposal' ? 'bg-blue-500' : 'bg-green-500';
    const typeIcon = rev.revision_type === 'walkthrough_proposal' ? 'calendar' : 'file-check';
    const isLatest = index === 0;
    const total = rev.total ? Number(rev.total).toLocaleString('en-US', { minimumFractionDigits: 2 }) : null;
    
    return `
      <div class="relative bg-white dark:bg-gray-800 rounded-xl border-2 ${isLatest ? 'border-nfgblue dark:border-blue-500 shadow-lg' : 'border-gray-200 dark:border-gray-700'} p-5 hover:shadow-md transition-all">
        ${isLatest ? `
          <div class="absolute -top-3 left-4 px-3 py-1 bg-nfgblue text-white text-xs font-bold rounded-full shadow-md">
            Latest
          </div>
        ` : ''}
        <div class="flex items-start justify-between gap-4">
          <div class="flex-1">
            <div class="flex items-center gap-3 mb-3">
              <div class="w-10 h-10 ${typeBg} rounded-lg flex items-center justify-center shadow-md">
                <i data-lucide="${typeIcon}" class="w-5 h-5 text-white"></i>
              </div>
              <div>
                <div class="flex items-center gap-2 mb-1">
                  <span class="font-semibold text-gray-900 dark:text-gray-100">${typeLabel}</span>
                  <span class="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded text-xs font-medium">
                    Revision ${rev.revision_number}
                  </span>
                </div>
                <div class="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
                  <span class="flex items-center gap-1">
                    <i data-lucide="send" class="w-3 h-3"></i>
                    ${sentDate}
                  </span>
                  ${rev.expires_at ? `
                    <span class="flex items-center gap-1">
                      <i data-lucide="clock" class="w-3 h-3"></i>
                      Expires: ${new Date(rev.expires_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </span>
                  ` : ''}
                </div>
              </div>
            </div>
            ${rev.accepted_at ? `
              <div class="mt-3 inline-flex items-center gap-2 px-3 py-1.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-lg text-sm font-medium">
                <i data-lucide="check-circle" class="w-4 h-4"></i>
                Accepted on ${new Date(rev.accepted_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              </div>
            ` : rev.declined_at ? `
              <div class="mt-3 inline-flex items-center gap-2 px-3 py-1.5 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-lg text-sm font-medium">
                <i data-lucide="x-circle" class="w-4 h-4"></i>
                Declined on ${new Date(rev.declined_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              </div>
            ` : ''}
            ${rev.public_token ? `
              <div class="mt-3">
                <a href="quote.html?token=${rev.public_token}" target="_blank" class="inline-flex items-center gap-2 text-sm text-nfgblue hover:text-nfgdark dark:text-blue-400 dark:hover:text-blue-300 font-medium">
                  <i data-lucide="external-link" class="w-4 h-4"></i>
                  View Public Link
                </a>
              </div>
            ` : ''}
          </div>
          ${total ? `
            <div class="text-right">
              <div class="text-2xl font-bold text-nfgblue dark:text-blue-400">
                $${total}
              </div>
              <div class="text-xs text-gray-500 dark:text-gray-400 mt-1">Total</div>
            </div>
          ` : ''}
        </div>
      </div>
    `;
  }).join('');
}

// Render events
function renderEvents(quote) {
  const container = document.getElementById('quote-events-timeline');
  if (!container) return;

  if (!quote.events || quote.events.length === 0) {
    container.innerHTML = `
      <div class="text-center py-8 text-gray-500 dark:text-gray-400">
        <i data-lucide="activity" class="w-12 h-12 mx-auto mb-2 opacity-50"></i>
        <p>No events yet</p>
      </div>
    `;
    return;
  }

  const eventConfig = {
    sent: { icon: 'send', color: 'bg-blue-500', text: 'Sent' },
    viewed: { icon: 'eye', color: 'bg-yellow-500', text: 'Viewed' },
    pdf_downloaded: { icon: 'file-down', color: 'bg-purple-500', text: 'PDF Downloaded' },
    accepted: { icon: 'check-circle', color: 'bg-green-500', text: 'Accepted' },
    declined: { icon: 'x-circle', color: 'bg-red-500', text: 'Declined' },
    expired: { icon: 'clock', color: 'bg-gray-500', text: 'Expired' },
    withdrawn: { icon: 'ban', color: 'bg-gray-500', text: 'Withdrawn' },
    walkthrough_scheduled: { icon: 'calendar', color: 'bg-indigo-500', text: 'Walkthrough Scheduled' },
    walkthrough_completed: { icon: 'check-circle', color: 'bg-green-500', text: 'Walkthrough Completed' },
    walkthrough_no_show: { icon: 'x-circle', color: 'bg-red-500', text: 'Walkthrough No-Show' },
    revision_created: { icon: 'file-text', color: 'bg-nfgblue', text: 'Revision Created' }
  };

  container.innerHTML = quote.events.map((event, index) => {
    const config = eventConfig[event.event_type] || { icon: 'circle', color: 'bg-gray-500', text: event.event_type };
    const date = new Date(event.timestamp);
    const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    const timeStr = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    
    return `
      <div class="relative flex items-start gap-4 pb-6 last:pb-0">
        <div class="relative flex-shrink-0">
          <div class="w-10 h-10 ${config.color} rounded-full flex items-center justify-center shadow-md border-2 border-white dark:border-gray-800">
            <i data-lucide="${config.icon}" class="w-5 h-5 text-white"></i>
          </div>
          ${index < quote.events.length - 1 ? '<div class="absolute top-10 left-1/2 transform -translate-x-1/2 w-0.5 h-6 bg-gray-200 dark:bg-gray-700"></div>' : ''}
        </div>
        <div class="flex-1 pt-1">
          <div class="font-semibold text-gray-900 dark:text-gray-100 mb-1">
            ${config.text}
          </div>
          <div class="text-sm text-gray-500 dark:text-gray-400">
            ${dateStr} at ${timeStr}
          </div>
          ${event.metadata?.note ? `
            <div class="mt-2 text-sm text-gray-600 dark:text-gray-400 italic">
              ${event.metadata.note}
            </div>
          ` : ''}
        </div>
      </div>
    `;
  }).join('');
}

// Render action buttons
function renderActionButtons(quote) {
  const container = document.getElementById('quote-detail-actions');
  if (!container) return;

  const buttons = [];
  const latestRevision = quote.revisions?.[0];

  if (quote.status === 'draft' && latestRevision && !latestRevision.sent_at) {
    buttons.push(`
      <button id="edit-draft-quote-btn" class="inline-flex items-center gap-2 px-5 py-2.5 border-2 border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg font-medium transition text-gray-700 dark:text-gray-300">
        <i data-lucide="edit" class="w-4 h-4"></i>
        Edit Draft
      </button>
    `);
  }

  // Create Final Quote (if walkthrough completed)
  if (quote.quote_type === 'walkthrough_required' && quote.walkthrough?.status === 'completed') {
    const hasFinalQuote = quote.revisions?.some(r => r.revision_type === 'final_quote');
    if (!hasFinalQuote) {
      buttons.push(`
        <button id="create-final-quote-btn" class="inline-flex items-center gap-2 px-5 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition shadow-md hover:shadow-lg">
          <i data-lucide="file-plus" class="w-4 h-4"></i>
          Create Final Quote
        </button>
      `);
    }
  }

  // Send Final Quote (if final quote exists and not sent)
  if (latestRevision && latestRevision.revision_type === 'final_quote' && !latestRevision.sent_at) {
    buttons.push(`
      <button id="send-final-quote-btn" class="inline-flex items-center gap-2 px-5 py-2.5 bg-nfgblue hover:bg-nfgdark text-white rounded-lg font-medium transition shadow-md hover:shadow-lg">
        <i data-lucide="send" class="w-4 h-4"></i>
        Send Final Quote
      </button>
    `);
  }

  // Delete quote (always available)
  buttons.push(`
    <button id="delete-quote-btn" class="inline-flex items-center gap-2 px-5 py-2.5 border-2 border-red-300 text-red-600 dark:border-red-700 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg font-medium transition">
      <i data-lucide="trash" class="w-4 h-4"></i>
      Delete Quote
    </button>
  `);

  container.innerHTML = buttons.join('');

  // Attach event listeners
  document.getElementById('edit-draft-quote-btn')?.addEventListener('click', () => {
    // TODO: Open edit modal
    toast.info('Edit draft coming soon', 'Notice');
  });

  document.getElementById('create-final-quote-btn')?.addEventListener('click', async () => {
    try {
      await quotesModule.createFinalQuoteFromWalkthrough(quote.id);
      await openQuoteDetail(quote.id); // Reload
    } catch (error) {
      console.error('[Quote Detail] Error creating final quote:', error);
    }
  });

  document.getElementById('send-final-quote-btn')?.addEventListener('click', async () => {
    // TODO: Open send modal with email input
    toast.info('Send quote modal coming soon', 'Notice');
  });

  document.getElementById('delete-quote-btn')?.addEventListener('click', async () => {
    try {
      const confirmed = confirm('Are you sure you want to delete this quote and all its revisions? This cannot be undone.');
      if (!confirmed) return;

      const { data, error } = await quotesModule.deleteQuote(quote.id);
      if (error) throw error;

      toast.success('Quote deleted', 'Success');
      const modal = document.getElementById('quote-detail-modal');
      if (modal) modal.classList.add('hidden');
      // Reload quotes list if available
      if (window.quotes && typeof window.quotes.loadQuotes === 'function') {
        await window.quotes.loadQuotes();
      } else if (typeof quotesModule.loadQuotes === 'function') {
        await quotesModule.loadQuotes();
      }
    } catch (error) {
      console.error('[Quote Detail] Error deleting quote:', error);
      toast.error('Failed to delete quote', 'Error');
    }
  });
}
