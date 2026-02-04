/**
 * Route Leads and Appointments Module
 * Handles lead and appointment creation from door visits
 */

import { supabase } from './supabase.js';
import { queueOperation, isOnline } from './offline-sync.js';

/**
 * Create a lead from a door visit
 */
export async function createLeadFromVisit(doorVisitId, leadData) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    // Get door visit details
    const { data: visit, error: visitError } = await supabase
      .from('door_visits')
      .select(`
        *,
        door_target:door_targets(*),
        route:routes(*)
      `)
      .eq('id', doorVisitId)
      .single();

    if (visitError) throw visitError;
    if (!visit) throw new Error('Door visit not found');

    const lead = {
      door_visit_id: doorVisitId,
      route_id: visit.route_id,
      door_target_id: visit.door_target_id,
      first_name: leadData.first_name || null,
      last_name: leadData.last_name || null,
      email: leadData.email || null,
      phone: leadData.phone || null,
      address: visit.door_target?.address || leadData.address,
      city: visit.door_target?.city || leadData.city || null,
      state_province: visit.door_target?.state_province || leadData.state_province || null,
      postal_code: visit.door_target?.postal_code || leadData.postal_code || null,
      country: visit.door_target?.country || leadData.country || 'US',
      property_type: visit.door_target?.property_type || leadData.property_type || null,
      status: 'new',
      source: 'door_to_door',
      notes: leadData.notes || visit.note || null,
      created_by: user.id
    };

    if (!isOnline()) {
      return await queueOperation('leads', 'create', lead);
    }

    const { data, error } = await supabase
      .from('leads')
      .insert(lead)
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('[RouteLeads] Error creating lead:', error);
    throw error;
  }
}

/**
 * Create an appointment from a door visit
 */
export async function createAppointmentFromVisit(doorVisitId, appointmentData) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    // Get door visit details
    const { data: visit, error: visitError } = await supabase
      .from('door_visits')
      .select(`
        *,
        door_target:door_targets(*),
        route:routes(*)
      `)
      .eq('id', doorVisitId)
      .single();

    if (visitError) throw visitError;
    if (!visit) throw new Error('Door visit not found');

    // Check if lead exists, create if not
    let leadId = appointmentData.lead_id || null;
    if (!leadId) {
      const { data: existingLead } = await supabase
        .from('leads')
        .select('id')
        .eq('door_visit_id', doorVisitId)
        .single();

      if (!existingLead) {
        // Create lead first
        const lead = await createLeadFromVisit(doorVisitId, {
          first_name: appointmentData.first_name,
          last_name: appointmentData.last_name,
          email: appointmentData.email,
          phone: appointmentData.phone,
          notes: appointmentData.notes
        });
        leadId = lead.id;
      } else {
        leadId = existingLead.id;
      }
    }

    const appointment = {
      lead_id: leadId,
      door_visit_id: doorVisitId,
      route_id: visit.route_id,
      scheduled_date: appointmentData.scheduled_date,
      scheduled_time: appointmentData.scheduled_time || null,
      duration_minutes: appointmentData.duration_minutes || 30,
      status: 'scheduled',
      location_type: appointmentData.location_type || 'on_site',
      address: visit.door_target?.address || appointmentData.address || null,
      notes: appointmentData.notes || null,
      created_by: user.id
    };

    if (!isOnline()) {
      return await queueOperation('appointments', 'create', appointment);
    }

    const { data, error } = await supabase
      .from('appointments')
      .insert(appointment)
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('[RouteLeads] Error creating appointment:', error);
    throw error;
  }
}

/**
 * Fetch leads for a route
 */
export async function fetchRouteLeads(routeId) {
  try {
    const { data, error } = await supabase
      .from('leads')
      .select(`
        *,
        door_visit:door_visits(*),
        created_by_user:user_profiles!leads_created_by_fkey(id, full_name, email)
      `)
      .eq('route_id', routeId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('[RouteLeads] Error fetching route leads:', error);
    return [];
  }
}

/**
 * Fetch appointments for a route
 */
export async function fetchRouteAppointments(routeId) {
  try {
    const { data, error } = await supabase
      .from('appointments')
      .select(`
        *,
        lead:leads(*),
        door_visit:door_visits(*),
        created_by_user:user_profiles!appointments_created_by_fkey(id, full_name, email)
      `)
      .eq('route_id', routeId)
      .order('scheduled_date', { ascending: true });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('[RouteLeads] Error fetching route appointments:', error);
    return [];
  }
}

/**
 * Fetch follow-up tasks for a route
 */
export async function fetchRouteFollowUpTasks(routeId) {
  try {
    const { data, error } = await supabase
      .from('follow_up_tasks')
      .select(`
        *,
        door_visit:door_visits(*),
        lead:leads(*),
        assigned_to_user:user_profiles!follow_up_tasks_assigned_to_fkey(id, full_name, email),
        created_by_user:user_profiles!follow_up_tasks_created_by_fkey(id, full_name, email)
      `)
      .eq('route_id', routeId)
      .order('due_date', { ascending: true });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('[RouteLeads] Error fetching follow-up tasks:', error);
    return [];
  }
}

/**
 * Update lead status
 */
export async function updateLeadStatus(leadId, status) {
  try {
    if (!isOnline()) {
      return await queueOperation('leads', 'update', { status }, leadId);
    }

    const { data, error } = await supabase
      .from('leads')
      .update({ status })
      .eq('id', leadId)
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('[RouteLeads] Error updating lead status:', error);
    throw error;
  }
}

/**
 * Update appointment status
 */
export async function updateAppointmentStatus(appointmentId, status) {
  try {
    if (!isOnline()) {
      return await queueOperation('appointments', 'update', { status }, appointmentId);
    }

    const { data, error } = await supabase
      .from('appointments')
      .update({ status })
      .eq('id', appointmentId)
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('[RouteLeads] Error updating appointment status:', error);
    throw error;
  }
}
