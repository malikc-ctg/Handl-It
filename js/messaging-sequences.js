// ============================================
// Messaging & Sequences Client Library
// ============================================
// Client-side functions for managing sequences, templates, and enrollments
// ============================================

import { supabase } from './supabase.js'

// ============================================
// SEQUENCE MANAGEMENT
// ============================================

/**
 * Enroll a site/deal in a sequence
 * @param {string} sequenceId - The sequence ID
 * @param {string} entityType - 'site', 'booking', etc.
 * @param {string} entityId - The entity ID
 * @param {Object} options - { recipientEmail, recipientPhone, recipientName, metadata }
 * @returns {Promise<Object>} Enrollment object
 */
export async function enrollInSequence(sequenceId, entityType, entityId, options = {}) {
  try {
    const { data, error } = await supabase
      .from('sequence_enrollments')
      .insert({
        sequence_id: sequenceId,
        entity_type: entityType,
        entity_id: entityId,
        recipient_email: options.recipientEmail,
        recipient_phone: options.recipientPhone,
        recipient_name: options.recipientName,
        metadata: options.metadata || {},
        status: 'active',
      })
      .select()
      .single()

    if (error) throw error

    // Enqueue first step immediately
    await enqueueNextStep(data.id)

    return { success: true, enrollment: data }
  } catch (error) {
    console.error('Error enrolling in sequence:', error)
    throw error
  }
}

/**
 * Pause a sequence enrollment
 * @param {string} enrollmentId - The enrollment ID
 * @returns {Promise<Object>}
 */
export async function pauseSequence(enrollmentId) {
  try {
    const { data, error } = await supabase
      .from('sequence_enrollments')
      .update({
        status: 'paused',
        paused_at: new Date().toISOString(),
      })
      .eq('id', enrollmentId)
      .select()
      .single()

    if (error) throw error

    return { success: true, enrollment: data }
  } catch (error) {
    console.error('Error pausing sequence:', error)
    throw error
  }
}

/**
 * Resume a paused sequence enrollment
 * @param {string} enrollmentId - The enrollment ID
 * @returns {Promise<Object>}
 */
export async function resumeSequence(enrollmentId) {
  try {
    const { data, error } = await supabase
      .from('sequence_enrollments')
      .update({
        status: 'active',
        paused_at: null,
      })
      .eq('id', enrollmentId)
      .select()
      .single()

    if (error) throw error

    return { success: true, enrollment: data }
  } catch (error) {
    console.error('Error resuming sequence:', error)
    throw error
  }
}

/**
 * Stop a sequence enrollment
 * @param {string} enrollmentId - The enrollment ID
 * @param {string} reason - Stop reason
 * @returns {Promise<Object>}
 */
export async function stopSequence(enrollmentId, reason = 'manual') {
  try {
    const { error } = await supabase.rpc('stop_sequence_enrollment', {
      enrollment_id_param: enrollmentId,
      reason: reason,
      actor_id_param: null, // Will use auth.uid() in function
    })

    if (error) throw error

    return { success: true }
  } catch (error) {
    console.error('Error stopping sequence:', error)
    throw error
  }
}

/**
 * Enqueue the next step for an enrollment
 * @param {string} enrollmentId - The enrollment ID
 * @returns {Promise<Object>}
 */
async function enqueueNextStep(enrollmentId) {
  try {
    const { data, error } = await supabase.rpc('enqueue_next_sequence_step', {
      enrollment_id_param: enrollmentId,
    })

    if (error) throw error

    return { success: true, messageId: data }
  } catch (error) {
    console.error('Error enqueueing next step:', error)
    throw error
  }
}

// ============================================
// TEMPLATE MANAGEMENT
// ============================================

/**
 * Get all templates (for admin UI)
 * @param {Object} filters - { vertical, objectionType, channel, isActive }
 * @returns {Promise<Array>}
 */
export async function getTemplates(filters = {}) {
  try {
    let query = supabase.from('message_templates').select('*')

    if (filters.vertical) {
      query = query.eq('vertical', filters.vertical)
    }
    if (filters.objectionType) {
      query = query.eq('objection_type', filters.objectionType)
    }
    if (filters.channel) {
      query = query.eq('channel', filters.channel)
    }
    if (filters.isActive !== undefined) {
      query = query.eq('is_active', filters.isActive)
    }

    const { data, error } = await query.order('created_at', { ascending: false })

    if (error) throw error

    return { success: true, templates: data || [] }
  } catch (error) {
    console.error('Error fetching templates:', error)
    throw error
  }
}

/**
 * Create a template (admin only)
 * @param {Object} templateData - Template data
 * @returns {Promise<Object>}
 */
export async function createTemplate(templateData) {
  try {
    const { data, error } = await supabase
      .from('message_templates')
      .insert({
        name: templateData.name,
        description: templateData.description,
        vertical: templateData.vertical,
        objection_type: templateData.objectionType,
        channel: templateData.channel,
        subject: templateData.subject,
        body: templateData.body,
        variables: templateData.variables || [],
        is_active: templateData.isActive !== false,
      })
      .select()
      .single()

    if (error) throw error

    return { success: true, template: data }
  } catch (error) {
    console.error('Error creating template:', error)
    throw error
  }
}

