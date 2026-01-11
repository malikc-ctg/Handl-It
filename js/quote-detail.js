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
  
  if (titleEl) titleEl.textContent = `Quote - ${site?.name || 'Unknown Account'}`;
  if (subtitleEl) {
    const statusColors = {
      draft: 'text-gray-600',
      sent: 'text-blue-600',
      viewed: 'text-yellow-600',
      accepted: 'text-green-600',
      declined: 'text-red-600',
      expired: 'text-gray-600',
      withdrawn: 'text-gray-600'
    };
    subtitleEl.innerHTML = `
      <span class="${statusColors[quote.status] || 'text-gray-600'} font-medium">${quote.status || 'draft'}</span> • 
      ${quote.quote_type === 'walkthrough_required' ? 'Walkthrough Required' : quote.quote_type === 'standard' ? 'Standard' : 'Ballpark'}
    `;
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
    content.innerHTML = '<p class="text-blue-800 dark:text-blue-200">No walkthrough scheduled yet.</p>';
    if (actions) {
      actions.innerHTML = `
        <button id="schedule-walkthrough-btn" class="px-4 py-2 bg-nfgblue hover:bg-nfgdark text-white rounded-lg text-sm font-medium transition">
          Schedule Walkthrough
        </button>
      `;
      document.getElementById('schedule-walkthrough-btn')?.addEventListener('click', () => {
        // TODO: Open schedule walkthrough modal
        toast.info('Walkthrough scheduling coming soon', 'Notice');
      });
    }
  } else {
    const statusColors = {
      scheduled: 'bg-blue-100 text-blue-800',
      completed: 'bg-green-100 text-green-800',
      no_show: 'bg-red-100 text-red-800',
      rescheduled: 'bg-yellow-100 text-yellow-800',
      cancelled: 'bg-gray-100 text-gray-800'
    };

    content.innerHTML = `
      <div class="space-y-2">
        <div class="flex items-center justify-between">
          <span class="font-medium text-blue-900 dark:text-blue-100">Status:</span>
          <span class="px-2 py-1 rounded text-sm font-medium ${statusColors[walkthrough.status] || 'bg-gray-100 text-gray-800'}">
            ${walkthrough.status || 'scheduled'}
          </span>
        </div>
        ${walkthrough.scheduled_at ? `
          <div class="flex items-center justify-between">
            <span class="text-sm text-blue-700 dark:text-blue-300">Scheduled:</span>
            <span class="text-sm text-blue-900 dark:text-blue-100">${new Date(walkthrough.scheduled_at).toLocaleString()}</span>
          </div>
        ` : ''}
        ${walkthrough.location_address ? `
          <div class="flex items-center justify-between">
            <span class="text-sm text-blue-700 dark:text-blue-300">Location:</span>
            <span class="text-sm text-blue-900 dark:text-blue-100">${walkthrough.location_address}</span>
          </div>
        ` : ''}
      </div>
    `;

    if (actions) {
      actions.innerHTML = '';
      if (walkthrough.status === 'scheduled') {
        actions.innerHTML = `
          <button id="mark-walkthrough-completed-btn" class="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition">
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
    container.innerHTML = '<p class="text-gray-500 text-center py-4">No revisions yet</p>';
    return;
  }

  container.innerHTML = quote.revisions.map(rev => {
    const sentDate = rev.sent_at ? new Date(rev.sent_at).toLocaleDateString() : 'Not sent';
    const typeLabel = rev.revision_type === 'walkthrough_proposal' ? 'Walkthrough Proposal' : 'Final Quote';
    const typeColor = rev.revision_type === 'walkthrough_proposal' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' : 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
    
    return `
      <div class="border border-nfgray dark:border-gray-700 rounded-lg p-4">
        <div class="flex items-start justify-between mb-3">
          <div>
            <div class="flex items-center gap-2 mb-1">
              <span class="px-2 py-1 rounded text-xs font-medium ${typeColor}">${typeLabel}</span>
              <span class="text-sm text-gray-600 dark:text-gray-400">Revision ${rev.revision_number}</span>
            </div>
            <div class="text-sm text-gray-500 dark:text-gray-400">
              Sent: ${sentDate}
              ${rev.expires_at ? ` • Expires: ${new Date(rev.expires_at).toLocaleDateString()}` : ''}
            </div>
          </div>
          ${rev.total ? `
            <div class="text-right">
              <div class="text-lg font-semibold text-nfgblue dark:text-blue-400">
                $${Number(rev.total).toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </div>
            </div>
          ` : ''}
        </div>
        ${rev.accepted_at ? `
          <div class="mt-2 text-sm text-green-600 dark:text-green-400">
            ✅ Accepted on ${new Date(rev.accepted_at).toLocaleDateString()}
          </div>
        ` : rev.declined_at ? `
          <div class="mt-2 text-sm text-red-600 dark:text-red-400">
            ❌ Declined on ${new Date(rev.declined_at).toLocaleDateString()}
          </div>
        ` : ''}
        ${rev.public_token ? `
          <div class="mt-2">
            <a href="quote.html?token=${rev.public_token}" target="_blank" class="text-sm text-nfgblue hover:text-nfgdark">
              View Public Link →
            </a>
          </div>
        ` : ''}
      </div>
    `;
  }).join('');
}

// Render events
function renderEvents(quote) {
  const container = document.getElementById('quote-events-timeline');
  if (!container) return;

  if (!quote.events || quote.events.length === 0) {
    container.innerHTML = '<p class="text-gray-500 text-center py-4">No events yet</p>';
    return;
  }

  container.innerHTML = quote.events.map(event => {
    const date = new Date(event.timestamp).toLocaleString();
    const eventLabels = {
      sent: '📤 Sent',
      viewed: '👁️ Viewed',
      pdf_downloaded: '📄 PDF Downloaded',
      accepted: '✅ Accepted',
      declined: '❌ Declined',
      expired: '⏰ Expired',
      withdrawn: '🚫 Withdrawn',
      walkthrough_scheduled: '📅 Walkthrough Scheduled',
      walkthrough_completed: '✅ Walkthrough Completed',
      walkthrough_no_show: '❌ Walkthrough No-Show',
      revision_created: '📝 Revision Created'
    };

    return `
      <div class="flex items-start gap-3 pb-3 border-b border-nfgray dark:border-gray-700 last:border-0">
        <div class="flex-shrink-0 w-2 h-2 rounded-full bg-nfgblue dark:bg-blue-400 mt-2"></div>
        <div class="flex-1">
          <div class="text-sm font-medium text-gray-900 dark:text-gray-100">
            ${eventLabels[event.event_type] || event.event_type}
          </div>
          <div class="text-xs text-gray-500 dark:text-gray-400">${date}</div>
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

  // Edit Draft (if latest revision is draft)
  const latestRevision = quote.revisions?.[0];
  if (quote.status === 'draft' && latestRevision && !latestRevision.sent_at) {
    buttons.push(`
      <button id="edit-draft-quote-btn" class="px-4 py-2 border border-nfgray dark:border-gray-700 hover:bg-nfglight dark:hover:bg-gray-700 rounded-lg text-sm font-medium transition">
        Edit Draft
      </button>
    `);
  }

  // Create Final Quote (if walkthrough completed)
  if (quote.quote_type === 'walkthrough_required' && quote.walkthrough?.status === 'completed') {
    const hasFinalQuote = quote.revisions?.some(r => r.revision_type === 'final_quote');
    if (!hasFinalQuote) {
      buttons.push(`
        <button id="create-final-quote-btn" class="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition">
          Create Final Quote
        </button>
      `);
    }
  }

  // Send Final Quote (if final quote exists and not sent)
  if (latestRevision && latestRevision.revision_type === 'final_quote' && !latestRevision.sent_at) {
    buttons.push(`
      <button id="send-final-quote-btn" class="px-4 py-2 bg-nfgblue hover:bg-nfgdark text-white rounded-lg text-sm font-medium transition">
        Send Final Quote
      </button>
    `);
  }

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
}
