/**
 * User Management Module for NFG App
 * Handles user invitations, role management, and site assignments
 */

import { supabase } from './supabase.js'
import { NFGDropdown } from './custom-dropdown.js'
import { showNotification, showConfirm, showPrompt, toast, notify } from './notifications.js'

let currentUser = null;
let currentUserProfile = null;
let selectedUserId = null;

// Get current user and profile
export async function getCurrentUser() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  
  currentUser = user;
  
  // Get user profile
  try {
    const { data: profile, error } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', user.id)
      .single();
    
    if (error) {
      console.error('Error fetching user profile:', error);
      // Create default profile if doesn't exist
      currentUserProfile = { 
        id: user.id, 
        email: user.email, 
        full_name: user.user_metadata?.full_name || null,
        role: 'staff', 
        status: 'active' 
      };
    } else {
      currentUserProfile = profile;
    }
  } catch (error) {
    console.error('Error in getCurrentUser:', error);
            currentUserProfile = { 
              id: user.id, 
              email: user.email, 
              role: 'staff', 
              status: 'active' 
            };
  }
  
  return { user, profile: currentUserProfile };
}

// Normalize role for display (super_admin shows as admin in UI)
export function getDisplayRole(role) {
  return role === 'super_admin' ? 'admin' : role;
}

// Check if current user is admin, client, or super_admin
export function canManageUsers() {
  // Check both currentUserProfile (from module) and try to get from auth if not set
  if (currentUserProfile && ['admin', 'client', 'super_admin'].includes(currentUserProfile.role)) {
    return true;
  }
  // Fallback: check if we can determine from current user data
  return false;
}

// Check if user can manage users (with profile parameter)
export function canManageUsersWithProfile(profile) {
  return profile && ['admin', 'client', 'super_admin'].includes(profile.role);
}

// Fetch all users
export async function fetchUsers() {
  try {
    console.log('fetchUsers: Starting query...');
    const { data, error } = await supabase
      .from('user_profiles')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('fetchUsers: Error from Supabase:', error);
      return [];
    }
    console.log('fetchUsers: Successfully fetched data:', data);
    return data || [];
  } catch (error) {
    console.error('fetchUsers: Exception caught:', error);
    return [];
  }
}

// Fetch pending invitations
export async function fetchPendingInvitations() {
  try {
    const { data, error } = await supabase
      .from('user_invitations')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('Error fetching invitations:', error);
      return [];
    }
    return data || [];
  } catch (error) {
    console.error('Error in fetchPendingInvitations:', error);
    return [];
  }
}

// Send invitation with automatic email
export async function sendInvitation(email, role) {
  try {
    // Check if user already exists
    const { data: existingProfile } = await supabase
      .from('user_profiles')
      .select('email')
      .eq('email', email)
      .single();
    
    if (existingProfile) {
      throw new Error('A user with this email already exists');
    }
    
    // Check if there's already a pending invitation
    const { data: existingInvitation } = await supabase
      .from('user_invitations')
      .select('*')
      .eq('email', email)
      .eq('status', 'pending')
      .single();
    
    if (existingInvitation) {
      throw new Error('This email already has a pending invitation');
    }
    
    // Generate invitation token
    const token = generateToken();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // Expires in 7 days
    
    // Create invitation in database
    const { data, error } = await supabase
      .from('user_invitations')
      .insert({
        email,
        role,
        invited_by: currentUser.id,
        invitation_token: token,
        expires_at: expiresAt.toISOString(),
        status: 'pending'
      })
      .select()
      .single();
    
    if (error) throw error;
    
    // Generate invitation link
    const invitationLink = `${window.location.origin}/accept-invitation.html?token=${token}`;
    
    console.log('Invitation created:', data);
    console.log('Invitation link:', invitationLink);
    
    // Get current user's email for inviter
    const { data: { user: authUser } } = await supabase.auth.getUser();
    const inviterEmail = authUser?.email || currentUser?.email || null;
    
    // Send email via Edge Function using Resend
    try {
      const { data: emailResult, error: emailError } = await supabase.functions.invoke('send-invitation-email', {
        method: 'POST',
        body: {
          email,
          role,
          invitationLink,
          inviterEmail
        }
      });

      if (emailError) {
        console.error('[User Management] Error sending invitation email:', emailError);
        // Fallback: copy link to clipboard if email fails
        await navigator.clipboard.writeText(invitationLink);
        toast.warning(`Invitation created but email failed to send. Link copied to clipboard.`, 'Warning');
      } else {
        console.log('[User Management] Invitation email sent successfully:', emailResult);
        toast.success(`Invitation email sent successfully to ${email}`, 'Success');
      }
    } catch (emailErr) {
      console.error('[User Management] Error calling email function:', emailErr);
      // Fallback: copy link to clipboard if email fails
      await navigator.clipboard.writeText(invitationLink);
      toast.warning(`Invitation created but email failed to send. Link copied to clipboard.`, 'Warning');
    }
    
    return data;
  } catch (error) {
    console.error('Error sending invitation:', error);
    throw error;
  }
}

