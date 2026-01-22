/**
 * Sales Portal Notifications
 * Handles notifications for sales portal events
 */

import { supabase } from './supabase.js';
import { toast } from './notifications.js';

/**
 * Create a notification in the database
 */
async function createNotification(title, message, type = 'info', link = null, userId = null) {
  try {
    // Get current user if not provided
    if (!userId) {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      userId = user.id;
    }

    // Map sales notification types to notification center types
    const notificationTypeMap = {
      'deal_created': 'job_assigned',
      'deal_updated': 'job_updated',
      'deal_stage_changed': 'job_updated',
      'deal_won': 'job_completed',
      'deal_lost': 'booking_cancelled',
      'quote_created': 'booking_created',
      'quote_sent': 'booking_created',
      'quote_accepted': 'job_completed',
      'quote_rejected': 'booking_cancelled',
      'account_created': 'site_assigned',
      'contact_created': 'mention',
      'default': 'system'
    };

    const dbType = notificationTypeMap[type] || notificationTypeMap['default'];

    const { data, error } = await supabase
      .from('notifications')
      .insert({
        user_id: userId,
        type: dbType,
        title,
        message,
        link: link || null,
        read: false
      })
      .select()
      .single();

    if (error) {
      console.warn('[Sales Notifications] Could not create database notification:', error);
      // Continue anyway - toast will still show
    }

    return data;
  } catch (error) {
    console.warn('[Sales Notifications] Error creating notification:', error);
    return null;
  }
}

/**
 * Notify about deal events
 */
export const dealNotifications = {
  async created(deal) {
    const message = `New deal "${deal.title || 'Untitled'}" has been created`;
    toast.success(message, 'Deal Created');
    await createNotification('Deal Created', message, 'deal_created', `#deals?deal=${deal.id}`);
  },

  async updated(deal) {
    const message = `Deal "${deal.title || 'Untitled'}" has been updated`;
    toast.info(message, 'Deal Updated');
    await createNotification('Deal Updated', message, 'deal_updated', `#deals?deal=${deal.id}`);
  },

  async stageChanged(deal, oldStage, newStage) {
    const stageNames = {
      'prospecting': 'Prospecting',
      'qualification': 'Qualification',
      'proposal': 'Proposal',
      'negotiation': 'Negotiation',
      'closed_won': 'Closed Won',
      'closed_lost': 'Closed Lost'
    };

    const oldStageName = stageNames[oldStage] || oldStage;
    const newStageName = stageNames[newStage] || newStage;
    const message = `Deal "${deal.title || 'Untitled'}" moved from ${oldStageName} to ${newStageName}`;

    if (newStage === 'closed_won') {
      toast.success(message, 'Deal Won! 🎉');
      await createNotification('Deal Won!', `Deal "${deal.title || 'Untitled'}" has been won`, 'deal_won', `#deals?deal=${deal.id}`);
    } else if (newStage === 'closed_lost') {
      toast.warning(message, 'Deal Lost');
      await createNotification('Deal Lost', `Deal "${deal.title || 'Untitled'}" has been marked as lost`, 'deal_lost', `#deals?deal=${deal.id}`);
    } else {
      toast.info(message, 'Stage Changed');
      await createNotification('Deal Stage Changed', message, 'deal_stage_changed', `#deals?deal=${deal.id}`);
    }
  },

  async deleted(dealTitle) {
    const message = `Deal "${dealTitle || 'Untitled'}" has been deleted`;
    toast.info(message, 'Deal Deleted');
    // Don't create DB notification for deletions
  },

  async convertedToSite(deal, site) {
    const message = `Deal "${deal.title || 'Untitled'}" has been converted to site "${site.name || 'New Site'}"`;
    toast.success(message, 'Deal Converted');
    await createNotification('Deal Converted', message, 'deal_updated', `#sites?site=${site.id}`);
  }
};

/**
 * Notify about quote events
 */
