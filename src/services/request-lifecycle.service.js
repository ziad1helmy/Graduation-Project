import mongoose from 'mongoose';
import Donation from '../models/Donation.model.js';
import Appointment from '../models/Appointment.model.js';
import Request from '../models/Request.model.js';
import Notification from '../models/Notification.model.js';
import * as activityService from './activity.service.js';
import { ACTIVITY_TITLE_MAP } from '../constants/rewards.constants.js';
import { logger } from '../utils/logger.js';
import { validateTransition, validateOrphanState } from '../utils/state-machine.js';

// Lazily imported to avoid circular dependencies at module load time.
// notification.service → matching.service → eligibility.service → ... none imports request-lifecycle
const getNotificationService = async () => import('./notification.service.js');
const getMatchingService = async () => import('./matching.service.js');

const ACTIVE_DONATION_STATUSES = ['pending', 'scheduled'];
const ACTIVE_APPOINTMENT_STATUSES = ['pending', 'confirmed'];

const toObjectIdString = (value) => value?.toString?.() || String(value || '');

const runInSession = async (session, executor) => {
  if (session) {
    return executor(session);
  }

  const createdSession = await mongoose.startSession();
  try {
    let result;
    await createdSession.withTransaction(async () => {
      result = await executor(createdSession);
    });
    return result;
  } finally {
    createdSession.endSession();
  }
};

const getDonationCandidate = async ({ donationId = null, requestId = null, donorId = null, appointmentId = null, session = null } = {}) => {
  if (donationId) {
    return session ? Donation.findById(donationId).session(session) : Donation.findById(donationId);
  }

  if (appointmentId) {
    const donation = session
      ? await Donation.findOne({ appointmentId }).session(session)
      : await Donation.findOne({ appointmentId });
    if (donation) return donation;
  }

  if (requestId && donorId) {
    const query = {
      requestId,
      donorId,
      status: { $in: ACTIVE_DONATION_STATUSES },
    };
    const donation = session ? await Donation.findOne(query).session(session) : await Donation.findOne(query);
    if (donation) return donation;
  }

  if (requestId) {
    const query = {
      requestId,
      status: { $in: ACTIVE_DONATION_STATUSES },
    };
    const donation = session ? await Donation.findOne(query).session(session) : await Donation.findOne(query);
    if (donation) return donation;
  }

  return null;
};

