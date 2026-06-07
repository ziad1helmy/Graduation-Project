/**
 * Application Events - Central registry of all domain events
 * 
 * Organized by domain area. Each event represents a significant state change
 * that should trigger side effects or notifications.
 * 
 * Event naming convention: {domain}:{action}
 * Payload structure defined as JSDoc for each event
 */

export const DonationEvents = Object.freeze({
  /**
   * @event donation:created
   * @payload {string} donationId, {string} donorId, {string} requestId, {object} data
   */
  DONATION_CREATED: 'donation:created',

  /**
   * @event donation:scheduled
   * @payload {string} donationId, {string} appointmentId, {date} scheduledDate
   */
  DONATION_SCHEDULED: 'donation:scheduled',

  /**
   * @event donation:completed
   * @payload {string} donationId, {string} donorId, {number} pointsAwarded
   */
  DONATION_COMPLETED: 'donation:completed',

  /**
   * @event donation:rejected
   * @payload {string} donationId, {string} reason
   */
  DONATION_REJECTED: 'donation:rejected',

  /**
   * @event donation:cancelled
   * @payload {string} donationId, {string} reason
   */
  DONATION_CANCELLED: 'donation:cancelled',

  /**
   * @event donation:eligibility-check-failed
   * @payload {string} donorId, {string} reason, {array} failedRules
   */
  ELIGIBILITY_CHECK_FAILED: 'donation:eligibility-check-failed',
});

export const RewardEvents = Object.freeze({
  /**
   * @event reward:points-awarded
   * @payload {string} donorId, {number} points, {string} reason, {string} referenceId
   */
  POINTS_AWARDED: 'reward:points-awarded',

  /**
   * @event reward:badge-unlocked
   * @payload {string} donorId, {string} badgeId, {object} badge
   */
  BADGE_UNLOCKED: 'reward:badge-unlocked',

  /**
   * @event reward:tier-progressed
   * @payload {string} donorId, {string} oldTier, {string} newTier, {number} totalPoints
   */
  TIER_PROGRESSED: 'reward:tier-progressed',

  /**
   * @event reward:redemption-processed
   * @payload {string} donorId, {string} rewardId, {number} pointsSpent
   */
  REDEMPTION_PROCESSED: 'reward:redemption-processed',
});

export const ActivityEvents = Object.freeze({
  /**
   * @event activity:recorded
   * @payload {string} donorId, {string} type, {object} data, {date} timestamp
   */
  ACTIVITY_RECORDED: 'activity:recorded',

  /**
   * @event activity:milestone-reached
   * @payload {string} donorId, {string} milestoneType, {number} count, {string} description
   */
  MILESTONE_REACHED: 'activity:milestone-reached',
});

export const NotificationEvents = Object.freeze({
  /**
   * @event notification:send-match-alert
   * @payload {string} donorId, {string} requestId, {object} requestDetails
   */
  SEND_MATCH_ALERT: 'notification:send-match-alert',

  /**
   * @event notification:send-appointment-reminder
   * @payload {string} donorId, {string} appointmentId, {date} appointmentDate
   */
  SEND_APPOINTMENT_REMINDER: 'notification:send-appointment-reminder',

  /**
   * @event notification:send-completion-alert
   * @payload {string} donorId, {string} donationId, {number} pointsEarned
   */
  SEND_COMPLETION_ALERT: 'notification:send-completion-alert',

  /**
   * @event notification:send-milestone-notification
   * @payload {string} donorId, {string} milestoneType, {object} details
   */
  SEND_MILESTONE_NOTIFICATION: 'notification:send-milestone-notification',

  /**
   * @event notification:urgent-request-available
   * @payload {string} donorId, {string} requestId, {object} requestDetails
   */
  URGENT_REQUEST_AVAILABLE: 'notification:urgent-request-available',
});

export const AppointmentEvents = Object.freeze({
  /**
   * @event appointment:created
   * @payload {string} appointmentId, {string} donorId, {string} hospitalId, {date} appointmentDate
   */
  APPOINTMENT_CREATED: 'appointment:created',

  /**
   * @event appointment:confirmed
   * @payload {string} appointmentId, {string} donorId, {date} confirmedAt
   */
  APPOINTMENT_CONFIRMED: 'appointment:confirmed',

  /**
   * @event appointment:completed
   * @payload {string} appointmentId, {string} donorId, {string} donationId
   */
  APPOINTMENT_COMPLETED: 'appointment:completed',

  /**
   * @event appointment:cancelled
   * @payload {string} appointmentId, {string} reason
   */
  APPOINTMENT_CANCELLED: 'appointment:cancelled',
});

export const RequestEvents = Object.freeze({
  /**
   * @event request:created
   * @payload {string} requestId, {string} hospitalId, {string} bloodType, {number} quantity, {string} urgency
   */
  REQUEST_CREATED: 'request:created',

  /**
   * @event request:fulfilled
   * @payload {string} requestId, {number} quantityReceived, {date} fulfilledAt
   */
  REQUEST_FULFILLED: 'request:fulfilled',

  /**
   * @event request:cancelled
   * @payload {string} requestId, {string} reason
   */
  REQUEST_CANCELLED: 'request:cancelled',

  /**
   * @event request:urgent
   * @payload {string} requestId, {string} hospitalId, {string} bloodType, {number} remainingQuantity
   */
  REQUEST_URGENT: 'request:urgent',
});

export const HospitalEvents = Object.freeze({
  /**
   * @event hospital:created
   * @payload {string} hospitalId, {object} hospitalData
   */
  HOSPITAL_CREATED: 'hospital:created',

  /**
   * @event hospital:updated
   * @payload {string} hospitalId, {object} changes
   */
  HOSPITAL_UPDATED: 'hospital:updated',
});

export const UserEvents = Object.freeze({
  /**
   * @event user:registered
   * @payload {string} userId, {string} userType (donor|hospital|admin), {object} userData
   */
  USER_REGISTERED: 'user:registered',

  /**
   * @event user:verified
   * @payload {string} userId, {string} verificationMethod (email|phone)
   */
  USER_VERIFIED: 'user:verified',

  /**
   * @event user:suspended
   * @payload {string} userId, {string} reason
   */
  USER_SUSPENDED: 'user:suspended',

  /**
   * @event user:deleted
   * @payload {string} userId, {string} reason
   */
  USER_DELETED: 'user:deleted',
});

export const SystemEvents = Object.freeze({
  /**
   * @event system:maintenance-mode-enabled
   * @payload {date} startedAt, {string} reason
   */
  MAINTENANCE_MODE_ENABLED: 'system:maintenance-mode-enabled',

  /**
   * @event system:maintenance-mode-disabled
   * @payload {date} endedAt, {number} downtimeMins
   */
  MAINTENANCE_MODE_DISABLED: 'system:maintenance-mode-disabled',

  /**
   * @event system:emergency-broadcast
   * @payload {string} message, {array} recipientFilters, {date} sentAt
   */
  EMERGENCY_BROADCAST: 'system:emergency-broadcast',
});

// Combine all event types for easy access
export const AllEvents = {
  ...DonationEvents,
  ...RewardEvents,
  ...ActivityEvents,
  ...NotificationEvents,
  ...AppointmentEvents,
  ...RequestEvents,
  ...HospitalEvents,
  ...UserEvents,
  ...SystemEvents,
};

export default AllEvents;