// Cancel invitation
export async function cancelInvitation(invitationId) {
  const { error } = await supabase
    .from('user_invitations')
    .update({ status: 'cancelled' })
    .eq('id', invitationId);
  
  if (error) {
    console.error('Error cancelling invitation:', error);
    throw error;
  }
}

// Update user role and status
export async function updateUserRole(userId, role, status) {
  try {
    // Get current user data first
    const { data: currentUser, error: fetchError } = await supabase
      .from('user_profiles')
      .select('role, status')
      .eq('id', userId)
      .single();
    
    if (fetchError) {
      console.error('Error fetching current user:', fetchError);
      throw fetchError;
    }
    
    // If user is super_admin, only allow status updates (not role changes)
    if (currentUser?.role === 'super_admin') {
      if (role && role !== 'super_admin') {
        throw new Error('Cannot change super_admin role via UI. Use SQL to reassign.');
      }
      // Only update status for super_admin
      const updateData = { 
        status, 
        updated_at: new Date().toISOString() 
      };
      
      const { error } = await supabase
        .from('user_profiles')
        .update(updateData)
        .eq('id', userId);
      
      if (error) {
        console.error('Error updating super_admin status:', error);
        throw error;
      }
      return;
    }
    
    // For non-super_admin users, update both role and status
    // Only update role if it's actually changing
    const updateData = { 
      status, 
      updated_at: new Date().toISOString() 
    };
    
    // Only include role in update if it's different from current role
    if (role && role !== currentUser?.role) {
      updateData.role = role;
    }
    
    const { error } = await supabase
      .from('user_profiles')
      .update(updateData)
      .eq('id', userId);
    
    if (error) {
      console.error('Error updating user:', error);
      throw error;
    }
  } catch (error) {
    console.error('Error in updateUserRole:', error);
    throw error;
  }
}

// Get user's site assignments
export async function getUserSiteAssignments(userId) {
  const { data, error } = await supabase
    .from('worker_site_assignments')
    .select('*')
    .eq('worker_id', userId);
  
  if (error) {
    console.error('Error fetching site assignments:', error);
    return [];
  }
  return data || [];
}

