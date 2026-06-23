import mongoose from 'mongoose';
import Request from '../models/Request.model.js';
import Donation from '../models/Donation.model.js';
import { validateTransition } from '../utils/state-machine.js';
import { URGENCY_TIMEOUTS } from '../constants/request-timeout.constants.js';
import { logger } from '../utils/logger.js';

const getMatchingService = async () => import('../services/matching.service.js');
const getNotificationService = async () => import('../services/notification.service.js');

export const processArrivalExpirations = async () => {
  const now = new Date();
  let expired = 0;
  let failed = 0;

  const pendingDonations = await Donation.find({
    status: 'pending',
    arrivalDeadline: { $ne: null, $lt: now },
    qrUsed: false,
  });

  for (const donation of pendingDonations) {
    const session = await mongoose.startSession();
    try {
      let processed = false;
      await session.withTransaction(async () => {
        const sessionDonation = await Donation.findById(donation._id).session(session);
        if (!sessionDonation || sessionDonation.status !== 'pending' || sessionDonation.qrUsed) {
          return;
        }
        if (!sessionDonation.arrivalDeadline || now <= new Date(sessionDonation.arrivalDeadline)) {
          return;
        }

        const sessionRequest = await Request.findById(sessionDonation.requestId).session(session);
        if (!sessionRequest) {
          return;
        }

        // Only process if request is pending or accepted (stale donations on cancelled requests are ignored)
        if (sessionRequest.status !== 'pending' && sessionRequest.status !== 'accepted') {
          return;
        }

        validateTransition('donation', sessionDonation.status, 'expired');
        sessionDonation.status = 'expired';
        sessionDonation.qrUsed = true;
        sessionDonation.qrUsedAt = now;
        await sessionDonation.save({ session });

        // Decrement unitsAccepted on the request for multi-donor support
        sessionRequest.unitsAccepted = Math.max(0, (sessionRequest.unitsAccepted || 0) - (sessionDonation.quantity || 1));

        // If request was fully accepted and this was the last active donation, revert to pending
        if (sessionRequest.status === 'accepted') {
          const otherActiveDonations = await Donation.countDocuments({
            requestId: sessionRequest._id,
            _id: { $ne: sessionDonation._id },
            status: { $in: ['pending', 'scheduled'] },
          }).session(session);

          if (otherActiveDonations === 0) {
            validateTransition('request', sessionRequest.status, 'pending');
            sessionRequest.status = 'pending';
            sessionRequest.acceptedBy = null;
            sessionRequest.acceptedByName = null;
            sessionRequest.acceptedByPhoneNumber = null;
            sessionRequest.acceptedByBloodType = null;
            sessionRequest.acceptedAt = null;
            sessionRequest.acceptedDonationId = null;
            sessionRequest.arrivalDeadline = null;
          }
        }

        await sessionRequest.save({ session });

        processed = true;
      });

      if (processed) {
        expired += 1;

        // Track missed donation (fire-and-forget outside transaction)
        try {
          const { trackMissedDonation } = await import('../utils/missed-donation.js');
          await trackMissedDonation({
            donorId: donation.donorId,
            donationId: donation._id,
            requestId: donation.requestId,
            reason: 'Arrival deadline passed without confirmation',
          });
        } catch (trackErr) {
          logger.error('Failed to track missed donation', {
            donationId: String(donation._id),
            error: trackErr.message,
          });
        }

        try {
          const [matchingSvc, notificationSvc] = await Promise.all([
            getMatchingService(),
            getNotificationService(),
          ]);
          const request = await Request.findById(donation.requestId);
          if (request && request.status === 'pending') {
            const compatibleDonors = await matchingSvc.findCompatibleDonors(request._id);
            if (compatibleDonors.length > 0) {
              const donorIds = compatibleDonors.map((d) => d.donor._id);
              await notificationSvc.notifyRequest(donorIds, request);
              logger.info('Re-broadcast after arrival expiration', {
                requestId: String(request._id),
                donorsNotified: donorIds.length,
              });
            }
          }
        } catch (broadcastErr) {
          logger.error('Re-broadcast failed after arrival expiration', {
            requestId: String(donation.requestId),
            error: broadcastErr.message,
          });
        }
      }
    } catch (err) {
      logger.error('Failed to process arrival expiration', {
        donationId: String(donation._id),
        error: err.message,
      });
      failed += 1;
    } finally {
      session.endSession();
    }
  }

  return { expired, failed };
};

