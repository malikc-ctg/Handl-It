/**
 * Example Edge Function: Store Call Recording
 * Demonstrates RBAC and compliance enforcement
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import {
  authenticateRequest,
  requireAuth,
  checkCallConsent,
  emitAuditLog,
  errorResponse,
  successResponse,
  handleCORS,
} from '../_shared/rbac-middleware.ts'

serve(async (req) => {
  // Handle CORS preflight
  const cors = handleCORS(req)
  if (cors) return cors

  try {
    // Authenticate request
    const context = requireAuth(await authenticateRequest(req))
    
    // Get Supabase admin client for server operations
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        global: {
          headers: {
            Authorization: req.headers.get('Authorization') ?? '',
          },
        },
      }
    )

    // Parse request body
    const { callId, recordingUrl, storagePath, duration, fileSize } = await req.json()

    // Validate inputs
    if (!callId || !recordingUrl || !storagePath) {
      return errorResponse('Missing required fields: callId, recordingUrl, storagePath', 400)
    }

    // COMPLIANCE CHECK: Verify consent before storing
    const hasConsent = await checkCallConsent(supabase, callId, 'recording')
    if (!hasConsent) {
      return errorResponse(
        'Cannot store recording: Consent not provided by participant. Recording consent must be enabled when creating the call.',
        403
      )
    }

    // Check if user has access to this call
    const { data: call, error: callError } = await supabase
      .from('calls')
      .select('id, caller_id, deal_id')
      .eq('id', callId)
      .single()

    if (callError || !call) {
      return errorResponse('Call not found', 404)
    }

    // Verify user has access (RLS will also enforce this, but we check explicitly)
    if (call.caller_id !== context.userId) {
      // Check if user is admin or manager with team access
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('role')
        .eq('id', context.userId)
        .single()

      if (profile?.role !== 'admin' && profile?.role !== 'manager') {
        return errorResponse('You do not have permission to store recordings for this call', 403)
      }
    }

    // Store the recording
    const { data: recording, error: recordingError } = await supabase
      .from('call_recordings')
      .insert({
        call_id: callId,
        recording_url: recordingUrl,
        storage_path: storagePath,
        duration: duration || null,
        file_size: fileSize || null,
        uploaded_by: context.userId,
        consent_verified: true,
      })
      .select()
      .single()

    if (recordingError) {
      console.error('Error storing recording:', recordingError)
      return errorResponse(
        `Failed to store recording: ${recordingError.message}`,
        500
      )
    }

    // AUDIT LOG: Log the recording access
    await emitAuditLog(
      supabase,
      'call.recording_access',
      context.userId!,
      'call',
      callId,
      null,
      {
        recording_id: recording.id,
        duration: recording.duration,
        action: 'upload',
      }
    )

    return successResponse({
      success: true,
      recording: {
        id: recording.id,
        call_id: recording.call_id,
        recording_url: recording.recording_url,
        uploaded_at: recording.uploaded_at,
      },
    })
  } catch (error) {
    console.error('Error in store-call-recording:', error)
    return errorResponse(
      error instanceof Error ? error.message : 'Internal server error',
      500
    )
  }
})
