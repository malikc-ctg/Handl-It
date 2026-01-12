// =====================================================
// In-App Messaging System
// Phase 1: MVP (Core Messaging)
// =====================================================
// Messages.js loaded

import { supabase } from './supabase.js';
import { showNotification } from './notifications.js';

// Create toast helper for backward compatibility
const toast = {
  error: (message, title = 'Error') => showNotification(message, 'error', title),
  success: (message, title = 'Success') => showNotification(message, 'success', title),
  info: (message, title = 'Info') => showNotification(message, 'info', title),
  warning: (message, title = 'Warning') => showNotification(message, 'warning', title)
};

// ========== STATE MANAGEMENT ==========
let currentUser = null;
let currentUserProfile = null;
let conversations = [];
let currentConversation = null;
let messages = [];
let realtimeChannel = null;
let realtimeSubscription = null;
let typingChannel = null; // For typing indicators
let presenceChannel = null; // For online/offline status
let typingTimeout = null; // To clear typing indicator
let typingChannelSubscribed = false; // Track subscription status
let conversationFilterType = 'all'; // 'all', 'direct', 'group' (Phase 4.4)
const linkPreviews = new Map(); // messageId -> linkPreviewData[] (Phase 2.3)
const revealedItems = new Set(); // For swipe gesture tracking (must be global scope)
const TYPING_TIMEOUT_MS = 3000; // Hide typing after 3 seconds
const MESSAGE_EDIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes to edit

// ========== INITIALIZATION ==========
console.log('=== MESSAGES.JS LOADED ===');
console.log('Link previews map initialized:', linkPreviews);
console.log('🔵 Document readyState:', document.readyState);

// Immediately invoke async function to start initialization
(async function initializeMessages() {
  try {
  
  // Hide page loader
  const pageLoader = document.getElementById('page-loader');
  if (pageLoader) {
    pageLoader.style.display = 'none';
  }

  // Get current user
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  
  if (userError || !user) {
    window.location.href = './index.html';
    return;
  }

  currentUser = user;

  // Get user profile
  const { data: profile, error: profileError } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  if (profileError) {
    console.error('❌ Error loading user profile:', profileError);
    // Create profile if doesn't exist
    const { data: newProfile } = await supabase
      .from('user_profiles')
      .insert({
        id: user.id,
        full_name: user.email?.split('@')[0] || 'User',
        email: user.email,
        role: 'staff'
      })
      .select()
      .single();
    
    currentUserProfile = newProfile;
  } else {
    currentUserProfile = profile;
  }

  // Initialize event listeners
  initEventListeners();

  // Load conversations
  if (currentUser && currentUser.id) {
    await loadConversations();
  } else {
    const emptyEl = document.getElementById('conversations-empty');
    const loadingEl = document.getElementById('conversations-loading');
    if (loadingEl) loadingEl.classList.add('hidden');
    if (emptyEl) {
      emptyEl.classList.remove('hidden');
      const emptyTitle = emptyEl.querySelector('h3');
      const emptyMessage = emptyEl.querySelector('p');
      if (emptyTitle) emptyTitle.textContent = 'Authentication Error';
      if (emptyMessage) emptyMessage.textContent = 'Please refresh the page';
    }
  }

  // Initialize icons
  if (window.lucide) {
    lucide.createIcons();
  }
  
  // Initialize mobile navigation visibility after a short delay to ensure DOM is ready
  setTimeout(() => {
    // Check if we're viewing a conversation or on list
    const activeEl = document.getElementById('conversation-active');
    const isViewingConversation = activeEl && !activeEl.classList.contains('hidden');
    updateMobileNavigation(!isViewingConversation);
    
    // Initialize swipe gestures on mobile
    if (window.innerWidth < 768) {
      initPullToRefresh();
    }
  }, 100);
  
  // Initialize mobile keyboard handling
  initMobileKeyboardHandling();
  
  } catch (error) {
    console.error('Error initializing messages:', error);
    const loadingEl = document.getElementById('conversations-loading');
    const emptyEl = document.getElementById('conversations-empty');
    if (loadingEl) loadingEl.classList.add('hidden');
    if (emptyEl) {
      emptyEl.classList.remove('hidden');
      const emptyTitle = emptyEl.querySelector('h3');
      const emptyMessage = emptyEl.querySelector('p');
      if (emptyTitle) emptyTitle.textContent = 'Error Loading Messages';
      if (emptyMessage) emptyMessage.textContent = 'Please refresh the page';
    }
  }
})(); // Immediately invoke the async function

// ========== HAPTIC FEEDBACK ==========
function triggerHaptic(type = 'light') {
  if (!window.navigator || !window.navigator.vibrate) return;
  
  const patterns = {
    light: 10,        // Light tap
    medium: 20,       // Medium tap
    heavy: 30,        // Heavy tap
    success: [10, 50, 10],  // Success pattern
    error: [20, 50, 20],    // Error pattern
    warning: [15, 30, 15]   // Warning pattern
  };
  
  const pattern = patterns[type] || patterns.light;
  try {
    window.navigator.vibrate(pattern);
  } catch (e) {
    // Silently fail if haptic feedback is not supported
  }
}

// ========== PHASE 2: FILE ATTACHMENTS & SEARCH ==========
let selectedFiles = []; // Track selected files for attachment
let messageSearchQuery = ''; // Track search query
let originalMessages = []; // Store original messages before search filter

// ========== PHASE 3: MESSAGE REACTIONS ==========
let messageReactions = new Map(); // Map of message_id -> reactions array
const COMMON_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🔥', '👏', '🎉']; // Quick reaction emojis

// ========== PHASE 3.2: MESSAGE REPLIES ==========
let replyingTo = null; // { messageId, content, sender, conversationId } - current reply context

// Handle file selection
function initFileUpload() {
  const fileInput = document.getElementById('file');
  if (!fileInput) return;
  
  fileInput.addEventListener('change', (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    
    // Validate file size (10 MB limit)
    const maxSize = 10 * 1024 * 1024; // 10 MB
    const validFiles = files.filter(file => {
      if (file.size > maxSize) {
        toast?.error(`File "${file.name}" is too large. Maximum size is 10 MB.`, 'File Too Large');
        triggerHaptic('warning');
        return false;
      }
      return true;
    });
    
    if (validFiles.length > 0) {
      selectedFiles = [...selectedFiles, ...validFiles];
      updateFilePreview(); // This will call updateSendButtonState()
      triggerHaptic('light');
    }
    
    // Reset input to allow selecting same file again
    fileInput.value = '';
  });
}

// Show file preview before sending
function updateFilePreview() {
  const messageBox = document.querySelector('.messageBox');
  if (!messageBox) return;
  
  // Remove existing preview
  const existingPreview = messageBox.querySelector('.file-preview');
  if (existingPreview) existingPreview.remove();
  
  if (selectedFiles.length === 0) return;
  
  // Create preview container
  const preview = document.createElement('div');
  preview.className = 'file-preview flex flex-wrap gap-2 p-2 border-t border-gray-200 dark:border-gray-700';
  preview.innerHTML = selectedFiles.map((file, index) => {
    const isImage = file.type.startsWith('image/');
    const fileSize = (file.size / 1024).toFixed(1); // KB
    
    return `
      <div class="file-preview-item flex items-center gap-2 p-2 bg-gray-100 dark:bg-gray-700 rounded-lg text-sm">
        ${isImage ? `
          <img src="${URL.createObjectURL(file)}" alt="${file.name}" class="w-10 h-10 object-cover rounded">
        ` : `
          <i data-lucide="file" class="w-5 h-5 text-gray-600 dark:text-gray-400"></i>
        `}
        <div class="flex-1 min-w-0">
          <p class="text-xs font-medium truncate">${escapeHtml(file.name)}</p>
          <p class="text-xs text-gray-500 dark:text-gray-400">${fileSize} KB</p>
        </div>
        <button class="remove-file-btn p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-600" data-file-index="${index}" title="Remove">
          <i data-lucide="x" class="w-4 h-4 text-gray-600 dark:text-gray-400"></i>
        </button>
      </div>
    `;
  }).join('');
  
  // Insert preview before message input
  const messageInput = document.getElementById('message-input');
  if (messageInput) {
    messageBox.insertBefore(preview, messageInput.parentElement || messageInput);
  }
  
  // Recreate icons
  if (window.lucide) {
    lucide.createIcons();
  }
  
  // Attach remove file listeners
  preview.querySelectorAll('.remove-file-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const index = parseInt(btn.dataset.fileIndex);
      selectedFiles.splice(index, 1);
      updateFilePreview();
      triggerHaptic('light');
      // Update send button state after removing file
      updateSendButtonState();
    });
  });
  
  // Update send button state after adding files
  updateSendButtonState();
}

// Update send button enabled/disabled state
function updateSendButtonState() {
  const sendBtn = document.getElementById('send-message-btn');
  const messageInput = document.getElementById('message-input');
  if (sendBtn && messageInput) {
    const hasText = messageInput.value.trim().length > 0;
    const hasFiles = selectedFiles.length > 0;
    sendBtn.disabled = !hasText && !hasFiles;
    console.log('[Send Button] State updated from file selection:', { hasText, hasFiles, disabled: sendBtn.disabled });
  }
}

// ========== EVENT LISTENERS ==========
function initEventListeners() {
  // New message button
  document.getElementById('new-message-btn')?.addEventListener('click', () => {
    triggerHaptic('light');
    openNewMessageModal();
  });
  
  // Empty state new message button
  document.getElementById('empty-state-new-message-btn')?.addEventListener('click', () => {
    triggerHaptic('medium');
    openNewMessageModal();
  });

  // New group button (Phase 4)
  document.getElementById('new-group-btn')?.addEventListener('click', () => {
    triggerHaptic('light');
    openCreateGroupModal();
  });

  // Close new message modal
  document.getElementById('close-new-message-modal')?.addEventListener('click', () => {
    closeNewMessageModal();
  });

  // User search in new message modal
  const userSearch = document.getElementById('user-search');
  if (userSearch) {
    userSearch.addEventListener('input', (e) => {
      searchUsers(e.target.value);
    });
  }

  // Close create group modal (Phase 4)
  document.getElementById('close-create-group-modal')?.addEventListener('click', () => {
    closeCreateGroupModal();
  });

  document.getElementById('cancel-create-group-btn')?.addEventListener('click', () => {
    closeCreateGroupModal();
  });

  // Create group button (Phase 4)
  document.getElementById('create-group-btn')?.addEventListener('click', async () => {
    await handleCreateGroup();
  });

  // Group participant search (Phase 4)
  const groupParticipantSearch = document.getElementById('group-participant-search');
  if (groupParticipantSearch) {
    groupParticipantSearch.addEventListener('input', (e) => {
      searchGroupParticipants(e.target.value);
    });
  }

  // Group name input validation (Phase 4)
  const groupNameInput = document.getElementById('group-name-input');
  if (groupNameInput) {
    groupNameInput.addEventListener('input', (e) => {
      validateGroupForm();
    });
  }

  // File upload (Phase 2)
  initFileUpload();
  
  // Message search (Phase 2)
  initMessageSearch();

  // Message form submission
  const messageForm = document.getElementById('message-form');
  if (messageForm) {
    messageForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      triggerHaptic('medium');
      await sendMessage();
      return false;
    });
  }

  // Send button click handler (direct handler as fallback)
  const sendBtn = document.getElementById('send-message-btn');
  if (sendBtn) {
    sendBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      // Only send if button is not disabled and there's content
      if (!sendBtn.disabled) {
        triggerHaptic('medium');
        await sendMessage();
      } else {
        triggerHaptic('warning');
      }
      return false;
    });
  }

  // Message input auto-resize and enable/disable send button
  const messageInput = document.getElementById('message-input');
  if (messageInput) {
    // Initial check to enable button if there's already text (e.g., from page reload)
    const sendBtn = document.getElementById('send-message-btn');
    if (sendBtn && messageInput.value.trim()) {
      sendBtn.disabled = false;
    }
    
    messageInput.addEventListener('input', (e) => {
      // Auto-resize input (adjust messageBox height)
      const messageBox = e.target.closest('.messageBox');
      if (messageBox) {
        e.target.style.height = 'auto';
        const newHeight = Math.min(e.target.scrollHeight, 120);
        e.target.style.height = newHeight + 'px';
        messageBox.style.height = 'auto';
        messageBox.style.minHeight = Math.max(44, newHeight + 16) + 'px';
      }

      // Enable/disable send button (enable if text OR files are selected)
      updateSendButtonState();
    });

    // Send on Enter (but allow Shift+Enter for new line)
    messageInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        e.stopPropagation(); // Prevent form submission
        if (messageInput.value.trim() || selectedFiles.length > 0) {
          triggerHaptic('medium');
          sendMessage();
        } else {
          triggerHaptic('warning');
        }
        return false; // Extra safety
      }
    });
    
    // Also handle keypress as backup (for some browsers/edge cases)
    messageInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        e.stopPropagation();
        if (messageInput.value.trim() || selectedFiles.length > 0) {
          triggerHaptic('medium');
          sendMessage();
        }
        return false;
      }
    });
  }

  // Conversation search (Phase 4.4)
  const conversationSearch = document.getElementById('conversation-search');
  if (conversationSearch) {
    conversationSearch.addEventListener('input', (e) => {
      filterConversations(e.target.value);
    });
  }
  
  // Make filter function globally available (Phase 4.4)
  window.setConversationFilterType = setConversationFilterType;

  // Back to list button (mobile)
  document.getElementById('back-to-list-btn')?.addEventListener('click', () => {
    triggerHaptic('light');
    showConversationList();
  });

  // Back to dashboard button (mobile)
  document.getElementById('back-to-dashboard-btn')?.addEventListener('click', () => {
    triggerHaptic('light');
    window.location.href = './dashboard.html';
  });

  // Floating Action Button for new message (mobile)
  document.getElementById('fab-new-message')?.addEventListener('click', () => {
    triggerHaptic('medium');
    openNewMessageModal();
  });

  // Close modal on backdrop click
  const newMessageModal = document.getElementById('new-message-modal');
  if (newMessageModal) {
    newMessageModal.addEventListener('click', (e) => {
      if (e.target === newMessageModal) {
        closeNewMessageModal();
      }
    });
  }

  // Close create group modal on backdrop click (Phase 4)
  const createGroupModal = document.getElementById('create-group-modal');
  if (createGroupModal) {
    createGroupModal.addEventListener('click', (e) => {
      if (e.target === createGroupModal) {
        closeCreateGroupModal();
      }
    });
  }

  // Group actions button (Phase 4.2)
  document.getElementById('group-actions-btn')?.addEventListener('click', () => {
    if (currentConversation && currentConversation.type === 'group') {
      showGroupInfo(currentConversation.id);
    }
  });

  // Group info modal (Phase 4.2)
  document.getElementById('close-group-info-modal')?.addEventListener('click', () => {
    closeGroupInfoModal();
  });
  document.getElementById('close-group-info-btn')?.addEventListener('click', () => {
    closeGroupInfoModal();
  });

  // Leave group button (Phase 4.2)
  document.getElementById('leave-group-btn')?.addEventListener('click', async () => {
    if (currentConversation && currentConversation.type === 'group') {
      await handleLeaveGroup(currentConversation.id);
    }
  });

  // Add member button (Phase 4.2)
  document.getElementById('add-member-btn')?.addEventListener('click', () => {
    if (currentConversation && currentConversation.type === 'group') {
      openAddMemberModal(currentConversation.id);
    }
  });

  // Add member modal (Phase 4.2)
  document.getElementById('close-add-member-modal')?.addEventListener('click', () => {
    closeAddMemberModal();
  });
  document.getElementById('cancel-add-member-btn')?.addEventListener('click', () => {
    closeAddMemberModal();
  });
  document.getElementById('confirm-add-member-btn')?.addEventListener('click', async () => {
    if (currentConversation && currentConversation.type === 'group') {
      await handleAddMembers();
    }
  });

  // Add member search (Phase 4.2)
  const addMemberSearch = document.getElementById('add-member-search');
  if (addMemberSearch) {
    addMemberSearch.addEventListener('input', (e) => {
      searchMembersToAdd(e.target.value);
    });
  }

  // Close group info modal on backdrop click (Phase 4.2)
  const groupInfoModal = document.getElementById('group-info-modal');
  if (groupInfoModal) {
    groupInfoModal.addEventListener('click', (e) => {
      if (e.target === groupInfoModal) {
        closeGroupInfoModal();
      }
    });
  }

  // Close add member modal on backdrop click (Phase 4.2)
  const addMemberModal = document.getElementById('add-member-modal');
  if (addMemberModal) {
    addMemberModal.addEventListener('click', (e) => {
      if (e.target === addMemberModal) {
        closeAddMemberModal();
      }
    });
  }
}

// ========== LOAD CONVERSATIONS ==========
async function loadConversations() {
  try {
    const loadingEl = document.getElementById('conversations-loading');
    const emptyEl = document.getElementById('conversations-empty');
    const listEl = document.getElementById('conversations-list');

    if (loadingEl) loadingEl.classList.remove('hidden');
    if (emptyEl) emptyEl.classList.add('hidden');
    if (listEl) listEl.classList.add('hidden');

    // Get user's conversations with participant info
    // First, get participant records
    const { data: participantData, error: participantError } = await supabase
      .from('conversation_participants')
      .select('conversation_id, last_read_at')
      .eq('user_id', currentUser.id);

    if (participantError) throw participantError;

    if (!participantData || participantData.length === 0) {
      if (loadingEl) loadingEl.classList.add('hidden');
      if (emptyEl) emptyEl.classList.remove('hidden');
      return;
    }

    // Get conversation details separately (we'll filter archived conversations client-side)
    const conversationIds = participantData.map(p => p.conversation_id);
    const { data: conversationsData, error: conversationsError } = await supabase
      .from('conversations')
      .select('id, type, job_id, title, created_by, created_at, updated_at, last_message_at, archived_at, archived_by')
      .in('id', conversationIds)
      .order('last_message_at', { ascending: false });

    if (conversationsError) throw conversationsError;
    
    // Filter out conversations archived by current user (client-side filter)
    const filteredConversations = (conversationsData || []).filter(conv => {
      // Show if not archived OR archived by someone else
      return !conv.archived_at || conv.archived_by !== currentUser.id;
    });

    if (!filteredConversations || filteredConversations.length === 0) {
      if (loadingEl) loadingEl.classList.add('hidden');
      if (emptyEl) emptyEl.classList.remove('hidden');
      return;
    }

    // Get other participants for each conversation
    const { data: allParticipants, error: participantsError } = await supabase
      .from('conversation_participants')
      .select('conversation_id, user_id')
      .in('conversation_id', conversationIds);

    if (participantsError) throw participantsError;

    // Get user profiles for participants separately (to avoid relationship errors)
    const userIds = [...new Set((allParticipants || []).map(p => p.user_id))];
    const { data: userProfiles, error: profilesError } = await supabase
      .from('user_profiles')
      .select('id, full_name, email, profile_picture')
      .in('id', userIds);

    if (profilesError) throw profilesError;

    // Create a map of user_id -> profile
    const profilesMap = new Map((userProfiles || []).map(profile => [profile.id, profile]));

    // Get last messages for unread counts (only for non-archived conversations)
    const nonArchivedIds = filteredConversations.map(c => c.id);
    const { data: lastMessages, error: messagesError } = await supabase
      .from('messages')
      .select('conversation_id, created_at')
      .in('conversation_id', nonArchivedIds.length > 0 ? nonArchivedIds : ['00000000-0000-0000-0000-000000000000']) // Empty array workaround
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    // Build conversations array with participant info (only non-archived)
    conversations = participantData.map(participant => {
      const conversation = filteredConversations.find(c => c.id === participant.conversation_id);
      if (!conversation) return null; // Skip if conversation not found or archived

      const otherParticipants = (allParticipants || [])
        .filter(p => p.conversation_id === conversation.id && p.user_id !== currentUser.id)
        .map(p => profilesMap.get(p.user_id))
        .filter(Boolean); // Remove undefined entries

      // Get last message for this conversation
      const lastMessage = (lastMessages || []).find(m => m.conversation_id === conversation.id);

      // Calculate unread count
      const unreadCount = lastMessage && participant.last_read_at && 
        new Date(lastMessage.created_at) > new Date(participant.last_read_at)
        ? 1 : 0; // Simplified: 1 if there's a new message, 0 otherwise

      // For groups, get participant count
      const participantCount = conversation.type === 'group' 
        ? (allParticipants || []).filter(p => p.conversation_id === conversation.id).length
        : null;

      return {
        ...conversation,
        otherParticipants,
        lastReadAt: participant.last_read_at,
        unreadCount,
        participant_count: participantCount
      };
    }).filter(Boolean); // Remove null entries

    // Sort conversations by last_message_at (most recent first)
    // If last_message_at is null, use updated_at or created_at
    conversations.sort((a, b) => {
      const aTime = new Date(a.last_message_at || a.updated_at || a.created_at);
      const bTime = new Date(b.last_message_at || b.updated_at || b.created_at);
      return bTime - aTime; // Most recent first
    });

    // Render conversations
    renderConversations();

    if (loadingEl) loadingEl.classList.add('hidden');
    if (listEl) listEl.classList.remove('hidden');

    // Auto-select most recent conversation if none is selected
    if (conversations.length > 0 && !currentConversation) {
      const mostRecentConversation = conversations[0];
      await selectConversation(mostRecentConversation.id);
    } else {
      // If no conversation selected, show back button and FAB (on conversation list)
      updateMobileNavigation(true);
    }
  } catch (error) {
    console.error('Error loading conversations:', error);
    const loadingEl = document.getElementById('conversations-loading');
    const emptyEl = document.getElementById('conversations-empty');
    const listEl = document.getElementById('conversations-list');
    
    if (loadingEl) loadingEl.classList.add('hidden');
    if (listEl) listEl.classList.add('hidden');
    if (emptyEl) {
      emptyEl.classList.remove('hidden');
      const emptyTitle = emptyEl.querySelector('h3');
      const emptyMessage = emptyEl.querySelector('p');
      if (emptyTitle) emptyTitle.textContent = 'Error loading conversations';
      if (emptyMessage) emptyMessage.textContent = 'Please refresh the page';
    }
    
    toast?.error('Failed to load conversations', 'Error');
  }
}

