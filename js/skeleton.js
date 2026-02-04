// ============================================
// Skeleton Loader Utilities
// ============================================
// Provides loading skeleton UI components
// Works in light and dark mode
// ============================================

/**
 * Create skeleton table rows
 * @param {number} rows - Number of rows to create
 * @param {number} cols - Number of columns per row
 * @returns {string} HTML string for skeleton rows
 */
export function createSkeletonTableRows(rows = 5, cols = 5) {
  let html = '';
  for (let i = 0; i < rows; i++) {
    html += '<tr class="skeleton-table-row animate-pulse">';
    for (let j = 0; j < cols; j++) {
      const w = j === 0 ? 'w-3/4' : (j === cols - 1 ? 'w-20' : 'w-1/2');
      html += `<td class="px-4 py-3">
        <div class="skeleton-bar skeleton-bar-${w} h-4 rounded"></div>
      </td>`;
    }
    html += '</tr>';
  }
  return html;
}

/**
 * Create skeleton table row for tbody (single full-width row with colspan)
 * Use when table has a header - returns one row that spans all columns
 * @param {number} cols - Number of columns (colspan)
 * @param {number} skeletonRows - Number of skeleton lines to show in the cell
 * @returns {string} HTML string
 */
export function createSkeletonTableBody(cols = 5, skeletonRows = 5) {
  let bars = '';
  for (let i = 0; i < skeletonRows; i++) {
    const w = i === 0 ? 'w-3/4' : (i === skeletonRows - 1 ? 'w-1/4' : 'w-1/2');
    bars += `<div class="skeleton-bar skeleton-bar-${w} h-4 rounded mb-3"></div>`;
  }
  return `<tr class="animate-pulse">
    <td colspan="${cols}" class="px-4 py-8">
      <div class="max-w-md mx-auto space-y-3">${bars}</div>
    </td>
  </tr>`;
}

/**
 * Create empty state HTML
 * @param {Object} opts - Options
 * @param {string} opts.icon - Lucide icon name (e.g. 'clipboard-check')
 * @param {string} opts.title - Empty state title
 * @param {string} opts.message - Short message
 * @param {string} [opts.actionLabel] - Button label
 * @param {string} [opts.actionId] - Button id for click handler
 * @param {boolean} [opts.bordered] - Use dashed border container
 * @returns {string} HTML string
 */
export function createEmptyState({ icon = 'inbox', title, message, actionLabel, actionId, bordered = false }) {
  const containerClass = bordered ? 'nfg-empty-state nfg-empty-state-bordered' : 'nfg-empty-state';
  let actionHtml = '';
  if (actionLabel && actionId) {
    actionHtml = `<button id="${actionId}" class="nfg-empty-state-action">
      <i data-lucide="plus" class="w-4 h-4"></i>
      ${actionLabel}
    </button>`;
  } else if (actionLabel) {
    actionHtml = `<span class="nfg-empty-state-action">${actionLabel}</span>`;
  }
  return `
    <div class="${containerClass}">
      <i data-lucide="${icon}" class="nfg-empty-state-icon w-16 h-16"></i>
      <h3 class="nfg-empty-state-title">${title}</h3>
      <p class="nfg-empty-state-message">${message}</p>
      ${actionHtml}
    </div>
  `;
}

/**
 * Create skeleton list/card items for grid layout
 * @param {number} count - Number of skeleton cards
 * @param {string} [variant] - 'card' | 'list'
 * @returns {string} HTML string
 */
export function createSkeletonCards(count = 3, variant = 'card') {
  let html = '';
  for (let i = 0; i < count; i++) {
    if (variant === 'list') {
      html += `
        <div class="flex items-center gap-4 p-4 border-b border-nfgray dark:border-gray-700 animate-pulse">
          <div class="h-10 w-10 rounded-full bg-gray-200 dark:bg-gray-700 flex-shrink-0"></div>
          <div class="flex-1 space-y-2">
            <div class="skeleton-bar skeleton-bar-w-3/4 h-4 rounded"></div>
            <div class="skeleton-bar skeleton-bar-w-1/2 h-3 rounded"></div>
          </div>
          <div class="skeleton-bar skeleton-bar-w-20 h-8 rounded"></div>
        </div>
      `;
    } else {
      html += `
        <div class="bg-white dark:bg-gray-800 border border-nfgray dark:border-gray-700 rounded-xl shadow-nfg p-4 animate-pulse">
          <div class="skeleton-bar skeleton-bar-w-1/4 h-4 rounded mb-3"></div>
          <div class="skeleton-bar skeleton-bar-w-3/4 h-5 rounded mb-2"></div>
          <div class="skeleton-bar skeleton-bar-w-1/2 h-4 rounded mb-3"></div>
          <div class="skeleton-bar skeleton-bar-w-28 h-8 rounded"></div>
        </div>
      `;
    }
  }
  return html;
}

/** Progress overlay for long operations (export, sync) */
let _progressOverlayEl = null;

/**
 * Show progress overlay
 * @param {string} message - Message to display
 * @returns {HTMLElement} The overlay element (for manual removal)
 */
export function showProgressOverlay(message = 'Processing...') {
  if (_progressOverlayEl) return _progressOverlayEl;
  _progressOverlayEl = document.createElement('div');
  _progressOverlayEl.className = 'nfg-progress-overlay';
  _progressOverlayEl.innerHTML = `
    <div class="nfg-progress-card">
      <div class="nfg-progress-spinner"></div>
      <p class="nfg-progress-message">${message}</p>
    </div>
  `;
  document.body.appendChild(_progressOverlayEl);
  return _progressOverlayEl;
}

/**
 * Hide progress overlay
 */
export function hideProgressOverlay() {
  if (_progressOverlayEl && _progressOverlayEl.parentNode) {
    _progressOverlayEl.parentNode.removeChild(_progressOverlayEl);
  }
  _progressOverlayEl = null;
}

/**
 * Show skeleton loader in container
 * @param {HTMLElement} container - Container element
 * @param {string} skeletonHTML - HTML string for skeleton
 */
export function showSkeleton(container, skeletonHTML) {
  if (!container) return;
  
  // Store original content if not already stored
  if (!container.dataset.originalContent) {
    container.dataset.originalContent = container.innerHTML;
  }
  
  // Show skeleton
  container.innerHTML = skeletonHTML;
  container.classList.add('skeleton-loading');
}

/**
 * Hide skeleton loader and restore original content
 * @param {HTMLElement} container - Container element
 */
export function hideSkeleton(container) {
  if (!container) return;
  
  container.classList.remove('skeleton-loading');
  
  // Restore original content if stored
  if (container.dataset.originalContent) {
    container.innerHTML = container.dataset.originalContent;
    delete container.dataset.originalContent;
  }
}

// Export for use in console/testing
window.createSkeletonTableRows = createSkeletonTableRows;
window.createSkeletonTableBody = createSkeletonTableBody;
window.createEmptyState = createEmptyState;
window.createSkeletonCards = createSkeletonCards;
window.showSkeleton = showSkeleton;
window.hideSkeleton = hideSkeleton;
window.showProgressOverlay = showProgressOverlay;
window.hideProgressOverlay = hideProgressOverlay;

