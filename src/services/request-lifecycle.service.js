import Donation from '../models/Donation.model.js';
import Appointment from '../models/Appointment.model.js';
import Request from '../models/Request.model.js';
import Notification from '../models/Notification.model.js';
import * as activityService from './activity.service.js';
import { ACTIVITY_TITLE_MAP } from '../constants/rewards.constants.js';
import { logger } from '../utils/logger.js';
import { validateTransition, validateOrphanState } from '../utils/state-machine.js';

const ACTIVE_DONATION_STATUSES = ['pending', 'scheduled'];
const ACTIVE_APPOINTMENT_STATUSES = ['pending', 'confirmed'];

const toObjectIdString = (value) => value?.toString?.() || String(value || '');

const getDonationCandidate = async ({ donationId = null, requestId = null, donorId = null, appointmentId = null } = {}) => {
  if (donationId) {
    return Donation.findById(donationId);
  }

  if (appointmentId) {
    const donation = await Donation.findOne({ appointmentId });
    if (donation) return donation;
  }

  if (requestId && donorId) {
    const donation = await Donation.findOne({
      requestId,
      donorId,
      status: { $in: ACTIVE_DONATION_STATUSES },
    });
    if (donation) return donation;
  }

  if (requestId) {
    const donation = await Donation.findOne({
      requestId,
      status: { $in: ACTIVE_DONATION_STATUSES },
    });
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
} = {}) => {
  const donation = await getDonationCandidate({ donationId, requestId, donorId, appointmentId });

  // Guard: if donation exists and status is changing, validate transition through the state machine.
  if (donation && donation.status !== donationStatus) {
    try {
      validateTransition('donation', donation.status, donationStatus);
    } catch (err) {
      throw new Error(err.message);
    }
  }

  const request = requestId
    ? await Request.findById(requestId)
    : (donation && donation.requestId)
      ? await Request.findById(donation.requestId)
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
    const appointmentsToCancel = await Appointment.find(appointmentQuery);
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
        { returnDocument: 'after' }
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
        }
      );
    }
  }

  if (donation) {
    donation.status = donationStatus;
    await donation.save();
  }

  if (request) {
    request.status = requestStatus;
    request.acceptedBy = null;
    request.acceptedByName = null;
    request.acceptedByPhoneNumber = null;
    request.acceptedByBloodType = null;
    request.acceptedAt = null;
    request.acceptedDonationId = null;
    await request.save();
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
    Notification.create({
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
    }).catch((error) => logger.error('Request rejection notification error', { message: error.message }));
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
};
