import mongoose from 'mongoose';
import Appointment from '../models/Appointment.model.js';
import Donation from '../models/Donation.model.js';
import Donor from '../models/Donor.model.js';
import Request from '../models/Request.model.js';
import * as activityService from './activity.service.js';
import { ACTIVITY_TITLE_MAP } from '../constants/rewards.constants.js';
import { APPOINTMENT_POINTS_BY_DONATION_TYPE, DONATION_TYPE_LABELS } from '../constants/donation.constants.js';
import * as eligibilityService from './eligibility.service.js';
import * as rewardService from './reward.service.js';
import { normalizeDonationTypeRequestKey } from './appointment.service.js';
import { rejectDonationLifecycle } from './request-lifecycle.service.js';
import { validateTransition, validateOrphanState } from '../utils/state-machine.js';
import { buildSafetyRejectionReason, isDonorIneligible } from '../utils/eligibility-reason.js';
import { logger } from '../utils/logger.js';

export const MIN_HEMOGLOBIN_LEVEL = 12.5;
export const MAX_HEMOGLOBIN_LEVEL = 20;
export const MIN_DONOR_WEIGHT_KG = 50;
export const VALID_UNITS_COLLECTED = [1, 2];

export const normalizeUnitsCollected = (value, donationType) => {
  if (value === undefined || value === null || value === '') {
    return donationType === DONATION_TYPE_LABELS.DOUBLE_RED_CELLS ? 2 : 1;
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || !VALID_UNITS_COLLECTED.includes(parsed)) {
    return null;
  }

  return parsed;
};

export const validateMedicalInputs = (body = {}, donationType = DONATION_TYPE_LABELS.WHOLE_BLOOD) => {
  const errors = [];

  const hemoglobinLevel = body.hemoglobinLevel === undefined || body.hemoglobinLevel === null || body.hemoglobinLevel === ''
    ? null
    : Number(body.hemoglobinLevel);
  if (hemoglobinLevel === null || Number.isNaN(hemoglobinLevel)) {
    errors.push('hemoglobinLevel is required');
  } else if (hemoglobinLevel < MIN_HEMOGLOBIN_LEVEL || hemoglobinLevel > MAX_HEMOGLOBIN_LEVEL) {
    errors.push(`hemoglobinLevel must be between ${MIN_HEMOGLOBIN_LEVEL} and ${MAX_HEMOGLOBIN_LEVEL}`);
  }

  const weight = body.weight === undefined || body.weight === null || body.weight === ''
    ? null
    : Number(body.weight);
  if (weight === null || Number.isNaN(weight)) {
    errors.push('weight is required');
  } else if (weight < MIN_DONOR_WEIGHT_KG) {
    errors.push(`weight must be at least ${MIN_DONOR_WEIGHT_KG} kg`);
  }

  const unitsCollected = normalizeUnitsCollected(body.unitsCollected, donationType);
  if (unitsCollected === null) {
    errors.push('unitsCollected must be either 1 or 2');
  }

  const notes = typeof body.notes === 'string' ? body.notes.trim() : '';

  return {
    errors,
    hemoglobinLevel,
    weight,
    unitsCollected,
    notes,
  };
};

const getAppointmentPoints = (donationType = DONATION_TYPE_LABELS.WHOLE_BLOOD) => {
  return APPOINTMENT_POINTS_BY_DONATION_TYPE[donationType]
    ?? APPOINTMENT_POINTS_BY_DONATION_TYPE[DONATION_TYPE_LABELS.WHOLE_BLOOD];
};

const runEligibilityCheck = async (donor, { donationType, excludeDonationId }) => {
  const donationTypeKey = normalizeDonationTypeRequestKey(donationType) || 'blood';
  const eligibility = await eligibilityService.canDonate(donor, {
    persistTravelDeferral: false,
    donationType: donationTypeKey,
    excludeDonationId,
  });
  const reason = buildSafetyRejectionReason(eligibility, donor);
  const ineligible = isDonorIneligible(eligibility, donor);
  return { eligibility, reason, ineligible };
};

const rejectAndReturn = async ({ appointmentId, donationId, requestId, donorId, reason, rejectedBy, session }) => {
  const localSession = session || await mongoose.startSession();
  let createdSession = !session;
  try {
    await (session ? Promise.resolve() : localSession.withTransaction(async () => {}));
    if (!session) {
      await localSession.withTransaction(async () => {
        await rejectDonationLifecycle({
          appointmentId,
          donationId,
          requestId,
          donorId,
          reason: `Donation rejected due to safety check failure at confirmation: ${reason}`,
          rejectedBy,
          requestStatus: 'pending',
          donationStatus: 'rejected',
          session: localSession,
        });
      });
    } else {
      await rejectDonationLifecycle({
        appointmentId,
        donationId,
        requestId,
        donorId,
        reason: `Donation rejected due to safety check failure at confirmation: ${reason}`,
        rejectedBy,
        requestStatus: 'pending',
        donationStatus: 'rejected',
        session,
      });
    }
  } finally {
    if (createdSession) localSession.endSession();
  }
  return { rejected: true, reason };
};

