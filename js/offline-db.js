/**
 * Generic Offline Queue Database
 * Stores queued operations and sync conflict logs using IndexedDB.
 */

const DB_NAME = 'NFGOfflineQueue';
const DB_VERSION = 1;
const QUEUE_STORE = 'queuedOperations';
const CONFLICT_STORE = 'syncConflicts';

class OfflineQueueDB {
  constructor() {
    this.dbPromise = this.init();
    this.isSupported = typeof indexedDB !== 'undefined';
  }

  init() {
    if (typeof indexedDB === 'undefined') {
      console.warn('[OfflineQueueDB] IndexedDB not supported in this environment');
      return Promise.resolve(null);
    }

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        console.error('[OfflineQueueDB] Failed to open database:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        const db = request.result;

        // Ensure database is closed cleanly on versionchange (when app updates)
        db.onversionchange = () => {
          db.close();
        };

        resolve(db);
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;

        if (!db.objectStoreNames.contains(QUEUE_STORE)) {
          const store = db.createObjectStore(QUEUE_STORE, { keyPath: 'id' });
          store.createIndex('status', 'status', { unique: false });
          store.createIndex('created_at', 'timestamp', { unique: false });
        }

        if (!db.objectStoreNames.contains(CONFLICT_STORE)) {
          db.createObjectStore(CONFLICT_STORE, { keyPath: 'id', autoIncrement: true });
        }
      };
    });
  }

  async withStore(storeName, mode, callback) {
    const db = await this.dbPromise;
    if (!db) {
      return null;
    }

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(storeName, mode);
      const store = transaction.objectStore(storeName);
      let requestResult;

      try {
        requestResult = callback(store, transaction);
      } catch (error) {
        reject(error);
      }

      transaction.oncomplete = () => resolve(requestResult);
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error || new Error('Transaction aborted'));
    });
  }

  async saveOperation(operation) {
    return this.withStore(QUEUE_STORE, 'readwrite', (store) => store.put(operation));
  }

  async saveOperations(operations = []) {
    return this.withStore(QUEUE_STORE, 'readwrite', (store) => {
      operations.forEach(op => store.put(op));
    });
  }

  async deleteOperation(id) {
    return this.withStore(QUEUE_STORE, 'readwrite', (store) => store.delete(id));
  }

  async clearOperations() {
    return this.withStore(QUEUE_STORE, 'readwrite', (store) => store.clear());
  }

  async getOperation(id) {
    return this.withStore(QUEUE_STORE, 'readonly', (store) => store.get(id));
  }

  async getAllOperations() {
    return this.withStore(QUEUE_STORE, 'readonly', (store) => store.getAll());
  }

  async recordConflict(conflict) {
    return this.withStore(CONFLICT_STORE, 'readwrite', (store) => store.add({
      ...conflict,
      recorded_at: new Date().toISOString()
    }));
  }

  async getConflicts(limit = 50) {
    return this.withStore(CONFLICT_STORE, 'readonly', (store) => {
      return new Promise((resolve, reject) => {
        const conflicts = [];
        const request = store.openCursor(null, 'prev');

        request.onsuccess = (event) => {
          const cursor = event.target.result;
          if (cursor && conflicts.length < limit) {
            conflicts.push(cursor.value);
            cursor.continue();
          } else {
            resolve(conflicts);
          }
        };

        request.onerror = () => reject(request.error);
      });
    });
  }
}

export const offlineQueueDB = new OfflineQueueDB();
