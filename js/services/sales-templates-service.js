/**
 * Sales Templates Service
 * CRUD for follow-up and proposal templates; merge field resolution from deal/contact/account.
 */

import { supabase } from '../supabase.js';

const TEMPLATE_TYPES = Object.freeze({ follow_up: 'follow_up', proposal: 'proposal' });
const MERGE_FIELDS = Object.freeze([
  'contact_name',
  'company_name',
  'site_name',
  'deal_value',
  'contact_email',
  'deal_title',
  'account_name'
]);

/**
 * Get current user's company id (from profile or fallback to user id)
 * @returns {Promise<string|null>}
 */
async function getCompanyId() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('company_id')
    .eq('id', user.id)
    .single();
  return profile?.company_id ?? user.id;
}

/**
 * List templates for the current company (optionally by type)
 * @param {{ templateType?: 'follow_up' | 'proposal' }} options
 * @returns {Promise<Array>}
 */
export async function listSalesTemplates(options = {}) {
  const companyId = await getCompanyId();
  let query = supabase
    .from('sales_templates')
    .select('*')
    .eq('is_active', true)
    .order('name');

  if (companyId) {
    query = query.or(`company_id.eq.${companyId},company_id.is.null`);
  } else {
    query = query.is('company_id', null);
  }
  if (options.templateType) {
    query = query.eq('template_type', options.templateType);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

/**
 * Get one template by id
 * @param {string} id
 * @returns {Promise<Object|null>}
 */
export async function getSalesTemplate(id) {
  const companyId = await getCompanyId();
  let query = supabase.from('sales_templates').select('*').eq('id', id);
  if (companyId) {
    query = query.or(`company_id.eq.${companyId},company_id.is.null`);
  }
  const { data, error } = await query.single();
  if (error) {
    if (error.code === 'PGRST116' || error.code === 'PGRST204' || error.code === '42P01') return null;
    throw error;
  }
  return data;
}

/**
 * Create a template
 * @param {Object} payload - { name, template_type, subject?, body, variables? }
 * @returns {Promise<Object>}
 */
export async function createSalesTemplate(payload) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');
  const companyId = await getCompanyId();

  const row = {
    company_id: companyId || null,
    template_type: payload.template_type,
    name: payload.name,
    subject: payload.subject ?? null,
    body: payload.body,
    variables: Array.isArray(payload.variables) ? payload.variables : [],
    is_active: payload.is_active !== false,
    created_by: user.id
  };

  const { data, error } = await supabase
    .from('sales_templates')
    .insert(row)
    .select()
    .single();
  if (error) throw error;
  return data;
}

/**
 * Update a template
 * @param {string} id
 * @param {Object} updates - { name?, subject?, body?, variables?, is_active? }
 * @returns {Promise<Object>}
 */
export async function updateSalesTemplate(id, updates) {
  const allowed = ['name', 'subject', 'body', 'variables', 'is_active'];
  const payload = {};
  for (const k of allowed) {
    if (updates[k] !== undefined) payload[k] = updates[k];
  }
  if (Object.keys(payload).length === 0) return await getSalesTemplate(id);

  const { data, error } = await supabase
    .from('sales_templates')
    .update(payload)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

/**
 * Delete a template (soft: set is_active = false, or hard delete)
 * @param {string} id
 * @param {{ soft?: boolean }} options
 */
export async function deleteSalesTemplate(id, options = { soft: true }) {
  if (options.soft) {
    return await updateSalesTemplate(id, { is_active: false });
  }
  const { error } = await supabase.from('sales_templates').delete().eq('id', id);
  if (error) throw error;
}

/**
 * Build merge context from deal (and related contact/site/account)
 * @param {Object} deal - deal with contact, site, account if loaded
 * @returns {Object} map of merge field name -> value
 */
export function buildMergeContext(deal) {
  const contact = deal?.contact || deal?.primary_contact || {};
  const site = deal?.sites || deal?.site || {};
  const account = deal?.account || {};
  const formatMoney = (v) => {
    if (v == null || v === '') return '';
    const n = Number(v);
    return isNaN(n) ? String(v) : `$${n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  };
  return {
    contact_name: contact.name || contact.full_name || (contact.first_name || contact.last_name ? [contact.first_name, contact.last_name].filter(Boolean).join(' ') : null) || contact.email || 'Valued Contact',
    company_name: account.name || account.company_name || site.name || 'Your Company',
    account_name: account.name || account.company_name || '',
    site_name: site.name || deal?.title || 'This Site',
    deal_value: formatMoney(deal?.deal_value ?? deal?.estimated_value ?? site?.deal_value),
    contact_email: contact.email || site.contact_email || '',
    deal_title: deal?.title || site?.name || 'Deal'
  };
}

/**
 * Replace merge fields in text. Supports {field} and {{field}}.
 * @param {string} text
 * @param {Object} context - map of field name -> value
 * @returns {string}
 */
export function applyMergeFields(text, context) {
  if (!text || typeof text !== 'string') return '';
  let out = text;
  const keys = Object.keys(context || {});
  for (const key of keys) {
    const value = context[key] ?? '';
    const re1 = new RegExp(`\\{\\s*${key}\\s*\\}`, 'gi');
    const re2 = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'gi');
    out = out.replace(re1, value);
    out = out.replace(re2, value);
  }
  return out;
}

/**
 * Get merged subject and body for a template with deal context
 * @param {Object} template - { subject, body }
 * @param {Object} mergeContext - from buildMergeContext(deal)
 * @returns {{ subject: string, body: string }}
 */
export function renderTemplate(template, mergeContext) {
  return {
    subject: applyMergeFields(template.subject || '', mergeContext),
    body: applyMergeFields(template.body || '', mergeContext)
  };
}

export { TEMPLATE_TYPES, MERGE_FIELDS };
