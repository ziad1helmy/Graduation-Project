/**
 * Event Listeners Registry - Central registration of all event listeners
 * 
 * This module registers all cross-service event listeners that were previously
 * implemented as direct service-to-service calls. This decouples services and
 * enables async processing.
 * 
 * Call this function during app initialization (in server.js) to set up all listeners.
 */

import eventBus from './eventBus.service.js';
import * as DonationEvents from '../constants/events.js';
import logger from '../utils/logger.js';

/**
 * Register all event listeners
 * @param {object} services - Object containing all services
 * @returns {Promise<void>}
 */
export const registerEventListeners = async (services) => {
  logger.info('Registering event listeners for decoupled service communication');

  const {
    activityService,
    notificationService,
    rewardService,
    matchingService,
    donationService,
    appointmentService,
    requestLifecycleService,
  } = services;

  // ============================================================================
  // DONATION EVENT LISTENERS
  // ============================================================================

  /**
   * When donation is created:
   * 1. Log activity for donor timeline
   * 2. Award initial points
   * 3. Send match notification to hospital
   */
  eventBus.on(DonationEvents.DonationEvents.DONATION_CREATED, async (payload) => {
    const { donationId, donorId, requestId, data } = payload;

    try {
      // Activity logging (previously done in donation.service)
      if (activityService) {
        await activityService.logActivity(donorId, {
          type: 'DONATION_CREATED',
          donationId,
          requestId,
        });
      }

      // Send match notification to hospital
      if (notificationService) {
        await notificationService.notifyHospitalMatchAccepted({
          donationId,
          requestId,
        });
      }

      logger.debug('Processed DONATION_CREATED event', {
        donationId,
        donorId,
        requestId,
      });
    } catch (error) {
      logger.error('Error processing DONATION_CREATED event', {
        donationId,
        error: error.message,
      });
    }
  });

  /**
   * When donation is completed:
   * 1. Award completion points and badge unlocks
   * 2. Log activity
   * 3. Send completion notification
   * 4. Check if milestone reached
   */
  eventBus.on(DonationEvents.DonationEvents.DONATION_COMPLETED, async (payload) => {
    const { donationId, donorId, pointsAwarded } = payload;

    try {
      // Activity logging
      if (activityService) {
        await activityService.logActivity(donorId, {
          type: 'DONATION_COMPLETED',
          donationId,
          pointsAwarded,
        });
      }

      // Send completion notification
      if (notificationService) {
        await notificationService.notifyDonationCompleted({
          donorId,
          donationId,
          pointsAwarded,
        });
      }

      // Check for milestones (e.g., 5th donation, 100 points)
      if (activityService) {
        const stats = await donationService.getDonorStats(donorId);
        if (stats.totalDonations % 5 === 0) {
          await activityService.logMilestone(donorId, {
            type: 'DONATION_MILESTONE',
            count: stats.totalDonations,
            description: `Completed ${stats.totalDonations} donations!`,
          });
        }
      }

      logger.debug('Processed DONATION_COMPLETED event', {
        donationId,
        donorId,
        pointsAwarded,
      });
    } catch (error) {
      logger.error('Error processing DONATION_COMPLETED event', {
        donationId,
        error: error.message,
      });
    }
  });

  /**
   * When donation is rejected:
   * 1. Log activity
   * 2. Send notification to donor
   * 3. Find alternative donors for request
   */
  eventBus.on(DonationEvents.DonationEvents.DONATION_REJECTED, async (payload) => {
    const { donationId, reason } = payload;

    try {
      if (activityService) {
        await activityService.logActivity(payload.donorId, {
          type: 'DONATION_REJECTED',
          donationId,
          reason,
        });
      }

      if (notificationService) {
        await notificationService.notifyDonationRejected({
          donorId: payload.donorId,
          donationId,
          reason,
        });
      }

      logger.debug('Processed DONATION_REJECTED event', {
        donationId,
      });
    } catch (error) {
      logger.error('Error processing DONATION_REJECTED event', {
        donationId,
        error: error.message,
      });
    }
  });

  /**
   * When eligibility check fails:
   * 1. Log activity
   * 2. Send notification to donor with reason
   */
  eventBus.on(DonationEvents.DonationEvents.ELIGIBILITY_CHECK_FAILED, async (payload) => {
    const { donorId, reason, failedRules } = payload;

    try {
      if (activityService) {
        await activityService.logActivity(donorId, {
          type: 'ELIGIBILITY_FAILED',
          reason,
          failedRules,
        });
      }

      if (notificationService) {
        await notificationService.notifyEligibilityCheckFailed({
          donorId,
          reason,
          failedRules,
        });
      }

      logger.debug('Processed ELIGIBILITY_CHECK_FAILED event', {
        donorId,
        failedRules,
      });
    } catch (error) {
      logger.error('Error processing ELIGIBILITY_CHECK_FAILED event', {
        donorId,
        error: error.message,
      });
    }
  });

  // ============================================================================
  // REWARD EVENT LISTENERS
  // ============================================================================

  /**
   * When points are awarded:
   * 1. Log activity
   * 2. Check for badge unlocks
   * 3. Check for tier progression
   */
  eventBus.on(DonationEvents.RewardEvents.POINTS_AWARDED, async (payload) => {
    const { donorId, points, reason, referenceId } = payload;

    try {
      if (activityService) {
        await activityService.logActivity(donorId, {
          type: 'POINTS_AWARDED',
          points,
          reason,
          referenceId,
        });
      }

      logger.debug('Processed POINTS_AWARDED event', {
        donorId,
        points,
        reason,
      });
    } catch (error) {
      logger.error('Error processing POINTS_AWARDED event', {
        donorId,
        error: error.message,
      });
    }
  });

  /**
   * When badge is unlocked:
   * 1. Log activity
   * 2. Send notification to donor
   */
  eventBus.on(DonationEvents.RewardEvents.BADGE_UNLOCKED, async (payload) => {
    const { donorId, badgeId, badge } = payload;

    try {
      if (activityService) {
        await activityService.logActivity(donorId, {
          type: 'BADGE_UNLOCKED',
          badgeId,
          badgeName: badge?.name,
        });
      }

      if (notificationService) {
        await notificationService.notifyBadgeUnlocked({
          donorId,
          badgeId,
          badge,
        });
      }

      logger.debug('Processed BADGE_UNLOCKED event', {
        donorId,
        badgeId,
      });
    } catch (error) {
      logger.error('Error processing BADGE_UNLOCKED event', {
        donorId,
        error: error.message,
      });
    }
  });

  /**
   * When tier progresses:
   * 1. Log activity with milestone
   * 2. Send notification to donor
   */
  eventBus.on(DonationEvents.RewardEvents.TIER_PROGRESSED, async (payload) => {
    const { donorId, oldTier, newTier, totalPoints } = payload;

    try {
      if (activityService) {
        await activityService.logMilestone(donorId, {
          type: 'TIER_PROGRESSION',
          oldTier,
          newTier,
          totalPoints,
          description: `Progressed to ${newTier} tier!`,
        });
      }

      if (notificationService) {
        await notificationService.notifyTierProgression({
          donorId,
          oldTier,
          newTier,
        });
      }

      logger.debug('Processed TIER_PROGRESSED event', {
        donorId,
        oldTier,
        newTier,
      });
    } catch (error) {
      logger.error('Error processing TIER_PROGRESSED event', {
        donorId,
        error: error.message,
      });
    }
  });

  // ============================================================================
  // APPOINTMENT EVENT LISTENERS
  // ============================================================================

  /**
   * When appointment is confirmed:
   * 1. Log activity
   * 2. Send reminder notification
   */
  eventBus.on(DonationEvents.AppointmentEvents.APPOINTMENT_CONFIRMED, async (payload) => {
    const { appointmentId, donorId, confirmedAt } = payload;

    try {
      if (activityService) {
        await activityService.logActivity(donorId, {
          type: 'APPOINTMENT_CONFIRMED',
          appointmentId,
          confirmedAt,
        });
      }

      if (notificationService) {
        await notificationService.notifyAppointmentConfirmed({
          donorId,
          appointmentId,
          confirmedAt,
        });
      }

      logger.debug('Processed APPOINTMENT_CONFIRMED event', {
        appointmentId,
        donorId,
      });
    } catch (error) {
      logger.error('Error processing APPOINTMENT_CONFIRMED event', {
        appointmentId,
        error: error.message,
      });
    }
  });

  /**
   * When appointment is completed:
   * 1. Update donation status
   * 2. Award points
   * 3. Log activity
   */
  eventBus.on(DonationEvents.AppointmentEvents.APPOINTMENT_COMPLETED, async (payload) => {
    const { appointmentId, donorId, donationId } = payload;

    try {
      if (donationService) {
        await donationService.completeDonation(donationId);
      }

      if (activityService) {
        await activityService.logActivity(donorId, {
          type: 'APPOINTMENT_COMPLETED',
          appointmentId,
          donationId,
        });
      }

      logger.debug('Processed APPOINTMENT_COMPLETED event', {
        appointmentId,
        donationId,
      });
    } catch (error) {
      logger.error('Error processing APPOINTMENT_COMPLETED event', {
        appointmentId,
        error: error.message,
      });
    }
  });

  // ============================================================================
  // REQUEST EVENT LISTENERS
  // ============================================================================

  /**
   * When request is urgent:
   * 1. Find compatible donors
   * 2. Send urgent notifications
   * 3. Log activity
   */
  eventBus.on(DonationEvents.RequestEvents.REQUEST_URGENT, async (payload) => {
    const { requestId, hospitalId, bloodType, remainingQuantity } = payload;

    try {
      if (notificationService && matchingService) {
        // Find compatible donors within critical distance
        const compatibleDonors = await matchingService.findCompatibleDonors({
          _id: requestId,
          bloodType,
          urgency: 'CRITICAL',
        });

        // Send urgent notification batch
        await notificationService.sendUrgentRequestNotifications({
          requestId,
          donors: compatibleDonors,
          urgencyLevel: 'CRITICAL',
        });
      }

      logger.debug('Processed REQUEST_URGENT event', {
        requestId,
        remainingQuantity,
      });
    } catch (error) {
      logger.error('Error processing REQUEST_URGENT event', {
        requestId,
        error: error.message,
      });
    }
  });

  /**
   * When request is fulfilled:
   * 1. Log activity
   * 2. Send notification to hospital
   * 3. Trigger follow-up activities
   */
  eventBus.on(DonationEvents.RequestEvents.REQUEST_FULFILLED, async (payload) => {
    const { requestId, quantityReceived, fulfilledAt } = payload;

    try {
      if (activityService) {
        await activityService.logActivity('SYSTEM', {
          type: 'REQUEST_FULFILLED',
          requestId,
          quantityReceived,
          fulfilledAt,
        });
      }

      if (notificationService) {
        await notificationService.notifyRequestFulfilled({
          requestId,
          quantityReceived,
        });
      }

      logger.debug('Processed REQUEST_FULFILLED event', {
        requestId,
        quantityReceived,
      });
    } catch (error) {
      logger.error('Error processing REQUEST_FULFILLED event', {
        requestId,
        error: error.message,
      });
    }
  });

  // ============================================================================
  // NOTIFICATION EVENT LISTENERS
  // ============================================================================

  /**
   * Send match alert notifications
   */
  eventBus.on(DonationEvents.NotificationEvents.SEND_MATCH_ALERT, async (payload) => {
    const { donorId, requestId, requestDetails } = payload;

    try {
      if (notificationService) {
        await notificationService.sendMatchAlert({
          donorId,
          requestId,
          requestDetails,
        });
      }

      logger.debug('Processed SEND_MATCH_ALERT event', {
        donorId,
        requestId,
      });
    } catch (error) {
      logger.error('Error processing SEND_MATCH_ALERT event', {
        donorId,
        error: error.message,
      });
    }
  });

  logger.info('Event listeners registered successfully');
};

export default registerEventListeners;