/**
 * Update a template (admin only)
 * @param {string} templateId - The template ID
 * @param {Object} updates - Fields to update
 * @returns {Promise<Object>}
 */
export async function updateTemplate(templateId, updates) {
  try {
    const { data, error } = await supabase
      .from('message_templates')
      .update(updates)
      .eq('id', templateId)
      .select()
      .single()

    if (error) throw error

    return { success: true, template: data }
  } catch (error) {
    console.error('Error updating template:', error)
    throw error
  }
}

// ============================================
// SEQUENCE QUERIES
// ============================================

/**
 * Get all sequences
 * @param {Object} filters - { vertical, isActive }
 * @returns {Promise<Array>}
 */
export async function getSequences(filters = {}) {
  try {
    let query = supabase
      .from('sequences')
      .select(`
        *,
        sequence_steps (
          *,
          template:message_templates (*)
        )
      `)

    if (filters.vertical) {
      query = query.eq('vertical', filters.vertical)
    }
    if (filters.isActive !== undefined) {
      query = query.eq('is_active', filters.isActive)
    }

    const { data, error } = await query.order('created_at', { ascending: false })

    if (error) throw error

    return { success: true, sequences: data || [] }
  } catch (error) {
    console.error('Error fetching sequences:', error)
    throw error
  }
}

/**
 * Get enrollments for an entity
 * @param {string} entityType - 'site', 'booking', etc.
 * @param {string} entityId - The entity ID
 * @returns {Promise<Array>}
 */
export async function getEntityEnrollments(entityType, entityId) {
  try {
    const { data, error } = await supabase
      .from('sequence_enrollments')
      .select(`
        *,
        sequence:sequences (*)
      `)
      .eq('entity_type', entityType)
      .eq('entity_id', entityId)
      .order('created_at', { ascending: false })

    if (error) throw error

    return { success: true, enrollments: data || [] }
  } catch (error) {
    console.error('Error fetching enrollments:', error)
    throw error
  }
}

/**
 * Get outbound messages for an enrollment
 * @param {string} enrollmentId - The enrollment ID
 * @returns {Promise<Array>}
 */
export async function getEnrollmentMessages(enrollmentId) {
  try {
    const { data, error } = await supabase
      .from('messages_outbound')
      .select('*')
      .eq('enrollment_id', enrollmentId)
      .order('created_at', { ascending: true })

    if (error) throw error

    return { success: true, messages: data || [] }
  } catch (error) {
    console.error('Error fetching messages:', error)
    throw error
  }
}

/**
 * Get inbound messages (replies)
 * @param {string} enrollmentId - Optional enrollment ID filter
 * @returns {Promise<Array>}
 */
export async function getInboundMessages(enrollmentId = null) {
  try {
    let query = supabase.from('messages_inbound').select('*').order('created_at', { ascending: false })

    if (enrollmentId) {
      query = query.eq('matched_enrollment_id', enrollmentId)
    }

    const { data, error } = await query

    if (error) throw error

    return { success: true, messages: data || [] }
  } catch (error) {
    console.error('Error fetching inbound messages:', error)
    throw error
  }
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Check if a site/deal has an active sequence
 * @param {string} entityType - 'site', 'booking', etc.
 * @param {string} entityId - The entity ID
 * @returns {Promise<boolean>}
 */
export async function hasActiveSequence(entityType, entityId) {
  try {
    const { data, error } = await supabase
      .from('sequence_enrollments')
      .select('id')
      .eq('entity_type', entityType)
      .eq('entity_id', entityId)
      .eq('status', 'active')
      .limit(1)
      .single()

    if (error && error.code !== 'PGRST116') {
      // PGRST116 = no rows returned, which is fine
      throw error
    }

    return !!data
  } catch (error) {
    console.error('Error checking active sequence:', error)
    return false
  }
}

/**
 * Attach sequence to a site/deal (convenience function)
 * @param {string} siteId - The site ID (BIGINT)
 * @param {string} sequenceId - The sequence ID
 * @param {Object} options - { recipientEmail, recipientPhone, recipientName }
 * @returns {Promise<Object>}
 */
export async function attachSequenceToSite(siteId, sequenceId, options = {}) {
  try {
    // Get site details if needed
    let siteData = null
    if (!options.recipientEmail || !options.recipientName) {
      const { data } = await supabase
        .from('sites')
        .select('contact_email, contact_phone, name')
        .eq('id', siteId)
        .single()

      siteData = data
    }

    return await enrollInSequence(
      sequenceId,
      'site',
      siteId.toString(),
      {
        recipientEmail: options.recipientEmail || siteData?.contact_email,
        recipientPhone: options.recipientPhone || siteData?.contact_phone,
        recipientName: options.recipientName || siteData?.name,
        metadata: {
          site_name: siteData?.name,
          ...options.metadata,
        },
      }
    )
  } catch (error) {
    console.error('Error attaching sequence to site:', error)
    throw error
  }
}
