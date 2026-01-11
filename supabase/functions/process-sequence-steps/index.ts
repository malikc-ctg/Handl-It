// ============================================
// Process Sequence Steps Edge Function
// ============================================
// Processes queued messages and enqueues next sequence steps
// Called by cron job
// ============================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const results = {
      processedQueued: 0,
      enqueuedNext: 0,
      errors: [] as string[],
    }

    // 1. Process queued messages that are ready to send
    const now = new Date().toISOString()
    const { data: queuedMessages, error: queuedError } = await supabaseAdmin
      .from('messages_outbound')
      .select('id')
      .eq('status', 'queued')
      .lte('scheduled_for', now)
      .limit(50) // Process in batches

    if (!queuedError && queuedMessages) {
      for (const msg of queuedMessages) {
        try {
          // Call send-message function to send this message
          const sendResponse = await fetch(
            `${Deno.env.get('SUPABASE_URL')}/functions/v1/send-message`,
            {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ messageId: msg.id }),
            }
          )

          if (sendResponse.ok) {
            results.processedQueued++
          } else {
            results.errors.push(`Failed to send message ${msg.id}`)
          }
        } catch (error: any) {
          results.errors.push(`Error sending message ${msg.id}: ${error.message}`)
        }
      }
    }

    // 2. Find active enrollments that need next step enqueued
    // (enrollments where current step was just sent)
    const { data: enrollments, error: enrollmentError } = await supabaseAdmin
      .from('sequence_enrollments')
      .select('id, sequence_id, current_step_order')
      .eq('status', 'active')
      .limit(50)

    if (!enrollmentError && enrollments) {
      for (const enrollment of enrollments) {
        // Check if the current step has been sent (not queued)
        const { data: currentStepMessages } = await supabaseAdmin
          .from('messages_outbound')
          .select('status, sent_at')
          .eq('enrollment_id', enrollment.id)
          .order('created_at', { ascending: false })
          .limit(1)
        
        const currentStepMessage = currentStepMessages?.[0] || null

        // If last message was sent (not queued or sending), enqueue next step
        if (
          currentStepMessage &&
          currentStepMessage.status === 'sent' &&
          currentStepMessage.sent_at
        ) {
          // Check if next step should be enqueued (based on delay)
          const { data: nextSteps } = await supabaseAdmin
            .from('sequence_steps')
            .select('id, delay_days, delay_hours')
            .eq('sequence_id', enrollment.sequence_id)
            .gt('step_order', enrollment.current_step_order)
            .eq('is_active', true)
            .order('step_order', { ascending: true })
            .limit(1)
          
          const nextStep = nextSteps?.[0] || null

          if (nextStep) {
            // Calculate when next step should be sent
            const delayMs =
              (nextStep.delay_days || 0) * 24 * 60 * 60 * 1000 +
              (nextStep.delay_hours || 0) * 60 * 60 * 1000
            const nextSendTime = new Date(
              new Date(currentStepMessage.sent_at).getTime() + delayMs
            )

            // Only enqueue if delay has passed
            if (nextSendTime <= new Date()) {
              try {
                // Call the database function to enqueue next step
                const { data, error } = await supabaseAdmin.rpc(
                  'enqueue_next_sequence_step',
                  { enrollment_id_param: enrollment.id }
                )

                if (!error) {
                  results.enqueuedNext++
                } else {
                  results.errors.push(
                    `Failed to enqueue next step for enrollment ${enrollment.id}: ${error.message}`
                  )
                }
              } catch (error: any) {
                results.errors.push(
                  `Error enqueueing next step for enrollment ${enrollment.id}: ${error.message}`
                )
              }
            }
          }
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        ...results,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error: any) {
    console.error('Error processing sequence steps:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
