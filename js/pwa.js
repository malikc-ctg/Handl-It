import { supabase } from './supabase.js';

// Fallback public key (exposed value from user-provided VAPID pair)
const FALLBACK_VAPID_PUBLIC_KEY = 'BNRzgf5fJSbUfBsaFvCPUWPqvnd1qqKPu8C3tUQp_RoILsvczmd1oZNA-bpHq5q0VnLLjWzcm2U1vYxEbZ_kH4I';

const pushSupported = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

let serviceWorkerRegistration = null;
let currentSubscription = null;
let cachedVapidKey = null;

// Install prompt - ONE TIME ONLY on desktop after login
let deferredPrompt = null;
const installBanner = document.createElement('div');

// Check if running as PWA
export function isPWA() {
  return window.matchMedia('(display-mode: standalone)').matches || 
         window.navigator.standalone === true;
}

// Check if device is desktop (not mobile/tablet)
function isDesktop() {
  const userAgent = navigator.userAgent || navigator.vendor || window.opera;
  const isMobile = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent.toLowerCase());
  const isTablet = /ipad|android(?!.*mobile)/i.test(userAgent.toLowerCase());
  
  // Also check screen size as fallback
  const hasLargeScreen = window.innerWidth >= 768;
  
  return !isMobile && !isTablet && hasLargeScreen;
}

// Check if install prompt was already shown/dismissed (PERMANENT - never show again)
function wasInstallPromptDismissed() {
  return localStorage.getItem('pwa-install-dismissed') === 'true';
}

// Check if user is on dashboard page (after login)
function isDashboardPage() {
  const path = window.location.pathname || window.location.href;
  return path.includes('dashboard.html') || path.endsWith('/dashboard.html') || path === '/dashboard.html';
}

// Check if user is authenticated
async function isAuthenticated() {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    return !!session;
  } catch (error) {
    console.error('[PWA Install] Error checking auth:', error);
    return false;
  }
}

// Mark install prompt as dismissed (PERMANENT - never show again)
function markInstallPromptDismissed() {
  localStorage.setItem('pwa-install-dismissed', 'true');
  console.log('[PWA Install] Prompt dismissed permanently - will never show again');
}

// Check if install prompt should be shown
async function shouldShowInstallPrompt() {
  // 1. Must be desktop
  if (!isDesktop()) {
    console.log('[PWA Install] Skipping - not desktop device');
    return false;
  }
  
  // 2. Must not already be installed
  if (isPWA()) {
    console.log('[PWA Install] Skipping - app already installed');
    return false;
  }
  
  // 3. Must not have been dismissed before (PERMANENT - never show again)
  if (wasInstallPromptDismissed()) {
    console.log('[PWA Install] Skipping - prompt already dismissed (permanent)');
    return false;
  }
  
  // 4. Must be on dashboard page ONLY (after login)
  if (!isDashboardPage()) {
    console.log('[PWA Install] Skipping - not on dashboard page');
    return false;
  }
  
  // 5. Must be authenticated
  const authenticated = await isAuthenticated();
  if (!authenticated) {
    console.log('[PWA Install] Skipping - not authenticated');
    return false;
  }
  
  // 6. Must have deferredPrompt available
  if (!deferredPrompt) {
    console.log('[PWA Install] Skipping - no install prompt available');
    return false;
  }
  
  console.log('[PWA Install] ✅ All conditions met - showing install prompt (ONE TIME ONLY)');
  return true;
}

