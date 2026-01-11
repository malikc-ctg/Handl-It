// ============================================
// Sequence Service - Follow-up Sequences with Stop Rules
// ============================================

import { supabase } from '../supabase.js';

/**
 * Get all sequences for company
 * 
 * @param {string} companyId - Company ID
 * @returns {Promise<Array>} Sequences with steps
 */
export async function getSequences(companyId = null) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');
    
    const { data, error } = await supabase
      .from('follow_up_sequences')
      .select(`
        *,
        steps:sequence_steps(*)
      `)
      .eq('company_id', companyId || user.id)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    
    // Sort steps by step_order
    (data || []).forEach(sequence => {
      if (sequence.steps) {
        sequence.steps.sort((a, b) => (a.step_order || 0) - (b.step_order || 0));
      }
    });
    
    return data || [];
  } catch (error) {
    console.error('[Sequence Service] Error fetching sequences:', error);
    throw error;
  }
}

/**
 * Create a new sequence
 * 
 * @param {Object} sequenceData - Sequence data
 * @param {Array} steps - Array of step objects
 * @returns {Promise<Object>} Created sequence
 */
export async function createSequence(sequenceData, steps = []) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');
    
    // Create sequence
    const { data: sequence, error: seqError } = await supabase
      .from('follow_up_sequences')
      .insert({
        ...sequenceData,
        company_id: user.id
      })
      .select()
      .single();
    
    if (seqError) throw seqError;
    
    // Create steps
    if (steps.length > 0) {
      const stepRecords = steps.map((step, index) => ({
        sequence_id: sequence.id,
        step_order: step.step_order || index + 1,
        action_type: step.action_type,
        delay_days: step.delay_days || 0,
        delay_hours: step.delay_hours || 0,
        subject: step.subject || null,
        body: step.body || null,
        metadata: step.metadata || {}
      }));
      
      const { error: stepsError } = await supabase
        .from('sequence_steps')
        .insert(stepRecords);
      
      if (stepsError) throw stepsError;
    }
    
    return await getSequenceDetails(sequence.id);
  } catch (error) {
    console.error('[Sequence Service] Error creating sequence:', error);
    throw error;
  }
}

/**
 * Get sequence details with steps
 * 
 * @param {string} sequenceId - Sequence ID
 * @returns {Promise<Object>} Sequence with steps
 */
export async function getSequenceDetails(sequenceId) {
  try {
    const { data, error } = await supabase
      .from('follow_up_sequences')
      .select(`
        *,
        steps:sequence_steps(*)
      `)
      .eq('id', sequenceId)
      .single();
    
    if (error) throw error;
    
    // Sort steps
    if (data.steps) {
      data.steps.sort((a, b) => (a.step_order || 0) - (b.step_order || 0));
    }
    
    return data;
  } catch (error) {
    console.error('[Sequence Service] Error fetching sequence:', error);
    throw error;
  }
}

/**
 * Start a sequence for a deal
 * 
 * @param {string} sequenceId - Sequence ID
 * @param {string} dealId - Deal ID
 * @returns {Promise<Object>} Sequence execution
 */
export async function startSequence(sequenceId, dealId) {
  try {
    // Get sequence to calculate next execution time
    const sequence = await getSequenceDetails(sequenceId);
    
    if (!sequence.enabled) {
      throw new Error('Sequence is not enabled');
    }
    
    // Get first step
    const firstStep = sequence.steps?.[0];
    if (!firstStep) {
      throw new Error('Sequence has no steps');
    }
    
    // Calculate next execution time
    const now = new Date();
    const nextExecution = new Date(now);
    nextExecution.setDate(nextExecution.getDate() + (firstStep.delay_days || 0));
    nextExecution.setHours(nextExecution.getHours() + (firstStep.delay_hours || 0));
    
    // Create execution record
    const { data, error } = await supabase
      .from('sequence_executions')
      .insert({
        sequence_id: sequenceId,
        deal_id: dealId,
        current_step: 0,
        status: 'active',
        next_execution_at: nextExecution.toISOString()
      })
      .select()
      .single();
    
    if (error) throw error;
    
    // Create event
    await supabase
      .from('deal_events')
      .insert({
        deal_id: dealId,
        event_type: 'sequence_started',
        new_value: { sequence_id: sequenceId }
      });
    
    // Schedule first step execution (would typically be a cron job or scheduled task)
    // For now, this is just a record - actual execution would be handled by a background job
    
    return data;
  } catch (error) {
    console.error('[Sequence Service] Error starting sequence:', error);
    throw error;
  }
}

/**
 * Stop a sequence execution
 * 
 * @param {string} executionId - Execution ID
 * @param {string} reason - Stop reason
 * @returns {Promise<Object>} Updated execution
 */
export async function stopSequence(executionId, reason = null) {
  try {
    const { data, error } = await supabase
      .from('sequence_executions')
      .update({
        status: 'stopped',
        stopped_reason: reason,
        updated_at: new Date().toISOString()
      })
      .eq('id', executionId)
      .select()
      .single();
    
    if (error) throw error;
    
    // Create event
    await supabase
      .from('deal_events')
      .insert({
        deal_id: data.deal_id,
        event_type: 'sequence_stopped',
        new_value: { sequence_id: data.sequence_id, reason }
      });
    
    return data;
  } catch (error) {
    console.error('[Sequence Service] Error stopping sequence:', error);
    throw error;
  }
}

