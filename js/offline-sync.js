/**
 * Offline Sync Manager
 * Handles queuing and syncing operations when offline
 */

import { supabase } from './supabase.js';

const OFFLINE_QUEUE_KEY = 'nfg_offline_queue';
const SYNC_IN_PROGRESS_KEY = 'nfg_sync_in_progress';
const MAX_RETRY_ATTEMPTS = 3;

// Operation types
export const OPERATION_TYPES = {
  CREATE: 'create',
  UPDATE: 'update',
  DELETE: 'delete'
};

// Table names that support offline sync
export const SYNCABLE_TABLES = {
  JOBS: 'jobs',
  SITES: 'sites',
  BOOKINGS: 'bookings',
  INVENTORY_TRANSACTIONS: 'inventory_transactions',
  TIME_ENTRIES: 'time_entries',
  ROUTES: 'routes',
  DOOR_TARGETS: 'door_targets',
  DOOR_VISITS: 'door_visits',
  LEADS: 'leads',
  APPOINTMENTS: 'appointments'
};

/**
 * Check if app is online
 */
export function isOnline() {
  return navigator.onLine;
}

/**
 * Get offline queue from localStorage
 */
function getOfflineQueue() {
  try {
    const queue = localStorage.getItem(OFFLINE_QUEUE_KEY);
    return queue ? JSON.parse(queue) : [];
  } catch (error) {
    console.error('[OfflineSync] Error reading queue:', error);
    return [];
  }
}

/**
 * Save offline queue to localStorage
 */
function saveOfflineQueue(queue) {
  try {
    localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
    updateSyncIndicator();
  } catch (error) {
    console.error('[OfflineSync] Error saving queue:', error);
    // If storage is full, try to remove old items
    if (error.name === 'QuotaExceededError') {
      console.warn('[OfflineSync] Storage full, removing oldest items');
      const trimmed = queue.slice(-50); // Keep only last 50 items
      localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(trimmed));
    }
  }
}

/**
 * Add operation to offline queue
 */
