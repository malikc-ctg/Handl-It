// ============================================
// Sales Portal API - Main API Interface
// ============================================
// This file provides a unified API interface for the frontend
// All sales portal operations should go through this module

import * as dealService from '../services/deal-service.js';
import * as quoteService from '../services/quote-service.js';
import * as sequenceService from '../services/sequence-service.js';
import * as eventService from '../services/event-service.js';
import * as analyticsService from '../services/analytics-service.js';

// ============================================
// DEAL API
// ============================================

export const deals = {
  /**
   * Get prioritized deal queue with pagination
   * 
   * @param {Object} options - Query options
   * @returns {Promise<{data: Array, total: number, limit: number, offset: number}>}
   */
  getQueue: async (options = {}) => {
    return await dealService.getDealQueue(options);
  },
  
  /**
   * Get single deal with full details
   * 
   * @param {string} dealId - Deal ID
   * @returns {Promise<Object>} Deal with timeline and next actions
   */
  getDetails: async (dealId) => {
    return await dealService.getDealDetails(dealId);
  },
  
  /**
   * Create a new deal
   * 
   * @param {Object} dealData - Deal data
   * @returns {Promise<Object>} Created deal
   */
  create: async (dealData) => {
    return await dealService.createDeal(dealData);
  },
  
  /**
   * Update deal stage
   * 
   * @param {string} dealId - Deal ID
   * @param {string} newStage - New stage
   * @returns {Promise<Object>} Updated deal
   */
  updateStage: async (dealId, newStage) => {
    return await dealService.updateDealStage(dealId, newStage);
  },
  
  /**
   * Close deal (won or lost)
   * 
   * @param {string} dealId - Deal ID
   * @param {string} outcome - 'won' or 'lost'
   * @returns {Promise<Object>} Updated deal
   */
  close: async (dealId, outcome) => {
    return await dealService.closeDeal(dealId, outcome);
  },
  
  /**
   * Get deal timeline
   * 
   * @param {string} dealId - Deal ID
   * @returns {Promise<Array>} Timeline entries
   */
  getTimeline: async (dealId) => {
    return await dealService.getDealTimeline(dealId);
  }
};

// ============================================
// QUOTE API
// ============================================

export const quotes = {
  /**
   * Get quote templates
   * 
   * @param {string} vertical - Filter by vertical (optional)
   * @returns {Promise<Array>} Quote templates
   */
  getTemplates: async (vertical = null) => {
    return await quoteService.getQuoteTemplates(vertical);
  },
  
  /**
   * Create a new quote
   * 
   * @param {Object} quoteData - Quote data
   * @returns {Promise<Object>} Created quote
   */
  create: async (quoteData) => {
    return await quoteService.createQuote(quoteData);
  },
  
  /**
   * Create new quote version
   * 
   * @param {string} dealId - Deal ID
   * @param {string} baseQuoteId - Base quote ID (optional)
   * @returns {Promise<Object>} New quote version
   */
  createVersion: async (dealId, baseQuoteId = null) => {
    return await quoteService.createQuoteVersion(dealId, baseQuoteId);
  },
  
  /**
   * Get quote details
   * 
   * @param {string} quoteId - Quote ID
   * @returns {Promise<Object>} Quote with line items
   */
  getDetails: async (quoteId) => {
    return await quoteService.getQuoteDetails(quoteId);
  },
  
  /**
   * Update quote
   * 
   * @param {string} quoteId - Quote ID
   * @param {Object} updates - Updates to apply
   * @param {boolean} createNewVersion - Force new version
   * @returns {Promise<Object>} Updated quote
   */
  update: async (quoteId, updates, createNewVersion = false) => {
    return await quoteService.updateQuote(quoteId, updates, createNewVersion);
  },
  
  /**
   * Send quote
   * 
   * @param {string} quoteId - Quote ID
   * @returns {Promise<Object>} Updated quote
   */
  send: async (quoteId) => {
    return await quoteService.sendQuote(quoteId);
  },
  
  /**
   * Mark quote as viewed
   * 
   * @param {string} quoteId - Quote ID
   * @returns {Promise<Object>} Updated quote
   */
  markViewed: async (quoteId) => {
    return await quoteService.markQuoteViewed(quoteId);
  },
  
  /**
   * Accept or reject quote
   * 
   * @param {string} quoteId - Quote ID
   * @param {string} action - 'accepted' or 'rejected'
   * @returns {Promise<Object>} Updated quote
   */
  respond: async (quoteId, action) => {
    return await quoteService.respondToQuote(quoteId, action);
  },
  
  /**
   * Get all quotes for a deal
   * 
   * @param {string} dealId - Deal ID
   * @returns {Promise<Array>} All quotes
   */
  getDealQuotes: async (dealId) => {
    return await quoteService.getDealQuotes(dealId);
  }
};