// Assign user to site
export async function assignUserToSite(userId, siteId, canManage = false) {
  // Check if assignment already exists (don't use .single() as it throws on no result)
  const { data: existing, error: checkError } = await supabase
    .from('worker_site_assignments')
    .select('id')
    .eq('worker_id', userId)
    .eq('site_id', siteId)
    .maybeSingle(); // Use maybeSingle() instead of single() to avoid error when no result
  
  if (checkError && checkError.code !== 'PGRST116') { // PGRST116 is "not found" which is OK
    console.error('Error checking existing assignment:', checkError);
    throw checkError;
  }
  
  if (existing) {
    throw new Error('Worker is already assigned to this site');
  }
  
  // Get site name for notification
  const { data: site, error: siteError } = await supabase
    .from('sites')
    .select('name')
    .eq('id', siteId)
    .maybeSingle(); // Use maybeSingle() to handle case where site might not exist
  
  if (siteError && siteError.code !== 'PGRST116') {
    console.warn('Error fetching site name:', siteError);
  }
  
  const siteName = site?.name || `Site #${siteId}`;
  
  // Get current user
  const { data: { user: currentUser } } = await supabase.auth.getUser();
  if (!currentUser) {
    throw new Error('User not authenticated');
  }
  
  const { data: assignment, error } = await supabase
    .from('worker_site_assignments')
    .insert({
      worker_id: userId,
      site_id: siteId,
      can_manage: canManage,
      assigned_by: currentUser.id
    })
    .select()
    .single();
  
  if (error) {
    console.error('Error assigning user to site:', error);
    throw error;
  }
  
  console.log('✅ Site assignment created:', assignment);
  
  // Create notification for the assigned worker (non-blocking)
  // Import and call notification function asynchronously to avoid blocking
  import('./notification-triggers.js')
    .then(module => {
      if (module && module.notifySiteAssigned) {
        return module.notifySiteAssigned(userId, siteId, siteName);
      }
    })
    .then(() => {
      console.log('✅ Site assignment notification created');
    })
    .catch(notifError => {
      console.warn('⚠️ Failed to create site assignment notification:', notifError);
      // Don't fail the assignment if notification fails
    });
  
  return assignment;
}

// Remove user from site
export async function removeUserFromSite(assignmentId) {
  // Get assignment details for notification
  const { data: assignment } = await supabase
    .from('worker_site_assignments')
    .select('worker_id, site_id, sites(name)')
    .eq('id', assignmentId)
    .single();
  
  const workerId = assignment?.worker_id;
  const siteId = assignment?.site_id;
  const siteName = assignment?.sites?.name || `Site #${siteId}`;
  
  const { error } = await supabase
    .from('worker_site_assignments')
    .delete()
    .eq('id', assignmentId);
  
  if (error) {
    console.error('Error removing site assignment:', error);
    throw error;
  }
  
  // Create notification for the unassigned worker
  if (workerId && siteId) {
    try {
      const { notifySiteUnassigned } = await import('./notification-triggers.js');
      await notifySiteUnassigned(workerId, siteId, siteName);
      console.log('✅ Site unassignment notification created');
    } catch (notifError) {
      console.warn('⚠️ Failed to create site unassignment notification:', notifError);
      // Don't fail the removal if notification fails
    }
  }
}

// Get user job stats
export async function getUserJobStats(userId) {
  try {
    const { data: allJobs } = await supabase
      .from('jobs')
      .select('status')
      .eq('assigned_worker_id', userId);
    
    const total = allJobs?.length || 0;
    const completed = allJobs?.filter(j => j.status === 'completed').length || 0;
    
    const { data: assignments } = await supabase
      .from('worker_site_assignments')
      .select('site_id')
      .eq('worker_id', userId);
    
    const sites = new Set(assignments?.map(a => a.site_id)).size || 0;
    
    return { total, completed, sites };
  } catch (error) {
    console.error('Error fetching job stats:', error);
    return { total: 0, completed: 0, sites: 0 };
  }
}

// Remove user (set to inactive)
export async function removeUser(userId) {
  const { error } = await supabase
    .from('user_profiles')
    .update({ 
      status: 'inactive', 
      updated_at: new Date().toISOString() 
    })
    .eq('id', userId);
  
  if (error) {
    console.error('Error removing user:', error);
    throw error;
  }
}

// Store all users for filtering
let allUsers = [];

// Clear user cache (call after updates to force refresh)
export function clearUserCache() {
  allUsers = [];
}