export const rejectDonationLifecycle = async ({
  donationId = null,
  requestId = null,
  donorId = null,
  appointmentId = null,
  reason = null,
  rejectedBy = null,
  requestStatus = 'pending',
  donationStatus = 'rejected',
  session = null,
} = {}) => {
  return runInSession(session, async (activeSession) => {
    const donation = await getDonationCandidate({ donationId, requestId, donorId, appointmentId, session: activeSession });

    // Guard: if donation exists and status is changing, validate transition through the state machine.
    if (donation && donation.status !== donationStatus) {
      try {
        validateTransition('donation', donation.status, donationStatus);
      } catch (err) {
        throw new Error(err.message);
      }
    }

    const request = requestId
      ? await Request.findById(requestId).session(activeSession)
      : (donation && donation.requestId)
        ? await Request.findById(donation.requestId).session(activeSession)
        : null;

    // Guard: if request exists and status is changing, validate transition through the state machine.
    if (request && request.status !== requestStatus) {
      try {
        validateTransition('request', request.status, requestStatus);
      } catch (err) {
        throw new Error(err.message);
      }
    }

    const now = new Date();
    const donorObjectId = donation ? (donation.donorId?._id || donation.donorId) : donorId;
    const donorRecipientId = donorObjectId ? toObjectIdString(donorObjectId) : null;
    const previousDonationStatus = donation?.status || null;

    // Cancel the specific appointment (by ID) or all active appointments for the request
    const appointmentQuery = appointmentId
      ? { _id: appointmentId, status: { $in: ACTIVE_APPOINTMENT_STATUSES } }
      : request
        ? { requestId: request._id, status: { $in: ACTIVE_APPOINTMENT_STATUSES } }
        : null;

    let cancelledAppointment = null;
    if (appointmentQuery) {
      const appointmentsToCancel = await Appointment.find(appointmentQuery).session(activeSession);
      for (const appt of appointmentsToCancel) {
        if (appt.status !== 'cancelled') {
          validateTransition('appointment', appt.status, 'cancelled');
        }
      }

      // For single appointment cancellation, we load it first to cancel/assert
      if (appointmentId) {
        cancelledAppointment = await Appointment.findByIdAndUpdate(
          appointmentId,
          {
            $set: {
              status: 'cancelled',
              cancelledAt: now,
              notes: reason || (donationStatus === 'cancelled' ? 'Donation cancelled' : 'Donation rejected by hospital'),
            },
          },
          { returnDocument: 'after', session: activeSession }
        );
      } else {
        await Appointment.updateMany(
          appointmentQuery,
          {
            $set: {
              status: 'cancelled',
              cancelledAt: now,
              notes: reason || (donationStatus === 'cancelled' ? 'Donation cancelled' : 'Donation rejected by hospital'),
            },
          },
          { session: activeSession }
        );
      }
    }

    if (donation) {
      donation.status = donationStatus;

      // Invalidate QR on the donation when it is rejected, cancelled, or expired
      if (['rejected', 'cancelled', 'expired', 'abandoned'].includes(donationStatus)) {
        donation.qrUsed = true;
        donation.qrUsedAt = now;
      }

      await donation.save({ session: activeSession });
    }

    if (request) {
      request.status = requestStatus;

      // When reopening to pending, extend requiredBy so it doesn't immediately expire
      if (requestStatus === 'pending') {
        const originalRequiredBy = request.requiredBy;
        if (originalRequiredBy && new Date(originalRequiredBy) <= now) {
          // Extend by 3 days or use the original urgency-based window, whichever is longer
          request.requiredBy = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
        }
      }

      // Decrement unitsAccepted when a donation is removed from an active request
      if (donation && (request.status === 'pending' || request.status === 'accepted')) {
        request.unitsAccepted = Math.max(0, (request.unitsAccepted || 0) - (donation.quantity || 1));
      }

      // Only clear first-acceptor fields if no other active donations remain
      if (requestStatus === 'pending' || requestStatus === 'cancelled') {
        const otherActive = await (requestId
          ? Donation.countDocuments({
              requestId: request._id,
              _id: { $ne: donation?._id },
              status: { $in: ['pending', 'scheduled'] },
            }).session(activeSession)
          : Promise.resolve(0));

        if (otherActive === 0) {
          request.acceptedBy = null;
          request.acceptedByName = null;
          request.acceptedByPhoneNumber = null;
          request.acceptedByBloodType = null;
          request.acceptedAt = null;
          request.acceptedDonationId = null;
          request.arrivalDeadline = null;
        }
      }
      await request.save({ session: activeSession });
    }

    // Track missed donation for abandoned status (fire-and-forget)
    if (donation && donationStatus === 'abandoned') {
      try {
        const { trackMissedDonation } = await import('../utils/missed-donation.js');
        await trackMissedDonation({
          donorId: donorObjectId || donation.donorId,
          donationId: donation._id,
          requestId: request?._id,
          reason: reason || 'Donation marked as abandoned',
        });
      } catch (_noop) { /* non-critical */ }
    }

    // Perform cross-entity orphan checking for request, donation and appointment
    if (donation) {
      validateOrphanState('donation', donation, { appointment: cancelledAppointment });
    }
    if (cancelledAppointment) {
      validateOrphanState('appointment', cancelledAppointment, { donation });
    }
    if (request) {
      validateOrphanState('request', request, { donation });
    }

    if (donorRecipientId && request) {
      await Notification.create([{
        userId: donorRecipientId,
        type: 'request',
        title: donationStatus === 'cancelled' ? 'Request cancelled' : 'Request rejected',
        message: reason || (donationStatus === 'cancelled'
          ? 'Your accepted donation request was cancelled.'
          : 'Your accepted donation request was rejected by the hospital.'),
        relatedId: request._id,
        relatedType: 'Request',
        data: {
          requestId: request._id,
          donationId: donation ? donation._id : null,
          requestStatus: request.status,
          donationStatus: donation ? donation.status : null,
          reason: reason || null,
          rejectedBy: rejectedBy ? toObjectIdString(rejectedBy) : null,
        },
      }], { session: activeSession }).catch((error) => logger.error('Request rejection notification error', { message: error.message }));
    }

    if (donorRecipientId && donation) {
      activityService.logActivity(donorRecipientId, {
        type: 'donation',
        action: donationStatus === 'cancelled' ? 'cancelled_donation' : 'rejected_donation',
        title: ACTIVITY_TITLE_MAP.donation_cancelled,
        description: reason || (donationStatus === 'cancelled'
          ? `Donation cancelled (${donation.quantity} unit(s))`
          : 'Donation request rejected by hospital'),
        referenceId: donation._id.toString(),
        referenceType: 'Donation',
        metadata: {
            quantity: donation?.quantity || 1,
          requestId: request ? request._id.toString() : null,
          donationId: donation._id.toString(),
          previousStatus: previousDonationStatus,
          requestStatus: request ? request.status : null,
          donationStatus: donation.status,
          reason: reason || null,
          rejectedBy: rejectedBy ? toObjectIdString(rejectedBy) : null,
        },
      }).catch((error) => logger.error('Request rejection activity error', { message: error.message }));
    }

    return {
      request,
      donation,
      cancelledAt: now,
    };
  });
};