// Show install banner (only if all conditions are met)
async function showInstallBanner() {
  // Check if we should show it
  const shouldShow = await shouldShowInstallPrompt();
  if (!shouldShow) {
    return;
  }
  
  // Don't show if banner already exists
  if (document.getElementById('pwa-install-banner')) {
    return;
  }
  
  installBanner.id = 'pwa-install-banner';
  installBanner.className = 'fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-96 bg-white dark:bg-gray-800 rounded-xl shadow-2xl p-4 z-50 border-2 border-nfgblue animate-slide-up';
  installBanner.innerHTML = `
    <div class="flex items-start gap-3">
      <img 
        src="https://zqcbldgheimqrnqmbbed.supabase.co/storage/v1/object/sign/app-images/NFG%20one.png?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV8xN2RmNDhlMi0xNGJlLTQ5NzMtODZlNy0zZTc0MjgzMWIzOTQiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJhcHAtaW1hZ2VzL05GRyBvbmUucG5nIiwiaWF0IjoxNzYyOTc5NzU5LCJleHAiOjQ4ODUwNDM3NTl9.fnJIDQep2yYlgGKlBRNnkrUoUzXzG7eac39GG6NQPuU" 
        alt="NFG" 
        class="w-12 h-12 rounded-lg"
      >
      <div class="flex-1">
        <h3 class="font-bold text-gray-900 dark:text-white mb-1">Install NFG App</h3>
        <p class="text-sm text-gray-600 dark:text-gray-300 mb-3">Add to your desktop for quick access and offline use!</p>
        <div class="flex gap-2">
          <button 
            id="pwa-install-btn" 
            class="px-4 py-2 bg-nfgblue text-white rounded-lg text-sm font-medium hover:bg-nfgdark transition"
          >
            Install
          </button>
          <button 
            id="pwa-dismiss-btn" 
            class="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg text-sm font-medium hover:bg-gray-300 dark:hover:bg-gray-600 transition"
          >
            Not Now
          </button>
        </div>
      </div>
      <button 
        id="pwa-close-btn" 
        class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
      >
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
        </svg>
      </button>
    </div>
  `;
  
  document.body.appendChild(installBanner);
  
  // Install button
  document.getElementById('pwa-install-btn').addEventListener('click', async () => {
    if (!deferredPrompt) return;
    
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    console.log(`[PWA Install] User response: ${outcome}`);
    
    if (outcome === 'accepted') {
      console.log('✅ User accepted the install prompt');
      // Mark as dismissed so it never shows again (even if installation fails)
      markInstallPromptDismissed();
    } else {
      // User declined - mark as dismissed permanently
      markInstallPromptDismissed();
    }
    
    deferredPrompt = null;
    installBanner.remove();
  });
  
  // Dismiss buttons - mark as dismissed PERMANENTLY
  document.getElementById('pwa-dismiss-btn').addEventListener('click', () => {
    markInstallPromptDismissed();
    installBanner.remove();
  });
  
  document.getElementById('pwa-close-btn').addEventListener('click', () => {
    markInstallPromptDismissed();
    installBanner.remove();
  });
}

// Listen for beforeinstallprompt event (capture it whenever it fires, on any page)
window.addEventListener('beforeinstallprompt', (e) => {
  // Prevent Chrome 67 and earlier from automatically showing the prompt
  e.preventDefault();
  deferredPrompt = e;
  
  console.log('[PWA Install] beforeinstallprompt event fired - captured for later use');
  
  // If we're on dashboard page, try to show it
  if (isDashboardPage()) {
    setTimeout(async () => {
      await showInstallBanner();
    }, 1500);
  }
});

// Track installation
window.addEventListener('appinstalled', () => {
  console.log('✅ NFG App installed successfully!');
  deferredPrompt = null;
  
  // Mark as dismissed so it never shows again
  markInstallPromptDismissed();
  
  // Remove banner if still visible
  const banner = document.getElementById('pwa-install-banner');
  if (banner) {
    banner.remove();
  }
  
  // Show success notification
  if (typeof toast !== 'undefined') {
    toast.success('App installed! You can now use NFG offline.');
  }
});

// Check on dashboard page load (after login redirect) - ONE TIME ONLY
if (isDashboardPage()) {
  // Function to check and show install prompt on dashboard
  const checkAndShowInstallPrompt = async () => {
    const authenticated = await isAuthenticated();
    if (authenticated && deferredPrompt) {
      // Only show if all conditions are met (one time only)
      await showInstallBanner();
    }
  };
  
  // Wait for page to fully load and auth to be ready
  if (document.readyState === 'loading') {
    window.addEventListener('load', () => {
      setTimeout(checkAndShowInstallPrompt, 2000);
    });
  } else {
    // DOM already loaded
    setTimeout(checkAndShowInstallPrompt, 2000);
  }
}

// Add PWA badge to UI if installed
if (isPWA()) {
  console.log('✅ Running as PWA');
  document.documentElement.classList.add('pwa-mode');
}

// Online/Offline status
function broadcastConnectionStatus(online) {
  if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
    try {
      navigator.serviceWorker.controller.postMessage({
        type: 'CONNECTION_STATUS',
        online,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.warn('[PWA] Failed to broadcast connection status:', error);
    }
  }
}

window.addEventListener('online', () => {
  console.log('✅ Back online');
  if (typeof toast !== 'undefined') {
    toast.success('Connection restored!');
  }
  broadcastConnectionStatus(true);
});

window.addEventListener('offline', () => {
  console.log('🔴 Offline');
  if (typeof toast !== 'undefined') {
    toast.warning('You are offline. Some features may be limited.');
  }
  broadcastConnectionStatus(false);
});

// --- Service worker registration & push setup ---

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then(async (registration) => {
        console.log('✅ Service Worker registered:', registration.scope);
        serviceWorkerRegistration = registration;

        // Listen for service worker updates
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                console.log('🔄 New service worker available, reloading page...');
                // Auto-reload to activate new service worker
                window.location.reload();
              }
            });
          }
        });

        // Check for updates every hour
        setInterval(() => {
          registration.update();
        }, 60 * 60 * 1000);

        // Listen for messages from service worker
        navigator.serviceWorker.addEventListener('message', (event) => {
          if (event.data && event.data.type === 'SW_READY') {
            console.log('✅ Service Worker ready, version:', event.data.version);
          }
          if (event.data && event.data.type === 'PUSH_NOTIFICATION_RECEIVED') {
            console.log('📨 Push notification received:', event.data.payload);
          }
        });

        await refreshSubscriptionState();
      })
      .catch((error) => {
        console.error('❌ Service Worker registration failed:', error);
      });
  });

  navigator.serviceWorker.ready.then(async (registration) => {
    if (!serviceWorkerRegistration) {
      serviceWorkerRegistration = registration;
      await refreshSubscriptionState();
    }
  });
}

