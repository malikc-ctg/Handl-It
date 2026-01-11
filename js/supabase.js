// NFG One — Supabase Client Initialization
// Reads env vars from window.ENV (injected by each page)

// @ts-ignore - CDN import, TypeScript cannot resolve
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

export const SUPABASE_URL = window.ENV?.SUPABASE_URL || 'https://zqcbldgheimqrnqmbbed.supabase.co'
export const SUPABASE_ANON_KEY = window.ENV?.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpxY2JsZGdoZWltcXJucW1iYmVkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA3MDM5NjIsImV4cCI6MjA3NjI3OTk2Mn0.UYlnTQeCjNLed6g9oNRLQIXD69OgzRrXupl3LXUvh4I'

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_ANON_KEY')
  console.error('📋 window.ENV:', window.ENV)
} else {
  console.log('✅ Supabase config loaded:', {
    url: SUPABASE_URL,
    hasKey: !!SUPABASE_ANON_KEY,
    keyLength: SUPABASE_ANON_KEY.length
  })
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

console.log('✅ Supabase client initialized')
