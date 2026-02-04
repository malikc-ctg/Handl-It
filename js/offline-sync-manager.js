import { supabase } from './supabase.js';
import { offlineQueueDB } from './offline-db.js';

export const OPERATION_TYPES = {
  CREATE: 'create',
  UPDATE: 'update',
  DELETE: 'delete'
};

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
  APPOINTMENTS: 'appointments',
  TERRITORIES: 'territories'
};

const MAX_RETRY_ATTEMPTS = 3;

class OfflineSyncManager {
  constructor() {
    this.queue = [];
    this.isSyncing = false;
    this.initialized = false;
    this.lastSyncedAt = null;
    this.queueReadyPromise = this.bootstrap();
  }

  async bootstrap() {
    try {
      const indexedQueue = await offlineQueueDB.getAllOperations();
      if (Array.isArray(indexedQueue) && indexedQueue.length > 0) {
        // Sort chronologically to ensure deterministic order
        indexedQueue.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
        this.queue = indexedQueue;
      } else {
        this.queue = [];
      }
    } catch (error) {
      console.warn('[OfflineSyncManager] Failed to load queue from IndexedDB:', error);
      this.queue = [];
    } finally {
      this.initialized = true;
      this.emitStatus();
    }
  }

  async ensureReady() {
    if (!this.initialized) {
      await this.queueReadyPromise;
    }
  }

  getQueue() {
    return this.queue;
  }

  getStats() {
    const pending = this.queue.filter(op => op.status === 'pending').length;
    const failed = this.queue.filter(op => op.status === 'failed').length;
    return {
      pending,
      failed,
      syncing: this.isSyncing,
      lastSyncedAt: this.lastSyncedAt
    };
  }