/**
 * Check stop rules for a sequence execution
 * 
 * @param {Object} execution - Sequence execution record
 * @param {Object} sequence - Sequence record
 * @param {Object} deal - Deal record
 * @returns {Object} Stop rule result
 */
export function checkStopRules(execution, sequence, deal) {
  // Stop on reply
  if (sequence.stop_on_reply) {
    // Check for recent inbound messages (would need to query deal_messages)
    // For now, return false (not stopped)
  }
  
  // Stop on stage change
  if (sequence.stop_on_stage_change) {
    // Check if deal stage changed from trigger stage
    if (deal.stage !== sequence.trigger_stage) {
      return {
        shouldStop: true,
        reason: 'Stage changed from trigger stage'
      };
    }
  }
  
  // Stop after N attempts
  if (sequence.max_attempts && execution.attempt_count >= sequence.max_attempts) {
    return {
      shouldStop: true,
      reason: `Maximum attempts (${sequence.max_attempts}) reached`
    };
  }
  
  return {
    shouldStop: false,
    reason: null
  };
}

/**
 * Execute next step in a sequence
 * This would typically be called by a scheduled job/cron
 * 
 * @param {string} executionId - Execution ID
 * @returns {Promise<Object>} Execution result
 */
export async function executeNextStep(executionId) {
  try {
    // Get execution with sequence and deal
    const { data: execution, error: execError } = await supabase
      .from('sequence_executions')
      .select(`
        *,
        sequence:follow_up_sequences(*),
        deal:deals(*)
      `)
      .eq('id', executionId)
      .single();
    
    if (execError) throw execError;
    
    if (execution.status !== 'active') {
      throw new Error('Sequence execution is not active');
    }
    
    // Check stop rules
    const stopCheck = checkStopRules(execution, execution.sequence, execution.deal);
    if (stopCheck.shouldStop) {
      await stopSequence(executionId, stopCheck.reason);
      return { stopped: true, reason: stopCheck.reason };
    }
    
    // Get current step
    const steps = execution.sequence.steps || [];
    const currentStepIndex = execution.current_step;
    const currentStep = steps[currentStepIndex];
    
    if (!currentStep) {
      // Sequence complete
      await supabase
        .from('sequence_executions')
        .update({
          status: 'completed',
          updated_at: new Date().toISOString()
        })
        .eq('id', executionId);
      
      return { completed: true };
    }
    
    // Execute step action (email, call, message, task)
    // This would integrate with messaging/email system
    const actionResult = await executeStepAction(currentStep, execution.deal);
    
    // Increment attempt count
    await supabase
      .from('sequence_executions')
      .update({
        attempt_count: execution.attempt_count + 1,
        last_executed_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', executionId);
    
    // Calculate next step execution time
    const nextStepIndex = currentStepIndex + 1;
    const nextStep = steps[nextStepIndex];
    
    if (nextStep) {
      const now = new Date();
      const nextExecution = new Date(now);
      nextExecution.setDate(nextExecution.getDate() + (nextStep.delay_days || 0));
      nextExecution.setHours(nextExecution.getHours() + (nextStep.delay_hours || 0));
      
      await supabase
        .from('sequence_executions')
        .update({
          current_step: nextStepIndex,
          next_execution_at: nextExecution.toISOString()
        })
        .eq('id', executionId);
    } else {
      // No more steps
      await supabase
        .from('sequence_executions')
        .update({
          status: 'completed',
          updated_at: new Date().toISOString()
        })
        .eq('id', executionId);
    }
    
    return {
      executed: true,
      step: currentStep,
      actionResult
    };
  } catch (error) {
    console.error('[Sequence Service] Error executing step:', error);
    throw error;
  }
}

/**
 * Execute a step action
 * 
 * @param {Object} step - Step record
 * @param {Object} deal - Deal record
 * @returns {Promise<Object>} Action result
 */
async function executeStepAction(step, deal) {
  switch (step.action_type) {
    case 'email':
      // TODO: Send email via email service
      // This would integrate with the messaging/email system
      return { type: 'email', sent: true };
    
    case 'call':
      // TODO: Create call task/reminder
      return { type: 'call', created: true };
    
    case 'message':
      // Create message in deal_messages
      const { data: message, error } = await supabase
        .from('deal_messages')
        .insert({
          deal_id: deal.id,
          direction: 'outbound',
          channel: 'email', // or sms, etc.
          subject: step.subject,
          body: step.body
        })
        .select()
        .single();
      
      if (error) throw error;
      
      return { type: 'message', message_id: message.id };
    
    case 'task':
      // TODO: Create task/reminder
      return { type: 'task', created: true };
    
    default:
      throw new Error(`Unknown action type: ${step.action_type}`);
  }
}

/**
 * Get active sequence executions that need to run
 * (For scheduled job to query)
 * 
 * @returns {Promise<Array>} Executions ready to run
 */
export async function getExecutionsReadyToRun() {
  try {
    const now = new Date().toISOString();
    
    const { data, error } = await supabase
      .from('sequence_executions')
      .select(`
        *,
        sequence:follow_up_sequences(*),
        deal:deals(*)
      `)
      .eq('status', 'active')
      .lte('next_execution_at', now)
      .order('next_execution_at', { ascending: true });
    
    if (error) throw error;
    
    return data || [];
  } catch (error) {
    console.error('[Sequence Service] Error fetching ready executions:', error);
    throw error;
  }
}
