// NFG One — Auth Helper Functions
// Shared utilities for auth pages

import { supabase } from './supabase.js'

// Get URL params (handles both ?query and #fragment)
export function getQuery() {
  const url = new URL(window.location.href)
  let params = new URLSearchParams(url.search)
  
  // If fragment exists and contains tokens, parse it
  if (url.hash && (url.hash.includes('access_token') || url.hash.includes('type'))) {
    const fragment = url.hash.substring(1) // Remove #
    params = new URLSearchParams(fragment)
  }
  
  return params
}

// Extract access_token and refresh_token from URL
export function getTokenParams() {
  const params = getQuery()
  const accessToken = params.get('access_token')
  const refreshToken = params.get('refresh_token')
  
  return {
    accessToken,
    refreshToken,
    hasTokens: !!(accessToken && refreshToken)
  }
}

// Set Supabase session from URL tokens
export async function setSessionFromUrl() {
  try {
    const { accessToken, refreshToken, hasTokens } = getTokenParams()
    
    if (!hasTokens) {
      return { ok: false, error: 'No tokens found in URL' }
    }
    
    console.log('🔐 Setting session from URL tokens...')
    
    const { data, error } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken
    })
    
    if (error) {
      console.error('❌ Error setting session:', error)
      return { ok: false, error: error.message }
    }
    
    console.log('✅ Session set successfully')
    return { ok: true, data }
  } catch (error) {
    console.error('❌ Exception setting session:', error)
    return { ok: false, error: error.message || 'Failed to set session' }
  }
}

// Redirect if user is already authenticated
export async function requireNoAuth() {
  try {
    const { data: { session } } = await supabase.auth.getSession()
    if (session) {
      console.log('✅ User already authenticated, redirecting to dashboard')
      window.location.href = '/dashboard.html'
      return true
    }
    return false
  } catch (error) {
    console.error('Error checking session:', error)
    return false
  }
}

// Show toast notification
export function showToast(type, message) {
  // Remove existing toasts
  const existing = document.querySelector('.auth-toast')
  if (existing) existing.remove()
  
  const toast = document.createElement('div')
  toast.className = 'auth-toast fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg text-white text-sm font-medium animate-fade-in'
  toast.style.animation = 'fadeIn 0.3s ease-out'
  
  if (type === 'success') {
    toast.classList.add('bg-green-600')
  } else if (type === 'error') {
    toast.classList.add('bg-red-600')
  } else {
    toast.classList.add('bg-blue-600')
  }
  
  toast.textContent = message
  document.body.appendChild(toast)
  
  // Auto-remove after 5 seconds
  setTimeout(() => {
    toast.style.animation = 'fadeOut 0.3s ease-out'
    setTimeout(() => toast.remove(), 300)
  }, 5000)
}

// Basic email validation
export function validateEmail(email) {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return re.test(email)
}

// Wrapper for async functions with error handling
export async function handleAsync(fn, errorMessage = 'An error occurred') {
  try {
    return await fn()
  } catch (error) {
    console.error('Error:', error)
    showToast('error', errorMessage)
    return null
  }
}

// Format error message for display
export function formatError(error) {
  if (typeof error === 'string') return error
  if (error?.message) return error.message
  return 'An unexpected error occurred'
}

const WELCOME_BACK_STORAGE_KEY = 'nfg_last_user_name'

/** Get the display name we saved for "Welcome back, ___" on the login page. */
export function getLastUserName() {
  try {
    return localStorage.getItem(WELCOME_BACK_STORAGE_KEY) || null
  } catch {
    return null
  }
}

/** After successful sign-in, save current user's name so login page can show "Welcome back, ___". */
export async function saveLastUserForWelcomeBack() {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user?.id) return
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('full_name, email')
      .eq('id', user.id)
      .single()
    const fullName = profile?.full_name?.trim()
    const email = profile?.email?.trim() || user?.email?.trim()
    let display = fullName
      ? fullName.split(/\s+/)[0]
      : (email ? (email.split('@')[0] || email) : null)
    if (display) {
      localStorage.setItem(WELCOME_BACK_STORAGE_KEY, display)
    }
  } catch (e) {
    console.warn('Could not save last user for welcome back:', e)
  }
}