// Render users list with optional filters
export async function renderUsersList(searchTerm = '', roleFilter = 'all', statusFilter = 'all') {
  console.log('renderUsersList called', { searchTerm, roleFilter, statusFilter });
  const list = document.getElementById('users-list');
  
  if (!list) {
    console.error('users-list element not found!');
    return;
  }
  
  // Only fetch if we don't have users cached or if explicitly requested
  if (allUsers.length === 0) {
    console.log('Fetching users...');
    allUsers = await fetchUsers();
    console.log('Users fetched:', allUsers);
  }
  
  // Apply filters
  let users = [...allUsers];
  
  // Search filter
  if (searchTerm) {
    const searchLower = searchTerm.toLowerCase();
    users = users.filter(user => {
      const name = (user.full_name || user.email.split('@')[0]).toLowerCase();
      const email = user.email.toLowerCase();
      const role = (user.role || '').toLowerCase();
      return name.includes(searchLower) || email.includes(searchLower) || role.includes(searchLower);
    });
  }
  
  // Role filter
  if (roleFilter !== 'all') {
    users = users.filter(user => {
      const userRole = user.role === 'super_admin' ? 'admin' : user.role;
      return userRole === roleFilter;
    });
  }
  
  // Status filter
  if (statusFilter !== 'all') {
    users = users.filter(user => user.status === statusFilter);
  }
  
  // Check if no users at all (setup issue) vs filtered out
  if (allUsers.length === 0) {
    console.warn('No users found, showing setup message');
    list.innerHTML = `
      <div class="text-center py-12 text-gray-500 dark:text-gray-400">
        <i data-lucide="alert-circle" class="w-16 h-16 mx-auto mb-4 opacity-30"></i>
        <h3 class="text-xl font-semibold text-nfgblue mb-2">User Management Not Set Up</h3>
        <p class="text-sm mb-4">To enable user management, you need to:</p>
        <ol class="text-left max-w-md mx-auto space-y-2 text-sm bg-nfglight/50 border border-nfgblue/20 rounded-xl p-4">
          <li>✅ 1. Run the SQL schema in Supabase</li>
          <li>✅ 2. Set your account to admin role</li>
          <li>✅ 3. Refresh this page</li>
        </ol>
        <div class="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-xl max-w-md mx-auto text-sm text-left">
          <p class="font-semibold text-blue-900 mb-2">📝 Quick Setup:</p>
          <p class="text-blue-800">Open <code class="bg-white px-2 py-0.5 rounded">supabase_user_management_schema.sql</code></p>
          <p class="text-blue-800 mt-1">Copy the SQL and run in Supabase SQL Editor</p>
        </div>
      </div>
    `;
    if (window.lucide) lucide.createIcons();
    return;
  }
  
  // Show message if filters result in no users
  if (users.length === 0) {
    list.innerHTML = `
      <div class="text-center py-8 text-gray-500 dark:text-gray-400">
        <i data-lucide="search-x" class="w-12 h-12 mx-auto mb-3 opacity-50"></i>
        <p class="text-sm">No users match your filters</p>
        <button onclick="clearUserFilters()" class="mt-3 text-sm text-nfgblue hover:underline">Clear filters</button>
      </div>
    `;
    if (window.lucide) lucide.createIcons();
    return;
  }
  
  console.log(`Rendering ${users.length} users`);
  
  const roleColors = {
    admin: 'bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300',
    client: 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300',
    staff: 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300',
    super_admin: 'bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300' // Same as admin (hidden)
  };
  
  const statusColors = {
    active: 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300',
    pending: 'bg-yellow-100 dark:bg-yellow-900 text-yellow-700 dark:text-yellow-300',
    inactive: 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300',
    suspended: 'bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300'
  };
  
  list.innerHTML = users.map(user => {
    const displayName = user.full_name || user.email.split('@')[0];
    const initials = displayName.charAt(0).toUpperCase();
    
    // Determine avatar display (profile picture or initials)
    const avatarHtml = user.profile_picture 
      ? `<img src="${user.profile_picture}" alt="${displayName}" class="w-10 h-10 md:w-12 md:h-12 flex-shrink-0 rounded-full object-cover border-2 border-nfgray" />`
      : `<div class="w-10 h-10 md:w-12 md:h-12 flex-shrink-0 rounded-full bg-gradient-to-br from-nfgblue to-nfgdark text-white flex items-center justify-center font-semibold text-base md:text-lg">${initials}</div>`;
    
    // Show View button for all users (they can view their own details at least)
    // Admin/client/super_admin can manage others
    const viewButton = `
      <button onclick="openUserDetails('${user.id}')" class="px-3 py-2 md:px-4 rounded-xl border border-nfgblue text-nfgblue hover:bg-nfglight transition flex items-center gap-2 flex-shrink-0 text-sm">
        <i data-lucide="eye" class="w-4 h-4"></i>
        <span class="hidden sm:inline">View</span>
      </button>
    `;
    
    return `
      <div class="flex items-center gap-3 p-3 md:p-4 bg-white dark:bg-gray-800 border border-nfgray dark:border-gray-700 rounded-xl hover:shadow-md transition-shadow">
        <div class="flex items-center gap-3 flex-1 min-w-0">
          ${avatarHtml}
          <div class="flex-1 min-w-0">
            <h5 class="font-semibold text-nfgblue dark:text-blue-400 text-sm md:text-base truncate">${displayName}</h5>
            <p class="text-xs md:text-sm text-gray-500 dark:text-gray-400 truncate">${user.email}</p>
            <div class="flex items-center gap-1.5 md:gap-2 mt-1 flex-wrap">
              <span class="px-2 py-0.5 rounded-lg text-xs font-medium ${roleColors[user.role] || roleColors.admin}">${getDisplayRole(user.role).toUpperCase()}</span>
              <span class="px-2 py-0.5 rounded-lg text-xs font-medium ${statusColors[user.status]}">${user.status}</span>
            </div>
          </div>
        </div>
        ${viewButton}
      </div>
    `;
  }).join('');
  
  if (window.lucide) lucide.createIcons();
}