export const processReBroadcasts = async () => {
  const now = new Date();

  const requests = await Request.find({
    status: 'pending',
    isEmergency: { $ne: true },
  });

  let reBroadcast = 0;
  let skipped = 0;
  let failed = 0;

  for (const request of requests) {
    try {
      const urgencyKey = request.urgency || 'medium';
      const timeouts = URGENCY_TIMEOUTS[urgencyKey];
      if (!timeouts) {
        skipped += 1;
        continue;
      }

      const intervalMs = timeouts.reBroadcastIntervalMs;
      const lastBroadcast = request.lastBroadcastAt ? new Date(request.lastBroadcastAt) : null;
      const nextBroadcastAt = lastBroadcast
        ? new Date(lastBroadcast.getTime() + intervalMs)
        : new Date(request.createdAt.getTime() + intervalMs);

      if (now < nextBroadcastAt) {
        skipped += 1;
        continue;
      }

      const [matchingSvc, notificationSvc] = await Promise.all([
        getMatchingService(),
        getNotificationService(),
      ]);
      const compatibleDonors = await matchingSvc.findCompatibleDonors(request._id);
      if (compatibleDonors.length === 0) {
        skipped += 1;
        continue;
      }

      const donorIds = compatibleDonors.map((d) => d.donor._id);
      await notificationSvc.notifyRequest(donorIds, request);

      await Request.findByIdAndUpdate(request._id, {
        $set: { lastBroadcastAt: now },
        $inc: { escalationLevel: 1 },
      });

      reBroadcast += 1;
      logger.info('Request re-broadcast', {
        requestId: String(request._id),
        urgency: urgencyKey,
        donorsNotified: donorIds.length,
        escalationLevel: request.escalationLevel + 1,
      });
    } catch (err) {
      logger.error('Failed to re-broadcast request', {
        requestId: String(request._id),
        error: err.message,
      });
      failed += 1;
    }
  }

  return { reBroadcast, skipped, failed };
};

export const processEmergencyReBroadcasts = async () => {
  const now = new Date();

  const requests = await Request.find({
    status: 'pending',
    $or: [
      { isEmergency: true },
      { urgency: 'critical' },
    ],
  });

  let reBroadcast = 0;
  let skipped = 0;
  let failed = 0;

  for (const request of requests) {
    try {
      const urgencyKey = request.urgency || 'critical';
      const timeouts = URGENCY_TIMEOUTS[urgencyKey] || URGENCY_TIMEOUTS.critical;
      const intervalMs = timeouts.reBroadcastIntervalMs;

      const lastBroadcast = request.lastBroadcastAt ? new Date(request.lastBroadcastAt) : null;
      const nextBroadcastAt = lastBroadcast
        ? new Date(lastBroadcast.getTime() + intervalMs)
        : new Date(request.createdAt.getTime() + Math.min(intervalMs, 5 * 60 * 1000));

      if (now < nextBroadcastAt) {
        skipped += 1;
        continue;
      }

      const [matchingSvc, notificationSvc] = await Promise.all([
        getMatchingService(),
        getNotificationService(),
      ]);
      const compatibleDonors = await matchingSvc.findCompatibleDonors(request._id);
      if (compatibleDonors.length === 0) {
        skipped += 1;
        continue;
      }

      const donorIds = compatibleDonors.map((d) => d.donor._id);
      await notificationSvc.notifyRequest(donorIds, request);

      await Request.findByIdAndUpdate(request._id, {
        $set: { lastBroadcastAt: now },
        $inc: { escalationLevel: 1 },
      });

      reBroadcast += 1;
      logger.info('Emergency request re-broadcast', {
        requestId: String(request._id),
        urgency: urgencyKey,
        donorsNotified: donorIds.length,
        escalationLevel: request.escalationLevel + 1,
      });
    } catch (err) {
      logger.error('Failed to re-broadcast emergency request', {
        requestId: String(request._id),
        error: err.message,
      });
      failed += 1;
    }
  }

  return { reBroadcast, skipped, failed };
};

export const runIteration = async () => {
  const [expiryResult, broadcastResult, emergencyResult] = await Promise.all([
    processArrivalExpirations(),
    processReBroadcasts(),
    processEmergencyReBroadcasts(),
  ]);

  return {
    arrivalExpirations: expiryResult,
    reBroadcasts: broadcastResult,
    emergencyReBroadcasts: emergencyResult,
  };
};

export default { processArrivalExpirations, processReBroadcasts, processEmergencyReBroadcasts, runIteration };