export function queueOperation(table, operation, data, id = null) {
  if (isOnline()) {
    console.log('[OfflineSync] Online - not queueing, executing directly');
    return null;
  }

  const operationId = `op_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const queueItem = {
    id: operationId,
    table,
    operation,
    data,
    recordId: id,
    timestamp: new Date().toISOString(),
    retryCount: 0,
    status: 'pending'
  };

  const queue = getOfflineQueue();
  queue.push(queueItem);
  saveOfflineQueue(queue);

  console.log('[OfflineSync] Operation queued:', queueItem);
  updateSyncIndicator();
  
  // Show toast notification (dynamic import to avoid circular dependencies)
  import('./notifications.js').then(({ toast }) => {
    if (toast) {
      toast.info('Operation queued for sync when online', 'Offline Mode');
    }
  }).catch(() => {
    // Toast not available, skip notification
  });

  return operationId;
}

/**
 * Remove operation from queue
 */
function removeFromQueue(operationId) {
  const queue = getOfflineQueue();
  const filtered = queue.filter(item => item.id !== operationId);
  saveOfflineQueue(filtered);
}

/**
 * Update operation status in queue
 */
function updateOperationStatus(operationId, status, error = null) {
  const queue = getOfflineQueue();
  const item = queue.find(op => op.id === operationId);
  if (item) {
    item.status = status;
    item.error = error;
    item.lastAttempt = new Date().toISOString();
    if (status === 'failed') {
      item.retryCount += 1;
    }
    saveOfflineQueue(queue);
  }
}

/**
 * Process a single queued operation
 */
async function processOperation(queueItem) {
  try {
    console.log('[OfflineSync] Processing operation:', queueItem);

    let result;
    const { table, operation, data, recordId } = queueItem;

    switch (operation) {
      case OPERATION_TYPES.CREATE:
        const { data: createData, error: createError } = await supabase
          .from(table)
          .insert(data)
          .select()
          .single();
        
        if (createError) throw createError;
        result = createData;
        break;

      case OPERATION_TYPES.UPDATE:
        if (!recordId) {
          throw new Error('Record ID required for update operation');
        }
        const { data: updateData, error: updateError } = await supabase
          .from(table)
          .update(data)
          .eq('id', recordId)
          .select()
          .single();
        
        if (updateError) throw updateError;
        result = updateData;
        break;

      case OPERATION_TYPES.DELETE:
        if (!recordId) {
          throw new Error('Record ID required for delete operation');
        }
        const { error: deleteError } = await supabase
          .from(table)
          .delete()
          .eq('id', recordId);
        
        if (deleteError) throw deleteError;
        result = { success: true };
        break;

      default:
        throw new Error(`Unknown operation type: ${operation}`);
    }

    // Operation successful - remove from queue
    removeFromQueue(queueItem.id);
    console.log('[OfflineSync] Operation successful:', queueItem.id);
    return { success: true, result };

  } catch (error) {
    console.error('[OfflineSync] Operation failed:', error);
    
    // Check if we should retry
    if (queueItem.retryCount < MAX_RETRY_ATTEMPTS) {
      updateOperationStatus(queueItem.id, 'pending', error.message);
      return { success: false, error, willRetry: true };
    } else {
      updateOperationStatus(queueItem.id, 'failed', error.message);
      return { success: false, error, willRetry: false };
    }
  }
}

/**
 * Sync all queued operations
 */
export async function syncOfflineQueue() {
  if (!isOnline()) {
    console.log('[OfflineSync] Still offline, cannot sync');
    return { synced: 0, failed: 0 };
  }

  // Check if sync is already in progress
  if (localStorage.getItem(SYNC_IN_PROGRESS_KEY) === 'true') {
    console.log('[OfflineSync] Sync already in progress');
    return { synced: 0, failed: 0, inProgress: true };
  }

  const queue = getOfflineQueue();
  if (queue.length === 0) {
    console.log('[OfflineSync] No operations to sync');
    updateSyncIndicator();
    return { synced: 0, failed: 0 };
  }

  console.log(`[OfflineSync] Starting sync of ${queue.length} operations`);
  localStorage.setItem(SYNC_IN_PROGRESS_KEY, 'true');
  updateSyncIndicator();

  const pendingOps = queue.filter(op => op.status === 'pending');
  let synced = 0;
  let failed = 0;

  try {
    // Process operations sequentially to avoid conflicts
    for (const operation of pendingOps) {
      const result = await processOperation(operation);
      if (result.success) {
        synced++;
      } else if (!result.willRetry) {
        failed++;
      }
    }

    console.log(`[OfflineSync] Sync complete: ${synced} synced, ${failed} failed`);
    
    // Show notification (dynamic import to avoid circular dependencies)
    if (synced > 0 || failed > 0) {
      import('./notifications.js').then(({ toast }) => {
        if (toast) {
          if (synced > 0) {
            toast.success(`${synced} operation(s) synced successfully`, 'Sync Complete');
          }
          if (failed > 0) {
            toast.error(`${failed} operation(s) failed to sync`, 'Sync Error');
          }
        }
      }).catch(() => {
        // Toast not available, skip notification
      });
    }

  } catch (error) {
    console.error('[OfflineSync] Sync error:', error);
  } finally {
    localStorage.removeItem(SYNC_IN_PROGRESS_KEY);
    updateSyncIndicator();
  }

  return { synced, failed };
}

/**
 * Get pending operations count
 */
export function getPendingOperationsCount() {
  const queue = getOfflineQueue();
  return queue.filter(op => op.status === 'pending').length;
}

/**
 * Get failed operations count
 */
export function getFailedOperationsCount() {
  const queue = getOfflineQueue();
  return queue.filter(op => op.status === 'failed').length;
}

/**
 * Get all queued operations
 */
export function getQueuedOperations() {
  return getOfflineQueue();
}

/**
 * Clear failed operations
 */
export function clearFailedOperations() {
  const queue = getOfflineQueue();
  const filtered = queue.filter(op => op.status !== 'failed');
  saveOfflineQueue(filtered);
  updateSyncIndicator();
}

/**
 * Retry failed operations
 */
export async function retryFailedOperations() {
  const queue = getOfflineQueue();
  const failedOps = queue.filter(op => op.status === 'failed');
  
  // Reset failed operations to pending
  failedOps.forEach(op => {
    op.status = 'pending';
    op.retryCount = 0;
    op.error = null;
  });
  
  saveOfflineQueue(queue);
  await syncOfflineQueue();
}

/**
 * Update sync indicator in UI
 */
function updateSyncIndicator() {
  const pendingCount = getPendingOperationsCount();
  const failedCount = getFailedOperationsCount();
  const isOnlineStatus = isOnline();
  
  // Dispatch event for UI to update
  window.dispatchEvent(new CustomEvent('offline-sync-status', {
    detail: {
      pending: pendingCount,
      failed: failedCount,
      isOnline: isOnlineStatus,
      hasPending: pendingCount > 0,
      hasFailed: failedCount > 0
    }
  }));
}

/**
 * Initialize offline sync
 */
export function initOfflineSync() {
  console.log('[OfflineSync] Initializing offline sync...');

  // Listen for online/offline events
  window.addEventListener('online', async () => {
    console.log('[OfflineSync] Back online, starting sync...');
    updateSyncIndicator();
    
    // Wait a bit for connection to stabilize
    setTimeout(async () => {
      await syncOfflineQueue();
    }, 1000);
  });

  window.addEventListener('offline', () => {
    console.log('[OfflineSync] Went offline');
    updateSyncIndicator();
  });

  // Try to sync on page load if online
  if (isOnline()) {
    // Wait for page to be fully loaded
    if (document.readyState === 'complete') {
      syncOfflineQueue();
    } else {
      window.addEventListener('load', () => {
        setTimeout(syncOfflineQueue, 2000);
      });
    }
  }

  // Register background sync with service worker
  if ('serviceWorker' in navigator && 'sync' in window.ServiceWorkerRegistration.prototype) {
    navigator.serviceWorker.ready.then(registration => {
      // Request background sync
      registration.sync.register('sync-data').catch(err => {
        console.warn('[OfflineSync] Background sync registration failed:', err);
      });
    });
  }

  // Listen for sync requests from service worker
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('message', async (event) => {
      if (event.data && event.data.type === 'REQUEST_SYNC') {
        console.log('[OfflineSync] Sync requested by service worker');
        try {
          const result = await syncOfflineQueue();
          
          // Send response back to service worker
          if (event.ports && event.ports[0]) {
            event.ports[0].postMessage({
              type: 'SYNC_COMPLETE',
              synced: result.synced,
              failed: result.failed,
              timestamp: new Date().toISOString()
            });
          }
        } catch (error) {
          console.error('[OfflineSync] Sync error:', error);
          
          // Send error back to service worker
          if (event.ports && event.ports[0]) {
            event.ports[0].postMessage({
              type: 'SYNC_ERROR',
              error: error.message,
              timestamp: new Date().toISOString()
            });
          }
        }
      }
    });
  }

  // Update indicator initially
  updateSyncIndicator();
  
  // Update indicator periodically
  setInterval(updateSyncIndicator, 5000);

  console.log('[OfflineSync] Offline sync initialized');
}

// Auto-initialize when module loads
if (typeof window !== 'undefined') {
  // Wait for DOM to be ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initOfflineSync);
  } else {
    initOfflineSync();
  }
}