// Clear user filters and refresh
window.clearUserFilters = function() {
  const searchInput = document.getElementById('user-search-input');
  const roleFilter = document.getElementById('user-role-filter');
  const statusFilter = document.getElementById('user-status-filter');
  
  if (searchInput) searchInput.value = '';
  if (roleFilter) roleFilter.value = 'all';
  if (statusFilter) statusFilter.value = 'all';
  
  renderUsersList('', 'all', 'all');
};

// Render pending invitations
export async function renderPendingInvitations() {
  const invitations = await fetchPendingInvitations();
  const container = document.getElementById('pending-invitations-container');
  const list = document.getElementById('pending-invitations-list');
  
  if (!container || !list) {
    console.warn('Pending invitations container or list not found');
    return;
  }
  
  // Always show container if user can manage, even if no invitations
  // This allows users to see the section exists
  if (invitations.length === 0) {
    container.classList.remove('hidden');
    list.innerHTML = `
      <div class="text-center py-4 text-gray-500 dark:text-gray-400 text-sm">
        <i data-lucide="inbox" class="w-6 h-6 mx-auto mb-2 opacity-50"></i>
        <p>No pending invitations</p>
      </div>
    `;
    if (window.lucide) lucide.createIcons();
    return;
  }
  
  container.classList.remove('hidden');
  
  list.innerHTML = invitations.map(inv => {
    const expiresAt = new Date(inv.expires_at);
    const now = new Date();
    const daysLeft = Math.ceil((expiresAt - now) / (1000 * 60 * 60 * 24));
    const expired = daysLeft < 0;
    
    return `
      <div class="flex items-center gap-2 md:gap-3 p-3 md:p-4 ${expired ? 'bg-red-50 border-red-200' : 'bg-yellow-50 border-yellow-200'} border rounded-xl">
        <div class="flex-1 min-w-0 pr-2">
          <div class="flex items-center gap-2">
            <i data-lucide="mail" class="w-4 h-4 text-nfgblue flex-shrink-0"></i>
            <p class="font-medium text-nfgblue text-sm md:text-base truncate">${inv.email}</p>
          </div>
          <p class="text-xs text-gray-600 mt-1">
            Role: <span class="font-medium">${inv.role}</span> • 
            ${expired ? '<span class="text-red-600 font-semibold">EXPIRED</span>' : `Expires in ${daysLeft} day${daysLeft !== 1 ? 's' : ''}`}
          </p>
        </div>
        <div class="flex items-center gap-1 md:gap-2 flex-shrink-0">
          <button 
            onclick="copyInvitationLink('${inv.invitation_token}')" 
            class="p-2 rounded-lg hover:bg-yellow-100 text-nfgblue transition"
            title="Copy invitation link">
            <i data-lucide="copy" class="w-4 h-4"></i>
          </button>
          <button 
            onclick="cancelInvite('${inv.id}')" 
            class="p-2 rounded-lg hover:bg-red-100 text-red-600 transition"
            title="Cancel invitation">
            <i data-lucide="x" class="w-4 h-4"></i>
          </button>
        </div>
      </div>
    `;
  }).join('');
  
  if (window.lucide) lucide.createIcons();
}