// ========== RENDER CONVERSATIONS ==========
function renderConversations(filteredConversations = null) {
  const listEl = document.getElementById('conversations-list');
  if (!listEl) return;

  const conversationsToRender = filteredConversations || conversations;

  if (conversationsToRender.length === 0) {
    listEl.innerHTML = '';
    const emptyEl = document.getElementById('conversations-empty');
    if (emptyEl) {
      emptyEl.classList.remove('hidden');
      
      // Update empty state message based on filter (Phase 4.4)
      const emptyTitle = emptyEl.querySelector('h3');
      const emptyMessage = emptyEl.querySelector('p');
      if (emptyTitle && emptyMessage) {
        if (conversationFilterType === 'direct') {
          emptyTitle.textContent = 'No direct messages';
          emptyMessage.textContent = 'Start a conversation with a team member';
        } else if (conversationFilterType === 'group') {
          emptyTitle.textContent = 'No groups yet';
          emptyMessage.textContent = 'Create a group to collaborate with multiple team members';
        } else {
          emptyTitle.textContent = 'No conversations yet';
          emptyMessage.textContent = 'Start chatting with your team members to get started';
        }
      }
    }
    return;
  }

  document.getElementById('conversations-empty')?.classList.add('hidden');

  listEl.innerHTML = conversationsToRender.map(conv => {
    const isGroup = conv.type === 'group';
    const otherUser = conv.otherParticipants?.[0];
    
    // For groups, use title; for direct messages, use other user's name
    const displayName = isGroup 
      ? (conv.title || 'Unnamed Group')
      : (otherUser?.full_name || otherUser?.email || 'Unknown User');
    
    const initials = isGroup ? getInitials(displayName) : getInitials(displayName);
    const avatarUrl = isGroup ? null : otherUser?.profile_picture;
    const lastMessageTime = conv.last_message_at ? formatRelativeTime(conv.last_message_at) : '';
    const participantCount = isGroup ? (conv.participant_count || conv.otherParticipants?.length || 0) : null;

    return `
      <div class="conversation-item-swipe-container relative overflow-hidden group">
        <div 
          class="conversation-item p-4 border-b border-nfgray dark:border-gray-700 hover:bg-nfglight dark:hover:bg-gray-700 cursor-pointer transition-all relative z-10 bg-white dark:bg-gray-800 ${currentConversation?.id === conv.id ? 'bg-nfglight dark:bg-gray-700' : ''}"
          data-conversation-id="${conv.id}"
        >
          <div class="flex items-center gap-3">
            <div class="relative flex-shrink-0">
              ${isGroup
                ? `<div class="w-12 h-12 rounded-full bg-green-600 dark:bg-green-700 flex items-center justify-center text-white font-semibold text-sm">${initials}</div>`
                : (avatarUrl 
                  ? `<img src="${avatarUrl}" alt="${displayName}" class="w-12 h-12 rounded-full object-cover">`
                  : `<div class="w-12 h-12 rounded-full bg-nfgblue dark:bg-blue-900 flex items-center justify-center text-white font-semibold text-sm">${initials}</div>`)
              }
              ${conv.unreadCount > 0 ? `<span class="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500 text-white text-xs flex items-center justify-center font-semibold">${conv.unreadCount}</span>` : ''}
            </div>
            <div class="flex-1 min-w-0">
              <div class="flex items-center justify-between mb-1">
                <div class="flex items-center gap-2 flex-1 min-w-0">
                  <h3 class="font-semibold text-sm truncate ${conv.unreadCount > 0 ? 'font-bold' : ''}">${escapeHtml(displayName)}</h3>
                  ${isGroup ? `<i data-lucide="users" class="w-4 h-4 text-gray-400 dark:text-gray-500 flex-shrink-0"></i>` : ''}
                </div>
                ${lastMessageTime ? `<span class="text-xs text-gray-500 dark:text-gray-400 flex-shrink-0 ml-2">${lastMessageTime}</span>` : ''}
              </div>
              <p class="text-xs text-gray-500 dark:text-gray-400 truncate">
                ${isGroup && participantCount 
                  ? `${participantCount} ${participantCount === 1 ? 'member' : 'members'}`
                  : (lastMessageTime ? 'Tap to view messages' : 'No messages yet')
                }
              </p>
            </div>
            <!-- Desktop Actions Menu (three dots, visible on hover) -->
            <div class="conversation-actions-desktop hidden md:block relative opacity-0 group-hover:opacity-100 transition-opacity">
              <button 
                class="conversation-menu-btn p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition" 
                data-conversation-id="${conv.id}"
                title="More options"
                onclick="event.stopPropagation(); toggleConversationMenu(event);"
              >
                <i data-lucide="more-vertical" class="w-5 h-5 text-gray-600 dark:text-gray-400"></i>
              </button>
              <!-- Dropdown Menu -->
              <div 
                class="conversation-menu-dropdown fixed bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl py-1 min-w-[150px] z-[9999] hidden"
                data-conversation-id="${conv.id}"
                onclick="event.stopPropagation();"
                style="overflow: visible !important;"
              >
                <button 
                  class="conversation-action-btn archive-btn-desktop w-full text-left px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-yellow-50 dark:hover:bg-yellow-900/20 transition-colors flex items-center gap-2.5 whitespace-nowrap"
                  data-action="archive" 
                  data-conversation-id="${conv.id}"
                >
                  <i data-lucide="archive" class="w-4 h-4 text-yellow-600 dark:text-yellow-400 flex-shrink-0"></i>
                  <span class="flex-1">Archive</span>
                </button>
                <button 
                  class="conversation-action-btn delete-btn-desktop w-full text-left px-4 py-2.5 text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors flex items-center gap-2.5 whitespace-nowrap"
                  data-action="delete" 
                  data-conversation-id="${conv.id}"
                >
                  <i data-lucide="trash-2" class="w-4 h-4 flex-shrink-0"></i>
                  <span class="flex-1">Delete</span>
                </button>
              </div>
            </div>
          </div>
        </div>
        <!-- Swipe Actions (hidden by default, revealed on swipe left) -->
        <div class="swipe-actions absolute right-0 top-0 bottom-0 flex items-center gap-2 px-4 bg-gradient-to-r from-transparent to-red-500 dark:to-red-600 opacity-0 pointer-events-none transition-opacity">
          <button class="swipe-action-btn archive-btn p-3 rounded-lg bg-yellow-500 text-white hover:bg-yellow-600 transition" data-action="archive" title="Archive">
            <i data-lucide="archive" class="w-5 h-5"></i>
          </button>
          <button class="swipe-action-btn delete-btn p-3 rounded-lg bg-red-500 text-white hover:bg-red-600 transition" data-action="delete" title="Delete">
            <i data-lucide="trash-2" class="w-5 h-5"></i>
          </button>
        </div>
      </div>
    `;
  }).join('');

  // Attach click listeners
  listEl.querySelectorAll('.conversation-item').forEach(item => {
    item.addEventListener('click', () => {
      const conversationId = item.dataset.conversationId;
      selectConversation(conversationId);
    });
  });

  // Attach desktop action button listeners (archive/delete from dropdown menu)
  listEl.querySelectorAll('.conversation-action-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation(); // Prevent conversation selection
      const action = btn.dataset.action;
      const conversationId = btn.dataset.conversationId;
      
      // Close the menu
      const menu = btn.closest('.conversation-menu-dropdown');
      if (menu) {
        menu.classList.add('hidden');
      }
      
      if (action === 'archive') {
        await archiveConversation(conversationId);
      } else if (action === 'delete') {
        await deleteConversation(conversationId);
      }
      
      // Recreate icons after action
      if (window.lucide) {
        lucide.createIcons();
      }
    });
  });

  // Initialize swipe gestures for conversation items (mobile only)
  if (window.innerWidth < 768) {
    initConversationItemSwipe();
  }
  
  // Recreate icons for desktop action buttons
  if (window.lucide) {
    lucide.createIcons();
  }

  // Re-create icons
  if (window.lucide) {
    lucide.createIcons();
  }
}

// ========== SELECT CONVERSATION ==========
async function selectConversation(conversationId) {
  try {
    currentConversation = conversations.find(c => c.id === conversationId);
    if (!currentConversation) {
      console.error('Conversation not found:', conversationId);
      return;
    }

    // Update UI
    showConversationView();
    updateConversationHeader();
    
  // Load messages
  await loadMessages(conversationId);
  
  // Load group participants if group conversation (Phase 4.3)
  if (currentConversation && currentConversation.type === 'group') {
    await loadGroupParticipantsForConversation(conversationId);
    updateGroupActionsVisibility();
  }

    // Mark as read
    await markConversationAsRead(conversationId);

    // Subscribe to real-time updates
    subscribeToMessages(conversationId);
    
    // Initialize Phase 1 features (after a short delay to ensure DOM is ready)
    setTimeout(() => {
      initTypingIndicators();
      initOnlineStatus();
      updateUserLastSeen();
    }, 300);

    // Update conversation list highlight
    document.querySelectorAll('.conversation-item').forEach(item => {
      item.classList.remove('bg-nfglight', 'dark:bg-gray-700');
      if (item.dataset.conversationId === conversationId) {
        item.classList.add('bg-nfglight', 'dark:bg-gray-700');
      }
    });
  } catch (error) {
    console.error('Error selecting conversation:', error);
    toast?.error('Failed to load conversation', 'Error');
  }
}

// ========== LOAD MESSAGES ==========
async function loadMessages(conversationId) {
  console.log('=== loadMessages() CALLED ===', conversationId);
  try {
    const loadingEl = document.getElementById('messages-loading');
    const emptyEl = document.getElementById('messages-empty');
    const listEl = document.getElementById('messages-list');

    if (loadingEl) loadingEl.classList.remove('hidden');
    if (emptyEl) emptyEl.classList.add('hidden');
    if (listEl) listEl.classList.add('hidden');

    // Fetch messages (include deleted ones - they'll show as "deleted" in UI)
    const { data: messagesData, error: messagesError } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });

    if (messagesError) throw messagesError;

    messages = messagesData || [];

    // Fetch sender profiles separately (to avoid PostgREST relationship errors)
    if (messages.length > 0) {
      const senderIds = [...new Set(messages.map(m => m.sender_id))];
      const { data: senderProfiles, error: profilesError } = await supabase
        .from('user_profiles')
        .select('id, full_name, email, profile_picture')
        .in('id', senderIds);

      if (profilesError) {
        console.warn('Error fetching sender profiles:', profilesError);
      } else {
        // Create a map of sender_id -> profile
        const profilesMap = new Map((senderProfiles || []).map(profile => [profile.id, profile]));
        
        // Attach sender profiles to messages
        messages = messages.map(message => ({
          ...message,
          sender: profilesMap.get(message.sender_id) || null
        }));
      }
    }

    // Get read receipts
    // Note: RLS policy requires checking conversation participation for each message
    // If this query fails with 403, it's an RLS issue - we'll continue without read receipts
    if (messages.length > 0) {
      const messageIds = messages.map(m => m.id);
      const { data: readsData, error: readsError } = await supabase
        .from('message_reads')
        .select('message_id, user_id')
        .in('message_id', messageIds);

      // If RLS blocks the query, log warning but continue (read receipts are not critical)
      if (readsError) {
        if (readsError.code === 'PGRST301' || readsError.message?.includes('403') || readsError.message?.includes('permission')) {
          console.warn('[Messages] Could not load read receipts - RLS policy may be blocking. This is non-critical.');
        } else {
          console.error('[Messages] Error loading read receipts:', readsError);
        }
      }

      // Attach read status to messages (if data was loaded)
      if (readsData) {
        messages.forEach(message => {
          message.readBy = (readsData || [])
            .filter(r => r.message_id === message.id)
            .map(r => r.user_id);
        });
      } else {
        // No read receipts available - set empty array
        messages.forEach(message => {
          message.readBy = [];
        });
      }
    }

    // Load reactions for messages (Phase 3)
    if (messages.length > 0) {
      await loadMessageReactions(messages.map(m => m.id));
    }

    // Load reply context for messages (Phase 3.2)
    if (messages.length > 0) {
      await loadReplyContext(messages);
    }

    // Render messages first (so they appear quickly)
    renderMessages();

    // Load link previews for messages (Phase 2.3) - load after rendering, then re-render
    if (messages.length > 0) {
      const messagesWithContent = messages.filter(m => m.content && !m.deleted_at);
      if (messagesWithContent.length > 0) {
        const previewPromises = messagesWithContent.map(m => loadLinkPreviews(m.id, m.content));
        await Promise.all(previewPromises);
        // Re-render after previews load to show preview cards
        renderMessages();
      }
    }

    if (loadingEl) loadingEl.classList.add('hidden');
    if (messages.length === 0) {
      if (emptyEl) emptyEl.classList.remove('hidden');
    } else {
      if (listEl) listEl.classList.remove('hidden');
      scrollToBottom();
    }
  } catch (error) {
    console.error('Error loading messages:', error);
    toast?.error('Failed to load messages', 'Error');
  }
}

// ========== LOAD MESSAGE REACTIONS (Phase 3) ==========
async function loadMessageReactions(messageIds) {
  if (!messageIds || messageIds.length === 0) return;
  
  try {
    const { data: reactionsData, error: reactionsError } = await supabase
      .from('message_reactions')
      .select('message_id, user_id, emoji')
      .in('message_id', messageIds);
    
    if (reactionsError) {
      console.warn('Error loading message reactions:', reactionsError);
      return;
    }
    
    // Group reactions by message_id
    const reactionsMap = new Map();
    (reactionsData || []).forEach(reaction => {
      if (!reactionsMap.has(reaction.message_id)) {
        reactionsMap.set(reaction.message_id, []);
      }
      reactionsMap.get(reaction.message_id).push({
        user_id: reaction.user_id,
        emoji: reaction.emoji
      });
    });
    
    // Store in module-level map
    reactionsMap.forEach((reactions, messageId) => {
      messageReactions.set(messageId, reactions);
    });
    
    // Also fetch user profiles for reaction users
    const userIds = [...new Set((reactionsData || []).map(r => r.user_id))];
    if (userIds.length > 0) {
      const { data: profiles } = await supabase
        .from('user_profiles')
        .select('id, full_name, email')
        .in('id', userIds);
      
      // Attach profile info to reactions
      const profilesMap = new Map((profiles || []).map(p => [p.id, p]));
      reactionsMap.forEach((reactions, messageId) => {
        reactions.forEach(reaction => {
          reaction.user = profilesMap.get(reaction.user_id);
        });
      });
    }
  } catch (error) {
    console.error('Error loading message reactions:', error);
  }
}