export const quoteNotifications = {
  async created(quote) {
    const message = `New quote has been created${quote.deal_id ? ' for a deal' : ''}`;
    toast.success(message, 'Quote Created');
    await createNotification('Quote Created', message, 'quote_created', `#quotes?quote=${quote.id}`);
  },

  async updated(quote) {
    const message = `Quote has been updated`;
    toast.info(message, 'Quote Updated');
    await createNotification('Quote Updated', message, 'quote_created', `#quotes?quote=${quote.id}`);
  },

  async sent(quote) {
    const message = `Quote has been sent to the client`;
    toast.success(message, 'Quote Sent');
    await createNotification('Quote Sent', message, 'quote_sent', `#quotes?quote=${quote.id}`);
  },

  async accepted(quote) {
    const message = `Quote has been accepted by the client! 🎉`;
    toast.success(message, 'Quote Accepted');
    await createNotification('Quote Accepted', message, 'quote_accepted', `#quotes?quote=${quote.id}`);
  },

  async rejected(quote) {
    const message = `Quote has been rejected by the client`;
    toast.warning(message, 'Quote Rejected');
    await createNotification('Quote Rejected', message, 'quote_rejected', `#quotes?quote=${quote.id}`);
  },

  async deleted(quoteId) {
    const message = `Quote has been deleted`;
    toast.info(message, 'Quote Deleted');
    // Don't create DB notification for deletions
  }
};

/**
 * Notify about account/contact events
 */
export const accountNotifications = {
  async accountCreated(account) {
    const message = `New account "${account.name || 'Untitled'}" has been created`;
    toast.success(message, 'Account Created');
    await createNotification('Account Created', message, 'account_created', `#contacts?account=${account.id}`);
  },

  async accountUpdated(account) {
    const message = `Account "${account.name || 'Untitled'}" has been updated`;
    toast.info(message, 'Account Updated');
    await createNotification('Account Updated', message, 'account_created', `#contacts?account=${account.id}`);
  },

  async contactCreated(contact, accountName) {
    const message = `New contact "${contact.full_name || 'Untitled'}" has been added${accountName ? ` to ${accountName}` : ''}`;
    toast.success(message, 'Contact Created');
    await createNotification('Contact Created', message, 'contact_created', `#contacts?contact=${contact.id}`);
  },

  async contactUpdated(contact) {
    const message = `Contact "${contact.full_name || 'Untitled'}" has been updated`;
    toast.info(message, 'Contact Updated');
    await createNotification('Contact Updated', message, 'contact_created', `#contacts?contact=${contact.id}`);
  }
};

/**
 * Notify about important actions
 */
export const actionNotifications = {
  async bulkDelete(items, itemType) {
    const count = items.length;
    const message = `${count} ${itemType}${count === 1 ? '' : 's'} deleted`;
    toast.info(message, 'Bulk Delete');
    // Don't create DB notification for bulk operations
  },

  async exportStarted(format) {
    const message = `Exporting data as ${format.toUpperCase()}...`;
    toast.info(message, 'Export Started');
  },

  async exportCompleted(format, count) {
    const message = `Exported ${count} records as ${format.toUpperCase()}`;
    toast.success(message, 'Export Complete');
  },

  async importStarted(filename) {
    const message = `Importing data from ${filename}...`;
    toast.info(message, 'Import Started');
  },

  async importCompleted(count) {
    const message = `Successfully imported ${count} records`;
    toast.success(message, 'Import Complete');
  }
};

/**
 * Notify about errors
 */
export const errorNotifications = {
  async dealLoadFailed(error) {
    toast.error('Failed to load deals. Please refresh the page.', 'Error');
  },

  async quoteLoadFailed(error) {
    toast.error('Failed to load quotes. Please refresh the page.', 'Error');
  },

  async accountLoadFailed(error) {
    toast.error('Failed to load accounts. Please refresh the page.', 'Error');
  },

  async saveFailed(itemType, error) {
    const message = error?.message || 'An error occurred';
    toast.error(`Failed to save ${itemType}: ${message}`, 'Error');
  },

  async deleteFailed(itemType, error) {
    const message = error?.message || 'An error occurred';
    toast.error(`Failed to delete ${itemType}: ${message}`, 'Error');
  }
};

// Export default object with all notification types
export default {
  deal: dealNotifications,
  quote: quoteNotifications,
  account: accountNotifications,
  action: actionNotifications,
  error: errorNotifications
};