// Open user details modal
window.openUserDetails = async function(userId) {
  selectedUserId = userId;
  
  const users = await fetchUsers();
  const user = users.find(u => u.id === userId);
  if (!user) return;
  
  const displayName = user.full_name || user.email.split('@')[0];
  const initials = displayName.charAt(0).toUpperCase();
  
  // Populate user avatar (profile picture or initials)
  const avatarContainer = document.getElementById('user-detail-avatar-container');
  if (user.profile_picture) {
    avatarContainer.innerHTML = `<img src="${user.profile_picture}" alt="${displayName}" class="w-16 h-16 rounded-full object-cover border-2 border-nfgray" />`;
  } else {
    avatarContainer.innerHTML = `<div class="w-16 h-16 rounded-full bg-gradient-to-br from-nfgblue to-nfgdark text-white flex items-center justify-center font-semibold text-2xl">${initials}</div>`;
  }
  
  // Populate user info
  document.getElementById('user-detail-name').textContent = displayName;
  document.getElementById('user-detail-email').textContent = user.email;
  
  // Update badges (hide super_admin, show as admin)
  const roleBadge = document.getElementById('user-detail-role-badge');
  const roleColors = {
    admin: 'bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300',
    client: 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300',
    staff: 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300',
    super_admin: 'bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300' // Same as admin
  };
  const displayRole = getDisplayRole(user.role);
  roleBadge.className = `px-2 py-0.5 rounded-lg text-xs font-medium ${roleColors[user.role] || roleColors.admin}`;
  roleBadge.textContent = displayRole.toUpperCase();
  
  const statusBadge = document.getElementById('user-detail-status-badge');
  const statusColors = {
    active: 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300',
    pending: 'bg-yellow-100 dark:bg-yellow-900 text-yellow-700 dark:text-yellow-300',
    inactive: 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300',
    suspended: 'bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300'
  };
  statusBadge.className = `px-2 py-0.5 rounded-lg text-xs font-medium ${statusColors[user.status]}`;
  statusBadge.textContent = user.status;
  
  // Set role and status selects
  const roleSelect = document.querySelector('#user-detail-role-select');
  const statusSelect = document.querySelector('#user-detail-status-select');
  
  // Hide role dropdown if user is super_admin (cannot be changed via UI)
  if (user.role === 'super_admin') {
    if (roleSelect) {
      const roleField = roleSelect.closest('.space-y-2');
      if (roleField) roleField.style.display = 'none';
    }
  } else {
    if (roleSelect) {
      const roleField = roleSelect.closest('.space-y-2');
      if (roleField) roleField.style.display = '';
      roleSelect.value = user.role;
    }
  }
  
  if (statusSelect) statusSelect.value = user.status;
  
  // Reinitialize dropdowns (use display role for UI)
  initializeUserDetailsDropdowns(displayRole, user.status);
  
  // Load site assignments
  await loadUserSiteAssignments(userId);
  
  // Load job stats
  const stats = await getUserJobStats(userId);
  document.getElementById('user-jobs-count').textContent = stats.total;
  document.getElementById('user-jobs-completed').textContent = stats.completed;
  document.getElementById('user-sites-count').textContent = stats.sites;
  
  // Show modal
  const modal = document.getElementById('userDetailsModal');
  modal.classList.remove('hidden');
  modal.classList.add('flex');
  
  if (window.lucide) lucide.createIcons();
};