export const completeAppointmentDonation = async ({ appointment, donor, donation, medicalValidation, rejectedBy }) => {
  const isRequestLinked = Boolean(appointment.requestId);
  let donationDoc = donation;

  if (isRequestLinked) {
    const { eligibility, reason, ineligible } = await runEligibilityCheck(donor, {
      donationType: appointment.donationType,
      excludeDonationId: donationDoc?._id,
    });

    if (ineligible) {
      await rejectAndReturn({
        appointmentId: appointment._id,
        requestId: appointment.requestId._id || appointment.requestId,
        donorId: donor._id,
        reason,
        rejectedBy,
      });
      return { rejected: true, reason: `Safety validation failed: ${reason}` };
    }
  }

  const now = new Date();
  const request = appointment.requestId?._id
    ? await Request.findById(appointment.requestId._id).select('status urgency hospitalId hospitalName fullName')
    : null;

  try {
    if (donationDoc) {
      if (donationDoc.status === 'pending') {
        validateTransition('donation', donationDoc.status, 'scheduled');
        validateTransition('donation', 'scheduled', 'completed');
      } else {
        validateTransition('donation', donationDoc.status, 'completed');
      }
    } else {
      validateTransition('donation', 'scheduled', 'completed');
    }

    if (request) {
      if (request.status === 'accepted') {
        validateTransition('request', request.status, 'in-progress');
        validateTransition('request', 'in-progress', 'completed');
      } else {
        validateTransition('request', request.status, 'completed');
      }
    }
  } catch (err) {
    return { rejected: true, reason: err.message };
  }

  let updatedAppointment = null;
  let updatedRequest = null;
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      if (donationDoc) {
        donationDoc.appointmentId = appointment._id;
        donationDoc.quantity = medicalValidation.unitsCollected;
        donationDoc.unitsCollected = medicalValidation.unitsCollected;
        donationDoc.hemoglobinLevel = medicalValidation.hemoglobinLevel;
        donationDoc.weight = medicalValidation.weight;
        donationDoc.status = 'completed';
        donationDoc.notes = medicalValidation.notes;
        donationDoc.verifiedAt = now;
        donationDoc.completedDate = now;
        donationDoc.qrToken = appointment.qrToken || null;
        await donationDoc.save({ session });
      } else {
        [donationDoc] = await Donation.create([{
          appointmentId: appointment._id,
          donorId: donor._id,
          requestId: appointment.requestId?._id || null,
          quantity: medicalValidation.unitsCollected,
          unitsCollected: medicalValidation.unitsCollected,
          hemoglobinLevel: medicalValidation.hemoglobinLevel,
          weight: medicalValidation.weight,
          status: 'scheduled',
          notes: medicalValidation.notes,
          qrToken: appointment.qrToken || null,
        }], { session });
        donationDoc.status = 'completed';
        donationDoc.verifiedAt = now;
        donationDoc.completedDate = now;
        await donationDoc.save({ session });
      }

      updatedAppointment = await Appointment.findByIdAndUpdate(
        appointment._id,
        {
          $set: {
            status: 'completed',
            verificationStatus: 'completed',
            verificationVerifiedAt: now,
            verificationChecklist: {
              ...(appointment.verificationChecklist || {}),
              completedAt: now,
            },
          },
        },
        { returnDocument: 'after', session }
      );

      if (request) {
        const requestToUpdate = await Request.findById(request._id).session(session);
        if (requestToUpdate.status === 'accepted') {
          requestToUpdate.status = 'in-progress';
          await requestToUpdate.save({ session });
        }
        requestToUpdate.status = 'completed';
        requestToUpdate.completedAt = now;
        requestToUpdate.acceptedDonationId = donationDoc._id;
        updatedRequest = await requestToUpdate.save({ session });
      }

      validateOrphanState('donation', donationDoc, { appointment: updatedAppointment });
      validateOrphanState('appointment', updatedAppointment, { donation: donationDoc });
      if (updatedRequest) {
        validateOrphanState('request', updatedRequest, { donation: donationDoc });
      }

      await Donor.findByIdAndUpdate(donor._id, { lastDonationDate: now }, { session });
    });
  } catch (err) {
    throw err;
  } finally {
    session.endSession();
  }

  await rewardService.onDonationCompleted(donor._id, donationDoc._id, request?.urgency === 'critical');

  activityService.logActivity(donor._id, {
    type: 'donation',
    action: 'completed_donation',
    title: ACTIVITY_TITLE_MAP.donation_completed,
    description: `Successfully completed donation of ${medicalValidation.unitsCollected} unit(s)`,
    referenceId: donationDoc._id.toString(),
    referenceType: 'Donation',
    metadata: {
      appointmentId: appointment._id.toString(),
      requestId: appointment.requestId?._id?.toString?.() || null,
      hemoglobinLevel: medicalValidation.hemoglobinLevel,
      weight: medicalValidation.weight,
      unitsCollected: medicalValidation.unitsCollected,
    },
  }).catch((error) => {
    logger.error('DONATION_COMPLETION_ACTIVITY_LOG_FAILED', {
      event: 'DONATION_COMPLETION_ACTIVITY_LOG_FAILED',
      donorId: donor._id.toString(),
      donationId: donationDoc._id.toString(),
      error: error.message,
    });
  });

  const pointsEarned = getAppointmentPoints(appointment.donationType);

  return {
    rejected: false,
    donation: donationDoc,
    appointment: updatedAppointment,
    request: updatedRequest,
    pointsEarned,
  };
};

