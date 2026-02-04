// Enhanced Service Worker for NFG App
// Version 3.1 - Offline Sync Support
// Features:
// - Push notifications
// - Offline caching
// - Background sync for queued operations
// - Automatic sync when device comes back online

const CACHE_NAME = 'nfg-app-v3.1'; // Cache version
const OFFLINE_URL = '/offline.html';

// Files to cache immediately
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/dashboard.html',
  '/jobs.html',
  '/sites.html',
  '/bookings.html',
  '/reports.html',
  '/settings.html',
  '/inventory.html',
  '/offline.html',
  '/manifest.json',
  '/js/pwa.js',
  '/js/supabase.js',
  '/js/auth.js',
  '/js/ui.js',
  '/js/notifications.js',
  '/js/loader.js',
  '/js/dark-mode.js',
  '/css/notifications.css',
  '/css/loader.css',
  '/css/custom-dropdown.css',
  '/css/mobile-menu.css',
  '/assets/icons/icon-192.png',
  '/assets/icons/icon-512.png',
  '/assets/icons/icon-maskable-512.png'
];

// ============================================
// INSTALL EVENT
// ============================================
self.addEventListener('install', (event) => {
  console.log('[SW v3] Installing service worker...');
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[SW v3] Precaching app shell');
        // Don't fail if some files can't be cached
        return Promise.allSettled(
          PRECACHE_URLS.map(url => 
            cache.add(url).catch(err => {
              console.warn(`[SW v3] Failed to cache ${url}:`, err);
            })
          )
        );
      })
      .then(() => {
        console.log('[SW v3] Service worker installed, activating immediately');
        return self.skipWaiting(); // Activate immediately
      })
      .catch((error) => {
        console.error('[SW v3] Installation failed:', error);
      })
  );
});

// ============================================
// ACTIVATE EVENT
// ============================================
self.addEventListener('activate', (event) => {
  console.log('[SW v3] Activating service worker...');
  
  event.waitUntil(
    Promise.all([
      // Clean up old caches
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== CACHE_NAME) {
              console.log('[SW v3] Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      }),
      // Take control of all clients immediately
      self.clients.claim()
    ]).then(() => {
      console.log('[SW v3] Service worker activated and controlling clients');
      // Notify all clients that service worker is ready
      return self.clients.matchAll().then(clients => {
        clients.forEach(client => {
          client.postMessage({ type: 'SW_READY', version: '3.0' });
        });
      });
    })
  );
});

// ============================================
// FETCH EVENT - Network first, fallback to cache
// ============================================
self.addEventListener('fetch', (event) => {
  // Skip cross-origin requests and non-GET requests
  if (!event.request.url.startsWith(self.location.origin) || event.request.method !== 'GET') {
    return;
  }

  // NEVER cache messages.js - always fetch fresh (for link previews and updates)
  const url = new URL(event.request.url);
  if (url.pathname.includes('messages.js') || url.pathname.includes('/js/messages.js')) {
    event.respondWith(fetch(event.request));
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Only cache successful responses
        if (response.status === 200) {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache).catch(err => {
              console.warn('[SW v3] Failed to cache response:', err);
            });
          });
        }
        return response;
      })
      .catch(() => {
        // Network failed, try cache
        return caches.match(event.request)
          .then((response) => {
            if (response) {
              return response;
            }
            
            // Show offline page for navigation requests
            if (event.request.mode === 'navigate') {
              return caches.match(OFFLINE_URL) || new Response('Offline', {
                status: 503,
                statusText: 'Service Unavailable'
              });
            }
            
            return new Response('Offline', {
              status: 503,
              statusText: 'Service Unavailable'
            });
          });
      })
  );
});

