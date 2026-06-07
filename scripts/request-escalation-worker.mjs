#!/usr/bin/env node

/**
 * Background Worker - Request Escalation and Expiration Cleanup
 * 
 * Running periodically (e.g., via cron) to:
 * 1. Re-broadcast pending requests exceeding acceptance deadlines (escalation levels)
 * 2. Cancel and re-broadcast request-based donations where the donor failed to arrive
 */

import mongoose from 'mongoose';
import { env } from '../src/config/env.js';
import { logger } from '../src/utils/logger.js';
import Donation from '../src/models/Donation.model.js';
import Notification from '../src/models/Notification.model.js';
import Request from '../src/models/Request.model.js';
import { URGENCY_TIMEOUTS } from '../src/constants/request-timeout.constants.js';
import { rejectDonationLifecycle } from '../src/services/request-lifecycle.service.js';

async function runEscalationJob() {
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const now = new Date();

      // ─── 1. ACCEPTANCE TIMEOUT / RE-BROADCAST LOGIC ───────────────────
      const staleRequests = await Request.find({
        status: 'pending',
        acceptanceDeadline: { $ne: null, $lt: now },
        manualInterventionFlag: { $ne: true },
      }).session(session);

      for (const request of staleRequests) {
        const nextLevel = request.escalationLevel + 1;
        if (nextLevel <= 3) {
          // Escalation Level 2 or 3
          const urgencyKey = request.isEmergency ? 'emergency' : (request.urgency || 'medium');
          const timeouts = URGENCY_TIMEOUTS[urgencyKey] || URGENCY_TIMEOUTS.medium;
          const acceptWindowMs = timeouts.acceptWindowMs;

          request.escalationLevel = nextLevel;
          request.acceptanceDeadline = new Date(now.getTime() + acceptWindowMs);
          await request.save({ session });

          logger.info(`Request escalated to level ${nextLevel}`, {
            requestId: request._id,
            newDeadline: request.acceptanceDeadline,
          });

          // Trigger re-broadcast in background after transaction commits
          // Lazily imported matching service to avoid circular dependency
          const matchingSvc = await import('../src/services/matching.service.js');
          const notificationSvc = await import('../src/services/notification.service.js');

          // Async notification execution
          Promise.resolve().then(async () => {
            try {
              // Re-fetch request to get latest (matching checks database state)
              const freshRequest = await Request.findById(request._id);
              if (freshRequest && freshRequest.status === 'pending') {
                const compatibleDonors = await matchingSvc.findCompatibleDonors(freshRequest._id);
                if (compatibleDonors.length > 0) {
                  const donorIds = compatibleDonors.map((d) => d.donor._id);
                  await notificationSvc.notifyRequest(donorIds, freshRequest);
                  logger.info(`Escalation re-broadcast sent for request`, {
                    requestId: freshRequest._id,
                    donorsNotified: donorIds.length,
                    level: nextLevel,
                  });
                }
              }
            } catch (err) {
              logger.error('Failed to notify donors during request escalation', {
                requestId: request._id,
                error: err.message,
              });
            }
          });
        } else {
          // Exceeded Level 3 -> Mark for manual hospital intervention
          request.manualInterventionFlag = true;
          await request.save({ session });

          // Notify hospital
          await Notification.create([{
            userId: request.hospitalId,
            type: 'request',
            title: 'Manual Intervention Required',
            message: `Your donation request has failed to attract donors after multiple re-broadcasts. Please intervene manually.`,
            relatedId: request._id,
            relatedType: 'Request',
            data: {
              requestId: request._id,
              status: 'pending',
            },
          }], { session });

          logger.warn(`Request flagged for manual intervention`, {
            requestId: request._id,
          });
        }
      }

      // ─── 2. ACCEPTED BUT NO ARRIVAL LOGIC ─────────────────────────────
      // Find donations linked to requests that have passed their arrival deadline
      const expiredDonations = await Donation.find({
        status: 'pending',
        requestId: { $ne: null },
        arrivalDeadline: { $ne: null, $lt: now },
      }).populate('requestId').session(session);

      for (const donation of expiredDonations) {
        logger.info(`Donation arrival expired`, {
          donationId: donation._id,
          requestId: donation.requestId?._id,
          donorId: donation.donorId,
        });

        // Use rejectDonationLifecycle to revert request and re-broadcast
        await rejectDonationLifecycle({
          donationId: donation._id,
          requestId: donation.requestId._id,
          donorId: donation.donorId,
          reason: 'Donor failed to arrive before arrival deadline',
          requestStatus: 'pending',
          donationStatus: 'expired',
          session,
        });

        // Notify hospital about the expiration
        await Notification.create([{
          userId: donation.requestId.hospitalId,
          type: 'request',
          title: 'Donor Arrival Timeout',
          message: `The donor who accepted your request for ${donation.requestId.bloodType.join(', ')} failed to arrive within the deadline. The request has been re-broadcasted.`,
          relatedId: donation.requestId._id,
          relatedType: 'Request',
          data: {
            requestId: donation.requestId._id,
            donationId: donation._id,
            status: 'pending',
          },
        }], { session });
      }
    });
  } catch (error) {
    logger.error('Request escalation job failed', {
      error: error.message,
      stack: error.stack,
    });
    throw error;
  } finally {
    session.endSession();
  }
}

async function main() {
  try {
    await mongoose.connect(env.MONGODB_URI, {
      maxPoolSize: 10,
      minPoolSize: 2,
    });

    logger.info('Request escalation worker: MongoDB connected');
    await runEscalationJob();
    logger.info('Request escalation worker: Job completed successfully');
    process.exit(0);
  } catch (error) {
    logger.error('Request escalation worker: Fatal error', {
      error: error.message,
      stack: error.stack,
    });
    process.exit(1);
  }
}

main();