  emitStatus() {
    const detail = {
      ...this.getStats(),
      hasPending: this.queue.some(op => op.status === 'pending'),
      hasFailed: this.queue.some(op => op.status === 'failed'),
      queueSize: this.queue.length,
      isOnline: typeof navigator !== 'undefined' ? navigator.onLine : false
    };

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('offline-sync-status', { detail }));
    }
  }

  async queueOperation({ table, operation, data, recordId = null, metadata = {} }) {
    await this.ensureReady();

    const queueItem = {
      id: metadata.id || `op_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      table,
      operation,
      data,
      recordId,
      timestamp: new Date().toISOString(),
      retryCount: 0,
      status: 'pending',
      metadata: {
        conflictStrategy: metadata.conflictStrategy || 'last-write-wins',
        expectedUpdatedAt: metadata.expectedUpdatedAt || data?.updated_at || null,
        ...metadata
      }
    };

    this.queue.push(queueItem);

    await this.persistOperation(queueItem);

    this.emitStatus();
    return queueItem.id;
  }

  async removeOperation(operationId) {
    this.queue = this.queue.filter(op => op.id !== operationId);
    try {
      await offlineQueueDB.deleteOperation(operationId);
    } catch (error) {
      console.warn('[OfflineSyncManager] Failed to remove operation from IndexedDB:', error);
    }
    this.emitStatus();
  }

  updateOperationStatus(operationId, status, errorMessage) {
    const op = this.queue.find(item => item.id === operationId);
    if (op) {
      op.status = status;
      op.error = errorMessage || null;
      op.retryCount = status === 'failed' ? (op.retryCount || 0) + 1 : op.retryCount || 0;
      op.lastAttempt = new Date().toISOString();
    }
  }

  async syncQueue() {
    await this.ensureReady();

    if (this.isSyncing) {
      return { inProgress: true };
    }

    if (!this.queue.some(op => op.status === 'pending' || op.status === 'failed')) {
      return { synced: 0, failed: 0 };
    }

    this.isSyncing = true;
    this.emitStatus();

    let synced = 0;
    let failed = 0;
    const operations = [...this.queue]
      .filter(op => op.status === 'pending' || (op.status === 'failed' && op.retryCount < MAX_RETRY_ATTEMPTS))
      .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

    for (const operation of operations) {
      try {
        await this.processOperation(operation);
        synced += 1;
        await this.removeOperation(operation.id);
      } catch (error) {
        failed += 1;
        this.updateOperationStatus(operation.id, operation.retryCount >= MAX_RETRY_ATTEMPTS ? 'failed' : 'pending', error.message);

        if (operation.retryCount >= MAX_RETRY_ATTEMPTS) {
          try {
            await offlineQueueDB.saveOperation(operation);
          } catch (persistError) {
            console.warn('[OfflineSyncManager] Failed to persist failed operation status:', persistError);
          }
        }
      }
    }

    this.isSyncing = false;
    if (synced > 0) {
      this.lastSyncedAt = new Date().toISOString();
    }
    this.emitStatus();
    return { synced, failed };
  }

  async processOperation(operation) {
    const { table, operation: action, data, recordId, metadata } = operation;

    switch (action) {
      case OPERATION_TYPES.CREATE: {
        const { error } = await supabase.from(table).insert(data);
        if (error) throw error;
        break;
      }

      case OPERATION_TYPES.UPDATE: {
        if (!recordId) throw new Error('recordId required for update operations');

        if (metadata?.expectedUpdatedAt) {
          await this.detectConflict(table, recordId, metadata.expectedUpdatedAt, data);
        }

        const { error } = await supabase
          .from(table)
          .update(data)
          .eq('id', recordId);

        if (error) throw error;
        break;
      }

      case OPERATION_TYPES.DELETE: {
        if (!recordId) throw new Error('recordId required for delete operations');
        const { error } = await supabase.from(table).delete().eq('id', recordId);
        if (error) throw error;
        break;
      }

      default:
        throw new Error(`Unknown operation type: ${action}`);
    }
  }

  async detectConflict(table, recordId, expectedUpdatedAt, payload) {
    try {
      const { data, error } = await supabase
        .from(table)
        .select('id, updated_at')
        .eq('id', recordId)
        .single();

      if (error) {
        console.warn('[OfflineSyncManager] Conflict check skipped:', error.message);
        return;
      }

      if (data?.updated_at && expectedUpdatedAt && data.updated_at !== expectedUpdatedAt) {
        // Last-write-wins: log conflict but continue
        await offlineQueueDB.recordConflict({
          table,
          recordId,
          serverUpdatedAt: data.updated_at,
          clientUpdatedAt: expectedUpdatedAt,
          strategy: 'last-write-wins',
          payloadSummary: Object.keys(payload || {})
        });
      }
    } catch (error) {
      console.warn('[OfflineSyncManager] Conflict detection error:', error);
    }
  }

  async executeNow({ table, action, payload, recordId, metadata }) {
    try {
      switch (action) {
        case OPERATION_TYPES.CREATE: {
          const { data, error } = await supabase.from(table).insert(payload).select().single();
          if (error) throw error;
          return data;
        }
        case OPERATION_TYPES.UPDATE: {
          const { data, error } = await supabase.from(table).update(payload).eq('id', recordId).select().single();
          if (error) throw error;
          return data;
        }
        case OPERATION_TYPES.DELETE: {
          const { error } = await supabase.from(table).delete().eq('id', recordId);
          if (error) throw error;
          return { success: true };
        }
        default:
          throw new Error(`Unsupported action ${action}`);
      }
    } catch (error) {
      if (!navigator.onLine) {
        // If we went offline during execution, queue instead
        const operationId = await this.queueOperation({ table, operation: action, data: payload, recordId, metadata });
        return { queued: true, operationId };
      }
      throw error;
    }
  }

  async persistOperation(operation) {
    try {
      await offlineQueueDB.saveOperation(operation);
    } catch (error) {
      console.warn('[OfflineSyncManager] Failed to persist operation:', error);
    }
  }
}

export const offlineSyncManager = new OfflineSyncManager();
