// ============================================
// Deal Linking Tests
// Tests for auto-creation and linking of deals from quotes
// ============================================

import { describe, it, expect, beforeEach, afterEach } from 'https://esm.sh/vitest@1.0.0';
import { 
  onQuoteRevisionSent,
  onQuoteAccepted,
  onQuoteDeclined,
  findMatchingActiveDeal,
  DEAL_LINKING_CONFIG
} from '../js/services/deal-linking-service.js';
import { supabase } from '../js/supabase.js';

// Test fixtures
const testFixtures = {
  accountId: null,
  primaryContactId: null,
  ownerUserId: null,
  quoteId: null,
  revisionNumber: 1
};

describe('Deal Auto-Creation & Linking', () => {
  beforeEach(async () => {
    // Setup test data
    // Note: In a real test environment, you'd use a test database
    // For now, we'll test the logic with mock data
    
    // Create test account (site)
    const { data: site } = await supabase
      .from('sites')
      .insert({
        name: 'Test Account',
        address: '123 Test St'
      })
      .select()
      .single();
    
    testFixtures.accountId = site?.id;
    
    // Get current user
    const { data: { user } } = await supabase.auth.getUser();
    testFixtures.ownerUserId = user?.id;
  });

  afterEach(async () => {
    // Cleanup test data
    // In production tests, use transactions or test database
  });

  describe('Deduplication', () => {
    it('should link quote to existing active deal with same account and contact', async () => {
      // Create a deal first
      const { data: deal } = await supabase
        .from('deals')
        .insert({
          account_id: testFixtures.accountId,
          primary_contact_id: testFixtures.primaryContactId,
          owner_user_id: testFixtures.ownerUserId,
          stage: 'qualification',
          is_closed: false,
          source: 'manual'
        })
        .select()
        .single();

      // Create a quote
      const { data: quote } = await supabase
        .from('quotes')
        .insert({
          account_id: testFixtures.accountId,
          primary_contact_id: testFixtures.primaryContactId,
          owner_user_id: testFixtures.ownerUserId,
          quote_type: 'standard',
          status: 'draft'
        })
        .select()
        .single();

      // Create revision
      const { data: revision } = await supabase
        .from('quote_revisions')
        .insert({
          quote_id: quote.id,
          revision_number: 1,
          revision_type: 'final_quote',
          is_binding: true,
          total: 5000
        })
        .select()
        .single();

      // Send revision
      const { dealId } = await onQuoteRevisionSent(quote.id, 1);

      // Should link to existing deal, not create new one
      expect(dealId).toBe(deal.id);

      // Verify quote is linked
      const { data: updatedQuote } = await supabase
        .from('quotes')
        .select('deal_id')
        .eq('id', quote.id)
        .single();

      expect(updatedQuote.deal_id).toBe(deal.id);
    });

    it('should not link to closed deals', async () => {
      // Create a closed deal
      const { data: closedDeal } = await supabase
        .from('deals')
        .insert({
          account_id: testFixtures.accountId,
          primary_contact_id: testFixtures.primaryContactId,
          owner_user_id: testFixtures.ownerUserId,
          stage: 'closed_won',
          is_closed: true,
          closed_reason: 'won'
        })
        .select()
        .single();

      // Create a quote
      const { data: quote } = await supabase
        .from('quotes')
        .insert({
          account_id: testFixtures.accountId,
          primary_contact_id: testFixtures.primaryContactId,
          owner_user_id: testFixtures.ownerUserId,
          quote_type: 'standard',
          status: 'draft'
        })
        .select()
        .single();

      // Create revision
      await supabase
        .from('quote_revisions')
        .insert({
          quote_id: quote.id,
          revision_number: 1,
          revision_type: 'final_quote',
          is_binding: true,
          total: 5000
        });

      // Send revision - should create new deal, not link to closed one
      const { dealId, created } = await onQuoteRevisionSent(quote.id, 1);

      expect(dealId).not.toBe(closedDeal.id);
      expect(created).toBe(true);
    });
  });

  describe('Idempotency', () => {
    it('should not create duplicate deals on repeated calls', async () => {
      // Create a quote
      const { data: quote } = await supabase
        .from('quotes')
        .insert({
          account_id: testFixtures.accountId,
          primary_contact_id: testFixtures.primaryContactId,
          owner_user_id: testFixtures.ownerUserId,
          quote_type: 'standard',
          status: 'draft'
        })
        .select()
        .single();

      // Create revision
      await supabase
        .from('quote_revisions')
        .insert({
          quote_id: quote.id,
          revision_number: 1,
          revision_type: 'final_quote',
          is_binding: true,
          total: 5000
        });

      // Send revision first time
      const { dealId: dealId1 } = await onQuoteRevisionSent(quote.id, 1);

      // Send revision second time (should be idempotent)
      const { dealId: dealId2 } = await onQuoteRevisionSent(quote.id, 1);

      // Should return same deal ID
      expect(dealId1).toBe(dealId2);

      // Verify only one deal exists
      const { data: deals } = await supabase
        .from('deals')
        .select('id')
        .eq('account_id', testFixtures.accountId)
        .eq('is_closed', false);

      expect(deals.length).toBe(1);
    });
  });

  describe('Stage Mapping', () => {
    it('should set correct stage for walkthrough proposal', async () => {
      // Create a quote with walkthrough_required type
      const { data: quote } = await supabase
        .from('quotes')
        .insert({
          account_id: testFixtures.accountId,
          primary_contact_id: testFixtures.primaryContactId,
          owner_user_id: testFixtures.ownerUserId,
          quote_type: 'walkthrough_required',
          status: 'draft'
        })
        .select()
        .single();

      // Create walkthrough proposal revision
      await supabase
        .from('quote_revisions')
        .insert({
          quote_id: quote.id,
          revision_number: 1,
          revision_type: 'walkthrough_proposal',
          is_binding: false
        });

      // Send revision
      const { dealId } = await onQuoteRevisionSent(quote.id, 1);

      // Check deal stage
      const { data: deal } = await supabase
        .from('deals')
        .select('stage')
        .eq('id', dealId)
        .single();

      // Should map to 'prospecting' stage (or configured stage)
      expect(deal.stage).toBe('prospecting');
    });

    it('should set correct stage for final quote', async () => {
      // Create a quote
      const { data: quote } = await supabase
        .from('quotes')
        .insert({
          account_id: testFixtures.accountId,
          primary_contact_id: testFixtures.primaryContactId,
          owner_user_id: testFixtures.ownerUserId,
          quote_type: 'standard',
          status: 'draft'
        })
        .select()
        .single();

      // Create final quote revision
      await supabase
        .from('quote_revisions')
        .insert({
          quote_id: quote.id,
          revision_number: 1,
          revision_type: 'final_quote',
          is_binding: true,
          total: 5000
        });

      // Send revision
      const { dealId } = await onQuoteRevisionSent(quote.id, 1);

      // Check deal stage
      const { data: deal } = await supabase
        .from('deals')
        .select('stage')
        .eq('id', dealId)
        .single();

      // Should map to 'proposal' stage
      expect(deal.stage).toBe('proposal');
    });
  });

  describe('Value Precedence', () => {
    it('should use binding total over non-binding range', async () => {
      // Create a quote
      const { data: quote } = await supabase
        .from('quotes')
        .insert({
          account_id: testFixtures.accountId,
          primary_contact_id: testFixtures.primaryContactId,
          owner_user_id: testFixtures.ownerUserId,
          quote_type: 'standard',
          status: 'draft'
        })
        .select()
        .single();

      // Create revision with binding total
      await supabase
        .from('quote_revisions')
        .insert({
          quote_id: quote.id,
          revision_number: 1,
          revision_type: 'final_quote',
          is_binding: true,
          total: 5000
        });

      // Send revision
      const { dealId } = await onQuoteRevisionSent(quote.id, 1);

      // Check deal value
      const { data: deal } = await supabase
        .from('deals')
        .select('deal_value, value_type')
        .eq('id', dealId)
        .single();

      expect(deal.deal_value).toBe(5000);
      expect(deal.value_type).toBe('binding');
    });

    it('should not overwrite binding value with non-binding range', async () => {
      // Create a deal with binding value
      const { data: deal } = await supabase
        .from('deals')
        .insert({
          account_id: testFixtures.accountId,
          primary_contact_id: testFixtures.primaryContactId,
          owner_user_id: testFixtures.ownerUserId,
          stage: 'qualification',
          deal_value: 5000,
          value_type: 'binding',
          is_closed: false
        })
        .select()
        .single();

      // Create a quote linked to this deal
      const { data: quote } = await supabase
        .from('quotes')
        .insert({
          account_id: testFixtures.accountId,
          primary_contact_id: testFixtures.primaryContactId,
          owner_user_id: testFixtures.ownerUserId,
          deal_id: deal.id,
          quote_type: 'standard',
          status: 'draft'
        })
        .select()
        .single();

      // Create revision with non-binding range
      await supabase
        .from('quote_revisions')
        .insert({
          quote_id: quote.id,
          revision_number: 1,
          revision_type: 'walkthrough_proposal',
          is_binding: false
        });

      // Add line items with range
      await supabase
        .from('quote_line_items')
        .insert({
          quote_id: quote.id,
          revision_number: 1,
          name: 'Service',
          unit: 'range',
          range_low: 3000,
          range_high: 4000,
          display_order: 0
        });

      // Send revision
      await onQuoteRevisionSent(quote.id, 1);

      // Check deal value - should still be binding
      const { data: updatedDeal } = await supabase
        .from('deals')
        .select('deal_value, value_type')
        .eq('id', deal.id)
        .single();

      expect(updatedDeal.deal_value).toBe(5000);
      expect(updatedDeal.value_type).toBe('binding');
    });
  });

  describe('Quote Accepted', () => {
    it('should mark deal as Won when quote is accepted', async () => {
      // Create a quote and deal
      const { data: quote } = await supabase
        .from('quotes')
        .insert({
          account_id: testFixtures.accountId,
          primary_contact_id: testFixtures.primaryContactId,
          owner_user_id: testFixtures.ownerUserId,
          quote_type: 'standard',
          status: 'sent'
        })
        .select()
        .single();

      // Create revision
      await supabase
        .from('quote_revisions')
        .insert({
          quote_id: quote.id,
          revision_number: 1,
          revision_type: 'final_quote',
          is_binding: true,
          total: 5000
        });

      // Send revision to create/link deal
      const { dealId } = await onQuoteRevisionSent(quote.id, 1);

      // Accept quote
      await onQuoteAccepted(quote.id, 1, {
        name: 'Test Signer',
        email: 'test@example.com'
      });

      // Check deal is marked as Won
      const { data: deal } = await supabase
        .from('deals')
        .select('stage, is_closed, closed_reason')
        .eq('id', dealId)
        .single();

      expect(deal.stage).toBe('closed_won');
      expect(deal.is_closed).toBe(true);
      expect(deal.closed_reason).toBe('won');
    });
  });

  describe('Quote Declined', () => {
    it('should mark deal as Lost when quote is declined', async () => {
      // Create a quote and deal
      const { data: quote } = await supabase
        .from('quotes')
        .insert({
          account_id: testFixtures.accountId,
          primary_contact_id: testFixtures.primaryContactId,
          owner_user_id: testFixtures.ownerUserId,
          quote_type: 'standard',
          status: 'sent'
        })
        .select()
        .single();

      // Create revision
      await supabase
        .from('quote_revisions')
        .insert({
          quote_id: quote.id,
          revision_number: 1,
          revision_type: 'final_quote',
          is_binding: true,
          total: 5000
        });

      // Send revision to create/link deal
      const { dealId } = await onQuoteRevisionSent(quote.id, 1);

      // Decline quote
      await onQuoteDeclined(quote.id, 1, 'Price too high');

      // Check deal is marked as Lost
      const { data: deal } = await supabase
        .from('deals')
        .select('stage, is_closed, closed_reason')
        .eq('id', dealId)
        .single();

      expect(deal.stage).toBe('closed_lost');
      expect(deal.is_closed).toBe(true);
      expect(deal.closed_reason).toBe('lost');
    });
  });

  describe('Closed Deals', () => {
    it('should not reopen Won deals with new sent quote', async () => {
      // Create a closed Won deal
      const { data: deal } = await supabase
        .from('deals')
        .insert({
          account_id: testFixtures.accountId,
          primary_contact_id: testFixtures.primaryContactId,
          owner_user_id: testFixtures.ownerUserId,
          stage: 'closed_won',
          is_closed: true,
          closed_reason: 'won'
        })
        .select()
        .single();

      // Create a new quote
      const { data: quote } = await supabase
        .from('quotes')
        .insert({
          account_id: testFixtures.accountId,
          primary_contact_id: testFixtures.primaryContactId,
          owner_user_id: testFixtures.ownerUserId,
          deal_id: deal.id,
          quote_type: 'standard',
          status: 'draft'
        })
        .select()
        .single();

      // Create revision
      await supabase
        .from('quote_revisions')
        .insert({
          quote_id: quote.id,
          revision_number: 1,
          revision_type: 'final_quote',
          is_binding: true,
          total: 6000
        });

      // Send revision
      await onQuoteRevisionSent(quote.id, 1);

      // Check deal is still closed
      const { data: updatedDeal } = await supabase
        .from('deals')
        .select('stage, is_closed')
        .eq('id', deal.id)
        .single();

      expect(updatedDeal.stage).toBe('closed_won');
      expect(updatedDeal.is_closed).toBe(true);
    });
  });
});