// Load user site assignments
async function loadUserSiteAssignments(userId) {
  const assignments = await getUserSiteAssignments(userId);
  const list = document.getElementById('user-site-assignments-list');
  
  if (!list) return;
  
  if (assignments.length === 0) {
    list.innerHTML = '<p class="text-gray-500 text-sm">No sites assigned</p>';
    return;
  }
  
  // Get site details
  const sites = JSON.parse(localStorage.getItem('nfg_sites') || '[]');
  
  list.innerHTML = assignments.map(assignment => {
    const site = sites.find(s => s.id == assignment.site_id);
    const siteName = site ? site.name : `Site #${assignment.site_id}`;
    
    return `
      <div class="flex items-center justify-between p-3 bg-nfglight/30 border border-nfgblue/20 rounded-xl">
        <div class="flex items-center gap-2">
          <i data-lucide="map-pin" class="w-4 h-4 text-nfgblue"></i>
          <div>
            <p class="font-medium text-nfgblue">${siteName}</p>
            <p class="text-xs text-gray-500 dark:text-gray-400">${assignment.can_manage ? '🔧 Can manage' : '👁️ View only'}</p>
          </div>
        </div>
        <button 
          onclick="removeSiteAssignment('${assignment.id}')"
          class="p-1.5 rounded-lg hover:bg-red-100 text-red-600"
          title="Remove assignment">
          <i data-lucide="x" class="w-4 h-4"></i>
        </button>
      </div>
    `;
  }).join('');
  
  if (window.lucide) lucide.createIcons();
}

// Make loadUserSiteAssignments available globally
window.loadUserSiteAssignments = loadUserSiteAssignments;

// Generate random token
function generateToken() {
  return Array.from(crypto.getRandomValues(new Uint8Array(32)))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

// Copy invitation link
window.copyInvitationLink = async function(token) {
  const link = `${window.location.origin}/accept-invitation.html?token=${token}`;
  try {
    await navigator.clipboard.writeText(link);
    toast.success('Invitation link copied to clipboard!');
  } catch (error) {
    // Fallback if clipboard API fails
    const result = await showPrompt('Copy this invitation link:', link);
    if (result) {
      toast.info('Please manually copy the link');
    }
  }
};

// Cancel invitation
window.cancelInvite = async function(invitationId) {
  const confirmed = await showConfirm(
    'Cancel Invitation',
    'Are you sure you want to cancel this invitation?'
  );
  
  if (!confirmed) return;
  
  try {
    await cancelInvitation(invitationId);
    await renderPendingInvitations();
    toast.success('Invitation cancelled');
  } catch (error) {
    toast.error('Failed to cancel invitation. Please try again.');
  }
};

// Remove site assignment
window.removeSiteAssignment = async function(assignmentId) {
  const confirmed = await showConfirm(
    'Remove Assignment',
    'Are you sure you want to remove this site assignment?'
  );
  
  if (!confirmed) return;
  
  try {
    await removeUserFromSite(assignmentId);
    await loadUserSiteAssignments(selectedUserId);
    toast.success('Site assignment removed');
  } catch (error) {
    toast.error('Failed to remove assignment: ' + error.message);
  }
};

// Initialize user details dropdowns
function initializeUserDetailsDropdowns(currentRole, currentStatus) {
  // Role dropdown
  const roleSelect = document.getElementById('user-detail-role-select');
  if (roleSelect) {
    const roleWrapper = roleSelect.previousElementSibling;
    if (roleWrapper && roleWrapper.classList.contains('nfg-select-wrapper')) {
      roleWrapper.remove();
    }
    roleSelect.style.display = '';
    roleSelect.value = currentRole;
    new NFGDropdown(roleSelect);
  }
  
  // Status dropdown
  const statusSelect = document.getElementById('user-detail-status-select');
  if (statusSelect) {
    const statusWrapper = statusSelect.previousElementSibling;
    if (statusWrapper && statusWrapper.classList.contains('nfg-select-wrapper')) {
      statusWrapper.remove();
    }
    statusSelect.style.display = '';
    statusSelect.value = currentStatus;
    new NFGDropdown(statusSelect);
  }
}

export { selectedUserId };