// ========== HELPER: HIGHLIGHT SEARCH TERM (Phase 2) ==========
function highlightSearchTerm(text, query) {
  if (!query) return text;
  const regex = new RegExp(`(${escapeRegex(query)})`, 'gi');
  return text.replace(regex, '<mark class="bg-yellow-200 dark:bg-yellow-800/50 px-1 rounded">$1</mark>');
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ========== LINK PREVIEWS (Phase 2.3) ==========
console.log('%c🔗 LINK PREVIEW FUNCTIONS LOADED', 'background: #10B981; color: white; padding: 4px 8px; border-radius: 4px; font-weight: bold;');
console.log('🔗 extractUrls function:', typeof extractUrls);
console.log('🔗 loadLinkPreviews function:', typeof loadLinkPreviews);
console.log('🔗 renderLinkPreviews function:', typeof renderLinkPreviews);

// Extract URLs from text
function extractUrls(text) {
  console.log('extractUrls called with:', text);
  if (!text) {
    console.log('extractUrls: No text provided');
    return [];
  }
  
  // URL regex pattern (matches http(s) URLs)
  const urlPattern = /https?:\/\/[^\s<>"{}|\\^`[\]]+/gi;
  const urls = text.match(urlPattern) || [];
  console.log('extractUrls found URLs:', urls);
  
  // Remove duplicates and return
  const uniqueUrls = [...new Set(urls)];
  console.log('extractUrls returning:', uniqueUrls);
  return uniqueUrls;
}

// Format message content with clickable links
function formatMessageContent(text) {
  if (!text) return '';
  
  // Escape HTML first
  let formatted = escapeHtml(text);
  
  // Replace URLs with clickable links
  const urlPattern = /(https?:\/\/[^\s<>"{}|\\^`[\]]+)/gi;
  formatted = formatted.replace(urlPattern, (url) => {
    return `<a href="${url}" target="_blank" rel="noopener noreferrer" class="text-blue-500 dark:text-blue-400 hover:underline break-all">${url}</a>`;
  });
  
  return formatted;
}

// Fetch link preview metadata (Phase 2.3)
async function fetchLinkPreview(url) {
  try {
    console.log('🌐 fetchLinkPreview called for URL:', url);
    // Use Microlink.io's free API (no key required for basic usage)
    // Note: This has rate limits, but works for demo purposes
    console.log('Fetching from Microlink API...');
    const response = await fetch(`https://api.microlink.io/?url=${encodeURIComponent(url)}`);
    console.log('Microlink API response status:', response.status);
    
    if (!response.ok) {
      console.warn('Failed to fetch link preview for:', url);
      return null;
    }
    
    const data = await response.json();
    
    // Extract relevant metadata
    return {
      url: url,
      title: data.data?.title || data.data?.description?.substring(0, 60) || 'Link Preview',
      description: data.data?.description || data.data?.title || '',
      image: data.data?.image?.url || data.data?.logo?.url || null,
      siteName: data.data?.publisher || data.data?.author || null
    };
  } catch (error) {
    console.warn('Error fetching link preview:', error);
    return null;
  }
}

// Load link previews for a message (Phase 2.3)
async function loadLinkPreviews(messageId, messageContent) {
  console.log('=== loadLinkPreviews called ===');
  console.log('Message ID:', messageId);
  console.log('Message Content:', messageContent);
  
  if (!messageContent) {
    console.log('No content for message:', messageId);
    return;
  }
  
  // Extract URLs from message
  const urls = extractUrls(messageContent);
  console.log('Extracted URLs for message', messageId, ':', urls);
  if (urls.length === 0) {
    console.log('No URLs found in message, returning');
    return;
  }
  
  console.log('Fetching previews for', urls.length, 'URL(s)...');
  // Fetch previews for each URL
  const previewPromises = urls.map(url => fetchLinkPreview(url));
  const previews = await Promise.all(previewPromises);
  
  // Filter out null results and store
  const validPreviews = previews.filter(p => p !== null);
  console.log('Valid previews for message', messageId, ':', validPreviews);
  if (validPreviews.length > 0) {
    linkPreviews.set(messageId, validPreviews);
    console.log('Stored previews in map for message:', messageId);
    console.log('Current linkPreviews map:', Array.from(linkPreviews.entries()));
  } else {
    console.log('No valid previews found, not storing');
  }
}

// Render link preview cards for a message (Phase 2.3)
function renderLinkPreviews(messageId) {
  console.log('=== renderLinkPreviews called ===');
  console.log('Message ID:', messageId);
  console.log('Current linkPreviews map:', Array.from(linkPreviews.entries()));
  const previews = linkPreviews.get(messageId);
  console.log('Previews for message', messageId, ':', previews);
  if (!previews || previews.length === 0) {
    console.log('No previews found for message', messageId);
    return '';
  }
  
  console.log('Rendering', previews.length, 'preview(s) for message', messageId);
  return previews.map(preview => `
    <a 
      href="${preview.url}" 
      target="_blank" 
      rel="noopener noreferrer"
      class="link-preview block mt-2 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden hover:border-nfgblue dark:hover:border-blue-600 transition-colors bg-white dark:bg-gray-800"
      onclick="event.stopPropagation()"
    >
      <div class="flex">
        ${preview.image ? `
          <div class="flex-shrink-0 w-32 h-24 bg-gray-100 dark:bg-gray-700">
            <img 
              src="${preview.image}" 
              alt="${escapeHtml(preview.title)}" 
              class="w-full h-full object-cover"
              onerror="this.parentElement.remove()"
            />
          </div>
        ` : ''}
        <div class="flex-1 p-3 min-w-0">
          ${preview.siteName ? `
            <p class="text-xs text-gray-500 dark:text-gray-400 mb-1 truncate">${escapeHtml(preview.siteName)}</p>
          ` : ''}
          <h4 class="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1 line-clamp-2">${escapeHtml(preview.title)}</h4>
          ${preview.description ? `
            <p class="text-xs text-gray-600 dark:text-gray-400 line-clamp-2">${escapeHtml(preview.description)}</p>
          ` : ''}
          <p class="text-xs text-gray-400 dark:text-gray-500 mt-2 truncate">${escapeHtml(preview.url)}</p>
        </div>
      </div>
    </a>
  `).join('');
}

// ========== MESSAGE SEARCH (Phase 2) ==========
function initMessageSearch() {
  const toggleSearchBtn = document.getElementById('toggle-message-search-btn');
  const searchBar = document.getElementById('message-search-bar');
  const searchInput = document.getElementById('message-search-input');
  const closeSearchBtn = document.getElementById('close-message-search-btn');
  
  if (!toggleSearchBtn || !searchBar || !searchInput) return;
  
  // Toggle search bar
  toggleSearchBtn.addEventListener('click', () => {
    searchBar.classList.toggle('hidden');
    if (!searchBar.classList.contains('hidden')) {
      searchInput.focus();
      triggerHaptic('light');
    }
  });
  
  // Close search
  if (closeSearchBtn) {
    closeSearchBtn.addEventListener('click', () => {
      searchBar.classList.add('hidden');
      messageSearchQuery = '';
      searchInput.value = '';
      filterMessagesBySearch('');
      triggerHaptic('light');
    });
  }
  
  // Search input handler
  let searchTimeout;
  searchInput.addEventListener('input', (e) => {
    const query = e.target.value.trim();
    messageSearchQuery = query;
    
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      filterMessagesBySearch(query);
    }, 300); // Debounce 300ms
  });
}

function filterMessagesBySearch(query) {
  const resultsCountEl = document.getElementById('message-search-count');
  const resultsEl = document.getElementById('message-search-results');
  
  if (!query) {
    // Clear search - show all messages
    originalMessages = [];
    renderMessages(false);
    if (resultsEl) resultsEl.classList.add('hidden');
    return;
  }
  
  // Store original messages if not already stored
  if (originalMessages.length === 0) {
    originalMessages = [...messages];
  }
  
  // Filter messages by search query (case-insensitive)
  const lowerQuery = query.toLowerCase();
  const filteredMessages = originalMessages.filter(message => {
    // Search in content
    if (message.content && message.content.toLowerCase().includes(lowerQuery)) {
      return true;
    }
    // Search in attachment name
    if (message.attachment_name && message.attachment_name.toLowerCase().includes(lowerQuery)) {
      return true;
    }
    // Search in sender name
    if (message.sender) {
      const senderName = (message.sender.full_name || message.sender.email || '').toLowerCase();
      if (senderName.includes(lowerQuery)) {
        return true;
      }
    }
    return false;
  });
  
  // Update messages array temporarily for rendering
  const previousMessages = messages;
  messages = filteredMessages;
  renderMessages(true); // Pass true to indicate search mode (for highlighting)
  messages = previousMessages; // Restore original messages array
  
  // Update results count
  if (resultsCountEl) {
    resultsCountEl.textContent = filteredMessages.length;
  }
  if (resultsEl) {
    if (filteredMessages.length > 0) {
      resultsEl.classList.remove('hidden');
    } else {
      resultsEl.classList.add('hidden');
    }
  }
}

// ========== RENDER MESSAGES ==========
function renderMessages(isSearchMode = false) {
  const listEl = document.getElementById('messages-list');
  if (!listEl) return;

  // Deduplicate messages by ID (keep the first occurrence, remove later duplicates)
  const seenIds = new Set();
  const uniqueMessages = messages.filter(message => {
    if (seenIds.has(message.id)) {
      return false; // Duplicate - skip it
    }
    seenIds.add(message.id);
    return true; // Unique - keep it
  });
  
  // Sort by created_at to ensure correct order after deduplication
  uniqueMessages.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

  // Messages are already filtered when loaded (deleted messages removed)
  // So we can render all messages in the array
  listEl.innerHTML = uniqueMessages.map((message, index) => {
    // Handle system messages differently (Phase 4)
    if (message.message_type === 'system') {
      const timestamp = formatMessageTime(message.created_at);
      return `
        <div class="message-item flex items-center justify-center py-2" data-message-id="${message.id}">
          <div class="system-message text-center px-4 py-2 rounded-lg bg-gray-100 dark:bg-gray-700/50 max-w-md">
            <p class="text-xs italic text-gray-600 dark:text-gray-400">${escapeHtml(message.content || '')}</p>
            <span class="text-xs text-gray-400 dark:text-gray-500 mt-1 block">${timestamp}</span>
          </div>
        </div>
      `;
    }

    const isSent = message.sender_id === currentUser.id;
    const sender = message.sender || {};
    const senderName = sender.full_name || sender.email || 'Unknown';
    const senderInitials = getInitials(senderName);
    const senderAvatar = sender.profile_picture;
    const timestamp = formatMessageTime(message.created_at);
    const isEdited = message.is_edited;
    const isRead = message.readBy && message.readBy.length > 0;

    // Group messages from same sender (show avatar only on first message)
    const prevMessage = index > 0 ? uniqueMessages[index - 1] : null;
    const showAvatar = !prevMessage || prevMessage.sender_id !== message.sender_id || 
      (new Date(message.created_at) - new Date(prevMessage.created_at)) > 5 * 60 * 1000; // 5 minutes

    // Check if message can be edited (within 15 minutes)
    const messageAge = Date.now() - new Date(message.created_at).getTime();
    const canEdit = isSent && !message.deleted_at && messageAge < MESSAGE_EDIT_WINDOW_MS;
    // Only sender can delete their own message
    const canDelete = isSent && !message.deleted_at;
    const isDeleted = !!message.deleted_at;

    return `
      <div class="message-item flex items-end gap-2 ${isSent ? 'flex-row-reverse' : ''}" data-message-id="${message.id}">
        ${showAvatar && !isSent ? `
          <div class="flex-shrink-0">
            ${senderAvatar 
              ? `<img src="${senderAvatar}" alt="${senderName}" class="w-8 h-8 rounded-full object-cover">`
              : `<div class="w-8 h-8 rounded-full bg-nfgblue dark:bg-blue-900 flex items-center justify-center text-white text-xs font-semibold">${senderInitials}</div>`
            }
          </div>
        ` : !isSent ? '<div class="w-8"></div>' : ''}
        <div class="message-bubble ${isSent ? 'message-bubble-sent' : 'message-bubble-received'} px-4 py-2 relative message-bubble-wrapper group ${isDeleted ? 'opacity-60' : ''}" data-message-id="${message.id}">
          ${!isSent && showAvatar ? `<p class="text-xs font-semibold mb-1 ${isSent ? 'text-white/80' : 'text-gray-600 dark:text-gray-400'}">${escapeHtml(senderName)}</p>` : ''}
          
          ${message.reply_to_id && message.originalMessage ? `
            <div class="reply-context mb-2 p-2 bg-gray-100 dark:bg-gray-700/50 rounded text-xs border-l-2 border-nfgblue cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-600 transition" 
                 onclick="scrollToMessage('${message.reply_to_id}')" 
                 title="Click to jump to original message">
              <p class="font-semibold text-nfgblue dark:text-blue-400 mb-0.5">
                ${escapeHtml(message.originalMessage.sender?.full_name || message.originalMessage.sender?.email || 'Unknown')}
              </p>
              <p class="truncate text-gray-600 dark:text-gray-400">
                ${escapeHtml((message.originalMessage.content || '').substring(0, 50))}${message.originalMessage.content && message.originalMessage.content.length > 50 ? '...' : ''}
              </p>
            </div>
          ` : ''}
          
          ${isDeleted ? `
            <p class="text-sm italic ${isSent ? 'text-white/70' : 'text-gray-500 dark:text-gray-400'}">This message was deleted</p>
          ` : `
            ${message.message_type === 'image' && message.attachment_url ? `
              <div class="mb-2">
                <img src="${message.attachment_url}" alt="${escapeHtml(message.attachment_name || 'Image')}" 
                     class="max-w-xs rounded-lg cursor-pointer" 
                     onclick="window.open('${message.attachment_url}', '_blank')">
              </div>
            ` : message.message_type === 'file' && message.attachment_url ? `
              <div class="mb-2">
                <a href="${message.attachment_url}" target="_blank" 
                   class="inline-flex items-center gap-2 p-2 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition">
                  <i data-lucide="file" class="w-5 h-5 text-gray-600 dark:text-gray-400"></i>
                  <span class="text-sm font-medium">${escapeHtml(message.attachment_name || 'File')}</span>
                  <i data-lucide="download" class="w-4 h-4 text-gray-500 dark:text-gray-400"></i>
                </a>
              </div>
            ` : ''}
            ${message.content ? `
              <p class="message-content text-sm whitespace-pre-wrap">${isSearchMode && messageSearchQuery ? highlightSearchTerm(escapeHtml(message.content), messageSearchQuery) : formatMessageContent(message.content)}</p>
              ${renderLinkPreviews(message.id)}
            ` : ''}
          `}
          <div class="flex items-center gap-1 mt-1 ${isSent ? 'justify-end' : 'justify-start'}">
            <span class="text-xs ${isSent ? 'text-white/70' : 'text-gray-500 dark:text-gray-400'}">${timestamp}</span>
            ${isEdited ? `<span class="text-xs ${isSent ? 'text-white/70' : 'text-gray-500 dark:text-gray-400'}">(edited)</span>` : ''}
            ${isSent && isRead ? `<i data-lucide="check-check" class="w-3 h-3 text-blue-300"></i>` : isSent ? `<i data-lucide="check" class="w-3 h-3 text-white/70"></i>` : ''}
          </div>
          ${canEdit || canDelete || !isDeleted ? `
            <div class="message-actions absolute ${isSent ? 'left-0 -translate-x-full mr-2' : 'right-0 translate-x-full ml-2'} top-0 opacity-0 group-hover:opacity-100 transition-opacity hidden md:flex items-center gap-1">
              ${!isDeleted ? `
                <button class="message-action-btn reply-message-btn p-1.5 rounded-lg bg-white dark:bg-gray-700 shadow-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition" data-message-id="${message.id}" title="Reply">
                  <i data-lucide="corner-up-left" class="w-3.5 h-3.5 text-gray-600 dark:text-gray-300"></i>
                </button>
              ` : ''}
              ${canEdit ? `
                <button class="message-action-btn edit-message-btn p-1.5 rounded-lg bg-white dark:bg-gray-700 shadow-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition" data-message-id="${message.id}" title="Edit">
                  <i data-lucide="pencil" class="w-3.5 h-3.5 text-gray-600 dark:text-gray-300"></i>
                </button>
              ` : ''}
              ${canDelete ? `
                <button class="message-action-btn delete-message-btn p-1.5 rounded-lg bg-white dark:bg-gray-700 shadow-lg hover:bg-red-100 dark:hover:bg-red-900/30 transition" data-message-id="${message.id}" title="Delete">
                  <i data-lucide="trash-2" class="w-3.5 h-3.5 text-red-600 dark:text-red-400"></i>
                </button>
              ` : ''}
            </div>
          ` : ''}
          ${(canEdit || canDelete) && window.innerWidth < 768 ? `
            <!-- Mobile: Long press to show menu -->
            <div class="message-actions-mobile md:hidden"></div>
          ` : ''}
          
          <!-- Message Reactions (Phase 3) -->
          ${renderMessageReactions(message.id)}
        </div>
      </div>
    `;
  }).join('');

  // Re-create icons
  if (window.lucide) {
    lucide.createIcons();
  }
  
  // Attach message action listeners (edit/delete buttons)
  attachMessageActionListeners();
  attachMobileMessageLongPress();
  
  // Attach mobile double-tap for reactions (Phase 3)
  attachMobileDoubleTapReactions();
  
  // Attach reaction listeners (Phase 3)
  attachReactionListeners();
  
  // Attach reply button listeners (Phase 3.2)
  attachReplyListeners();
}

// ========== RENDER MESSAGE REACTIONS (Phase 3) ==========
function renderMessageReactions(messageId) {
  const reactions = messageReactions.get(messageId) || [];
  
  // Group reactions by emoji
  const emojiGroups = new Map();
  reactions.forEach(reaction => {
    if (!emojiGroups.has(reaction.emoji)) {
      emojiGroups.set(reaction.emoji, []);
    }
    emojiGroups.get(reaction.emoji).push(reaction);
  });
  
  const reactionsHTML = Array.from(emojiGroups.entries()).map(([emoji, emojiReactions]) => {
    const count = emojiReactions.length;
    const hasUserReaction = emojiReactions.some(r => r.user_id === currentUser.id);
    const tooltip = emojiReactions.map(r => {
      const name = r.user?.full_name || r.user?.email || 'Unknown';
      return name;
    }).join(', ');
    
    return `
      <button class="reaction-btn flex items-center gap-1 px-2 py-1 rounded-full text-xs transition-colors ${
        hasUserReaction 
          ? 'bg-nfgblue/20 dark:bg-blue-900/30 border border-nfgblue dark:border-blue-700' 
          : 'bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 border border-transparent'
      }" 
      data-message-id="${messageId}" 
      data-emoji="${emoji}" 
      title="${escapeHtml(tooltip)}">
        <span class="text-sm">${emoji}</span>
        <span class="text-gray-600 dark:text-gray-400">${count}</span>
      </button>
    `;
  }).join('');
  
  // Always show add reaction button on desktop (visible on hover) and mobile (always visible)
  const addReactionBtn = `
    <button class="add-reaction-btn text-xs text-gray-400 dark:text-gray-500 hover:text-nfgblue dark:hover:text-blue-400 md:opacity-0 md:group-hover:opacity-100 transition-opacity ml-1" data-message-id="${messageId}" title="Add reaction">
      <i data-lucide="smile-plus" class="w-4 h-4"></i>
    </button>
  `;
  
  return `
    <div class="message-reactions mt-2 flex items-center gap-1 flex-wrap">
      ${reactionsHTML}
      ${addReactionBtn}
    </div>
  `;
}

// ========== ATTACH REACTION LISTENERS (Phase 3) ==========
function attachReactionListeners() {
  // Reaction button clicks (toggle reaction)
  document.querySelectorAll('.reaction-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const messageId = btn.dataset.messageId;
      const emoji = btn.dataset.emoji;
      await toggleReaction(messageId, emoji);
    });
  });
  
  // Add reaction button clicks (show emoji picker)
  document.querySelectorAll('.add-reaction-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const messageId = btn.dataset.messageId;
      showEmojiPicker(messageId, btn);
    });
  });
}

// ========== TOGGLE REACTION (Phase 3) ==========
async function toggleReaction(messageId, emoji) {
  if (!currentUser || !messageId || !emoji) return;
  
  try {
    const reactions = messageReactions.get(messageId) || [];
    const hasReaction = reactions.some(r => r.user_id === currentUser.id && r.emoji === emoji);
    
    if (hasReaction) {
      // Remove reaction
      const { error } = await supabase
        .from('message_reactions')
        .delete()
        .eq('message_id', messageId)
        .eq('user_id', currentUser.id)
        .eq('emoji', emoji);
      
      if (error) throw error;
      
      // Update local state
      const updatedReactions = reactions.filter(r => !(r.user_id === currentUser.id && r.emoji === emoji));
      if (updatedReactions.length === 0) {
        messageReactions.delete(messageId);
      } else {
        messageReactions.set(messageId, updatedReactions);
      }
    } else {
      // Add reaction
      const { error } = await supabase
        .from('message_reactions')
        .insert({
          message_id: messageId,
          user_id: currentUser.id,
          emoji: emoji
        });
      
      if (error) throw error;
      
      // Update local state
      const newReaction = {
        user_id: currentUser.id,
        emoji: emoji,
        user: currentUserProfile
      };
      messageReactions.set(messageId, [...reactions, newReaction]);
    }
    
    // Re-render messages to update reactions
    renderMessages();
    triggerHaptic('light');
  } catch (error) {
    console.error('Error toggling reaction:', error);
    toast?.error('Failed to update reaction', 'Error');
  }
}

// ========== SHOW EMOJI PICKER (Phase 3) ==========
function showEmojiPicker(messageId, triggerBtn) {
  // Remove existing picker
  document.getElementById('emoji-picker')?.remove();
  
  // Create emoji picker
  const picker = document.createElement('div');
  picker.id = 'emoji-picker';
  picker.className = 'emoji-picker absolute bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl p-3 z-50';
  picker.style.cssText = `
    position: fixed;
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    max-width: 280px;
    max-height: 200px;
    overflow-y: auto;
  `;
  
  // Add common emojis
  picker.innerHTML = COMMON_EMOJIS.map(emoji => `
    <button class="emoji-option w-10 h-10 flex items-center justify-center text-xl rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition" 
            data-emoji="${emoji}" 
            data-message-id="${messageId}">
      ${emoji}
    </button>
  `).join('');
  
  // Position picker near trigger button
  const rect = triggerBtn.getBoundingClientRect();
  picker.style.top = `${rect.top - 220}px`;
  picker.style.left = `${rect.left}px`;
  
  document.body.appendChild(picker);
  
  // Attach click listeners
  picker.querySelectorAll('.emoji-option').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const emoji = btn.dataset.emoji;
      await toggleReaction(messageId, emoji);
      picker.remove();
    });
  });
  
  // Close picker on outside click
  setTimeout(() => {
    const closePicker = (e) => {
      if (!picker.contains(e.target) && e.target !== triggerBtn) {
        picker.remove();
        document.removeEventListener('click', closePicker);
      }
    };
    document.addEventListener('click', closePicker);
  }, 0);
  
  triggerHaptic('light');
}

// ========== LOAD REPLY CONTEXT (Phase 3.2) ==========
async function loadReplyContext(messages) {
  // Get all message IDs that have replies
  const replyMessageIds = messages
    .filter(m => m.reply_to_id)
    .map(m => m.reply_to_id);
  
  if (replyMessageIds.length === 0) return;
  
  // Fetch original messages
  const uniqueReplyIds = [...new Set(replyMessageIds)];
  const { data: originalMessages, error } = await supabase
    .from('messages')
    .select('id, content, sender_id')
    .in('id', uniqueReplyIds);
  
  if (error) {
    console.warn('Error loading reply context:', error);
    return;
  }
  
  // Fetch sender profiles for original messages
  const originalSenderIds = [...new Set((originalMessages || []).map(m => m.sender_id))];
  if (originalSenderIds.length > 0) {
    const { data: originalSenders } = await supabase
      .from('user_profiles')
      .select('id, full_name, email')
      .in('id', originalSenderIds);
    
    // Create maps for quick lookup
    const originalMessagesMap = new Map((originalMessages || []).map(m => [m.id, m]));
    const originalSendersMap = new Map((originalSenders || []).map(s => [s.id, s]));
    
    // Attach original message data to reply messages
    messages.forEach(message => {
      if (message.reply_to_id && originalMessagesMap.has(message.reply_to_id)) {
        const originalMessage = originalMessagesMap.get(message.reply_to_id);
        message.originalMessage = {
          ...originalMessage,
          sender: originalSendersMap.get(originalMessage.sender_id) || null
        };
      }
    });
  }
}

