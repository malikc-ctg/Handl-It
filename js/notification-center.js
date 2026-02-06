/**
 * NFG Notification Center
 * Manages in-app notifications with real-time updates
 */

import { supabase } from './supabase.js';
import { toast } from './notifications.js';
import { escapeHtml } from './escape-html.js';
// Push notifications are managed in Settings page, removed from dropdown

// Notification types and their Lucide icon names
const NOTIFICATION_TYPE_ICONS = {
  job_assigned: 'clipboard-list',
  job_completed: 'check-circle',
  message_reaction: 'smile', // Phase 3: Message reactions
  job_updated: 'edit',
  booking_created: 'calendar',
  booking_updated: 'refresh-cw',
  booking_cancelled: 'x-circle',
  site_assigned: 'building',
  site_unassigned: 'building-x',
  inventory_low_stock: 'package-alert',
  mention: 'message-circle',
  system: 'bell'
};

// Cache
let notificationCache = [];
let unreadCount = 0;
let realtimeSubscription = null;
let pollingInterval = null;
const pushStatusEventName = 'nfg:push-status-changed';

/**
 * Initialize notification center
 */
export async function initNotificationCenter() {
  try {
    // Create notification bell UI if it doesn't exist
    createNotificationBell();
    
    // Load notifications
    await loadNotifications();
    
    // Update unread count
    await updateUnreadCount();
    
    // Setup real-time updates
    await setupRealtimeUpdates();
    
    // Setup polling as fallback (every 30 seconds)
    setupPolling(30000);
    
    // Auto-refresh unread count every minute
    setInterval(updateUnreadCount, 60000);
    
    console.log('✅ Notification center initialized');
  } catch (error) {
    console.error('❌ Failed to initialize notification center:', error);
  }
}

/**
 * Create notification bell button in header
 */
function createNotificationBell() {
  // Check if already exists
  if (document.getElementById('notification-bell-container')) {
    return;
  }
  
  const header = document.querySelector(
    'header .flex.items-center.gap-2:last-child, ' +
    'header > div > div.flex.items-center:last-child, ' +
    'header > div > div:last-child'
  );
  if (!header) {
    console.warn('⚠️ Could not find header to insert notification bell');
    return;
  }
  
  const container = document.createElement('div');
  container.id = 'notification-bell-container';
  container.className = 'relative';
  
  container.innerHTML = `
    <button id="notification-bell" class="notification-bell" aria-label="Notifications">
      <i data-lucide="bell" class="w-5 h-5"></i>
      <span id="notification-badge" class="notification-badge hidden">0</span>
    </button>
    <div id="notification-backdrop" class="notification-backdrop"></div>
    <div id="notification-center" class="notification-center">
      <div class="notification-header">
        <h3>Notifications</h3>
        <button id="mark-all-read-btn" class="notification-action-btn notification-action-btn-primary">
          <i data-lucide="check-double" class="w-3.5 h-3.5 sm:w-4 sm:h-4"></i>
          <span class="hidden sm:inline">Mark all read</span>
          <span class="sm:hidden">Read</span>
        </button>
      </div>
      <div id="notification-list" class="notification-list">
        <div class="notification-loading">
          <div class="notification-spinner"></div>
          <p>Loading notifications...</p>
        </div>
      </div>
    </div>
  `;
  
  // Insert before first child or append
  header.insertBefore(container, header.firstChild);
  
  // Setup event listeners
  setupNotificationListeners();
}

/**
 * Setup event listeners for notification center
 */
function setupNotificationListeners() {
  const bell = document.getElementById('notification-bell');
  const center = document.getElementById('notification-center');
  const backdrop = document.getElementById('notification-backdrop');
  const markAllReadBtn = document.getElementById('mark-all-read-btn');
  
  if (!bell || !center) return;
  
  // Toggle notification center
  bell.addEventListener('click', (e) => {
    e.stopPropagation();
    const isOpen = center.classList.contains('open');
    
    if (isOpen) {
      closeNotificationCenter();
    } else {
      openNotificationCenter();
    }
  });
  
  // Close when clicking backdrop (mobile)
  if (backdrop) {
    backdrop.addEventListener('click', () => {
      closeNotificationCenter();
    });
  }
  
  // Close when clicking outside (desktop)
  document.addEventListener('click', (e) => {
    if (window.innerWidth > 640) {
      if (!center.contains(e.target) && !bell.contains(e.target)) {
        closeNotificationCenter();
      }
    }
  });
  
  // Prevent clicks inside the notification center from closing it
  center.addEventListener('click', (e) => {
    e.stopPropagation();
  });
  
  // Mark all as read
  if (markAllReadBtn) {
    markAllReadBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      await markAllAsRead();
    });
  }
  
  // Initialize icons after setup
  if (window.lucide) {
    window.lucide.createIcons();
  }
}