// ============================================
// SEQUENCE API
// ============================================

export const sequences = {
  /**
   * Get all sequences
   * 
   * @param {string} companyId - Company ID (optional)
   * @returns {Promise<Array>} Sequences with steps
   */
  getAll: async (companyId = null) => {
    return await sequenceService.getSequences(companyId);
  },
  
  /**
   * Get sequence details
   * 
   * @param {string} sequenceId - Sequence ID
   * @returns {Promise<Object>} Sequence with steps
   */
  getDetails: async (sequenceId) => {
    return await sequenceService.getSequenceDetails(sequenceId);
  },
  
  /**
   * Create sequence
   * 
   * @param {Object} sequenceData - Sequence data
   * @param {Array} steps - Array of step objects
   * @returns {Promise<Object>} Created sequence
   */
  create: async (sequenceData, steps = []) => {
    return await sequenceService.createSequence(sequenceData, steps);
  },
  
  /**
   * Start sequence for a deal
   * 
   * @param {string} sequenceId - Sequence ID
   * @param {string} dealId - Deal ID
   * @returns {Promise<Object>} Sequence execution
   */
  start: async (sequenceId, dealId) => {
    return await sequenceService.startSequence(sequenceId, dealId);
  },
  
  /**
   * Stop sequence execution
   * 
   * @param {string} executionId - Execution ID
   * @param {string} reason - Stop reason
   * @returns {Promise<Object>} Updated execution
   */
  stop: async (executionId, reason = null) => {
    return await sequenceService.stopSequence(executionId, reason);
  }
};

// ============================================
// EVENT API
// ============================================

export const events = {
  /**
   * Log a call
   * 
   * @param {Object} callData - Call data
   * @returns {Promise<Object>} Created call
   */
  logCall: async (callData) => {
    return await eventService.logCall(callData);
  },
  
  /**
   * Log a door visit
   * 
   * @param {Object} visitData - Visit data
   * @returns {Promise<Object>} Created visit
   */
  logVisit: async (visitData) => {
    return await eventService.logDoorVisit(visitData);
  },
  
  /**
   * Log a message
   * 
   * @param {Object} messageData - Message data
   * @returns {Promise<Object>} Created message
   */
  logMessage: async (messageData) => {
    return await eventService.logMessage(messageData);
  },
  
  /**
   * Get deal events
   * 
   * @param {string} dealId - Deal ID
   * @param {Object} options - Query options
   * @returns {Promise<Array>} Events
   */
  getDealEvents: async (dealId, options = {}) => {
    return await eventService.getDealEvents(dealId, options);
  }
};

// ============================================
// ANALYTICS API
// ============================================

export const analytics = {
  /**
   * Get sales funnel analytics
   * 
   * @param {Object} options - Query options
   * @returns {Promise<Object>} Funnel analytics
   */
  getFunnel: async (options = {}) => {
    return await analyticsService.getSalesFunnelAnalytics(options);
  },
  
  /**
   * Get funnel breakdown by stage
   * 
   * @param {Object} options - Query options
   * @returns {Promise<Object>} Funnel breakdown
   */
  getBreakdown: async (options = {}) => {
    return await analyticsService.getFunnelBreakdown(options);
  },
  
  /**
   * Get activity analytics
   * 
   * @param {Object} options - Query options
   * @returns {Promise<Object>} Activity analytics
   */
  getActivity: async (options = {}) => {
    return await analyticsService.getActivityAnalytics(options);
  }
};

// Export default API object
export default {
  deals,
  quotes,
  sequences,
  events,
  analytics
};