// ============================================
// PUSH NOTIFICATION EVENT
// ============================================
self.addEventListener('push', (event) => {
  console.log('[SW v3] ========================================');
  console.log('[SW v3] Push event received!', {
    hasData: !!event.data,
    dataType: event.data?.type,
    timestamp: new Date().toISOString()
  });
  
  // Always show a notification, even if data is missing
  let payload = {
    title: 'NFG App',
    body: 'You have a new notification',
    url: '/dashboard.html',
    icon: '/assets/icons/icon-512.png',
    badge: '/assets/icons/icon-192.png'
  };

  // Try to parse push data
  if (event.data) {
    try {
      // Try JSON first
      const jsonData = event.data.json();
      console.log('[SW v3] Push payload (JSON):', jsonData);
      
      payload = {
        title: jsonData.title || payload.title,
        body: jsonData.body || payload.body,
        url: jsonData.url || payload.url,
        icon: jsonData.icon || payload.icon,
        badge: jsonData.badge || payload.badge,
        tag: jsonData.tag || 'nfg-notification',
        data: jsonData.data || { url: jsonData.url || '/dashboard.html' }
      };
    } catch (jsonError) {
      console.warn('[SW v3] Failed to parse as JSON, trying text:', jsonError);
      
      try {
        // Try text
        const textData = event.data.text();
        console.log('[SW v3] Push payload (text):', textData);
        
        // Try to parse as JSON string
        try {
          const parsed = JSON.parse(textData);
          payload = {
            title: parsed.title || payload.title,
            body: parsed.body || payload.body,
            url: parsed.url || payload.url,
            ...parsed
          };
        } catch {
          // Just use text as body
          payload.body = textData || payload.body;
        }
      } catch (textError) {
        console.warn('[SW v3] Failed to parse push data:', textError);
        // Use default payload
      }
    }
  } else {
    console.warn('[SW v3] Push event has no data, using default payload');
  }

  console.log('[SW v3] Final payload:', payload);

  // Notification options
  const options = {
    body: payload.body,
    icon: payload.icon,
    badge: payload.badge || payload.icon,
    vibrate: [200, 100, 200],
    tag: payload.tag || 'nfg-notification',
    requireInteraction: false,
    silent: false,
    renotify: true,
    timestamp: Date.now(),
    data: {
      url: payload.url || '/dashboard.html',
      ...payload.data
    },
    actions: [
      {
        action: 'open',
        title: 'View',
        icon: '/assets/icons/icon-192.png'
      },
      {
        action: 'close',
        title: 'Close'
      }
    ]
  };

  console.log('[SW v3] Showing notification with options:', options);

  // Show notification
  event.waitUntil(
    self.registration.showNotification(payload.title, options)
      .then(() => {
        console.log('[SW v3] ✅ Notification shown successfully!');
        console.log('[SW v3] Title:', payload.title);
        console.log('[SW v3] Body:', payload.body);
        console.log('[SW v3] URL:', payload.url);
        
        // Notify all clients about the notification
        return self.clients.matchAll().then(clients => {
          clients.forEach(client => {
            client.postMessage({
              type: 'PUSH_NOTIFICATION_RECEIVED',
              payload: payload
            });
          });
        });
      })
      .catch((error) => {
        console.error('[SW v3] ❌ Failed to show notification:', error);
        console.error('[SW v3] Error details:', {
          name: error.name,
          message: error.message,
          stack: error.stack
        });
        
        // Try to show a simpler notification as fallback
        return self.registration.showNotification('NFG App', {
          body: 'You have a new notification',
          icon: '/assets/icons/icon-192.png',
          tag: 'nfg-fallback'
        }).catch(fallbackError => {
          console.error('[SW v3] ❌ Fallback notification also failed:', fallbackError);
        });
      })
  );
});

// ============================================
// NOTIFICATION CLICK EVENT
// ============================================
self.addEventListener('notificationclick', (event) => {
  console.log('[SW v3] Notification clicked:', {
    action: event.action,
    notification: event.notification,
    data: event.notification.data
  });
  
  event.notification.close();
  
  const action = event.action;
  const destination = event.notification.data?.url || '/dashboard.html';
  
  if (action === 'close') {
    console.log('[SW v3] Notification closed by user');
    return;
  }
  
  // Default action or 'open' action - navigate to the URL
  event.waitUntil(
    self.clients.matchAll({ 
      type: 'window', 
      includeUncontrolled: true 
    })
      .then((windowClients) => {
        console.log('[SW v3] Found window clients:', windowClients.length);
        
        // Check if there's already a window open with this URL
        for (const client of windowClients) {
          const clientUrl = new URL(client.url);
          const destUrl = new URL(destination, self.location.origin);
          
          if (clientUrl.pathname === destUrl.pathname && 'focus' in client) {
            console.log('[SW v3] Focusing existing window:', client.url);
            return client.focus();
          }
        }
        
        // Open a new window
        if (self.clients.openWindow) {
          console.log('[SW v3] Opening new window:', destination);
          return self.clients.openWindow(destination);
        }
      })
      .catch((error) => {
        console.error('[SW v3] Error handling notification click:', error);
      })
  );
});