/**
 * Open notification center
 */
function openNotificationCenter() {
  const center = document.getElementById('notification-center');
  const bell = document.getElementById('notification-bell');
  const backdrop = document.getElementById('notification-backdrop');
  
  if (center) {
    center.classList.add('open');
  }
  if (bell) {
    bell.classList.add('active');
  }
  
  // Show backdrop on mobile
  if (backdrop && window.innerWidth <= 640) {
    backdrop.classList.add('active');
    // Prevent body scroll when open on mobile
    document.body.style.overflow = 'hidden';
  }
  
  // Refresh notifications when opening
  loadNotifications();
}

/**
 * Close notification center
 */
function closeNotificationCenter() {
  const center = document.getElementById('notification-center');
  const bell = document.getElementById('notification-bell');
  const backdrop = document.getElementById('notification-backdrop');
  
  if (center) {
    center.classList.remove('open');
  }
  if (bell) {
    bell.classList.remove('active');
  }
  
  // Hide backdrop on mobile
  if (backdrop) {
    backdrop.classList.remove('active');
  }
  
  // Restore body scroll
  document.body.style.overflow = '';
}

/**
 * Load notifications from database
 */
export async function loadNotifications(limit = 100) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(limit);
    
    if (error) throw error;
    
    notificationCache = data || [];
    renderNotifications(notificationCache);
    
    return notificationCache;
  } catch (error) {
    console.error('❌ Failed to load notifications:', error);
    showNotificationError();
    return [];
  }
}

/**
 * Render notifications in the list
 */
function renderNotifications(notifications) {
  const list = document.getElementById('notification-list');
  if (!list) return;
  
  if (!notifications || notifications.length === 0) {
    list.innerHTML = `
      <div class="notification-empty">
        <div class="notification-empty-icon">
          <i data-lucide="bell-off" class="w-12 h-12"></i>
        </div>
        <p class="notification-empty-text">No notifications yet</p>
      </div>
    `;
    if (window.lucide) window.lucide.createIcons();
    return;
  }
  
  list.innerHTML = notifications.map(notification => {
    const iconName = NOTIFICATION_TYPE_ICONS[notification.type] || 'bell';
    const metaHtml = renderNotificationMetadata(notification);
    return `
    <div class="notification-item ${notification.read ? '' : 'unread'}" 
         data-notification-id="${notification.id}"
         data-link="${notification.link || '#'}"
         data-reminder-type="${notification.metadata?.reminder_type || ''}">
      <div class="notification-item-content">
        <div class="notification-icon ${notification.type}">
          <i data-lucide="${iconName}" class="w-5 h-5"></i>
        </div>
        <div class="notification-details">
          <h4 class="notification-title">${escapeHtml(notification.title)}</h4>
          <p class="notification-message">${escapeHtml(notification.message)}</p>
          ${metaHtml}
          <p class="notification-time">${formatTime(notification.created_at)}</p>
        </div>
        ${!notification.read ? '<div class="notification-dot"></div>' : ''}
      </div>
    </div>
    `;
  }).join('');
  
  // Add click handlers
  list.querySelectorAll('.notification-item').forEach(item => {
    item.addEventListener('click', async () => {
      const notificationId = item.dataset.notificationId;
      const link = item.dataset.link;
      const reminderType = item.dataset.reminderType;
      
      // Mark as read
      await markAsRead(notificationId);
      
      // Special handling for morning reminders
      if (reminderType === 'morning_motivation') {
        handleMorningReminderClick();
        return;
      }
      
      // Navigate if link exists
      if (link && link !== '#') {
        window.location.href = link;
      } else {
        closeNotificationCenter();
      }
    });
  });
  
  // Initialize Lucide icons for notification items
  if (window.lucide) {
    window.lucide.createIcons();
  }
}