export function getPushStatus() {
  return {
    supported: pushSupported,
    permission: pushSupported ? Notification.permission : 'denied',
    subscribed: !!currentSubscription
  };
}

export async function enablePushNotifications() {
  if (!pushSupported) {
    throw new Error('Push notifications are not supported in this browser.');
  }

  const registration = await ensureServiceWorkerRegistration();

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    dispatchPushStatus();
    throw new Error('Notification permission was not granted.');
  }

  const existing = await registration.pushManager.getSubscription();
  if (existing) {
    currentSubscription = existing;
    await syncSubscriptionWithServer(existing, { requireAuth: true });
    dispatchPushStatus();
    return existing;
  }

  const vapidKey = await getVapidPublicKey();
  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(vapidKey)
  });

  currentSubscription = subscription;
  await syncSubscriptionWithServer(subscription, { requireAuth: true });
  dispatchPushStatus();
  return subscription;
}

export async function disablePushNotifications() {
  if (!pushSupported) {
    return;
  }

  const registration = await ensureServiceWorkerRegistration();
  const subscription = await registration.pushManager.getSubscription();

  if (!subscription) {
    currentSubscription = null;
    dispatchPushStatus();
    return;
  }

  try {
    await deleteSubscriptionFromServer(subscription.endpoint);
  } catch (error) {
    console.warn('[Push] Failed to remove subscription from server:', error);
  }

  await subscription.unsubscribe();
  currentSubscription = null;
  dispatchPushStatus();
}

async function refreshSubscriptionState() {
  if (!pushSupported) {
    dispatchPushStatus();
    return;
  }

  try {
    const registration = await ensureServiceWorkerRegistration();
    currentSubscription = await registration.pushManager.getSubscription();

    if (currentSubscription) {
      await syncSubscriptionWithServer(currentSubscription, { requireAuth: false });
    }
  } catch (error) {
    console.warn('[Push] Unable to refresh subscription state:', error);
  }

  dispatchPushStatus();
}

async function ensureServiceWorkerRegistration() {
  if (serviceWorkerRegistration) {
    return serviceWorkerRegistration;
  }

  serviceWorkerRegistration = await navigator.serviceWorker.ready;
  return serviceWorkerRegistration;
}

async function getVapidPublicKey() {
  if (cachedVapidKey) {
    return cachedVapidKey;
  }

  cachedVapidKey = window.ENV?.VAPID_PUBLIC_KEY || FALLBACK_VAPID_PUBLIC_KEY;
  return cachedVapidKey;
}

async function syncSubscriptionWithServer(subscription, { requireAuth } = { requireAuth: true }) {
  const token = await getAccessToken();
  if (!token) {
    if (requireAuth) {
      throw new Error('You must be logged in to manage push notifications.');
    }
    return;
  }

  await saveSubscriptionToServer(subscription);
}

async function saveSubscriptionToServer(subscription) {
  const payload = subscription.toJSON();
  const { error } = await supabase.functions.invoke('save-subscription', {
    body: {
      action: 'save',
      subscription: payload
    }
  });

  if (error) {
    throw new Error(error.message || 'Failed to save subscription');
  }
}

async function deleteSubscriptionFromServer(endpoint) {
  const { error } = await supabase.functions.invoke('save-subscription', {
    body: {
      action: 'delete',
      endpoint
    }
  });

  if (error && error.status !== 404) {
    throw new Error(error.message || 'Failed to delete subscription');
  }
}

async function getAccessToken() {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token ?? null;
  } catch (error) {
    console.warn('[Push] Unable to retrieve Supabase session:', error);
    return null;
  }
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

function dispatchPushStatus() {
  const detail = getPushStatus();
  window.dispatchEvent(new CustomEvent('nfg:push-status-changed', { detail }));
}

dispatchPushStatus();