// ============================================
// NOTIFICATION CLOSE EVENT
// ============================================
self.addEventListener('notificationclose', (event) => {
  console.log('[SW v3] Notification closed:', event.notification.tag);
});

// ============================================
// MESSAGE EVENT - Communication with clients
// ============================================
self.addEventListener('message', (event) => {
  console.log('[SW v3] Message received from client:', event.data);
  
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'GET_VERSION') {
    event.ports[0].postMessage({ version: '3.0', cacheName: CACHE_NAME });
  }
  
  if (event.data && event.data.type === 'CONNECTION_STATUS') {
    self.clients.matchAll({ includeUncontrolled: true }).then(clients => {
      clients.forEach(client => {
        if (event.source && client.id === event.source.id) {
          return;
        }
        client.postMessage({
          type: 'CONNECTION_STATUS',
          online: event.data.online,
          timestamp: event.data.timestamp
        });
      });
    }).catch(err => console.warn('[SW v3] Failed to broadcast connection status:', err));
  }
  
  // Echo back to confirm message received
  if (event.ports && event.ports[0]) {
    event.ports[0].postMessage({ 
      type: 'MESSAGE_RECEIVED', 
      originalMessage: event.data 
    });
  }
});

// ============================================
// SYNC EVENT - Background sync for offline operations
// ============================================
// This event fires when the browser detects the device is back online
// and there are pending operations queued for sync.
// The service worker requests the client to sync queued operations to Supabase.
self.addEventListener('sync', (event) => {
  console.log('[SW v3] Background sync triggered:', event.tag);
  
  if (event.tag === 'sync-data' || event.tag === 'nfg-offline-sync') {
    event.waitUntil(
      requestSyncFromClient()
        .then((result) => {
          console.log('[SW v3] Background sync request sent to client:', result);
        })
        .catch((error) => {
          console.error('[SW v3] Background sync request failed:', error);
          // Retry sync if it fails (browser will retry automatically)
          // But we can also manually retry after a delay
          setTimeout(() => {
            requestSyncFromClient().catch(err => {
              console.warn('[SW v3] Retry sync also failed:', err);
            });
          }, 5000);
        })
    );
  }
});

// ============================================
// REQUEST SYNC FROM CLIENT
// ============================================
async function requestSyncFromClient() {
  try {
    // Request sync from all clients
    const clients = await self.clients.matchAll({ includeUncontrolled: true });
    
    if (clients.length === 0) {
      console.log('[SW v3] No clients available for sync');
      return { synced: 0, failed: 0 };
    }
    
    console.log(`[SW v3] Requesting sync from ${clients.length} client(s)`);
    
    // Send sync request to all clients
    // The client will handle the actual sync and we don't need to wait for response
    // since sync operations can take time and we don't want to block the service worker
    clients.forEach(client => {
      try {
      client.postMessage({
        type: 'REQUEST_SYNC',
          timestamp: new Date().toISOString(),
          source: 'service-worker'
      });
      } catch (err) {
        console.warn('[SW v3] Failed to send sync request to client:', err);
      }
    });
    
    // Return immediately - sync will happen in background
    return { synced: 0, failed: 0, requested: true };
    
  } catch (error) {
    console.error('[SW v3] Error requesting sync from client:', error);
    throw error;
  }
}

// ============================================
// ERROR HANDLING
// ============================================
self.addEventListener('error', (event) => {
  console.error('[SW v3] Service worker error:', event.error);
});

self.addEventListener('unhandledrejection', (event) => {
  console.error('[SW v3] Unhandled promise rejection:', event.reason);
});

// ============================================
// INITIALIZATION LOG
// ============================================
console.log('[SW v3] Service worker script loaded');
console.log('[SW v3] Cache name:', CACHE_NAME);
console.log('[SW v3] Ready to handle push notifications');