function handleMorningReminderClick() {
  closeNotificationCenter();
  
  if (typeof window.openClockInModal === 'function') {
    window.openClockInModal();
    return;
  }
  
  const clockModal = document.getElementById('clockInOutModal');
  if (clockModal) {
    clockModal.classList.remove('hidden');
    clockModal.classList.add('flex');
    return;
  }
  
  if (!window.location.pathname.endsWith('dashboard.html')) {
    window.location.href = 'dashboard.html#clock-in';
  }
}

/**
 * Update unread count badge
 */
export async function updateUnreadCount() {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return 0;
    
    // Use count query to get unread count
    const { count, error } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('read', false);
    
    if (error) {
      console.error('❌ Error getting unread count:', error);
      throw error;
    }
    
    unreadCount = count || 0;
    updateBadge();
    
    return unreadCount;
  } catch (error) {
    console.error('❌ Failed to update unread count:', error);
    // Don't throw, just return 0 so the app doesn't break
    unreadCount = 0;
    updateBadge();
    return 0;
  }
}

/**
 * Update badge display
 */
function updateBadge() {
  const badge = document.getElementById('notification-badge');
  if (!badge) return;
  
  if (unreadCount > 0) {
    badge.textContent = unreadCount > 99 ? '99+' : unreadCount;
    badge.classList.remove('hidden');
  } else {
    badge.classList.add('hidden');
  }
}

/**
 * Mark notification as read
 */
async function markAsRead(notificationId) {
  try {
    // Use the database function to mark as read (handles read_at column properly)
    const { error } = await supabase.rpc('mark_notification_read', {
      notification_id: notificationId
    });
    
    if (error) {
      // Fallback: Try direct update if function doesn't work
      console.warn('⚠️ RPC function failed, trying direct update:', error);
      
      // Check if error is about read_at column not existing
      const readAtError = error.message?.includes('read_at') || 
                          (error.message?.includes('column') && error.message?.includes('does not exist'));
      
      // Only update read field (don't include read_at if column doesn't exist)
      const updateData = { read: true };
      
      const { error: updateError } = await supabase
        .from('notifications')
        .update(updateData)
        .eq('id', notificationId);
      
      if (updateError) {
        // If it's a read_at error, that's OK - the update should still work
        if (!updateError.message?.includes('read_at')) {
          throw updateError;
        }
      }
    }
    
    // Update cache
    const notification = notificationCache.find(n => n.id === notificationId);
    if (notification) {
      notification.read = true;
      notification.read_at = new Date().toISOString();
    }
    
    // Update UI
    const item = document.querySelector(`[data-notification-id="${notificationId}"]`);
    if (item) {
      item.classList.remove('unread');
      const dot = item.querySelector('.notification-dot');
      if (dot) dot.remove();
    }
    
    // Update badge
    await updateUnreadCount();
    
    return true;
  } catch (error) {
    console.error('❌ Failed to mark notification as read:', error);
    return false;
  }
}

/**
 * Mark all notifications as read
 */
async function markAllAsRead() {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error('You must be logged in to mark notifications as read');
      return false;
    }
    
    // Try using the database function first
    let error = null;
    try {
      const result = await supabase.rpc('mark_all_notifications_read');
      error = result.error;
    } catch (rpcError) {
      error = rpcError;
    }
    
    // If RPC fails, try direct update (fallback)
    if (error) {
      console.warn('⚠️ RPC function failed, trying direct update:', error);
      
      // Check if error is about read_at column not existing
      const readAtError = error.message?.includes('read_at') || error.message?.includes('column') && error.message?.includes('does not exist');
      
      // Only update read field if read_at column doesn't exist
      const updateData = { read: true };
      
      // Try to update without read_at first if column doesn't exist
      const { error: updateError } = await supabase
        .from('notifications')
        .update(updateData)
        .eq('user_id', user.id)
        .eq('read', false);
      
      if (updateError) {
        console.error('❌ Direct update also failed:', updateError);
        // If it's still a read_at error, that's OK - just update read field
        if (!updateError.message?.includes('read_at')) {
          throw updateError;
        }
      }
    }
    
    // Update cache - mark all as read
    notificationCache.forEach(n => {
      n.read = true;
      n.read_at = new Date().toISOString();
    });
    
    // Update UI
    renderNotifications(notificationCache);
    
    // Update badge
    await updateUnreadCount();
    
    toast.success('All notifications marked as read');
    
    return true;
  } catch (error) {
    console.error('❌ Failed to mark all as read:', error);
    const errorMessage = error?.message || 'Failed to mark all notifications as read';
    toast.error(errorMessage);
    return false;
  }
}

