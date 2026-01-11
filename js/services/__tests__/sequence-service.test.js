// ============================================
// Sequence Service - Unit Tests
// ============================================

import { checkStopRules } from '../sequence-service.js';

describe('Sequence Service - Stop Rules', () => {
  describe('checkStopRules', () => {
    it('should stop if stage changed from trigger stage', () => {
      const sequence = {
        trigger_stage: 'prospecting',
        stop_on_stage_change: true
      };
      
      const deal = {
        stage: 'qualification' // Changed from prospecting
      };
      
      const execution = {
        attempt_count: 2
      };
      
      const result = checkStopRules(execution, sequence, deal);
      
      expect(result.shouldStop).toBe(true);
      expect(result.reason).toContain('Stage changed');
    });
    
    it('should not stop if stage matches trigger stage', () => {
      const sequence = {
        trigger_stage: 'prospecting',
        stop_on_stage_change: true
      };
      
      const deal = {
        stage: 'prospecting' // Matches trigger
      };
      
      const execution = {
        attempt_count: 2
      };
      
      const result = checkStopRules(execution, sequence, deal);
      
      expect(result.shouldStop).toBe(false);
    });
    
    it('should stop if max attempts reached', () => {
      const sequence = {
        trigger_stage: 'prospecting',
        stop_on_stage_change: false,
        max_attempts: 5
      };
      
      const deal = {
        stage: 'prospecting'
      };
      
      const execution = {
        attempt_count: 5 // Reached max
      };
      
      const result = checkStopRules(execution, sequence, deal);
      
      expect(result.shouldStop).toBe(true);
      expect(result.reason).toContain('Maximum attempts');
    });
    
    it('should not stop if attempts below max', () => {
      const sequence = {
        trigger_stage: 'prospecting',
        stop_on_stage_change: false,
        max_attempts: 5
      };
      
      const deal = {
        stage: 'prospecting'
      };
      
      const execution = {
        attempt_count: 3 // Below max
      };
      
      const result = checkStopRules(execution, sequence, deal);
      
      expect(result.shouldStop).toBe(false);
    });
    
    it('should not stop if max_attempts is null', () => {
      const sequence = {
        trigger_stage: 'prospecting',
        stop_on_stage_change: false,
        max_attempts: null
      };
      
      const deal = {
        stage: 'prospecting'
      };
      
      const execution = {
        attempt_count: 100 // Even very high, shouldn't stop
      };
      
      const result = checkStopRules(execution, sequence, deal);
      
      expect(result.shouldStop).toBe(false);
    });
    
    it('should prioritize stage change over max attempts', () => {
      const sequence = {
        trigger_stage: 'prospecting',
        stop_on_stage_change: true,
        max_attempts: 10
      };
      
      const deal = {
        stage: 'qualification' // Changed
      };
      
      const execution = {
        attempt_count: 3 // Below max
      };
      
      const result = checkStopRules(execution, sequence, deal);
      
      expect(result.shouldStop).toBe(true);
      expect(result.reason).toContain('Stage changed'); // Not max attempts
    });
  });
});
