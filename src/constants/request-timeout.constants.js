/**
 * Configurable constants for request deadlines based on urgency level
 */
export const URGENCY_TIMEOUTS = Object.freeze({
  critical: {
    acceptWindowMs: 15 * 60 * 1000,        // 15 minutes
    arrivalWindowMs: 3 * 60 * 60 * 1000,     // 3 hours
    reBroadcastIntervalMs: 15 * 60 * 1000,  // 15 minutes
  },
  emergency: {
    acceptWindowMs: 30 * 60 * 1000,       // 30 minutes
    arrivalWindowMs: 6 * 60 * 60 * 1000,    // 6 hours
    reBroadcastIntervalMs: 30 * 60 * 1000,  // 30 minutes
  },
  high: {
    acceptWindowMs: 1 * 60 * 60 * 1000,     // 1 hour
    arrivalWindowMs: 12 * 60 * 60 * 1000,    // 12 hours
    reBroadcastIntervalMs: 1 * 60 * 60 * 1000,  // 1 hour
  },
  medium: {
    acceptWindowMs: 4 * 60 * 60 * 1000,     // 4 hours
    arrivalWindowMs: 24 * 60 * 60 * 1000,    // 24 hours
    reBroadcastIntervalMs: 4 * 60 * 60 * 1000,  // 4 hours
  },
  low: {
    acceptWindowMs: 12 * 60 * 60 * 1000,    // 12 hours
    arrivalWindowMs: 48 * 60 * 60 * 1000,   // 48 hours
    reBroadcastIntervalMs: 12 * 60 * 60 * 1000,  // 12 hours
  },
});