/**
 * Setup real-time updates using Supabase Realtime
 */
async function setupRealtimeUpdates() {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    
    // Subscribe to notifications table changes
    realtimeSubscription = supabase
      .channel('notifications')
      .on('postgres_changes', 
        { 
          event: 'INSERT', 
          schema: 'public', 
          table: 'notifications',
          filter: `user_id=eq.${user.id}`
        }, 
        (payload) => {
          console.log('🔔 New notification received:', payload);
          
          // Add to cache
          notificationCache.unshift(payload.new);
          
          // Re-render
          renderNotifications(notificationCache);
          
          // Update badge
          updateUnreadCount();
          
          // Show toast if center is closed
          if (!document.getElementById('notification-center')?.classList.contains('open')) {
            if (payload.new.type === 'inventory_low_stock') {
              toast.warning(payload.new.message, payload.new.title);
            } else {
            toast.info(payload.new.message, payload.new.title);
            }
          }
        }
      )
      .on('postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`
        },
        (payload) => {
          // Update cache
          const index = notificationCache.findIndex(n => n.id === payload.new.id);
          if (index !== -1) {
            notificationCache[index] = payload.new;
            renderNotifications(notificationCache);
            updateUnreadCount();
          }
        }
      )
      .subscribe();
    
    console.log('✅ Real-time notifications subscribed');
  } catch (error) {
    console.error('❌ Failed to setup real-time updates:', error);
  }
}

/**
 * Setup polling as fallback
 */
function setupPolling(interval = 30000) {
  if (pollingInterval) {
    clearInterval(pollingInterval);
  }
  
  pollingInterval = setInterval(async () => {
    await loadNotifications();
    await updateUnreadCount();
  }, interval);
}

/**
 * Show error state in notification list
 */
function showNotificationError() {
  const list = document.getElementById('notification-list');
  if (list) {
    list.innerHTML = `
      <div class="notification-empty">
        <div class="notification-empty-icon">
          <i data-lucide="alert-circle" class="w-full h-full"></i>
        </div>
        <p class="notification-empty-text">Failed to load notifications</p>
      </div>
    `;
    if (window.lucide) window.lucide.createIcons();
  }
}

/**
 * Create a notification (helper function)
 */
export async function createNotification(userId, type, title, message, link = null, metadata = {}) {
  try {
    const { data, error } = await supabase
      .from('notifications')
      .insert({
        user_id: userId,
        type,
        title,
        message,
        link,
        metadata
      })
      .select()
      .single();
    
    if (error) throw error;
    
    return data;
  } catch (error) {
    console.error('❌ Failed to create notification:', error);
    return null;
  }
}

function renderNotificationMetadata(notification) {
  if (notification.type !== 'inventory_low_stock' || !notification.metadata) {
    return '';
  }
  const meta = notification.metadata;
  const rows = [
    meta.item_name ? `<div class="notification-meta-row"><strong>Item:</strong> ${escapeHtml(meta.item_name)}</div>` : '',
    meta.site_name ? `<div class="notification-meta-row"><strong>Site:</strong> ${escapeHtml(meta.site_name)}</div>` : '',
    meta.quantity !== undefined ? `<div class="notification-meta-row"><strong>Qty:</strong> ${meta.quantity}</div>` : '',
    meta.threshold !== undefined ? `<div class="notification-meta-row"><strong>Threshold:</strong> ${meta.threshold}</div>` : ''
  ].filter(Boolean).join('');
  
  if (!rows) return '';
  
  return `<div class="notification-meta">${rows}</div>`;
}

/**
 * Helper: Format time
 */
function formatTime(timestamp) {
  const now = new Date();
  const time = new Date(timestamp);
  const diffMs = now - time;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  
  return time.toLocaleDateString();
}

/**
 * Cleanup on page unload
 */
window.addEventListener('beforeunload', () => {
  if (realtimeSubscription) {
    supabase.removeChannel(realtimeSubscription);
  }
  if (pollingInterval) {
    clearInterval(pollingInterval);
  }
});

// Initialize on DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initNotificationCenter);
} else {
  initNotificationCenter();
}

