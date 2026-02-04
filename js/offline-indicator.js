/**
 * Offline Status Indicator
 * Shows offline status and pending sync operations in the UI
 */

import { 
  isOnline, 
  getPendingOperationsCount, 
  getFailedOperationsCount,
  syncOfflineQueue,
  retryFailedOperations,
  clearFailedOperations
} from './offline-sync.js';

let indicatorElement = null;
let syncButton = null;
let statusText = null;
let lastStatusDetail = null;

/**
 * Create offline indicator UI
 */
function createOfflineIndicator() {
  // Check if indicator already exists
  if (document.getElementById('offline-sync-indicator')) {
    return;
  }

  // Create indicator element
  const indicator = document.createElement('div');
  indicator.id = 'offline-sync-indicator';
  indicator.className = 'fixed bottom-4 right-4 z-50 hidden';
  indicator.innerHTML = `
    <div class="bg-white dark:bg-gray-800 rounded-xl shadow-2xl border-2 border-nfgray dark:border-gray-700 p-4 min-w-[280px] max-w-[400px]">
      <div class="flex items-start gap-3">
        <div class="flex-shrink-0 mt-0.5">
          <div id="offline-status-icon" class="w-5 h-5 rounded-full"></div>
        </div>
        <div class="flex-1 min-w-0">
          <div class="flex items-center justify-between mb-2">
            <h4 id="offline-status-title" class="font-semibold text-sm text-nfgblue dark:text-blue-400">Online</h4>
            <button id="offline-indicator-close" class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-1">
              <i data-lucide="x" class="w-4 h-4"></i>
            </button>
          </div>
          <p id="offline-status-text" class="text-xs text-gray-600 dark:text-gray-400 mb-3">
            All systems operational
          </p>
          <div id="offline-sync-actions" class="flex gap-2 flex-wrap">
            <!-- Actions will be inserted here -->
          </div>
          <div id="offline-sync-progress" class="hidden mt-2">
            <div class="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
              <div class="animate-spin rounded-full h-3 w-3 border-2 border-nfgblue border-t-transparent"></div>
              <span>Syncing...</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(indicator);
  indicatorElement = indicator;
  syncButton = null; // Will be set when actions are created
  statusText = document.getElementById('offline-status-text');

  // Initialize Lucide icons
  if (window.lucide) {
    lucide.createIcons();
  }

  // Close button handler
  document.getElementById('offline-indicator-close')?.addEventListener('click', () => {
    hideIndicator();
  });

  // Listen for sync status updates
  window.addEventListener('offline-sync-status', handleSyncStatusUpdate);

  // Initial update
  updateIndicator();
}

/**
 * Update indicator based on online/offline status and sync state
 */
function updateIndicator(detailOverride = null) {
  if (!indicatorElement) {
    createOfflineIndicator();
    return;
  }

  const statusDetail = detailOverride || lastStatusDetail || {
    pending: getPendingOperationsCount(),
    failed: getFailedOperationsCount(),
    isOnline: isOnline(),
    syncing: false
  };

  const online = statusDetail.isOnline ?? isOnline();
  const pendingCount = typeof statusDetail.pending === 'number' ? statusDetail.pending : getPendingOperationsCount();
  const failedCount = typeof statusDetail.failed === 'number' ? statusDetail.failed : getFailedOperationsCount();
  const hasPending = pendingCount > 0;
  const hasFailed = failedCount > 0;
  const syncing = !!statusDetail.syncing;

  const icon = document.getElementById('offline-status-icon');
  const title = document.getElementById('offline-status-title');
  const text = document.getElementById('offline-status-text');
  const actions = document.getElementById('offline-sync-actions');
  const progress = document.getElementById('offline-sync-progress');

  if (!icon || !title || !text || !actions || !progress) {
    return; // DOM was replaced (e.g. error UI) or indicator not yet in document
  }

  if (syncing && online) {
    icon.className = 'w-5 h-5 rounded-full bg-blue-500 animate-pulse';
    title.textContent = 'Syncing';
    text.textContent = pendingCount
      ? `Syncing ${pendingCount} queued operation(s)...`
      : 'Finalizing sync...';
    indicatorElement.classList.remove('hidden');
    progress.classList.remove('hidden');
    updateActions(actions, online, hasPending, hasFailed);
  } else if (!online) {
    // Offline mode
    icon.className = 'w-5 h-5 rounded-full bg-red-500 animate-pulse';
    title.textContent = 'Offline Mode';
    text.textContent = hasPending 
      ? `${pendingCount} operation(s) queued for sync`
      : 'Working offline. Changes will sync when online.';
    indicatorElement.classList.remove('hidden');
    progress.classList.add('hidden');
    updateActions(actions, online, hasPending, hasFailed);
  } else if (hasPending || hasFailed) {
    // Online but has pending/failed operations
    icon.className = 'w-5 h-5 rounded-full bg-orange-500';
    title.textContent = 'Sync Pending';
    if (hasFailed) {
      text.textContent = `${failedCount} failed, ${pendingCount} pending`;
    } else {
      text.textContent = `${pendingCount} operation(s) pending sync`;
    }
    indicatorElement.classList.remove('hidden');
    progress.classList.add('hidden');
    updateActions(actions, online, hasPending, hasFailed);
  } else {
    // Online and synced
    icon.className = 'w-5 h-5 rounded-full bg-green-500';
    title.textContent = 'Online';
    text.textContent = 'All changes synced';
    indicatorElement.classList.add('hidden');
    progress.classList.add('hidden');
  }

  // Update icons
  if (window.lucide) {
    lucide.createIcons();
  }
}

/**
 * Update action buttons
 */
function updateActions(actionsContainer, online, hasPending, hasFailed) {
  actionsContainer.innerHTML = '';

  if (!online) {
    // Offline - show info only
    return;
  }

  if (hasPending) {
    const syncBtn = document.createElement('button');
    syncBtn.className = 'px-3 py-1.5 bg-nfgblue hover:bg-nfgdark text-white rounded-lg text-xs font-medium transition';
    syncBtn.innerHTML = '<i data-lucide="refresh-cw" class="w-3 h-3 inline-block mr-1"></i> Sync Now';
    syncBtn.addEventListener('click', async () => {
      syncBtn.disabled = true;
      syncBtn.innerHTML = '<div class="animate-spin rounded-full h-3 w-3 border-2 border-white border-t-transparent inline-block"></div> Syncing...';
      
      const progress = document.getElementById('offline-sync-progress');
      progress.classList.remove('hidden');
      
      await syncOfflineQueue();
      
      syncBtn.disabled = false;
      progress.classList.add('hidden');
      updateIndicator();
    });
    actionsContainer.appendChild(syncBtn);
    syncButton = syncBtn;
  }

  if (hasFailed) {
    const retryBtn = document.createElement('button');
    retryBtn.className = 'px-3 py-1.5 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-xs font-medium transition';
    retryBtn.innerHTML = '<i data-lucide="rotate-cw" class="w-3 h-3 inline-block mr-1"></i> Retry Failed';
    retryBtn.addEventListener('click', async () => {
      retryBtn.disabled = true;
      await retryFailedOperations();
      updateIndicator();
    });
    actionsContainer.appendChild(retryBtn);

    const clearBtn = document.createElement('button');
    clearBtn.className = 'px-3 py-1.5 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg text-xs font-medium transition';
    clearBtn.innerHTML = '<i data-lucide="trash-2" class="w-3 h-3 inline-block mr-1"></i> Clear Failed';
    clearBtn.addEventListener('click', async () => {
      if (confirm('Clear all failed operations? They will not be synced.')) {
        await clearFailedOperations();
        updateIndicator(lastStatusDetail);
        const { toast } = await import('./notifications.js');
        if (toast) toast.info('Failed operations cleared', 'Sync');
      }
    });
    actionsContainer.appendChild(clearBtn);
  }

  if (window.lucide) {
    lucide.createIcons();
  }
}

/**
 * Handle sync status update event
 */
function handleSyncStatusUpdate(event) {
  if (event?.detail) {
    lastStatusDetail = event.detail;
  }
  updateIndicator(lastStatusDetail);
}

/**
 * Hide indicator
 */
function hideIndicator() {
  if (indicatorElement) {
    indicatorElement.classList.add('hidden');
  }
}

/**
 * Show indicator
 */
function showIndicator() {
  if (indicatorElement) {
    updateIndicator();
  }
}

/**
 * Initialize offline indicator
 */
export function initOfflineIndicator() {
  createOfflineIndicator();
  
  // Listen for online/offline events
  window.addEventListener('online', () => {
    updateIndicator(lastStatusDetail);
    // Auto-sync after coming online
    setTimeout(async () => {
      await syncOfflineQueue();
      updateIndicator(lastStatusDetail);
    }, 1000);
  });

  window.addEventListener('offline', () => {
    updateIndicator(lastStatusDetail);
  });

  // Listen for service worker messages
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('message', async (event) => {
      if (event.data && event.data.type === 'SYNC_COMPLETE') {
        updateIndicator(lastStatusDetail);
        const { toast } = await import('./notifications.js');
        if (toast) toast.success('Sync completed', 'Offline Sync');
      } else if (event.data && event.data.type === 'SYNC_FAILED') {
        updateIndicator(lastStatusDetail);
        const { toast } = await import('./notifications.js');
        if (toast) toast.error('Sync failed: ' + event.data.error, 'Offline Sync');
      } else if (event.data && event.data.type === 'REQUEST_SYNC') {
        // Service worker requested sync (background sync)
        console.log('[OfflineIndicator] Background sync requested by service worker');
        await syncOfflineQueue();
        updateIndicator(lastStatusDetail);
      } else if (event.data && event.data.type === 'CONNECTION_STATUS') {
        lastStatusDetail = {
          ...(lastStatusDetail || {}),
          isOnline: event.data.online
        };
        updateIndicator(lastStatusDetail);
      }
    });
  }

  // Update periodically
  setInterval(() => updateIndicator(lastStatusDetail), 3000);
  
  console.log('[OfflineIndicator] Initialized');
}

// Auto-initialize when module loads
if (typeof window !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initOfflineIndicator);
  } else {
    initOfflineIndicator();
  }
}