// ========== ATTACH REPLY LISTENERS (Phase 3.2) ==========
function attachReplyListeners() {
  // Reply button clicks
  document.querySelectorAll('.reply-message-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const messageId = btn.dataset.messageId;
      startReply(messageId);
    });
  });
  
  // Cancel reply button
  const cancelReplyBtn = document.getElementById('cancel-reply-btn');
  if (cancelReplyBtn) {
    cancelReplyBtn.addEventListener('click', (e) => {
      e.preventDefault();
      cancelReply();
    });
  }
}

// ========== START REPLY (Phase 3.2) ==========
function startReply(messageId) {
  const message = messages.find(m => m.id === messageId);
  if (!message || !currentConversation) return;
  
  const sender = message.sender || {};
  const senderName = sender.full_name || sender.email || 'Unknown';
  const messagePreview = (message.content || '').substring(0, 50);
  
  replyingTo = {
    messageId: messageId,
    content: message.content || '',
    sender: senderName,
    conversationId: currentConversation.id
  };
  
  // Show reply context UI
  const replyContext = document.getElementById('reply-context');
  const replySenderName = document.getElementById('reply-sender-name');
  const replyContentPreview = document.getElementById('reply-content-preview');
  
  if (replyContext && replySenderName && replyContentPreview) {
    replyContext.classList.remove('hidden');
    replySenderName.textContent = senderName;
    replyContentPreview.textContent = messagePreview + (message.content && message.content.length > 50 ? '...' : '');
    
    // Scroll reply context into view
    replyContext.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    
    // Focus message input
    const messageInput = document.getElementById('message-input');
    if (messageInput) {
      messageInput.focus();
    }
  }
  
  triggerHaptic('light');
  
  // Recreate icons
  if (window.lucide) {
    lucide.createIcons();
  }
}

// ========== CANCEL REPLY (Phase 3.2) ==========
function cancelReply() {
  replyingTo = null;
  
  // Hide reply context UI
  const replyContext = document.getElementById('reply-context');
  if (replyContext) {
    replyContext.classList.add('hidden');
  }
  
  triggerHaptic('light');
}

// ========== SCROLL TO MESSAGE (Phase 3.2) ==========
window.scrollToMessage = function(messageId) {
  const messageElement = document.querySelector(`[data-message-id="${messageId}"]`);
  if (!messageElement) {
    console.warn('Message element not found:', messageId);
    return;
  }
  
  // Scroll to message
  messageElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
  
  // Highlight briefly
  messageElement.classList.add('animate-pulse');
  setTimeout(() => {
    messageElement.classList.remove('animate-pulse');
  }, 1000);
  
  triggerHaptic('light');
};

// ========== MOBILE DOUBLE-TAP FOR REACTIONS (Phase 3) ==========
function attachMobileDoubleTapReactions() {
  // Only on mobile devices
  if (window.innerWidth >= 768) return; // Desktop uses hover
  
  const messageBubbles = document.querySelectorAll('.message-bubble-wrapper');
  
  messageBubbles.forEach(bubble => {
    // Remove existing listeners by checking if already attached
    if (bubble.dataset.doubleTapAttached === 'true') return;
    bubble.dataset.doubleTapAttached = 'true';
    
    let tapTimeout = null;
    let tapCount = 0;
    
    bubble.addEventListener('touchstart', (e) => {
      tapCount++;
      
      if (tapCount === 1) {
        tapTimeout = setTimeout(() => {
          // Single tap - reset after delay
          tapCount = 0;
        }, 300); // 300ms window for double tap
      } else if (tapCount === 2) {
        // Double tap detected
        clearTimeout(tapTimeout);
        tapCount = 0;
        
        e.preventDefault();
        e.stopPropagation();
        
        const messageId = bubble.dataset.messageId;
        if (!messageId) return;
        
        // Show emoji picker
        const addReactionBtn = bubble.querySelector('.add-reaction-btn');
        if (addReactionBtn) {
          showEmojiPicker(messageId, addReactionBtn);
        } else {
          // Create temporary button element for positioning
          const rect = bubble.getBoundingClientRect();
          const tempBtn = document.createElement('button');
          tempBtn.style.position = 'fixed';
          tempBtn.style.bottom = `${window.innerHeight - rect.bottom}px`;
          tempBtn.style.left = `${rect.left}px`;
          document.body.appendChild(tempBtn);
          showEmojiPicker(messageId, tempBtn);
          setTimeout(() => tempBtn.remove(), 0);
        }
        
        triggerHaptic('medium');
      }
    }, { passive: true });
  });
}

