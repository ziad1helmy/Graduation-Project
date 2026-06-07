/**
 * EventBus Service - Central event dispatcher for decoupled service communication
 * 
 * Implements pub/sub pattern to decouple services and enable async processing.
 * Events are emitted synchronously but can be handled asynchronously.
 * 
 * Usage:
 *   // Emit event
 *   eventBus.emit('donation:created', { donationId, donorId, requestId });
 *   
 *   // Listen for event
 *   eventBus.on('donation:created', async (data) => {
 *     await handleDonationCreated(data);
 *   });
 */

import { EventEmitter } from 'events';
import logger from '../utils/logger.js';

class EventBus extends EventEmitter {
  constructor() {
    super();
    this.setMaxListeners(100); // Increase from default 10 to accommodate many listeners
    
    // Track event statistics for monitoring
    this.eventStats = {};
    
    // Error handling for uncaught event listeners
    this.on('error', (error) => {
      logger.error('EventBus error', {
        error: error.message,
        stack: error.stack,
        eventName: error.eventName,
      });
    });
  }

  /**
   * Emit an event with error handling
   * @param {string} eventName - Name of the event
   * @param {object} data - Event payload
   */
  emit(eventName, data) {
    try {
      // Track event statistics
      if (!this.eventStats[eventName]) {
        this.eventStats[eventName] = { count: 0, lastEmitted: null };
      }
      this.eventStats[eventName].count++;
      this.eventStats[eventName].lastEmitted = new Date();

      logger.debug(`Event emitted: ${eventName}`, { payload: data });
      
      // Call parent emit method to invoke all listeners
      return super.emit(eventName, data);
    } catch (error) {
      logger.error(`Failed to emit event: ${eventName}`, {
        error: error.message,
        eventName,
        payload: data,
      });
      throw error;
    }
  }

  /**
   * Register listener with error handling wrapper
   * @param {string} eventName - Name of the event
   * @param {function} listener - Async or sync listener function
   */
  on(eventName, listener) {
    const wrappedListener = async (...args) => {
      try {
        const result = listener(...args);
        // If listener returns a promise, await it
        if (result instanceof Promise) {
          await result;
        }
      } catch (error) {
        logger.error(`Error in event listener: ${eventName}`, {
          error: error.message,
          stack: error.stack,
          eventName,
        });
        // Don't rethrow - allow other listeners to continue
      }
    };

    return super.on(eventName, wrappedListener);
  }

  /**
   * Get event statistics for monitoring
   */
  getStats() {
    return this.eventStats;
  }

  /**
   * Clear all event statistics
   */
  clearStats() {
    this.eventStats = {};
  }
}

// Export singleton instance
export default new EventBus();