export const completeRequestDonation = async ({ donation, donor, medicalValidation, rejectedBy }) => {
  const { eligibility, reason, ineligible } = await runEligibilityCheck(donor, {
    donationType: donation.requestId?.type || 'blood',
    excludeDonationId: donation._id,
  });

  if (ineligible) {
    await rejectAndReturn({
      donationId: donation._id,
      requestId: donation.requestId._id || donation.requestId,
      donorId: donor._id,
      reason,
      rejectedBy,
    });
    return { rejected: true, reason: `Safety validation failed: ${reason}` };
  }

  try {
    if (donation.status === 'pending') {
      validateTransition('donation', donation.status, 'scheduled');
      validateTransition('donation', 'scheduled', 'completed');
    } else {
      validateTransition('donation', donation.status, 'completed');
    }

    const request = donation.requestId;
    if (request) {
      if (request.status === 'accepted') {
        validateTransition('request', request.status, 'in-progress');
        validateTransition('request', 'in-progress', 'completed');
      } else {
        validateTransition('request', request.status, 'completed');
      }
    }
  } catch (err) {
    return { rejected: true, reason: err.message };
  }

  const now = new Date();
  let updatedRequest = null;
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      donation.quantity = medicalValidation.unitsCollected;
      donation.unitsCollected = medicalValidation.unitsCollected;
      donation.hemoglobinLevel = medicalValidation.hemoglobinLevel;
      donation.weight = medicalValidation.weight;
      donation.status = 'completed';
      donation.notes = medicalValidation.notes;
      donation.verifiedAt = now;
      donation.completedDate = now;
      await donation.save({ session });

      const requestToUpdate = await Request.findById(donation.requestId._id).session(session);
      if (requestToUpdate.status === 'accepted') {
        requestToUpdate.status = 'in-progress';
        await requestToUpdate.save({ session });
      }
      requestToUpdate.status = 'completed';
      requestToUpdate.completedAt = now;
      requestToUpdate.acceptedDonationId = donation._id;
      updatedRequest = await requestToUpdate.save({ session });

      validateOrphanState('donation', donation);
      validateOrphanState('request', updatedRequest, { donation });

      await Donor.findByIdAndUpdate(donor._id, { lastDonationDate: now }, { session });
    });
  } catch (err) {
    throw err;
  } finally {
    session.endSession();
  }

  await rewardService.onDonationCompleted(donor._id, donation._id, donation.requestId?.urgency === 'critical');

  activityService.logActivity(donor._id, {
    type: 'donation',
    action: 'completed_donation',
    title: ACTIVITY_TITLE_MAP.donation_completed,
    description: `Successfully completed donation of ${medicalValidation.unitsCollected} unit(s)`,
    referenceId: donation._id.toString(),
    referenceType: 'Donation',
    metadata: {
      requestId: donation.requestId?._id?.toString?.() || null,
      hemoglobinLevel: medicalValidation.hemoglobinLevel,
      weight: medicalValidation.weight,
      unitsCollected: medicalValidation.unitsCollected,
    },
  }).catch((error) => {
    logger.error('DONATION_COMPLETION_ACTIVITY_LOG_FAILED', {
      event: 'DONATION_COMPLETION_ACTIVITY_LOG_FAILED',
      donorId: donor._id.toString(),
      donationId: donation._id.toString(),
      error: error.message,
    });
  });

  const pointsEarned = getAppointmentPoints(donation.requestId?.type === 'double_red_cells' ? DONATION_TYPE_LABELS.DOUBLE_RED_CELLS : DONATION_TYPE_LABELS.WHOLE_BLOOD);

  return {
    rejected: false,
    donation,
    request: updatedRequest,
    pointsEarned,
  };
};