// ========== SEND MESSAGE ==========
async function sendMessage() {
  console.log('=== sendMessage() CALLED ===');
  const messageInput = document.getElementById('message-input');
  if (!messageInput || !currentConversation) {
    toast?.error('No conversation selected', 'Error');
    triggerHaptic('error');
    return;
  }

  const content = messageInput.value.trim();
  console.log('Message content:', content);
  
  // Allow sending with just files (no text) or just text (no files)
  if (!content && selectedFiles.length === 0) {
    triggerHaptic('warning');
    return;
  }

  try {
    // Disable input and button
    messageInput.disabled = true;
    const sendBtn = document.getElementById('send-message-btn');
    if (sendBtn) sendBtn.disabled = true;

    // Upload files if any are selected (Phase 2)
    let attachmentUrl = null;
    let attachmentName = null;
    let messageType = 'text';
    
    if (selectedFiles.length > 0) {
      const file = selectedFiles[0]; // For now, support single file (can expand to multiple later)
      const isImage = file.type.startsWith('image/');
      
      // Upload file to Supabase Storage
      const fileExt = file.name.split('.').pop();
      const fileName = `${currentUser.id}/${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
      const storagePath = `message-attachments/${fileName}`;
      
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('message-attachments')
        .upload(storagePath, file, {
          cacheControl: '3600',
          upsert: false
        });
      
      if (uploadError) {
        triggerHaptic('error');
        throw new Error('Failed to upload file: ' + uploadError.message);
      }
      
      // Get public URL
      const { data: urlData } = supabase.storage
        .from('message-attachments')
        .getPublicUrl(storagePath);
      
      attachmentUrl = urlData.publicUrl;
      attachmentName = file.name;
      messageType = isImage ? 'image' : 'file';
      
      // Clear selected files
      selectedFiles = [];
      updateFilePreview();
    }

    // Insert message
    const messageData = {
      conversation_id: currentConversation.id,
      sender_id: currentUser.id,
      content: content || (attachmentName ? `Sent ${attachmentName}` : ''),
      message_type: messageType
    };
    
    // Add reply_to_id if replying (Phase 3.2)
    console.log('[Reply] Current replyingTo state:', replyingTo);
    if (replyingTo && replyingTo.messageId) {
      console.log('[Reply] Adding reply_to_id to message:', replyingTo.messageId);
      messageData.reply_to_id = replyingTo.messageId;
      console.log('[Reply] messageData with reply_to_id:', messageData);
    } else {
      console.log('[Reply] No reply context found - replyingTo:', replyingTo);
    }
    
    if (attachmentUrl) {
      messageData.attachment_url = attachmentUrl;
      messageData.attachment_name = attachmentName;
    }
    
    const { data: newMessage, error: insertError } = await supabase
      .from('messages')
      .insert(messageData)
      .select('*')
      .single();

    if (insertError) {
      triggerHaptic('error');
      throw insertError;
    }

    // Fetch sender profile separately (to avoid PostgREST relationship errors)
    let senderProfile = null;
    if (newMessage) {
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('id, full_name, email, profile_picture')
        .eq('id', newMessage.sender_id)
        .single();
      
      senderProfile = profile;
    }

    // Clear input and reset messageBox height
    messageInput.value = '';
    messageInput.style.height = 'auto';
    const messageBox = messageInput.closest('.messageBox');
    
    // Clear file preview
    selectedFiles = [];
    updateFilePreview();
    
    // Clear reply context (Phase 3.2) - AFTER message is sent
    if (replyingTo) {
      cancelReply();
    }
    
    if (messageBox) {
      messageBox.style.height = 'auto';
      messageBox.style.minHeight = '44px';
    }
    if (sendBtn) sendBtn.disabled = true;

    // Add message to local array with sender profile
    const messageWithSender = {
      ...newMessage,
      sender: senderProfile || null,
      readBy: []
    };
    messages.push(messageWithSender);

    // Load reply context for the new message if it's a reply (Phase 3.2)
    if (newMessage.reply_to_id) {
      await loadReplyContext([messageWithSender]);
    }

    // Re-render messages with animation (before previews load)
    renderMessages();

    // Load link previews for the new message (Phase 2.3) - re-render after
    console.log('=== SEND MESSAGE: Checking link previews ===');
    console.log('Message content:', newMessage.content);
    console.log('Message deleted:', !!newMessage.deleted_at);
    if (newMessage.content && !newMessage.deleted_at) {
      console.log('About to load link previews for sent message:', newMessage.id, newMessage.content);
      await loadLinkPreviews(newMessage.id, newMessage.content);
      console.log('Link previews loaded, re-rendering...');
      // Re-render after previews load
      renderMessages();
    } else {
      console.log('Skipping link preview load - no content or deleted:', {
        hasContent: !!newMessage.content,
        isDeleted: !!newMessage.deleted_at
      });
    }
    
    // Ensure conversation view stays visible
    showConversationView();
    
    // Scroll to bottom after a short delay to ensure DOM is updated
    setTimeout(() => {
      scrollToBottom();
      // Trigger success haptic after scroll
      triggerHaptic('success');
    }, 50);
    
    // Mark as read
    await markConversationAsRead(currentConversation.id);

    // Reload conversations to update last message
    await loadConversations();
  } catch (error) {
    console.error('Error sending message:', error);
    triggerHaptic('error');
    toast?.error('Failed to send message', 'Error');
  } finally {
    const messageInput = document.getElementById('message-input');
    const sendBtn = document.getElementById('send-message-btn');
    if (messageInput) messageInput.disabled = false;
    if (sendBtn) sendBtn.disabled = false;
  }
}

// ========== REAL-TIME SUBSCRIPTION ==========
async function subscribeToMessages(conversationId) {
  // Unsubscribe from previous channel
  if (realtimeSubscription) {
    supabase.removeChannel(realtimeSubscription);
  }

  // Subscribe to new messages and deletions
  realtimeSubscription = supabase
    .channel(`messages:${conversationId}`)
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'messages',
      filter: `conversation_id=eq.${conversationId}`
    }, async (payload) => {
      // New message received
      const newMessage = payload.new;

      // Check if message already exists in array (prevents duplicates from own sends)
      const existingIndex = messages.findIndex(m => m.id === newMessage.id);
      if (existingIndex !== -1) {
        // Message already exists, update it with any new data (like read receipts)
        if (newMessage.sender_id === currentUser.id) {
          // This is our own message that we already added optimistically
          // Just update the existing message with any new data
          messages[existingIndex] = { ...messages[existingIndex], ...newMessage };
        } else {
          // Update existing message with new data
          messages[existingIndex] = { ...messages[existingIndex], ...newMessage };
        }
        renderMessages();
        return;
      }

      // Fetch sender info
      const { data: sender } = await supabase
        .from('user_profiles')
        .select('id, full_name, email, profile_picture')
        .eq('id', newMessage.sender_id)
        .single();

      newMessage.sender = sender;
      newMessage.readBy = [];

      // Add to messages array
      messages.push(newMessage);

      // Load reply context for new message if it's a reply (Phase 3.2)
      if (newMessage.reply_to_id) {
        await loadReplyContext([newMessage]);
      }

      // Re-render first
      renderMessages();

      // Load link previews for new message (Phase 2.3) - re-render after
      if (newMessage.content && !newMessage.deleted_at) {
        await loadLinkPreviews(newMessage.id, newMessage.content);
        // Re-render after previews load
        renderMessages();
      }
      
      // Load reactions for new message (Phase 3)
      if (newMessage.id) {
        await loadMessageReactions([newMessage.id]);
        renderMessages();
      }
      
      // Ensure conversation view stays visible
      if (currentConversation && currentConversation.id === conversationId) {
        showConversationView();
        
        // Scroll to bottom after a short delay
        setTimeout(() => {
          scrollToBottom();
        }, 50);
      }

      // Mark as read if it's not from current user
      if (newMessage.sender_id !== currentUser.id) {
        await markConversationAsRead(conversationId);
      }

      // Reload conversations
      await loadConversations();
    })
    .on('postgres_changes', {
      event: 'UPDATE',
      schema: 'public',
      table: 'messages',
      filter: `conversation_id=eq.${conversationId}`
    }, async (payload) => {
      // Message updated (might be deleted)
      const updatedMessage = payload.new;
      const messageIndex = messages.findIndex(m => m.id === updatedMessage.id);
      
      if (messageIndex !== -1) {
        // Update local message in place (don't create new reference)
        messages[messageIndex] = { ...messages[messageIndex], ...updatedMessage };
        
        // Re-render messages (deduplication already handled in renderMessages)
        renderMessages();
      } else {
        // Message not in local array - might have been deleted and reloaded
        // Don't add it if it's deleted
        if (!updatedMessage.deleted_at) {
          // Fetch sender info and add it
          const { data: sender } = await supabase
            .from('user_profiles')
            .select('id, full_name, email, profile_picture')
            .eq('id', updatedMessage.sender_id)
            .single();
          
          updatedMessage.sender = sender;
          updatedMessage.readBy = [];
          messages.push(updatedMessage);
          renderMessages();
        }
      }
    })
    .subscribe();
  
  // Subscribe to message reactions (Phase 3) - separate channel for reactions
  // We'll subscribe to all reactions and filter client-side by message IDs
  if (window.reactionsChannel) {
    supabase.removeChannel(window.reactionsChannel);
  }
  
  const reactionsChannel = supabase
    .channel(`reactions:${conversationId}`)
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'message_reactions'
    }, async (payload) => {
      // New reaction added (Phase 3)
      const reaction = payload.new;
      
      // Check if this reaction is for a message in the current conversation
      const message = messages.find(m => m.id === reaction.message_id);
      if (!message) return; // Not for this conversation
      
      const reactions = messageReactions.get(reaction.message_id) || [];
      
      // Check if reaction already exists
      const exists = reactions.some(r => r.user_id === reaction.user_id && r.emoji === reaction.emoji);
      if (!exists) {
        // Fetch user profile
        const { data: profile } = await supabase
          .from('user_profiles')
          .select('id, full_name, email')
          .eq('id', reaction.user_id)
          .single();
        
        reactions.push({
          user_id: reaction.user_id,
          emoji: reaction.emoji,
          user: profile
        });
        messageReactions.set(reaction.message_id, reactions);
        renderMessages();
      }
    })
    .on('postgres_changes', {
      event: 'DELETE',
      schema: 'public',
      table: 'message_reactions'
    }, (payload) => {
      // Reaction removed (Phase 3)
      const oldReaction = payload.old;
      
      // Check if this reaction is for a message in the current conversation
      const message = messages.find(m => m.id === oldReaction.message_id);
      if (!message) return; // Not for this conversation
      
      const reactions = messageReactions.get(oldReaction.message_id) || [];
      const updatedReactions = reactions.filter(r => !(r.user_id === oldReaction.user_id && r.emoji === oldReaction.emoji));
      
      if (updatedReactions.length === 0) {
        messageReactions.delete(oldReaction.message_id);
      } else {
        messageReactions.set(oldReaction.message_id, updatedReactions);
      }
      renderMessages();
    })
    .subscribe();
  
  // Store reactions channel for cleanup
  window.reactionsChannel = reactionsChannel;
  
  // Subscribe to conversation_participants changes (Phase 4.3)
  if (window.participantsChannel) {
    supabase.removeChannel(window.participantsChannel);
  }
  
  const participantsChannel = supabase
    .channel(`participants:${conversationId}`)
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'conversation_participants',
      filter: `conversation_id=eq.${conversationId}`
    }, async (payload) => {
      // New participant added (Phase 4.3)
      const newParticipant = payload.new;
      
      // Reload participants
      await loadGroupParticipantsForConversation(conversationId);
      
      // Update conversation header if needed
      if (currentConversation && currentConversation.id === conversationId) {
        updateConversationHeader();
      }
      
      // Reload conversations to update participant count
      await loadConversations();
    })
    .on('postgres_changes', {
      event: 'UPDATE',
      schema: 'public',
      table: 'conversation_participants',
      filter: `conversation_id=eq.${conversationId}`
    }, async (payload) => {
      // Participant role updated (Phase 4.3)
      const updatedParticipant = payload.new;
      
      // Reload participants
      await loadGroupParticipantsForConversation(conversationId);
      
      // Update UI if group info modal is open
      if (currentConversation && currentConversation.id === conversationId) {
        const groupInfoModal = document.getElementById('group-info-modal');
        if (groupInfoModal && !groupInfoModal.classList.contains('hidden')) {
          await showGroupInfo(conversationId);
        }
        updateConversationHeader();
      }
      
      // Update current user's role
      if (updatedParticipant.user_id === currentUser.id) {
        currentUserGroupRole.set(conversationId, updatedParticipant.role);
        updateGroupActionsVisibility();
      }
    })
    .on('postgres_changes', {
      event: 'DELETE',
      schema: 'public',
      table: 'conversation_participants',
      filter: `conversation_id=eq.${conversationId}`
    }, async (payload) => {
      // Participant removed (Phase 4.3)
      const removedParticipant = payload.old;
      
      // If current user was removed, redirect to conversation list
      if (removedParticipant.user_id === currentUser.id) {
        showConversationList();
        await loadConversations();
        showNotification('You have been removed from the group', 'info');
        return;
      }
      
      // Reload participants
      await loadGroupParticipantsForConversation(conversationId);
      
      // Update conversation header if needed
      if (currentConversation && currentConversation.id === conversationId) {
        updateConversationHeader();
        
        // Close group info modal if open
        const groupInfoModal = document.getElementById('group-info-modal');
        if (groupInfoModal && !groupInfoModal.classList.contains('hidden')) {
          await showGroupInfo(conversationId);
        }
      }
      
      // Reload conversations to update participant count
      await loadConversations();
    })
    .subscribe();
  
  // Store participants channel for cleanup
  window.participantsChannel = participantsChannel;
  
  // Load group participants for current conversation (Phase 4.3)
  if (currentConversation && currentConversation.type === 'group') {
    await loadGroupParticipantsForConversation(conversationId);
    updateGroupActionsVisibility();
  }
}

// Update group actions visibility based on permissions (Phase 4.3)
async function updateGroupActionsVisibility() {
  if (!currentConversation || currentConversation.type !== 'group') {
    const groupActionsBtn = document.getElementById('group-actions-btn');
    if (groupActionsBtn) {
      groupActionsBtn.classList.add('hidden');
    }
    return;
  }
  
  const groupActionsBtn = document.getElementById('group-actions-btn');
  if (groupActionsBtn) {
    groupActionsBtn.classList.remove('hidden');
  }
  
  // Load role if not cached
  if (!currentUserGroupRole.has(currentConversation.id)) {
    await isGroupAdmin(currentConversation.id);
  }
}

// ========== MARK AS READ ==========
async function markConversationAsRead(conversationId) {
  try {
    // Update participant's last_read_at
    await supabase
      .from('conversation_participants')
      .update({ last_read_at: new Date().toISOString() })
      .eq('conversation_id', conversationId)
      .eq('user_id', currentUser.id);

    // Mark all unread messages as read
    const unreadMessages = messages.filter(m => 
      m.sender_id !== currentUser.id && 
      (!m.readBy || !m.readBy.includes(currentUser.id))
    );

    if (unreadMessages.length > 0) {
      const messageIds = unreadMessages.map(m => m.id);
      
      // Insert read receipts (one at a time to handle conflicts gracefully)
      // Use insert with ignoreDuplicates instead of upsert for better RLS compatibility
      for (const messageId of messageIds) {
        try {
          await supabase
            .from('message_reads')
            .insert({
              message_id: messageId,
              user_id: currentUser.id,
              read_at: new Date().toISOString()
            });
        } catch (error) {
          // Ignore duplicate key errors (already marked as read)
          if (error.code !== '23505' && !error.message?.includes('duplicate')) {
            console.warn('[Messages] Error marking message as read:', error);
          }
        }
      }

      // Update local read status
      unreadMessages.forEach(message => {
        if (!message.readBy) message.readBy = [];
        if (!message.readBy.includes(currentUser.id)) {
          message.readBy.push(currentUser.id);
        }
      });

      // Re-render to show read receipts
      renderMessages();
    }
  } catch (error) {
    console.error('Error marking conversation as read:', error);
  }
}

// ========== NEW MESSAGE MODAL ==========
async function openNewMessageModal() {
  const modal = document.getElementById('new-message-modal');
  if (!modal) return;

  modal.classList.remove('hidden');
  modal.classList.add('flex');

  // Load users
  await loadUsers();

  // Re-create icons
  if (window.lucide) {
    lucide.createIcons();
  }
}

function closeNewMessageModal() {
  const modal = document.getElementById('new-message-modal');
  if (!modal) return;

  modal.classList.add('hidden');
  modal.classList.remove('flex');

  // Clear search
  const userSearch = document.getElementById('user-search');
  if (userSearch) userSearch.value = '';

  // Clear users list
  const usersList = document.getElementById('users-list');
  if (usersList) usersList.innerHTML = '';
}

async function loadUsers(searchQuery = '') {
  try {
    let query = supabase
      .from('user_profiles')
      .select('id, full_name, email, profile_picture, role')
      .neq('id', currentUser.id)
      .order('full_name');

    if (searchQuery) {
      query = query.or(`full_name.ilike.%${searchQuery}%,email.ilike.%${searchQuery}%`);
    }

    const { data: users, error } = await query.limit(20);

    if (error) throw error;

    renderUsersList(users || []);
  } catch (error) {
    console.error('Error loading users:', error);
  }
}

function searchUsers(query) {
  loadUsers(query);
}

// ========== CREATE GROUP MODAL (Phase 4) ==========
let selectedGroupParticipants = new Set(); // Track selected participants for group creation
let groupParticipants = new Map(); // conversationId -> participants[] (Phase 4.3)
let currentUserGroupRole = new Map(); // conversationId -> role (Phase 4.3)

async function openCreateGroupModal() {
  const modal = document.getElementById('create-group-modal');
  if (!modal) return;

  modal.classList.remove('hidden');
  modal.classList.add('flex');

  // Reset form
  document.getElementById('group-name-input').value = '';
  document.getElementById('group-description-input').value = '';
  selectedGroupParticipants.clear();
  updateSelectedParticipantsUI();
  validateGroupForm();

  // Load users for participant selection
  await loadGroupParticipants('');

  // Re-create icons
  if (window.lucide) {
    lucide.createIcons();
  }
}

function closeCreateGroupModal() {
  const modal = document.getElementById('create-group-modal');
  if (!modal) return;

  modal.classList.add('hidden');
  modal.classList.remove('flex');

  // Clear form
  document.getElementById('group-name-input').value = '';
  document.getElementById('group-description-input').value = '';
  document.getElementById('group-participant-search').value = '';
  selectedGroupParticipants.clear();
  updateSelectedParticipantsUI();
  
  // Reset button state
  const createBtn = document.getElementById('create-group-btn');
  if (createBtn) {
    createBtn.disabled = true;
    createBtn.innerHTML = '<span>Create Group</span>';
  }
}

async function loadGroupParticipants(searchQuery = '') {
  try {
    let query = supabase
      .from('user_profiles')
      .select('id, full_name, email, profile_picture, role')
      .neq('id', currentUser.id)
      .order('full_name');

    if (searchQuery) {
      query = query.or(`full_name.ilike.%${searchQuery}%,email.ilike.%${searchQuery}%`);
    }

    const { data: users, error } = await query.limit(50);

    if (error) throw error;

    renderGroupParticipantsList(users || []);
  } catch (error) {
    console.error('Error loading group participants:', error);
    showNotification('Failed to load users', 'error');
  }
}

function searchGroupParticipants(query) {
  loadGroupParticipants(query);
}

function renderGroupParticipantsList(users) {
  const participantsList = document.getElementById('group-participants-list');
  if (!participantsList) return;

  if (users.length === 0) {
    participantsList.innerHTML = '<p class="text-sm text-gray-500 dark:text-gray-400 text-center py-4">No users found</p>';
    return;
  }

  participantsList.innerHTML = users.map(user => {
    const displayName = user.full_name || user.email || 'Unknown';
    const initials = getInitials(displayName);
    const avatarUrl = user.profile_picture;
    const isSelected = selectedGroupParticipants.has(user.id);

    return `
      <div 
        class="flex items-center gap-3 p-3 rounded-lg hover:bg-nfglight dark:hover:bg-gray-700 cursor-pointer transition ${isSelected ? 'bg-green-50 dark:bg-green-900/20 border-2 border-green-500' : ''}"
        data-user-id="${user.id}"
        onclick="selectGroupParticipant('${user.id}', '${escapeHtml(displayName).replace(/'/g, "\\'")}', '${user.profile_picture || ''}')"
      >
        ${avatarUrl 
          ? `<img src="${avatarUrl}" alt="${displayName}" class="w-10 h-10 rounded-full object-cover">`
          : `<div class="w-10 h-10 rounded-full bg-nfgblue dark:bg-blue-900 flex items-center justify-center text-white font-semibold text-sm">${initials}</div>`
        }
        <div class="flex-1 min-w-0">
          <h4 class="font-medium text-sm truncate">${escapeHtml(displayName)}</h4>
          <p class="text-xs text-gray-500 dark:text-gray-400 truncate">${escapeHtml(user.email || '')}</p>
        </div>
        ${isSelected ? '<i data-lucide="check" class="w-5 h-5 text-green-600 dark:text-green-400"></i>' : ''}
      </div>
    `;
  }).join('');

  // Re-create icons
  if (window.lucide) {
    lucide.createIcons();
  }
}

function selectGroupParticipant(userId, userName, avatarUrl) {
  if (selectedGroupParticipants.has(userId)) {
    selectedGroupParticipants.delete(userId);
  } else {
    selectedGroupParticipants.add(userId);
  }
  
  updateSelectedParticipantsUI();
  validateGroupForm(); // Update button state when participants change
  
  // Re-render list to update selection state
  const searchQuery = document.getElementById('group-participant-search')?.value || '';
  loadGroupParticipants(searchQuery);
  
  triggerHaptic('light');
}

async function updateSelectedParticipantsUI() {
  const container = document.getElementById('selected-participants-container');
  const list = document.getElementById('selected-participants-list');
  
  if (!container || !list) return;

  if (selectedGroupParticipants.size === 0) {
    container.classList.add('hidden');
    return;
  }

  container.classList.remove('hidden');
  
  // Fetch selected user names
  const selectedIds = Array.from(selectedGroupParticipants);
  if (selectedIds.length > 0) {
    try {
      const { data: profiles, error } = await supabase
        .from('user_profiles')
        .select('id, full_name, email')
        .in('id', selectedIds);

      if (error) throw error;

      const profilesMap = new Map((profiles || []).map(p => [p.id, p]));

      list.innerHTML = selectedIds.map(userId => {
        const profile = profilesMap.get(userId);
        const displayName = profile?.full_name || profile?.email || userId.substring(0, 8) + '...';
        return `
          <div class="inline-flex items-center gap-2 px-3 py-1 bg-green-100 dark:bg-green-900/30 rounded-full text-sm" data-user-id="${userId}">
            <span class="text-green-700 dark:text-green-300">${escapeHtml(displayName)}</span>
            <button onclick="removeGroupParticipant('${userId}')" class="text-green-600 dark:text-green-400 hover:text-green-800 dark:hover:text-green-200">
              <i data-lucide="x" class="w-4 h-4"></i>
            </button>
          </div>
        `;
      }).join('');

      // Re-create icons
      if (window.lucide) {
        lucide.createIcons();
      }
    } catch (error) {
      console.error('Error loading selected participant names:', error);
      // Fallback to showing IDs
      list.innerHTML = selectedIds.map(userId => {
        return `
          <div class="inline-flex items-center gap-2 px-3 py-1 bg-green-100 dark:bg-green-900/30 rounded-full text-sm" data-user-id="${userId}">
            <span class="text-green-700 dark:text-green-300">${userId.substring(0, 8)}...</span>
            <button onclick="removeGroupParticipant('${userId}')" class="text-green-600 dark:text-green-400 hover:text-green-800 dark:hover:text-green-200">
              <i data-lucide="x" class="w-4 h-4"></i>
            </button>
          </div>
        `;
      }).join('');

      if (window.lucide) {
        lucide.createIcons();
      }
    }
  }
}

function removeGroupParticipant(userId) {
  selectedGroupParticipants.delete(userId);
  updateSelectedParticipantsUI();
  validateGroupForm(); // Update button state when participants change
  
  // Re-render list
  const searchQuery = document.getElementById('group-participant-search')?.value || '';
  loadGroupParticipants(searchQuery);
  
  triggerHaptic('light');
}

function validateGroupForm() {
  const groupName = document.getElementById('group-name-input')?.value.trim();
  const createBtn = document.getElementById('create-group-btn');
  
  if (!createBtn) return;

  if (groupName && groupName.length > 0 && selectedGroupParticipants.size > 0) {
    createBtn.disabled = false;
  } else {
    createBtn.disabled = true;
  }
}

async function handleCreateGroup() {
  const groupName = document.getElementById('group-name-input')?.value.trim();
  const description = document.getElementById('group-description-input')?.value.trim();
  const createBtn = document.getElementById('create-group-btn');

  // Disable button during creation to prevent double-clicks
  if (createBtn) {
    createBtn.disabled = true;
    const originalText = createBtn.textContent || createBtn.innerHTML;
    createBtn.innerHTML = '<span>Creating...</span>';
  }

  if (!groupName) {
    if (createBtn) {
      createBtn.disabled = false;
      createBtn.innerHTML = '<span>Create Group</span>';
    }
    showNotification('Group name is required', 'error');
    return;
  }

  if (selectedGroupParticipants.size === 0) {
    if (createBtn) {
      createBtn.disabled = false;
      createBtn.innerHTML = '<span>Create Group</span>';
    }
    showNotification('Please select at least one member', 'error');
    return;
  }

  try {
    triggerHaptic('medium');
    console.log('[Group] Creating group:', { groupName, description, participantCount: selectedGroupParticipants.size });
    
    const conversation = await createGroupConversation(
      groupName,
      description || null,
      Array.from(selectedGroupParticipants)
    );

    console.log('[Group] Group created successfully:', conversation.id);

    // Close modal
    closeCreateGroupModal();

    // Reload conversations
    await loadConversations();

    // Select the new group conversation
    await selectConversation(conversation.id);

    showNotification(`Group "${groupName}" created successfully!`, 'success');
  } catch (error) {
    console.error('Error creating group:', error);
    if (createBtn) {
      createBtn.disabled = false;
      createBtn.innerHTML = '<span>Create Group</span>';
    }
    showNotification(error.message || 'Failed to create group', 'error');
  }
}

async function createGroupConversation(name, description, participantIds) {
  try {
    // Verify current user
    console.log('[Group] Current user ID:', currentUser?.id);
    console.log('[Group] Current user object:', currentUser);
    
    if (!currentUser || !currentUser.id) {
      throw new Error('User not authenticated');
    }

    // Verify Supabase client
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      console.error('[Group] Auth check failed:', authError);
      throw new Error('Authentication failed');
    }
    console.log('[Group] Verified auth user ID:', user.id);
    console.log('[Group] Auth user matches currentUser:', user.id === currentUser.id);

    // 1. Create the conversation
    const conversationData = {
      type: 'group',
      title: name,
      description: description || null,
      created_by: currentUser.id
    };
    
    console.log('[Group] Creating conversation with data:', conversationData);
    console.log('[Group] Using Supabase client:', !!supabase);
    
    const { data: conversation, error: convError } = await supabase
      .from('conversations')
      .insert([conversationData])
      .select()
      .single();

    if (convError) {
      console.error('[Group] Error creating conversation:', convError);
      console.error('[Group] Error code:', convError.code);
      console.error('[Group] Error message:', convError.message);
      console.error('[Group] Error details:', convError.details);
      console.error('[Group] Error hint:', convError.hint);
      console.error('[Group] Full error object:', JSON.stringify(convError, null, 2));
      throw new Error(convError.message || 'Failed to create conversation');
    }

    console.log('[Group] Conversation created:', conversation.id);

    // 2. Add all participants (including creator as admin)
    const allParticipants = [currentUser.id, ...participantIds];
    const participantEntries = allParticipants.map(userId => ({
      conversation_id: conversation.id,
      user_id: userId,
      role: userId === currentUser.id ? 'admin' : 'participant' // Creator is admin
    }));

    console.log('[Group] Adding participants:', participantEntries.length);

    // Insert participants one at a time if batch insert fails
    // This ensures we can see which specific participant fails
    for (const entry of participantEntries) {
      const { error: participantError } = await supabase
        .from('conversation_participants')
        .insert([entry]);
      
      if (participantError) {
        console.error('[Group] Error adding participant:', entry.user_id, participantError);
        throw new Error(`Failed to add participant: ${participantError.message}`);
      }
    }
    
    console.log('[Group] All participants added successfully');

    // 3. Create system message
    const memberNames = await Promise.all(
      participantIds.map(async (userId) => {
        const { data: profile } = await supabase
          .from('user_profiles')
          .select('full_name, email')
          .eq('id', userId)
          .single();
        return profile?.full_name || profile?.email || 'Unknown';
      })
    );

    const memberList = memberNames.join(', ');
    const systemMessage = `Group created. ${memberList} added.`;

    await supabase
      .from('messages')
      .insert([{
        conversation_id: conversation.id,
        sender_id: currentUser.id,
        content: systemMessage,
        message_type: 'system'
      }]);

    return conversation;
  } catch (error) {
    console.error('Error creating group conversation:', error);
    throw error;
  }
}

// Make functions globally available
window.selectGroupParticipant = selectGroupParticipant;
window.removeGroupParticipant = removeGroupParticipant;

// ========== GROUP MANAGEMENT (Phase 4.2) ==========
let groupMembers = []; // Current group members cache (deprecated, use groupParticipants Map instead)
let selectedMembersToAdd = new Set(); // Track selected members to add

// Show group info modal
async function showGroupInfo(conversationId) {
  const modal = document.getElementById('group-info-modal');
  if (!modal) return;

  try {
    // Fetch conversation details
    const { data: conversation, error: convError } = await supabase
      .from('conversations')
      .select('id, title, description, created_at, type')
      .eq('id', conversationId)
      .single();

    if (convError) throw convError;

    // Fetch all participants with their roles
    const { data: participants, error: participantsError } = await supabase
      .from('conversation_participants')
      .select('user_id, role, joined_at')
      .eq('conversation_id', conversationId);

    if (participantsError) throw participantsError;

    // Fetch user profiles for participants
    const userIds = participants.map(p => p.user_id);
    const { data: profiles, error: profilesError } = await supabase
      .from('user_profiles')
      .select('id, full_name, email, profile_picture')
      .in('id', userIds);

    if (profilesError) throw profilesError;

    // Combine participants with profiles
    const profilesMap = new Map(profiles.map(p => [p.id, p]));
    groupMembers = participants.map(p => ({
      ...p,
      profile: profilesMap.get(p.user_id)
    }));

    // Find current user's role (Phase 4.3)
    const currentUserParticipant = participants.find(p => p.user_id === currentUser.id);
    const userRole = currentUserParticipant?.role || 'participant';
    currentUserGroupRole.set(conversationId, userRole);
    
    // Also update groupParticipants Map (Phase 4.3)
    const participantsWithProfiles = participants.map(p => ({
      user_id: p.user_id,
      role: p.role,
      joined_at: p.joined_at,
      user: profilesMap.get(p.user_id)
    }));
    groupParticipants.set(conversationId, participantsWithProfiles);

    // Update modal content
    const nameEl = document.getElementById('group-info-name');
    const descEl = document.getElementById('group-info-description');
    const membersListEl = document.getElementById('group-members-list');
    const addMemberBtn = document.getElementById('add-member-btn');

    if (nameEl) nameEl.textContent = conversation.title || 'Unnamed Group';
    if (descEl) {
      descEl.textContent = conversation.description || 'No description';
      descEl.style.display = conversation.description ? 'block' : 'none';
    }

    // Render members list
    if (membersListEl) {
      membersListEl.innerHTML = groupMembers.map(member => {
        const profile = member.profile;
        const displayName = profile?.full_name || profile?.email || 'Unknown';
        const initials = getInitials(displayName);
        const avatarUrl = profile?.profile_picture;
        const isAdmin = member.role === 'admin';
        const isCurrentUser = member.user_id === currentUser.id;
        const canManage = currentUserGroupRole.get(conversationId) === 'admin' && !isCurrentUser;

        return `
          <div class="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition">
            ${avatarUrl 
              ? `<img src="${avatarUrl}" alt="${displayName}" class="w-10 h-10 rounded-full object-cover">`
              : `<div class="w-10 h-10 rounded-full bg-nfgblue dark:bg-blue-900 flex items-center justify-center text-white font-semibold text-sm">${initials}</div>`
            }
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2">
                <h4 class="font-medium text-sm truncate">${escapeHtml(displayName)}</h4>
                ${isCurrentUser ? '<span class="text-xs text-gray-400">(You)</span>' : ''}
                ${isAdmin ? '<span class="text-xs px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded">Admin</span>' : ''}
              </div>
              <p class="text-xs text-gray-500 dark:text-gray-400 truncate">${escapeHtml(profile?.email || '')}</p>
            </div>
            ${canManage ? `
              <div class="flex items-center gap-1">
                <button onclick="toggleMemberRole('${member.user_id}')" class="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-600 transition" title="${isAdmin ? 'Remove admin' : 'Make admin'}">
                  <i data-lucide="${isAdmin ? 'shield-off' : 'shield'}" class="w-4 h-4 text-gray-600 dark:text-gray-400"></i>
                </button>
                <button onclick="removeMemberFromGroup('${member.user_id}', '${escapeHtml(displayName).replace(/'/g, "\\'")}')" class="p-1.5 rounded hover:bg-red-50 dark:hover:bg-red-900/20 transition" title="Remove member">
                  <i data-lucide="user-x" class="w-4 h-4 text-red-600 dark:text-red-400"></i>
                </button>
              </div>
            ` : ''}
          </div>
        `;
      }).join('');

      // Re-create icons
      if (window.lucide) {
        lucide.createIcons();
      }
    }

    // Show/hide add member button based on role (Phase 4.3)
    if (addMemberBtn) {
      const userRole = currentUserGroupRole.get(conversationId);
      if (userRole === 'admin') {
        addMemberBtn.classList.remove('hidden');
      } else {
        addMemberBtn.classList.add('hidden');
      }
    }

    // Show modal
    modal.classList.remove('hidden');
    modal.classList.add('flex');
  } catch (error) {
    console.error('Error loading group info:', error);
    showNotification('Failed to load group info', 'error');
  }
}

function closeGroupInfoModal() {
  const modal = document.getElementById('group-info-modal');
  if (!modal) return;

  modal.classList.add('hidden');
  modal.classList.remove('flex');
  groupMembers = [];
  // Don't clear role cache - keep it for performance
}

// Open add member modal
async function openAddMemberModal(conversationId) {
  const modal = document.getElementById('add-member-modal');
  if (!modal) return;

  selectedMembersToAdd.clear();
  document.getElementById('add-member-search').value = '';
  document.getElementById('confirm-add-member-btn').disabled = true;

  // Load users not already in group
  await loadUsersForAddMember(conversationId);

  modal.classList.remove('hidden');
  modal.classList.add('flex');

  if (window.lucide) {
    lucide.createIcons();
  }
}

function closeAddMemberModal() {
  const modal = document.getElementById('add-member-modal');
  if (!modal) return;

  modal.classList.add('hidden');
  modal.classList.remove('flex');
  selectedMembersToAdd.clear();
  document.getElementById('add-member-search').value = '';
}

async function loadUsersForAddMember(conversationId, searchQuery = '') {
  try {
    // Get current participant IDs
    const { data: participants } = await supabase
      .from('conversation_participants')
      .select('user_id')
      .eq('conversation_id', conversationId);

    const participantIds = (participants || []).map(p => p.user_id);

    // Load users excluding current participants and current user
    let query = supabase
      .from('user_profiles')
      .select('id, full_name, email, profile_picture')
      .neq('id', currentUser.id)
      .not('id', 'in', `(${participantIds.length > 0 ? participantIds.join(',') : '00000000-0000-0000-0000-000000000000'})`)
      .order('full_name');

    if (searchQuery) {
      query = query.or(`full_name.ilike.%${searchQuery}%,email.ilike.%${searchQuery}%`);
    }

    const { data: users, error } = await query.limit(50);

    if (error) throw error;

    renderAddMemberList(users || []);
  } catch (error) {
    console.error('Error loading users for add member:', error);
    showNotification('Failed to load users', 'error');
  }
}

function searchMembersToAdd(query) {
  if (currentConversation && currentConversation.type === 'group') {
    loadUsersForAddMember(currentConversation.id, query);
  }
}

function renderAddMemberList(users) {
  const listEl = document.getElementById('add-member-list');
  if (!listEl) return;

  if (users.length === 0) {
    listEl.innerHTML = '<p class="text-sm text-gray-500 dark:text-gray-400 text-center py-4">No users found</p>';
    return;
  }

  listEl.innerHTML = users.map(user => {
    const displayName = user.full_name || user.email || 'Unknown';
    const initials = getInitials(displayName);
    const avatarUrl = user.profile_picture;
    const isSelected = selectedMembersToAdd.has(user.id);

    return `
      <div 
        class="flex items-center gap-3 p-3 rounded-lg hover:bg-nfglight dark:hover:bg-gray-700 cursor-pointer transition ${isSelected ? 'bg-green-50 dark:bg-green-900/20 border-2 border-green-500' : ''}"
        onclick="toggleMemberSelection('${user.id}')"
      >
        ${avatarUrl 
          ? `<img src="${avatarUrl}" alt="${displayName}" class="w-10 h-10 rounded-full object-cover">`
          : `<div class="w-10 h-10 rounded-full bg-nfgblue dark:bg-blue-900 flex items-center justify-center text-white font-semibold text-sm">${initials}</div>`
        }
        <div class="flex-1 min-w-0">
          <h4 class="font-medium text-sm truncate">${escapeHtml(displayName)}</h4>
          <p class="text-xs text-gray-500 dark:text-gray-400 truncate">${escapeHtml(user.email || '')}</p>
        </div>
        ${isSelected ? '<i data-lucide="check" class="w-5 h-5 text-green-600 dark:text-green-400"></i>' : ''}
      </div>
    `;
  }).join('');

  if (window.lucide) {
    lucide.createIcons();
  }
}

function toggleMemberSelection(userId) {
  if (selectedMembersToAdd.has(userId)) {
    selectedMembersToAdd.delete(userId);
  } else {
    selectedMembersToAdd.add(userId);
  }

  const confirmBtn = document.getElementById('confirm-add-member-btn');
  if (confirmBtn) {
    confirmBtn.disabled = selectedMembersToAdd.size === 0;
  }

  // Re-render list
  const searchQuery = document.getElementById('add-member-search')?.value || '';
  if (currentConversation && currentConversation.type === 'group') {
    loadUsersForAddMember(currentConversation.id, searchQuery);
  }

  triggerHaptic('light');
}

async function handleAddMembers() {
  if (!currentConversation || currentConversation.type !== 'group') return;
  if (selectedMembersToAdd.size === 0) return;

  try {
    await addParticipantsToGroup(currentConversation.id, Array.from(selectedMembersToAdd));
    closeAddMemberModal();
    // Refresh group info
    await showGroupInfo(currentConversation.id);
    showNotification('Members added successfully', 'success');
  } catch (error) {
    console.error('Error adding members:', error);
    showNotification(error.message || 'Failed to add members', 'error');
  }
}

async function addParticipantsToGroup(conversationId, userIds) {
  try {
    // Add participants
    const participantEntries = userIds.map(userId => ({
      conversation_id: conversationId,
      user_id: userId,
      role: 'participant'
    }));

    const { error: insertError } = await supabase
      .from('conversation_participants')
      .insert(participantEntries);

    if (insertError) throw insertError;

    // Get admin name for system message
    const { data: adminProfile } = await supabase
      .from('user_profiles')
      .select('full_name, email')
      .eq('id', currentUser.id)
      .single();

    const adminName = adminProfile?.full_name || adminProfile?.email || 'Admin';

    // Get added member names
    const { data: memberProfiles } = await supabase
      .from('user_profiles')
      .select('full_name, email')
      .in('id', userIds);

    const memberNames = (memberProfiles || []).map(p => p.full_name || p.email || 'Unknown');
    const memberList = memberNames.join(', ');

    // Create system message
    await supabase
      .from('messages')
      .insert([{
        conversation_id: conversationId,
        sender_id: currentUser.id,
        content: `${memberList} ${memberNames.length === 1 ? 'was' : 'were'} added by ${adminName}.`,
        message_type: 'system'
      }]);

    // Reload conversations to update participant count
    await loadConversations();
    
    // Update current conversation
    const updatedConv = conversations.find(c => c.id === conversationId);
    if (updatedConv) {
      currentConversation = updatedConv;
      updateConversationHeader();
    }

    // Reload messages to show system message
    await loadMessages(conversationId);
  } catch (error) {
    console.error('Error adding participants:', error);
    throw error;
  }
}

async function removeMemberFromGroup(userId, userName) {
  if (!currentConversation || currentConversation.type !== 'group') return;
  if (userId === currentUser.id) return; // Use leave group instead

  // Check if user is admin (Phase 4.3)
  const isAdmin = await isGroupAdmin(currentConversation.id);
  if (!isAdmin) {
    showNotification('Only admins can remove members', 'error');
    return;
  }

  const confirmed = confirm(`Are you sure you want to remove ${userName} from the group?`);
  if (!confirmed) return;

  try {
    // Remove participant
    const { error: deleteError } = await supabase
      .from('conversation_participants')
      .delete()
      .eq('conversation_id', currentConversation.id)
      .eq('user_id', userId);

    if (deleteError) throw deleteError;

    // Get admin name for system message
    const { data: adminProfile } = await supabase
      .from('user_profiles')
      .select('full_name, email')
      .eq('id', currentUser.id)
      .single();

    const adminName = adminProfile?.full_name || adminProfile?.email || 'Admin';

    // Create system message
    await supabase
      .from('messages')
      .insert([{
        conversation_id: currentConversation.id,
        sender_id: currentUser.id,
        content: `${userName} was removed by ${adminName}.`,
        message_type: 'system'
      }]);

    // Reload conversations
    await loadConversations();
    
    // Update current conversation
    const updatedConv = conversations.find(c => c.id === currentConversation.id);
    if (updatedConv) {
      currentConversation = updatedConv;
      updateConversationHeader();
    }

    // Refresh group info
    await showGroupInfo(currentConversation.id);
    
    // Reload messages to show system message
    await loadMessages(currentConversation.id);

    showNotification(`${userName} removed from group`, 'success');
  } catch (error) {
    console.error('Error removing member:', error);
    showNotification(error.message || 'Failed to remove member', 'error');
  }
}

async function toggleMemberRole(userId) {
  if (!currentConversation || currentConversation.type !== 'group') return;
  if (userId === currentUser.id) return; // Cannot change own role

  // Check if user is admin (Phase 4.4)
  const isAdmin = await isGroupAdmin(currentConversation.id);
  if (!isAdmin) {
    showNotification('Only admins can change member roles', 'error');
    return;
  }

  try {
    // Find member's current role
    const member = groupMembers.find(m => m.user_id === userId);
    if (!member) return;

    const newRole = member.role === 'admin' ? 'participant' : 'admin';

    // Prevent removing last admin (Phase 4.4 - Edge case handling)
    if (newRole === 'participant') {
      // Load participants if not cached
      if (!groupParticipants.has(currentConversation.id)) {
        await loadGroupParticipantsForConversation(currentConversation.id);
      }
      const participants = groupParticipants.get(currentConversation.id) || [];
      const adminCount = participants.filter(p => p.role === 'admin' && p.user_id !== userId).length;
      if (adminCount === 0) {
        showNotification('Cannot remove the last admin from the group. Promote another member to admin first.', 'error');
        return;
      }
    }

    // Update role
    const { error: updateError } = await supabase
      .from('conversation_participants')
      .update({ role: newRole })
      .eq('conversation_id', currentConversation.id)
      .eq('user_id', userId);

    if (updateError) throw updateError;

    // Get admin and member names for system message
    const { data: adminProfile } = await supabase
      .from('user_profiles')
      .select('full_name, email')
      .eq('id', currentUser.id)
      .single();

    const { data: memberProfile } = await supabase
      .from('user_profiles')
      .select('full_name, email')
      .eq('id', userId)
      .single();

    const adminName = adminProfile?.full_name || adminProfile?.email || 'Admin';
    const memberName = memberProfile?.full_name || memberProfile?.email || 'Member';

    // Create system message
    const systemMessage = newRole === 'admin' 
      ? `${memberName} was promoted to admin by ${adminName}.`
      : `${memberName} is now a participant.`;

    await supabase
      .from('messages')
      .insert([{
        conversation_id: currentConversation.id,
        sender_id: currentUser.id,
        content: systemMessage,
        message_type: 'system'
      }]);

    // Refresh group info
    await showGroupInfo(currentConversation.id);
    
    // Reload messages to show system message
    await loadMessages(currentConversation.id);

    showNotification(`Role updated successfully`, 'success');
  } catch (error) {
    console.error('Error updating member role:', error);
    showNotification(error.message || 'Failed to update role', 'error');
  }
}

async function handleLeaveGroup(conversationId) {
  // Check if user is the last admin (Phase 4.4 - Edge case handling)
  const isAdmin = await isGroupAdmin(conversationId);
  if (isAdmin) {
    // Load participants to check admin count
    if (!groupParticipants.has(conversationId)) {
      await loadGroupParticipantsForConversation(conversationId);
    }
    const participants = groupParticipants.get(conversationId) || [];
    const adminCount = participants.filter(p => p.role === 'admin').length;
    
    if (adminCount === 1) {
      showNotification('You are the last admin. Please promote another member to admin before leaving, or transfer admin privileges.', 'error');
      return;
    }
  }
  
  const confirmed = confirm('Are you sure you want to leave this group? You will no longer receive messages from this group.');
  if (!confirmed) return;

  try {
    // Get user name for system message
    const { data: userProfile } = await supabase
      .from('user_profiles')
      .select('full_name, email')
      .eq('id', currentUser.id)
      .single();

    const userName = userProfile?.full_name || userProfile?.email || 'User';

    // Remove participant
    const { error: deleteError } = await supabase
      .from('conversation_participants')
      .delete()
      .eq('conversation_id', conversationId)
      .eq('user_id', currentUser.id);

    if (deleteError) throw deleteError;

    // Create system message
    await supabase
      .from('messages')
      .insert([{
        conversation_id: conversationId,
        sender_id: currentUser.id,
        content: `${userName} left the group.`,
        message_type: 'system'
      }]);

    // Close group info modal
    closeGroupInfoModal();

    // Reload conversations
    await loadConversations();

    // Clear current conversation and show list
    currentConversation = null;
    showConversationList();

    showNotification('You left the group', 'success');
  } catch (error) {
    console.error('Error leaving group:', error);
    showNotification(error.message || 'Failed to leave group', 'error');
  }
}

// Make functions globally available
window.toggleMemberSelection = toggleMemberSelection;
window.removeMemberFromGroup = removeMemberFromGroup;
window.toggleMemberRole = toggleMemberRole;

function renderUsersList(users) {
  const usersList = document.getElementById('users-list');
  if (!usersList) return;

  if (users.length === 0) {
    usersList.innerHTML = '<p class="text-sm text-gray-500 dark:text-gray-400 text-center py-4">No users found</p>';
    return;
  }

  usersList.innerHTML = users.map(user => {
    const displayName = user.full_name || user.email || 'Unknown';
    const initials = getInitials(displayName);
    const avatarUrl = user.profile_picture;

    return `
      <div 
        class="flex items-center gap-3 p-3 rounded-lg hover:bg-nfglight dark:hover:bg-gray-700 cursor-pointer transition"
        data-user-id="${user.id}"
      >
        ${avatarUrl 
          ? `<img src="${avatarUrl}" alt="${displayName}" class="w-10 h-10 rounded-full object-cover">`
          : `<div class="w-10 h-10 rounded-full bg-nfgblue dark:bg-blue-900 flex items-center justify-center text-white font-semibold text-sm">${initials}</div>`
        }
        <div class="flex-1 min-w-0">
          <h4 class="font-medium text-sm truncate">${escapeHtml(displayName)}</h4>
          <p class="text-xs text-gray-500 dark:text-gray-400 truncate">${escapeHtml(user.email || '')}</p>
        </div>
      </div>
    `;
  }).join('');

  // Attach click listeners
  usersList.querySelectorAll('[data-user-id]').forEach(item => {
    item.addEventListener('click', async () => {
      const userId = item.dataset.userId;
      await createOrSelectConversation(userId);
    });
  });
}

// ========== CREATE OR SELECT CONVERSATION ==========
async function createOrSelectConversation(otherUserId) {
  try {
    // Call helper function to create or get existing conversation
    const { data, error } = await supabase.rpc('create_direct_conversation', {
      user1_id: currentUser.id,
      user2_id: otherUserId
    });

    if (error) {
      console.error('RPC Error details:', error);
      throw error;
    }

    if (!data) {
      throw new Error('No conversation ID returned from function');
    }

    const conversationId = data;

    // Close modal
    closeNewMessageModal();

    // Reload conversations
    await loadConversations();

    // Select the conversation (this will show the view)
    await selectConversation(conversationId);
    
    // Ensure view is visible
    showConversationView();
  } catch (error) {
    console.error('Error creating conversation:', error);
    const errorMessage = error?.message || error?.details || 'Failed to create conversation';
    toast?.error(errorMessage, 'Error');
  }
}

// ========== UI HELPERS ==========
function showConversationView() {
  const emptyEl = document.getElementById('conversation-empty');
  const activeEl = document.getElementById('conversation-active');
  const listEl = document.getElementById('conversation-list');
  const viewEl = document.getElementById('conversation-view');

  if (!currentConversation) {
    // No conversation selected, show empty state with fade in
    if (emptyEl) {
      emptyEl.classList.remove('hidden');
      emptyEl.style.opacity = '0';
      requestAnimationFrame(() => {
        emptyEl.style.opacity = '1';
      });
    }
    if (activeEl) {
      activeEl.classList.add('hidden');
      activeEl.style.opacity = '0';
    }
    // Show back button and FAB when on empty state (conversation list)
    updateMobileNavigation(true);
    return;
  }

  // Conversation is selected, show active view with smooth transition
  if (emptyEl) {
    emptyEl.style.opacity = '0';
    setTimeout(() => {
      emptyEl.classList.add('hidden');
    }, 200);
  }
  if (activeEl) {
    activeEl.classList.remove('hidden');
    activeEl.style.opacity = '0';
    requestAnimationFrame(() => {
      activeEl.style.opacity = '1';
    });
  }
  
  // On mobile, hide list and show view
  if (window.innerWidth < 768) {
    if (listEl) {
      listEl.style.opacity = '0';
      setTimeout(() => {
        listEl.classList.add('hidden');
      }, 200);
    }
    if (viewEl) {
      viewEl.classList.remove('hidden');
      viewEl.classList.add('flex');
      viewEl.style.opacity = '0';
      requestAnimationFrame(() => {
        viewEl.style.opacity = '1';
      });
    }
    // Hide back button and FAB when viewing conversation
    updateMobileNavigation(false);
    // Initialize swipe to go back gesture
    setTimeout(() => {
      initSwipeToGoBack();
    }, 100);
    // Ensure back button icon is visible on mobile
    if (window.lucide) {
      lucide.createIcons();
    }
  } else {
    // On desktop, show both
    if (viewEl) {
      viewEl.classList.remove('hidden');
      viewEl.classList.add('md:block');
      viewEl.style.opacity = '1';
    }
    // Hide FAB on desktop too (it's mobile-only, but ensure it's hidden when viewing conversation)
    const fab = document.getElementById('fab-new-message');
    if (fab) {
      fab.classList.add('hidden');
    }
    // Always show back button on desktop (it's hidden via CSS anyway)
    updateMobileNavigation(true);
  }
  
  // Always hide FAB when viewing a conversation (double-check)
  const fab = document.getElementById('fab-new-message');
  if (fab) {
    fab.classList.add('hidden');
  }
}

function showConversationList() {
  const listEl = document.getElementById('conversation-list');
  const viewEl = document.getElementById('conversation-view');

  if (listEl) {
    listEl.classList.remove('hidden');
    listEl.style.opacity = '0';
    requestAnimationFrame(() => {
      listEl.style.opacity = '1';
    });
  }
  if (viewEl) {
    viewEl.style.opacity = '0';
    setTimeout(() => {
      viewEl.classList.add('hidden');
      viewEl.classList.remove('flex', 'md:block');
    }, 200);
  }
  
  // Cleanup channels when leaving conversation
  cleanupChannels();
  
  // Clear current conversation
  currentConversation = null;
  
  // Show back button and FAB when on conversation list
  updateMobileNavigation(true);
}

// Update mobile navigation visibility (back button and FAB)
function updateMobileNavigation(show) {
  const backBtn = document.getElementById('back-to-dashboard-btn');
  const fab = document.getElementById('fab-new-message');
  const isMobile = window.innerWidth < 768;
  
  // Check if we're currently viewing a conversation
  const activeEl = document.getElementById('conversation-active');
  const isViewingConversation = activeEl && !activeEl.classList.contains('hidden') && currentConversation;
  
  if (isMobile) {
    // On mobile, show/hide based on state
    if (backBtn) {
      if (show) {
        backBtn.classList.remove('hidden');
      } else {
        backBtn.classList.add('hidden');
      }
    }
    
    if (fab) {
      // FAB should only show when on conversation list (not viewing conversation)
      // Double-check: if viewing conversation, always hide FAB
      if (isViewingConversation) {
        fab.classList.add('hidden');
      } else if (show) {
        fab.classList.remove('hidden');
      } else {
        fab.classList.add('hidden');
      }
    }
  } else {
    // On desktop, always hide (they're mobile-only)
    if (backBtn) backBtn.classList.add('hidden');
    if (fab) fab.classList.add('hidden');
  }
  
  // Recreate icons when visibility changes
  if (window.lucide) {
    lucide.createIcons();
  }
}

// Handle mobile keyboard to prevent blocking input
function initMobileKeyboardHandling() {
  if (window.innerWidth >= 768) return; // Desktop only
  
  const messageInput = document.getElementById('message-input');
  const messageForm = document.getElementById('message-form');
  const conversationActive = document.getElementById('conversation-active');
  
  if (!messageInput || !messageForm || !conversationActive) return;
  
  // Use Visual Viewport API if available (modern browsers)
  if (window.visualViewport) {
    const handleViewportChange = () => {
      const viewport = window.visualViewport;
      const viewportHeight = viewport.height;
      const windowHeight = window.innerHeight;
      const keyboardHeight = windowHeight - viewportHeight;
      
      if (keyboardHeight > 0) {
        // Keyboard is visible - adjust layout
        const isDark = document.documentElement.classList.contains('dark');
        const bgColor = isDark ? '#1F2937' : '#ffffff';
        
        conversationActive.style.height = `${viewportHeight}px`;
        conversationActive.style.maxHeight = `${viewportHeight}px`;
        conversationActive.style.backgroundColor = bgColor;
        
        // Also ensure all parent containers have backgrounds
        const conversationView = document.getElementById('conversation-view');
        const main = document.querySelector('main');
        const bodyDiv = document.querySelector('body > div.flex-1');
        
        if (conversationView) {
          conversationView.style.backgroundColor = bgColor;
        }
        if (main) {
          main.style.backgroundColor = bgColor;
        }
        if (bodyDiv) {
          bodyDiv.style.backgroundColor = bgColor;
        }
        document.body.style.backgroundColor = bgColor;
        document.documentElement.style.backgroundColor = bgColor;
        
        // Scroll input into view
        setTimeout(() => {
          messageForm.scrollIntoView({ behavior: 'smooth', block: 'end' });
        }, 100);
      } else {
        // Keyboard is hidden - reset to full height
        conversationActive.style.height = '';
        conversationActive.style.maxHeight = '';
      }
    };
    
    window.visualViewport.addEventListener('resize', handleViewportChange);
    window.visualViewport.addEventListener('scroll', handleViewportChange);
  }
  
  // Fallback: Handle focus/blur events
  messageInput.addEventListener('focus', () => {
    // Scroll input into view when focused
    setTimeout(() => {
      messageForm.scrollIntoView({ behavior: 'smooth', block: 'end' });
      
      // Also scroll the form container
      const formContainer = messageForm.closest('.p-4');
      if (formContainer) {
        formContainer.scrollIntoView({ behavior: 'smooth', block: 'end' });
      }
    }, 300); // Delay to allow keyboard to appear
  });
  
  // Handle input resize (for textarea auto-resize)
  messageInput.addEventListener('input', () => {
    // Ensure input stays visible
    setTimeout(() => {
      messageForm.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }, 50);
  });
}

// Handle window resize to update mobile navigation visibility
window.addEventListener('resize', () => {
  // Check current view state and update navigation accordingly
  const activeEl = document.getElementById('conversation-active');
  const isViewingConversation = activeEl && !activeEl.classList.contains('hidden');
  updateMobileNavigation(!isViewingConversation);
  
  // Reinitialize swipe gestures if switching to/from mobile
  if (window.innerWidth < 768) {
    initSwipeToGoBack();
    initConversationItemSwipe();
    initPullToRefresh();
    initMobileKeyboardHandling();
  }
});

// ========== SWIPE GESTURES (Mobile Only) ==========

// 1. Swipe right to go back (conversation → list)
function initSwipeToGoBack() {
  const conversationView = document.getElementById('conversation-active');
  if (!conversationView || window.innerWidth >= 768) return;
  
  let touchStartX = 0;
  let touchStartY = 0;
  let isSwiping = false;
  let startTime = 0;
  
  conversationView.addEventListener('touchstart', (e) => {
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
    startTime = Date.now();
    isSwiping = false;
  }, { passive: true });
  
  conversationView.addEventListener('touchmove', (e) => {
    if (!touchStartX || !touchStartY) return;
    
    const touchEndX = e.touches[0].clientX;
    const touchEndY = e.touches[0].clientY;
    const deltaX = touchEndX - touchStartX;
    const deltaY = touchEndY - touchStartY;
    
    // Check if horizontal swipe (ignore if too much vertical movement)
    if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 10) {
      isSwiping = true;
      
      // Only allow swipe right (positive deltaX)
      if (deltaX > 0 && deltaX < 100) {
        // Visual feedback: slight translate
        conversationView.style.transform = `translateX(${deltaX}px)`;
        conversationView.style.transition = 'none';
        conversationView.style.opacity = `${1 - (deltaX / 200)}`;
      }
    }
  }, { passive: true });
  
  conversationView.addEventListener('touchend', (e) => {
    if (!touchStartX || !touchStartY) return;
    
    const touchEndX = e.changedTouches[0].clientX;
    const deltaX = touchEndX - touchStartX;
    const swipeTime = Date.now() - startTime;
    const swipeSpeed = Math.abs(deltaX) / swipeTime; // pixels per ms
    
    // Reset transform
    conversationView.style.transform = '';
    conversationView.style.transition = '';
    conversationView.style.opacity = '';
    
    // Swipe right to go back (threshold: 50px or fast swipe)
    if (isSwiping && deltaX > 0 && currentConversation) {
      if (deltaX > 50 || (deltaX > 30 && swipeSpeed > 0.5)) {
        triggerHaptic('medium');
        showConversationList();
      }
    }
    
    touchStartX = 0;
    touchStartY = 0;
    isSwiping = false;
  }, { passive: true });
}

// 2. Swipe left on conversation items to reveal actions
function initConversationItemSwipe() {
  const conversationItems = document.querySelectorAll('.conversation-item');
  if (conversationItems.length === 0 || window.innerWidth >= 768) return;
  
  conversationItems.forEach(item => {
    const container = item.closest('.conversation-item-swipe-container');
    if (!container) return;
    
    const actions = container.querySelector('.swipe-actions');
    if (!actions) return;
    
    let touchStartX = 0;
    let currentX = 0;
    let isSwipeActive = false;
    let isRevealed = false;
    
    // Use global revealedItems Set (defined at module level)
    
    item.addEventListener('touchstart', (e) => {
      // Close other revealed items
      revealedItems.forEach(otherItem => {
        if (otherItem !== item) {
          const otherContainer = otherItem.closest('.conversation-item-swipe-container');
          const otherActions = otherContainer?.querySelector('.swipe-actions');
          if (otherContainer && otherActions) {
            otherItem.style.transform = 'translateX(0)';
            otherActions.style.opacity = '0';
            otherActions.style.pointerEvents = 'none';
          }
          revealedItems.delete(otherItem);
        }
      });
      
      touchStartX = e.touches[0].clientX;
      isSwipeActive = false;
    }, { passive: true });
    
    item.addEventListener('touchmove', (e) => {
      if (!touchStartX) return;
      
      const deltaX = e.touches[0].clientX - touchStartX;
      
      // Only allow left swipe (negative deltaX)
      if (deltaX < 0 && Math.abs(deltaX) > 10) {
        isSwipeActive = true;
        currentX = Math.max(deltaX, -140); // Max reveal 140px
        item.style.transform = `translateX(${currentX}px)`;
        item.style.transition = 'none';
        
        // Show actions with opacity
        const opacity = Math.min(Math.abs(currentX) / 140, 1);
        actions.style.opacity = opacity.toString();
        actions.style.pointerEvents = opacity > 0.5 ? 'auto' : 'none';
      } else if (deltaX > 0 && isRevealed) {
        // Swiping back to close
        currentX = Math.max(-140 + deltaX, -140);
        item.style.transform = `translateX(${currentX}px)`;
        item.style.transition = 'none';
        
        const opacity = Math.max(Math.abs(currentX) / 140, 0);
        actions.style.opacity = opacity.toString();
        actions.style.pointerEvents = opacity > 0.5 ? 'auto' : 'none';
      }
    }, { passive: true });
    
    item.addEventListener('touchend', () => {
      if (!isSwipeActive && !isRevealed) {
        touchStartX = 0;
        return;
      }
      
      item.style.transition = 'transform 0.2s ease-out';
      
      if (Math.abs(currentX) > 70) {
        // Snap to revealed position
        triggerHaptic('light');
        item.style.transform = 'translateX(-140px)';
        actions.style.opacity = '1';
        actions.style.pointerEvents = 'auto';
        isRevealed = true;
        revealedItems.add(item);
      } else {
        // Snap back
        item.style.transform = 'translateX(0)';
        actions.style.opacity = '0';
        actions.style.pointerEvents = 'none';
        isRevealed = false;
        revealedItems.delete(item);
      }
      
      touchStartX = 0;
      isSwipeActive = false;
      
      setTimeout(() => {
        item.style.transition = '';
      }, 200);
    }, { passive: true });
    
    // Handle action button clicks
    actions.querySelectorAll('.swipe-action-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        e.preventDefault();
        const conversationId = item.dataset.conversationId;
        const action = btn.dataset.action;
        
        // Close swipe actions first
        item.style.transform = 'translateX(0)';
        actions.style.opacity = '0';
        actions.style.pointerEvents = 'none';
        isRevealed = false;
        revealedItems.delete(item);
        
        if (action === 'archive') {
          triggerHaptic('medium');
          archiveConversation(conversationId);
        } else if (action === 'delete') {
          triggerHaptic('heavy');
          deleteConversation(conversationId);
        }
        
        // Recreate icons after action
        if (window.lucide) {
          lucide.createIcons();
        }
      });
    });
  });
  
  // Close revealed items when clicking outside
  document.addEventListener('click', (e) => {
    if (revealedItems.size > 0) {
      revealedItems.forEach(revealedItem => {
        const container = revealedItem.closest('.conversation-item-swipe-container');
        if (container && !container.contains(e.target)) {
          const actions = container.querySelector('.swipe-actions');
          if (actions) {
            revealedItem.style.transform = 'translateX(0)';
            actions.style.opacity = '0';
            actions.style.pointerEvents = 'none';
            revealedItems.delete(revealedItem);
          }
        }
      });
    }
  });
}

// 3. Pull to refresh on conversation list
function initPullToRefresh() {
  const conversationsContainer = document.getElementById('conversations-container');
  if (!conversationsContainer || window.innerWidth >= 768) return;
  
  let touchStartY = 0;
  let isPulling = false;
  let pullDistance = 0;
  
  // Create pull-to-refresh indicator
  let indicator = document.getElementById('pull-to-refresh-indicator');
  if (!indicator) {
    indicator = document.createElement('div');
    indicator.id = 'pull-to-refresh-indicator';
    indicator.className = 'pull-to-refresh-indicator absolute top-0 left-0 right-0 flex items-center justify-center gap-2 py-2 text-gray-500 dark:text-gray-400 text-sm pointer-events-none';
    indicator.innerHTML = '<i data-lucide="refresh-cw" class="w-4 h-4"></i><span>Pull to refresh</span>';
    conversationsContainer.style.position = 'relative';
    conversationsContainer.insertBefore(indicator, conversationsContainer.firstChild);
  }
  
  conversationsContainer.addEventListener('touchstart', (e) => {
    // Only if at top of scroll
    if (conversationsContainer.scrollTop === 0) {
      touchStartY = e.touches[0].clientY;
      isPulling = false;
      pullDistance = 0;
    }
  }, { passive: true });
  
  conversationsContainer.addEventListener('touchmove', (e) => {
    if (touchStartY === 0 || conversationsContainer.scrollTop > 0) return;
    
    const deltaY = e.touches[0].clientY - touchStartY;
    
    if (deltaY > 0) {
      isPulling = true;
      pullDistance = Math.min(deltaY, 80);
      
      // Visual feedback
      const opacity = Math.min(pullDistance / 80, 1);
      indicator.style.opacity = opacity.toString();
      indicator.style.transform = `translateY(${pullDistance - 40}px)`;
      
      // Rotate icon based on pull distance
      const icon = indicator.querySelector('i');
      if (icon) {
        icon.style.transform = `rotate(${pullDistance * 4.5}deg)`;
      }
      
      // Change text when ready to refresh
      const text = indicator.querySelector('span');
      if (text) {
        text.textContent = pullDistance >= 70 ? 'Release to refresh' : 'Pull to refresh';
      }
    }
  }, { passive: true });
  
  conversationsContainer.addEventListener('touchend', () => {
    if (isPulling && pullDistance >= 70) {
      // Trigger refresh with haptic feedback
      triggerHaptic('medium');
      indicator.querySelector('i').classList.add('animate-spin');
      loadConversations().finally(() => {
        triggerHaptic('success');
        setTimeout(() => {
          indicator.querySelector('i').classList.remove('animate-spin');
          indicator.style.opacity = '0';
          indicator.style.transform = 'translateY(-40px)';
          const icon = indicator.querySelector('i');
          if (icon) icon.style.transform = 'rotate(0deg)';
          const text = indicator.querySelector('span');
          if (text) text.textContent = 'Pull to refresh';
        }, 300);
      });
    } else {
      // Reset
      indicator.style.opacity = '0';
      indicator.style.transform = 'translateY(-40px)';
      const icon = indicator.querySelector('i');
      if (icon) icon.style.transform = 'rotate(0deg)';
      const text = indicator.querySelector('span');
      if (text) text.textContent = 'Pull to refresh';
    }
    
    touchStartY = 0;
    isPulling = false;
    pullDistance = 0;
  }, { passive: true });
}

function updateConversationHeader() {
  if (!currentConversation) return;

  const isGroup = currentConversation.type === 'group';
  const otherUser = currentConversation.otherParticipants?.[0];
  
  // For groups, use title; for direct messages, use other user's name
  const displayName = isGroup 
    ? (currentConversation.title || 'Unnamed Group')
    : (otherUser?.full_name || otherUser?.email || 'Unknown User');
  
  const initials = getInitials(displayName);
  const avatarUrl = isGroup ? null : otherUser?.profile_picture;
  const participantCount = isGroup ? (currentConversation.participant_count || 0) : null;

  const headerName = document.getElementById('conversation-header-name');
  const headerAvatar = document.getElementById('conversation-header-avatar');
  const headerStatus = document.getElementById('conversation-header-status');
  const groupActionsBtn = document.getElementById('group-actions-btn');

  if (headerName) {
    headerName.textContent = displayName;
  }
  
  // For groups, show participant count; for direct messages, show status
  if (headerStatus) {
    if (isGroup && participantCount) {
      headerStatus.textContent = `${participantCount} ${participantCount === 1 ? 'member' : 'members'}`;
      headerStatus.className = 'text-xs text-gray-500 dark:text-gray-400';
    } else {
      // Status will be updated by updateOnlineStatus() when presence channel is ready
      headerStatus.textContent = '...';
    }
  }
  
  if (headerAvatar) {
    if (isGroup) {
      // Group avatar: green background with initials
      headerAvatar.innerHTML = '';
      headerAvatar.className = 'w-10 h-10 rounded-full bg-green-600 dark:bg-green-700 flex items-center justify-center text-white font-semibold flex-shrink-0';
      headerAvatar.textContent = initials;
    } else if (avatarUrl) {
      headerAvatar.innerHTML = `<img src="${avatarUrl}" alt="${displayName}" class="w-full h-full rounded-full object-cover">`;
    } else {
      headerAvatar.textContent = initials;
    }
  }

  // Show/hide group actions button (Phase 4.2)
  // Show/hide group actions button (Phase 4.3)
  if (groupActionsBtn) {
    if (isGroup) {
      groupActionsBtn.classList.remove('hidden');
      // Update visibility based on permissions (async check)
      updateGroupActionsVisibility();
    } else {
      groupActionsBtn.classList.add('hidden');
    }
  }
}

function scrollToBottom() {
  const container = document.getElementById('messages-container');
  if (container) {
    // Use multiple requestAnimationFrame calls to ensure scroll happens after DOM updates
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        // Scroll to bottom
        container.scrollTop = container.scrollHeight;
        
        // Ensure the container is actually scrollable
        if (container.scrollHeight > container.clientHeight) {
          container.scrollTop = container.scrollHeight;
        }
      });
    });
  }
}

function filterConversations(query) {
  // Apply both search query and type filter (Phase 4.4)
  let filtered = conversations;

  // Apply type filter first
  if (conversationFilterType !== 'all') {
    filtered = filtered.filter(conv => {
      if (conversationFilterType === 'direct') {
        return conv.type === 'direct';
      } else if (conversationFilterType === 'group') {
        return conv.type === 'group';
      }
      return true;
    });
  }

  // Apply search query
  if (query && query.trim()) {
    const searchTerm = query.toLowerCase().trim();
    filtered = filtered.filter(conv => {
      if (conv.type === 'group') {
        // Search in group name and description (Phase 4.4)
        const groupName = (conv.title || '').toLowerCase();
        const groupDesc = (conv.description || '').toLowerCase();
        return groupName.includes(searchTerm) || groupDesc.includes(searchTerm);
      } else if (conv.type === 'direct') {
        // Search in other user's name or email (existing logic)
        const otherUser = conv.otherParticipants?.[0];
        const name = (otherUser?.full_name || '').toLowerCase();
        const email = (otherUser?.email || '').toLowerCase();
        return name.includes(searchTerm) || email.includes(searchTerm);
      }
      return false;
    });
  }

  renderConversations(filtered);
}

// Set conversation filter type (Phase 4.4)
function setConversationFilterType(type) {
  conversationFilterType = type;
  
  // Update active filter button UI
  document.querySelectorAll('.conversation-filter-btn').forEach(btn => {
    if (btn.dataset.filterType === type) {
      btn.classList.add('bg-nfgblue', 'text-white', 'dark:bg-blue-900');
      btn.classList.remove('bg-gray-100', 'text-gray-700', 'dark:bg-gray-700', 'dark:text-gray-300');
    } else {
      btn.classList.remove('bg-nfgblue', 'text-white', 'dark:bg-blue-900');
      btn.classList.add('bg-gray-100', 'text-gray-700', 'dark:bg-gray-700', 'dark:text-gray-300');
    }
  });
  
  // Re-apply current search query
  const searchInput = document.getElementById('conversation-search');
  if (searchInput) {
    filterConversations(searchInput.value);
  } else {
    filterConversations('');
  }
  
  triggerHaptic('light');
}

// ========== CONVERSATION MENU ==========
let activeMenu = null; // Track the currently open menu

function toggleConversationMenu(event) {
  event.stopPropagation();
  event.preventDefault();
  
  const button = event.currentTarget;
  const conversationId = button.dataset.conversationId;
  
  // Close any existing menu
  if (activeMenu) {
    activeMenu.remove();
    activeMenu = null;
  }
  
  // Get button position for fixed positioning
  const buttonRect = button.getBoundingClientRect();
  const menuWidth = 150;
  const menuHeight = 88; // 2 items * 44px each
  
  // Calculate position - align right edge with button right edge
  const right = window.innerWidth - buttonRect.right;
  let top = buttonRect.bottom + 4;
  
  // If menu would go off bottom of screen, show it above button instead
  if (top + menuHeight > window.innerHeight) {
    top = buttonRect.top - menuHeight - 4;
    // Ensure it doesn't go off top either
    if (top < 0) {
      top = 4;
    }
  }
  
  // Create new menu and append to body (avoids overflow clipping)
  const menu = document.createElement('div');
  menu.className = 'conversation-menu-dropdown';
  menu.dataset.conversationId = conversationId;
  
  const isDark = document.documentElement.classList.contains('dark');
  menu.style.cssText = `
    position: fixed !important;
    right: ${right}px !important;
    top: ${top}px !important;
    width: ${menuWidth}px !important;
    background-color: ${isDark ? '#1F2937' : 'white'} !important;
    border: 1px solid ${isDark ? '#374151' : '#E5E7EB'} !important;
    border-radius: 8px !important;
    box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.15), 0 10px 10px -5px rgba(0, 0, 0, 0.1) !important;
    padding: 4px 0 !important;
    z-index: 999999 !important;
    display: block !important;
    visibility: visible !important;
    opacity: 1 !important;
  `;
  
  menu.innerHTML = `
    <button 
      class="conversation-action-btn archive-btn-desktop"
      data-action="archive" 
      data-conversation-id="${conversationId}"
      style="display: flex !important; align-items: center !important; width: 100% !important; padding: 10px 16px !important; text-align: left !important; font-size: 14px !important; font-weight: 500 !important; color: ${isDark ? '#D1D5DB' : '#374151'} !important; background-color: transparent !important; border: none !important; cursor: pointer !important; white-space: nowrap !important; gap: 10px !important;"
    >
      <i data-lucide="archive" class="w-4 h-4 text-yellow-600 dark:text-yellow-400" style="flex-shrink: 0;"></i>
      <span style="flex: 1;">Archive</span>
    </button>
    <button 
      class="conversation-action-btn delete-btn-desktop"
      data-action="delete" 
      data-conversation-id="${conversationId}"
      style="display: flex !important; align-items: center !important; width: 100% !important; padding: 10px 16px !important; text-align: left !important; font-size: 14px !important; font-weight: 500 !important; color: ${isDark ? '#F87171' : '#DC2626'} !important; background-color: transparent !important; border: none !important; cursor: pointer !important; white-space: nowrap !important; gap: 10px !important;"
    >
      <i data-lucide="trash-2" class="w-4 h-4" style="flex-shrink: 0;"></i>
      <span style="flex: 1;">Delete</span>
    </button>
  `;
  
  // Append to body
  document.body.appendChild(menu);
  activeMenu = menu;
  
  // Recreate icons
  if (window.lucide) {
    lucide.createIcons();
  }
  
  // Attach action button listeners
  menu.querySelectorAll('.conversation-action-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      e.preventDefault();
      const action = btn.dataset.action;
      const convId = btn.dataset.conversationId;
      
      // Close menu
      if (activeMenu) {
        activeMenu.remove();
        activeMenu = null;
      }
      
      if (action === 'archive') {
        await archiveConversation(convId);
      } else if (action === 'delete') {
        await deleteConversation(convId);
      }
      
      // Recreate icons after action
      if (window.lucide) {
        lucide.createIcons();
      }
    });
    
    // Add hover effects
    btn.addEventListener('mouseenter', () => {
      if (btn.dataset.action === 'archive') {
        btn.style.backgroundColor = isDark ? '#78350F' : '#FEF3C7';
      } else {
        btn.style.backgroundColor = isDark ? '#7F1D1D' : '#FEE2E2';
      }
    });
    
    btn.addEventListener('mouseleave', () => {
      btn.style.backgroundColor = 'transparent';
    });
  });
  
  // Close menu when clicking outside
  const closeMenuOnClickOutside = (e) => {
    if (activeMenu && !activeMenu.contains(e.target) && !button.contains(e.target)) {
      activeMenu.remove();
      activeMenu = null;
      document.removeEventListener('click', closeMenuOnClickOutside);
    }
  };
  
  // Add listener after current event completes
  setTimeout(() => {
    document.addEventListener('click', closeMenuOnClickOutside);
  }, 0);
  
  console.log('[Menu] Menu created and shown for conversation:', conversationId);
  console.log('[Menu] Menu position - right:', right, 'top:', top);
  console.log('[Menu] Menu element:', menu);
  console.log('[Menu] Menu in DOM:', document.body.contains(menu));
}

// Expose to global scope for inline onclick
window.toggleConversationMenu = toggleConversationMenu;

// ========== UTILITY FUNCTIONS ==========
function getInitials(name) {
  if (!name) return '?';
  const parts = name.trim().split(' ');
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return name.substring(0, 2).toUpperCase();
}

function formatRelativeTime(dateString) {
  if (!dateString) return '';
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

function formatMessageTime(dateString) {
  if (!dateString) return '';
  const date = new Date(dateString);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  const isYesterday = date.toDateString() === new Date(now - 86400000).toDateString();

  if (isToday) {
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  } else if (isYesterday) {
    return 'Yesterday';
  } else {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }
}

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// ========== PHASE 1: MESSAGE EDITING & DELETING ==========

// Attach message action listeners (edit/delete)
function attachMessageActionListeners() {
  // Edit message button
  document.querySelectorAll('.edit-message-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const messageId = btn.dataset.messageId;
      editMessage(messageId);
    });
  });
  
  // Delete message button
  document.querySelectorAll('.delete-message-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const messageId = btn.dataset.messageId;
      deleteMessage(messageId);
    });
  });
}

// Mobile long-press for message actions
function attachMobileMessageLongPress() {
  let longPressTimer = null;
  const LONG_PRESS_DURATION = 500; // ms
  
  document.querySelectorAll('.message-bubble').forEach(bubble => {
    bubble.addEventListener('touchstart', (e) => {
      const messageId = bubble.dataset.messageId;
      const message = messages.find(m => m.id === messageId);
      if (!message || message.sender_id !== currentUser.id || message.deleted_at) return;
      
      longPressTimer = setTimeout(() => {
        triggerHaptic('medium');
        showMobileMessageMenu(messageId, e.touches[0].clientX, e.touches[0].clientY);
      }, LONG_PRESS_DURATION);
    });
    
    bubble.addEventListener('touchend', () => {
      if (longPressTimer) {
        clearTimeout(longPressTimer);
        longPressTimer = null;
      }
    });
    
    bubble.addEventListener('touchmove', () => {
      if (longPressTimer) {
        clearTimeout(longPressTimer);
        longPressTimer = null;
      }
    });
  });
}

// Show mobile message menu
function showMobileMessageMenu(messageId, x, y) {
  const message = messages.find(m => m.id === messageId);
  if (!message) return;
  
  const messageAge = Date.now() - new Date(message.created_at).getTime();
  const isSent = message.sender_id === currentUser.id;
  const canEdit = isSent && !message.deleted_at && messageAge < MESSAGE_EDIT_WINDOW_MS;
  // Anyone can delete any message (it will delete for everyone)
  const canDelete = !message.deleted_at;
  
  // Remove existing menu
  const existingMenu = document.getElementById('mobile-message-menu');
  if (existingMenu) existingMenu.remove();
  
  // Create menu
  const menu = document.createElement('div');
  menu.id = 'mobile-message-menu';
  menu.className = 'fixed z-50 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-nfgray dark:border-gray-700 p-2 min-w-[150px]';
  menu.style.left = `${Math.min(x, window.innerWidth - 160)}px`;
  menu.style.top = `${Math.min(y, window.innerHeight - 100)}px`;
  
  menu.innerHTML = `
    ${canEdit ? `
      <button class="mobile-menu-edit w-full px-4 py-2 text-left text-sm rounded-lg hover:bg-nfglight dark:hover:bg-gray-700 flex items-center gap-2" data-message-id="${messageId}">
        <i data-lucide="pencil" class="w-4 h-4"></i>
        <span>Edit</span>
      </button>
    ` : ''}
    ${canDelete ? `
      <button class="mobile-menu-delete w-full px-4 py-2 text-left text-sm text-red-600 dark:text-red-400 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2" data-message-id="${messageId}">
        <i data-lucide="trash-2" class="w-4 h-4"></i>
        <span>Delete</span>
      </button>
    ` : ''}
  `;
  
  document.body.appendChild(menu);
  
  // Recreate icons
  if (window.lucide) lucide.createIcons();
  
  // Attach listeners
  menu.querySelector('.mobile-menu-edit')?.addEventListener('click', () => {
    editMessage(messageId);
    menu.remove();
  });
  
  menu.querySelector('.mobile-menu-delete')?.addEventListener('click', () => {
    deleteMessage(messageId);
    menu.remove();
  });
  
  // Close on outside click
  setTimeout(() => {
    document.addEventListener('click', function closeMenu(e) {
      if (!menu.contains(e.target)) {
        menu.remove();
        document.removeEventListener('click', closeMenu);
      }
    });
  }, 100);
}

// Edit message
async function editMessage(messageId) {
  const message = messages.find(m => m.id === messageId);
  if (!message) return;
  
  const newContent = prompt('Edit message:', message.content);
  if (newContent === null || newContent.trim() === message.content) return;
  
  if (!newContent.trim()) {
    toast?.error('Message cannot be empty', 'Error');
    triggerHaptic('warning');
    return;
  }
  
  try {
    triggerHaptic('medium');
    
    const { error } = await supabase
      .from('messages')
      .update({
        content: newContent.trim(),
        is_edited: true,
        updated_at: new Date().toISOString()
      })
      .eq('id', messageId)
      .eq('sender_id', currentUser.id); // Ensure user can only edit their own messages
    
    if (error) throw error;
    
    // Update local message
    message.content = newContent.trim();
    message.is_edited = true;
    message.updated_at = new Date().toISOString();
    
    // Re-render messages
    renderMessages();
    triggerHaptic('success');
    toast?.success('Message edited', 'Success');
  } catch (error) {
    console.error('Error editing message:', error);
    triggerHaptic('error');
    toast?.error('Failed to edit message', 'Error');
  }
}

// Delete message (soft delete - just sets deleted_at)
async function deleteMessage(messageId) {
  const message = messages.find(m => m.id === messageId);
  if (!message || !currentConversation) return;
  
  const confirmed = confirm('Delete this message?');
  if (!confirmed) return;
  
  try {
    triggerHaptic('heavy');
    
    // Soft delete: use database function to bypass RLS
    const { data, error } = await supabase
      .rpc('soft_delete_message', {
        p_message_id: messageId,
        p_user_id: currentUser.id
      });
    
    if (error) throw error;
    
    // Update local message
    const messageIndex = messages.findIndex(m => m.id === messageId);
    if (messageIndex !== -1) {
      messages[messageIndex].deleted_at = new Date().toISOString();
    }
    
    // Re-render messages
    renderMessages();
    triggerHaptic('success');
    toast?.success('Message deleted', 'Success');
  } catch (error) {
    console.error('Error deleting message:', error);
    triggerHaptic('error');
    toast?.error('Failed to delete message: ' + (error.message || 'Unknown error'), 'Error');
  }
}

// ========== TOAST NOTIFICATIONS ==========
// Toast helper is defined at the top of the file (line 16)

// ========== PHASE 1: ARCHIVE & DELETE CONVERSATIONS ==========

// Archive conversation
async function archiveConversation(conversationId) {
  try {
    triggerHaptic('medium');
    
    const { error } = await supabase
      .from('conversations')
      .update({
        archived_at: new Date().toISOString(),
        archived_by: currentUser.id
      })
      .eq('id', conversationId);
    
    if (error) throw error;
    
    // Remove from local conversations array
    conversations = conversations.filter(c => c.id !== conversationId);
    
    // If this was the current conversation, clear it
    if (currentConversation?.id === conversationId) {
      currentConversation = null;
      showConversationList();
    }
    
    // Re-render conversations
    renderConversations();
    triggerHaptic('success');
    toast?.success('Conversation archived', 'Success');
  } catch (error) {
    console.error('Error archiving conversation:', error);
    triggerHaptic('error');
    toast?.error('Failed to archive conversation', 'Error');
  }
}

// Delete conversation
async function deleteConversation(conversationId) {
  const confirmed = confirm('Are you sure you want to delete this conversation? This action cannot be undone.');
  if (!confirmed) return;
  
  try {
    triggerHaptic('heavy');
    
    // Delete the conversation (this will cascade delete messages via foreign key)
    const { error } = await supabase
      .from('conversations')
      .delete()
      .eq('id', conversationId);
    
    if (error) throw error;
    
    // Remove from local conversations array
    conversations = conversations.filter(c => c.id !== conversationId);
    
    // If this was the current conversation, clear it
    if (currentConversation?.id === conversationId) {
      currentConversation = null;
      messages = [];
      showConversationList();
    }
    
    // Re-render conversations
    renderConversations();
    triggerHaptic('success');
    toast?.success('Conversation deleted', 'Success');
  } catch (error) {
    console.error('Error deleting conversation:', error);
    triggerHaptic('error');
    toast?.error('Failed to delete conversation', 'Error');
  }
}

// ========== PHASE 1: TYPING INDICATORS ==========

// Initialize typing indicators
function initTypingIndicators() {
  if (!currentConversation) return;
  
  // Cleanup existing channel first
  if (typingChannel) {
    typingChannel.untrack();
    typingChannel.unsubscribe();
    typingChannel = null;
  }
  
  // Create typing channel for this conversation
  typingChannel = supabase.channel(`typing:${currentConversation.id}`, {
    config: {
      presence: {
        key: currentUser.id
      }
    }
  });
  
  // Clear any existing typing timeout
  if (typingTimeout) {
    clearTimeout(typingTimeout);
    typingTimeout = null;
  }
  
  // Reset subscription status
  typingChannelSubscribed = false;
  
  // Listen for typing events from others
  typingChannel
    .on('presence', { event: 'sync' }, () => {
      console.log('[Typing] Presence sync event');
      updateTypingIndicator();
    })
    .on('presence', { event: 'join' }, ({ key, newPresences }) => {
      console.log('[Typing] Presence join event', { key, newPresences });
      updateTypingIndicator();
    })
    .on('presence', { event: 'leave' }, () => {
      console.log('[Typing] Presence leave event');
      updateTypingIndicator();
    });
  
  // Subscribe to channel and wait for subscription before tracking
  typingChannel.subscribe((status) => {
    console.log('[Typing] Channel subscription status:', status);
    if (status === 'SUBSCRIBED') {
      typingChannelSubscribed = true;
      console.log('[Typing] Channel subscribed, ready to track');
      // Trigger initial sync to check for existing typing users
      updateTypingIndicator();
    } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
      typingChannelSubscribed = false;
      console.warn('[Typing] Channel closed or error:', status);
    }
  });
  
  // Set up typing tracking (will only work after subscription)
  const messageInput = document.getElementById('message-input');
  if (messageInput) {
    // Remove existing typing listener if any
    if (messageInput.dataset.typingListenerAttached) {
      // Clone to remove old listener (we'll add new one below)
      const newInput = messageInput.cloneNode(true);
      messageInput.parentNode.replaceChild(newInput, messageInput);
    }
    
    const freshInput = document.getElementById('message-input');
    if (freshInput) {
      let lastTypingSent = 0;
      const TYPING_THROTTLE_MS = 1000; // Send typing indicator max once per second
      
      freshInput.addEventListener('input', () => {
        // Only track if channel is subscribed
        if (!typingChannel || !typingChannelSubscribed) {
          console.log('[Typing] Cannot track - channel not ready', { 
            hasChannel: !!typingChannel, 
            subscribed: typingChannelSubscribed 
          });
          return;
        }
        
        const now = Date.now();
        if (now - lastTypingSent < TYPING_THROTTLE_MS) return;
        
        lastTypingSent = now;
        
        try {
          console.log('[Typing] Sending typing indicator');
          // Send presence with typing state
          typingChannel.track({
            typing: true,
            user_id: currentUser.id,
            user_name: currentUserProfile?.full_name || currentUser.email,
            timestamp: new Date().toISOString()
          });
          
          // Clear typing state after 3 seconds
          if (typingTimeout) clearTimeout(typingTimeout);
          typingTimeout = setTimeout(() => {
            if (typingChannel && typingChannelSubscribed) {
              console.log('[Typing] Clearing typing indicator');
              typingChannel.track({
                typing: false,
                user_id: currentUser.id
              });
            }
          }, TYPING_TIMEOUT_MS);
        } catch (error) {
          console.error('[Typing] Error tracking presence:', error);
        }
      });
      
      // Mark listener as attached to prevent duplicates
      freshInput.dataset.typingListenerAttached = 'true';
    }
  }
}

// Update typing indicator UI
function updateTypingIndicator() {
  if (!typingChannel || !currentConversation) {
    console.log('[Typing] Cannot update indicator - missing channel or conversation', {
      hasChannel: !!typingChannel,
      hasConversation: !!currentConversation
    });
    return;
  }
  
  const state = typingChannel.presenceState();
  console.log('[Typing] Current presence state:', state);
  
  const typingUsers = [];
  
  // Get all users who are typing (excluding current user)
  Object.values(state).forEach(presences => {
    if (Array.isArray(presences)) {
      presences.forEach(presence => {
        if (presence.typing && presence.user_id !== currentUser.id) {
          typingUsers.push(presence);
        }
      });
    }
  });
  
  console.log('[Typing] Found typing users:', typingUsers);
  
  // Update UI
  const indicator = document.getElementById('typing-indicator');
  const indicatorText = document.getElementById('typing-indicator-text');
  
  if (!indicator || !indicatorText) {
    console.warn('[Typing] Typing indicator elements not found in DOM');
    return;
  }
  
  if (typingUsers.length > 0) {
    const names = typingUsers.map(u => u.user_name || 'Someone').join(', ');
    indicatorText.textContent = `${names} ${typingUsers.length === 1 ? 'is' : 'are'} typing...`;
    
    // Force show indicator - remove hidden class and set display
    indicator.classList.remove('hidden');
    indicator.style.display = 'block';
    indicator.style.visibility = 'visible';
    indicator.style.opacity = '1';
    
    // Ensure messages list is visible too
    const messagesList = document.getElementById('messages-list');
    if (messagesList) {
      messagesList.classList.remove('hidden');
    }
    
    console.log('[Typing] Showing indicator:', indicatorText.textContent);
    console.log('[Typing] Indicator element:', indicator);
    console.log('[Typing] Indicator classes:', indicator.className);
    console.log('[Typing] Indicator display:', window.getComputedStyle(indicator).display);
    console.log('[Typing] Indicator visibility:', window.getComputedStyle(indicator).visibility);
    console.log('[Typing] Indicator opacity:', window.getComputedStyle(indicator).opacity);
    
    // Scroll to show typing indicator (with delay to ensure DOM updated)
    setTimeout(() => {
      const container = document.getElementById('messages-container');
      if (container && indicator) {
        // Scroll to bottom to show typing indicator
        container.scrollTop = container.scrollHeight;
      }
    }, 50);
  } else {
    // Hide indicator
    indicator.classList.add('hidden');
    indicator.style.display = 'none';
    console.log('[Typing] Hiding indicator - no typing users');
  }
}

// Cleanup typing channel
function cleanupTypingChannel() {
  if (typingChannel) {
    try {
      typingChannel.untrack();
      typingChannel.unsubscribe();
    } catch (error) {
      console.error('[Typing] Error cleaning up channel:', error);
    }
    typingChannel = null;
  }
  
  // Remove typing listener flag
  const messageInput = document.getElementById('message-input');
  if (messageInput && messageInput.dataset.typingListenerAttached) {
    delete messageInput.dataset.typingListenerAttached;
  }
}

// ========== PHASE 1: ONLINE/OFFLINE STATUS ==========

// Initialize online status tracking
function initOnlineStatus() {
  if (!currentConversation) return;
  
  const otherUser = currentConversation.otherParticipants?.[0];
  if (!otherUser) return;
  
  // Cleanup existing channel first
  if (presenceChannel) {
    presenceChannel.untrack();
    presenceChannel.unsubscribe();
    presenceChannel = null;
  }
  
  // Create presence channel for online status
  presenceChannel = supabase.channel(`presence:${currentConversation.id}`, {
    config: {
      presence: {
        key: currentUser.id
      }
    }
  });
  
  // Listen for presence changes
  presenceChannel
    .on('presence', { event: 'sync' }, () => {
      updateOnlineStatus();
    })
    .on('presence', { event: 'join' }, () => {
      updateOnlineStatus();
    })
    .on('presence', { event: 'leave' }, () => {
      updateOnlineStatus();
    });
  
  // Subscribe to channel and wait for subscription before tracking
  presenceChannel.subscribe((status) => {
    if (status === 'SUBSCRIBED') {
      // Channel is ready, now we can track presence
      presenceChannel.track({
        online: true,
        user_id: currentUser.id,
        last_seen: new Date().toISOString()
      });
      
      // Update online status immediately
      updateOnlineStatus();
      
      // Update last_seen_at when user becomes active
      updateUserLastSeen();
    }
  });
  
  // Update last_seen_at periodically while active (only if channel exists)
  const statusInterval = setInterval(() => {
    if (presenceChannel) {
      updateUserLastSeen();
    } else {
      clearInterval(statusInterval);
    }
  }, 30000); // Every 30 seconds
  
  // Store interval ID for cleanup
  if (!window.presenceStatusInterval) {
    window.presenceStatusInterval = statusInterval;
  }
}

// Update online status UI
function updateOnlineStatus() {
  if (!presenceChannel || !currentConversation) return;
  
  const otherUser = currentConversation.otherParticipants?.[0];
  if (!otherUser) return;
  
  const state = presenceChannel.presenceState();
  const headerStatus = document.getElementById('conversation-header-status');
  if (!headerStatus) return;
  
  // Check if other user is online
  let isOnline = false;
  Object.values(state).forEach(presences => {
    presences.forEach(presence => {
      if (presence.user_id === otherUser.id && presence.online) {
        isOnline = true;
      }
    });
  });
  
  if (isOnline) {
    headerStatus.textContent = 'Online';
    headerStatus.className = 'text-xs text-green-600 dark:text-green-400';
  } else {
    // Show last seen if available
    const lastSeen = otherUser.last_seen_at;
    if (lastSeen) {
      const lastSeenDate = new Date(lastSeen);
      const now = new Date();
      const diffMs = now - lastSeenDate;
      const diffMins = Math.floor(diffMs / 60000);
      
      if (diffMins < 5) {
        headerStatus.textContent = 'Last seen just now';
      } else if (diffMins < 60) {
        headerStatus.textContent = `Last seen ${diffMins}m ago`;
      } else {
        headerStatus.textContent = `Last seen ${formatRelativeTime(lastSeen)}`;
      }
    } else {
      headerStatus.textContent = 'Offline';
    }
    headerStatus.className = 'text-xs text-gray-500 dark:text-gray-400';
  }
}

// Update user's last_seen_at in database
async function updateUserLastSeen() {
  try {
    await supabase
      .from('user_profiles')
      .update({ last_seen_at: new Date().toISOString() })
      .eq('id', currentUser.id);
  } catch (error) {
    console.error('Error updating last_seen_at:', error);
    // Non-critical, fail silently
  }
}

// Cleanup presence channel
function cleanupPresenceChannel() {
  if (presenceChannel) {
    presenceChannel.untrack();
    presenceChannel.unsubscribe();
    presenceChannel = null;
  }
}

// Cleanup all channels when leaving conversation
function cleanupChannels() {
  cleanupTypingChannel();
  cleanupPresenceChannel();
}

