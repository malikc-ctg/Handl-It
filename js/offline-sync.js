import { offlineSyncManager, OPERATION_TYPES, SYNCABLE_TABLES } from './offline-sync-manager.js';

/**
 * Check if app is online
 */
export function isOnline() {
  return navigator.onLine;
}

/**
 * Add operation to offline queue
 */
export async function queueOperation(table, operation, data, id = null, metadata = {}) {
  if (isOnline()) {
    return null;
  }

  const meta = metadata || {};
  const operationId = await offlineSyncManager.queueOperation({
    table,
    operation,
    data,
    recordId: id,
    metadata: meta
  });

  try {
    const { toast } = await import('./notifications.js');
    toast?.info('Operation queued for sync when you reconnect', 'Offline Mode');
  } catch {
    // Toast module might not be available on lightweight screens
  }

  return operationId;
}

export async function syncOfflineQueue() {
  if (!isOnline()) {
    console.log('[OfflineSync] Still offline, cannot sync');
    return { synced: 0, failed: 0 };
  }

  const result = await offlineSyncManager.syncQueue();

  if ((result.synced || 0) > 0 || (result.failed || 0) > 0) {
    try {
      const { toast } = await import('./notifications.js');
      if (toast) {
        if (result.synced) {
          toast.success(`${result.synced} operation(s) synced`, 'Offline Sync');
        }
        if (result.failed) {
          toast.error(`${result.failed} operation(s) failed`, 'Offline Sync');
        }
      }
    } catch {
      // optional toast
    }
  }

  return result;
}

export function getPendingOperationsCount() {
  return offlineSyncManager.getQueue().filter(op => op.status === 'pending').length;
}

export function getFailedOperationsCount() {
  return offlineSyncManager.getQueue().filter(op => op.status === 'failed').length;
}

export function getQueuedOperations() {
  return offlineSyncManager.getQueue();
}

export async function clearFailedOperations() {
  const failed = offlineSyncManager.getQueue().filter(op => op.status === 'failed');
  for (const op of failed) {
    await offlineSyncManager.removeOperation(op.id);
  }
  offlineSyncManager.emitStatus();
}

export async function retryFailedOperations() {
  const failedOps = offlineSyncManager.getQueue().filter(op => op.status === 'failed');

  for (const op of failedOps) {
    op.status = 'pending';
    op.retryCount = 0;
    op.error = null;
    await offlineSyncManager.persistOperation(op);
  }

  offlineSyncManager.emitStatus();
  await syncOfflineQueue();
}

export async function queueOrExecute({ table, action, payload, recordId = null, metadata = {} }) {
  if (!isOnline()) {
    const operationId = await queueOperation(table, action, payload, recordId, metadata);
    return { queued: true, operationId };
  }

  const result = await offlineSyncManager.executeNow({
    table,
    action,
    payload,
    recordId,
    metadata
  });

  if (result?.queued) {
    return result;
  }

  return { queued: false, data: result };
}

/**
 * Initialize offline sync
 */
export function initOfflineSync() {
  console.log('[OfflineSync] Initializing offline sync...');

  // Listen for online/offline events
  window.addEventListener('online', async () => {
    console.log('[OfflineSync] Back online, starting sync...');
    offlineSyncManager.emitStatus();
    
    // Wait a bit for connection to stabilize
    setTimeout(async () => {
      await syncOfflineQueue();
    }, 1000);
  });

  window.addEventListener('offline', () => {
    console.log('[OfflineSync] Went offline');
    offlineSyncManager.emitStatus();
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
  if ('serviceWorker' in navigator && 'sync' in (window.ServiceWorkerRegistration?.prototype || {})) {
    navigator.serviceWorker.ready.then(registration => {
      registration.sync.register('nfg-offline-sync').catch(err => {
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

  offlineSyncManager.emitStatus();
  
  setInterval(() => offlineSyncManager.emitStatus(), 5000);

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

