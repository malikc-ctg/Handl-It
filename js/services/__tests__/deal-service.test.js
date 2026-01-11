// ============================================
// Deal Service - Unit Tests
// ============================================

import { calculatePriorityScore } from '../deal-service.js';

describe('Deal Service - Priority Scoring', () => {
  describe('calculatePriorityScore', () => {
    it('should calculate high priority for high-value deals in late stage', () => {
      const deal = {
        deal_value: 50000,
        stage: 'negotiation',
        probability: 80,
        touch_count: 5,
        last_touch_at: new Date().toISOString()
      };
      
      const score = calculatePriorityScore(deal);
      expect(score).toBeGreaterThan(20); // Should be high
    });
    
    it('should calculate low priority for low-value deals in early stage', () => {
      const deal = {
        deal_value: 1000,
        stage: 'prospecting',
        probability: 10,
        touch_count: 0,
        last_touch_at: new Date().toISOString()
      };
      
      const score = calculatePriorityScore(deal);
      expect(score).toBeLessThan(5); // Should be low
    });
    
    it('should decay urgency for stale deals (no recent touch)', () => {
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 30); // 30 days ago
      
      const deal = {
        deal_value: 30000,
        stage: 'proposal',
        probability: 50,
        touch_count: 2,
        last_touch_at: oldDate.toISOString()
      };
      
      const score = calculatePriorityScore(deal);
      
      // Compare with same deal but recent touch
      const recentDeal = {
        ...deal,
        last_touch_at: new Date().toISOString()
      };
      const recentScore = calculatePriorityScore(recentDeal);
      
      expect(score).toBeLessThan(recentScore); // Stale deal should have lower score
    });
    
    it('should handle deals with null last_touch_at', () => {
      const deal = {
        deal_value: 20000,
        stage: 'qualification',
        probability: 30,
        touch_count: 1,
        last_touch_at: null
      };
      
      const score = calculatePriorityScore(deal);
      expect(score).toBeGreaterThan(0);
      expect(score).toBeLessThan(10); // Should be penalized for no touches
    });
    
    it('should increase score with more touches', () => {
      const deal1 = {
        deal_value: 25000,
        stage: 'qualification',
        probability: 40,
        touch_count: 1,
        last_touch_at: new Date().toISOString()
      };
      
      const deal2 = {
        ...deal1,
        touch_count: 10
      };
      
      const score1 = calculatePriorityScore(deal1);
      const score2 = calculatePriorityScore(deal2);
      
      expect(score2).toBeGreaterThan(score1);
    });
    
    it('should return 0 for closed_lost deals', () => {
      const deal = {
        deal_value: 50000,
        stage: 'closed_lost',
        probability: 0,
        touch_count: 10,
        last_touch_at: new Date().toISOString()
      };
      
      const score = calculatePriorityScore(deal);
      expect(score).toBe(0);
    });
  });
});
