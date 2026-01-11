// ============================================
// Quo Post-Call Workflow Processor
// ============================================
// Processes completed calls to generate:
// - AI summaries
// - Objection tags
// - Next action task suggestions
// ============================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
}

// ============================================
// Extract Objection Tags from Transcript
// ============================================

function extractObjectionTags(transcript: string, summary: string): string[] {
  const tags: string[] = []
  const text = `${transcript} ${summary}`.toLowerCase()
  
  // Common objection patterns
  const objectionPatterns = [
    { pattern: /(too expensive|price|cost|budget|afford)/i, tag: 'price_objection' },
    { pattern: /(not interested|not right time|later|maybe)/i, tag: 'not_interested' },
    { pattern: /(already have|competitor|using.*service)/i, tag: 'competitor' },
    { pattern: /(need to think|consider|discuss|talk to)/i, tag: 'needs_consideration' },
    { pattern: /(not sure|uncertain|hesitant)/i, tag: 'uncertainty' },
    { pattern: /(scheduling|timing|when|availability)/i, tag: 'scheduling' },
    { pattern: /(questions|concerns|worries)/i, tag: 'has_questions' },
    { pattern: /(interested|yes|sounds good|let.*do)/i, tag: 'interested' }
  ]
  
  for (const { pattern, tag } of objectionPatterns) {
    if (pattern.test(text) && !tags.includes(tag)) {
      tags.push(tag)
    }
  }
  
  return tags
}

// ============================================
// Generate AI Summary (Placeholder)
// ============================================

async function generateAISummary(transcript: string): Promise<string | null> {
  // TODO: Integrate with actual AI service (OpenAI, Anthropic, etc.)
  // For now, return a simple summary based on transcript length
  
  if (!transcript || transcript.length < 50) {
    return null
  }
  
  // Simple extraction: first 200 chars + key points
  const sentences = transcript.split(/[.!?]+/).filter(s => s.trim().length > 10)
  if (sentences.length === 0) return null
  
  const summary = sentences.slice(0, 3).join('. ').trim()
  return summary.length > 0 ? summary + '.' : null
}

// ============================================
// Suggest Next Action
// ============================================

function suggestNextAction(
  outcome: string,
  objectionTags: string[],
  transcript: string | null,
  summary: string | null
): string | null {
  const text = `${transcript || ''} ${summary || ''}`.toLowerCase()
  
  // If call was missed or no answer
  if (outcome === 'missed' || outcome === 'no_answer') {
    return 'Follow up with email or text message'
  }
  
  // If voicemail
  if (outcome === 'voicemail') {
    return 'Send follow-up email with call-back request'
  }
  
  // If price objection
  if (objectionTags.includes('price_objection')) {
    return 'Send pricing information and value proposition'
  }
  
  // If competitor mentioned
  if (objectionTags.includes('competitor')) {
    return 'Prepare competitive comparison document'
  }
  
  // If needs consideration
  if (objectionTags.includes('needs_consideration')) {
    return 'Schedule follow-up call in 3-5 days'
  }
  
  // If interested
  if (objectionTags.includes('interested')) {
    return 'Send proposal or schedule demo'
  }
  
  // If has questions
  if (objectionTags.includes('has_questions')) {
    return 'Send detailed information addressing questions'
  }
  
  // If scheduling mentioned
  if (objectionTags.includes('scheduling')) {
    return 'Send calendar link for scheduling'
  }
  
  // Default based on outcome
  if (outcome === 'answered') {
    return 'Send follow-up email summarizing call'
  }
  
  return null
}

// ============================================
// Process Post-Call Workflow
// ============================================

async function processPostCallWorkflow(
  supabase: any,
  callId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Get call data
    const { data: call, error: callError } = await supabase
      .from('calls')
      .select('*')
      .eq('id', callId)
      .single()
    
    if (callError || !call) {
      return { success: false, error: 'Call not found' }
    }
    
    // Only process if call is completed and has transcript or summary
    if (call.status !== 'completed' && call.outcome !== 'answered') {
      return { success: true } // Not ready for processing
    }
    
    const updates: any = {}
    
    // Generate summary if transcript exists and no summary yet
    if (call.transcript && !call.summary) {
      const summary = await generateAISummary(call.transcript)
      if (summary) {
        updates.summary = summary
      }
    }
    
    // Extract objection tags
    if (call.transcript || call.summary) {
      const objectionTags = extractObjectionTags(
        call.transcript || '',
        call.summary || ''
      )
      if (objectionTags.length > 0) {
        updates.objection_tags = objectionTags
      }
    }
    
    // Suggest next action
    const nextAction = suggestNextAction(
      call.outcome,
      updates.objection_tags || call.objection_tags || [],
      call.transcript,
      updates.summary || call.summary
    )
    
    if (nextAction) {
      updates.next_action_suggested = nextAction
    }
    
    // Update call if we have updates
    if (Object.keys(updates).length > 0) {
      await supabase
        .from('calls')
        .update(updates)
        .eq('id', callId)
      
      // Log event
      await supabase.from('call_events').insert({
        call_id: callId,
        event_type: 'post_call_workflow_processed',
        event_data: {
          summary_generated: !!updates.summary,
          objection_tags: updates.objection_tags || [],
          next_action_suggested: updates.next_action_suggested
        }
      })
    }
    
    return { success: true }
  } catch (error) {
    console.error('Error processing post-call workflow:', error)
    return { success: false, error: error.message }
  }
}

// ============================================
// Main Handler
// ============================================

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
  
  try {
    const { callId } = await req.json()
    
    if (!callId) {
      return new Response(
        JSON.stringify({ error: 'Missing callId' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    // Create Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false }
    })
    
    const result = await processPostCallWorkflow(supabase, callId)
    
    if (!result.success) {
      return new Response(
        JSON.stringify({ error: result.error || 'Processing failed' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Post-call workflow error:', error)
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
