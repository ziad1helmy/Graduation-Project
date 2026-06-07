import crypto from 'node:crypto';
import mongoose from 'mongoose';
import response from '../utils/response.js';
import { logger } from '../utils/logger.js';
import Appointment from '../models/Appointment.model.js';
import Donation from '../models/Donation.model.js';
import Donor from '../models/Donor.model.js';
import Request from '../models/Request.model.js';
import * as activityService from '../services/activity.service.js';
import { ACTIVITY_TITLE_MAP } from '../constants/rewards.constants.js';
import {
  APPOINTMENT_POINTS_BY_DONATION_TYPE,
  DONATION_TYPE_LABELS,
  DONATION_TYPE_OPTIONS,
} from '../constants/donation.constants.js';
import * as eligibilityService from '../services/eligibility.service.js';
import * as donationService from '../services/donation.service.js';
import * as rewardService from '../services/reward.service.js';
import { normalizeDonationTypeRequestKey } from '../services/appointment.service.js';
import { rejectDonationLifecycle } from '../services/request-lifecycle.service.js';
import ELIGIBILITY_KEYS from '../utils/eligibility-keys.js';
import { validateTransition, validateOrphanState } from '../utils/state-machine.js';

const MIN_HEMOGLOBIN_LEVEL = 12.5;
const MAX_HEMOGLOBIN_LEVEL = 20;
const MIN_DONOR_WEIGHT_KG = 50;
const VALID_UNITS_COLLECTED = [1, 2];

const getUserId = (req) => req?.user?.userId || req?.user?._id;

const getAppointmentPoints = (donationType = DONATION_TYPE_LABELS.WHOLE_BLOOD) => {
  return APPOINTMENT_POINTS_BY_DONATION_TYPE[donationType]
    ?? APPOINTMENT_POINTS_BY_DONATION_TYPE[DONATION_TYPE_LABELS.WHOLE_BLOOD];
};

const toLocation = (coordinates) => {
  const lat = Number(coordinates?.lat ?? coordinates?.latitude);
  const lng = Number(coordinates?.lng ?? coordinates?.longitude);

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return null;
  }

  return {
    lat,
    lng,
  };
};

const buildInitials = (fullName = '') => {
  const parts = String(fullName).trim().split(/\s+/).filter(Boolean);
  return parts.slice(0, 2).map((part) => part[0]?.toUpperCase() || '').join('') || 'D';
};

const isChecklistComplete = (checklist = {}) => {
  return Boolean(
    checklist.idVerified
    && checklist.questionnaireCompleted
    && checklist.consentSigned
  );
};

const normalizeUnitsCollected = (value, donationType) => {
  if (value === undefined || value === null || value === '') {
    return donationType === DONATION_TYPE_LABELS.DOUBLE_RED_CELLS ? 2 : 1;
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || !VALID_UNITS_COLLECTED.includes(parsed)) {
    return null;
  }

  return parsed;
};

const validateMedicalInputs = (body = {}, donationType = DONATION_TYPE_LABELS.WHOLE_BLOOD) => {
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

const populateAppointmentForVerification = (query) => {
  return query
    .populate('donorId', 'fullName phoneNumber email bloodType location lastDonationDate hemoglobinLevel weight isOptedIn isSuspended gender dateOfBirth temporaryDeferralUntil lastDeferralReason')
    .populate('hospitalId', 'fullName hospitalName contactNumber location')
    .populate('requestId', 'type bloodType urgency quantity unitsNeeded isEmergency hospitalContact hospitalName contactNumber requiredBy status');
};

const buildVerificationPayload = (appointment, eligibility, sessionId = null, translate = (value) => value) => {
  const donor = appointment.donorId;
  const hospital = appointment.hospitalId;
  const donorLocation = donor?.location?.coordinates;

  return {
    verificationStatus: appointment.verificationStatus || 'pending',
    verificationSessionId: sessionId || appointment.verificationSessionId || null,
    appointment: {
      id: appointment._id,
      appointmentDate: appointment.appointmentDate,
      status: appointment.status,
      donationType: appointment.donationType || DONATION_TYPE_LABELS.WHOLE_BLOOD,
      qrToken: appointment.qrToken || null,
      qrScannedAt: appointment.qrScannedAt || null,
      qrExpiresAt: appointment.qrExpiresAt || null,
      requestId: appointment.requestId?._id || appointment.requestId || null,
      hospital: hospital
        ? {
            id: hospital._id,
            fullName: hospital.fullName || null,
            hospitalName: hospital.hospitalName || null,
            contactNumber: hospital.contactNumber || null,
            location: hospital.location || null,
          }
        : null,
    },
    donor: {
      id: donor?._id || null,
      fullName: donor?.fullName || null,
      initials: buildInitials(donor?.fullName),
      bloodType: donor?.bloodType || null,
      phoneNumber: donor?.phoneNumber || null,
      email: donor?.email || null,
      location: toLocation(donorLocation),
      lastDonationDate: donor?.lastDonationDate || null,
      hemoglobinLevel: donor?.hemoglobinLevel ?? null,
      weight: donor?.weight ?? null,
      participation: donor?.isOptedIn !== false,
    },
    eligibility: {
      eligible: Boolean(eligibility?.eligible),
      reason: eligibility?.reason ? translate(eligibility.reason) : null,
      nextEligibleDate: eligibility?.nextEligibleDate || null,
    },
    checklistRequirements: {
      idVerified: true,
      questionnaireCompleted: true,
      consentSigned: true,
    },
  };
};

const buildDonationSummary = (donation, appointment, pointsEarned) => ({
  donation,
  appointment: {
    id: appointment._id,
    status: appointment.status,
    verificationStatus: appointment.verificationStatus,
    donationType: appointment.donationType || DONATION_TYPE_LABELS.WHOLE_BLOOD,
  },
  pointsEarned,
});


const ensureAppointmentIsActive = (appointment) => {
  if (!appointment) {
    return { status: 404, message: 'Appointment not found' };
  }

  if (appointment.status === 'cancelled') {
    return { status: 400, message: 'Appointment is cancelled' };
  }

  if (appointment.status === 'completed') {
    return { status: 409, message: 'Appointment has already been completed' };
  }

  if (!['pending', 'confirmed'].includes(appointment.status)) {
    return { status: 400, message: 'Appointment is not active' };
  }

  if (appointment.verificationStatus === 'rejected') {
    return { status: 409, message: 'Appointment verification was rejected' };
  }

  if (appointment.qrExpiresAt && new Date() > new Date(appointment.qrExpiresAt)) {
    return { status: 400, message: 'QR code expired' };
  }

  return null;
};

export const completeDonation = async (req, res, next) => {
  try {
    const body = req.body || {};
    const query = req.query || {};
    const params = req.params || {};
    const donationId = body.donationId || query.donationId || params.donationId;
    const appointmentId = body.appointmentId || query.appointmentId || params.appointmentId;

    if (appointmentId) {
      if (!mongoose.Types.ObjectId.isValid(appointmentId)) {
        return response.error(res, 400, 'Invalid appointmentId');
      }

      const appointment = await populateAppointmentForVerification(
        Appointment.findById(appointmentId)
      );

      if (!appointment) {
        return response.error(res, 404, 'Appointment not found');
      }

      const activeError = ensureAppointmentIsActive(appointment);
      if (activeError) {
        return response.error(res, activeError.status, activeError.message);
      }

      if (!appointment.qrScannedAt || appointment.verificationStatus !== 'verified') {
        return response.error(res, 400, 'Appointment must be verified before confirming donation');
      }

      if (!isChecklistComplete(appointment.verificationChecklist || {})) {
        return response.error(res, 400, 'Pre-donation checklist must be completed');
      }

      const donor = appointment.donorId;
      if (!donor) {
        return response.error(res, 404, 'Donor not found');
      }

      const medicalValidation = validateMedicalInputs(body, appointment.donationType);
      if (medicalValidation.errors.length) {
        return response.error(res, 400, medicalValidation.errors[0], medicalValidation.errors);
      }

      // Guard: appointment must transition to completed.
      try {
        validateTransition('appointment', appointment.status, 'completed');
      } catch (err) {
        return response.error(res, 400, err.message);
      }

      let donation = await Donation.findOne({ appointmentId: appointment._id });
      if (donation && donation.status === 'completed') {
        return response.error(res, 409, 'Donation has already been confirmed for this appointment');
      }

      if (!donation && appointment.requestId?._id) {
        donation = await Donation.findOne({
          donorId: donor._id,
          requestId: appointment.requestId._id,
          status: { $in: ['pending', 'scheduled'] },
        });
      }

      const now = new Date();
      const request = appointment.requestId?._id
        ? await Request.findById(appointment.requestId._id).select('status urgency hospitalId hospitalName fullName')
        : null;

      try {
        if (donation) {
          if (donation.status === 'pending') {
            validateTransition('donation', donation.status, 'scheduled');
            validateTransition('donation', 'scheduled', 'completed');
          } else {
            validateTransition('donation', donation.status, 'completed');
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
        return response.error(res, 400, err.message);
      }

      let updatedAppointment = null;
      let updatedRequest = null;
      const session = await mongoose.startSession();
      try {
        await session.withTransaction(async () => {
          if (donation) {
            donation.appointmentId = appointment._id;
            donation.quantity = medicalValidation.unitsCollected;
            donation.unitsCollected = medicalValidation.unitsCollected;
            donation.hemoglobinLevel = medicalValidation.hemoglobinLevel;
            donation.weight = medicalValidation.weight;
            donation.status = 'completed';
            donation.notes = medicalValidation.notes;
            donation.verifiedAt = now;
            donation.completedDate = now;
            donation.qrToken = appointment.qrToken || null;
            await donation.save({ session });
          } else {
            [donation] = await Donation.create([{
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
            donation.status = 'completed';
            donation.verifiedAt = now;
            donation.completedDate = now;
            await donation.save({ session });
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
            requestToUpdate.acceptedDonationId = donation._id;
            updatedRequest = await requestToUpdate.save({ session });
          }

          validateOrphanState('donation', donation, { appointment: updatedAppointment });
          validateOrphanState('appointment', updatedAppointment, { donation });
          if (updatedRequest) {
            validateOrphanState('request', updatedRequest, { donation });
          }

          await Donor.findByIdAndUpdate(donor._id, { lastDonationDate: now }, { session });
        });
      } catch (err) {
        return response.error(res, 400, err.message);
      } finally {
        session.endSession();
      }

      await rewardService.onDonationCompleted(donor._id, donation._id, request?.urgency === 'critical');

      // Rationale: Activity logging is intentionally best-effort and run outside the
      // main Mongoose transaction. A failure to log to the User timeline should NOT
      // roll back a successful clinical blood donation completion in the hospital.
      // We log errors as structured events for monitoring and dashboard alerting.
      activityService.logActivity(donor._id, {
        type: 'donation',
        action: 'completed_donation',
        title: ACTIVITY_TITLE_MAP.donation_completed,
        description: `Successfully completed donation of ${medicalValidation.unitsCollected} unit(s)`,
        referenceId: donation._id.toString(),
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
          donationId: donation._id.toString(),
          error: error.message,
        });
      });

      const pointsEarned = getAppointmentPoints(appointment.donationType);

      return response.success(res, 200, 'Donation completed successfully', buildDonationSummary(donation, appointment, pointsEarned));
    }

    if (!donationId) {
      return response.error(res, 400, 'appointmentId or donationId is required');
    }

    const donation = await donationService.updateDonationStatus(donationId, 'completed', {
      completedDate: body.completedDate,
      notes: body.notes,
    });

    return response.success(res, 200, 'Donation completed successfully', donation);
  } catch (error) {
    if (error.code === 11000 && error.keyPattern?.appointmentId) {
      return response.error(res, 409, 'Donation has already been confirmed for this appointment');
    }
    if (error.message === 'Donation not found') {
      return response.error(res, 404, error.message);
    }
    if (error.message === 'Invalid donation status') {
      return response.error(res, 400, error.message);
    }
    if (error.message === 'Completed donation requires a completed appointment') {
      return response.error(res, 400, error.message);
    }
    next(error);
  }
};

export const getDonationTypes = (req, res) => {
  return response.success(res, 200, 'Donation types retrieved successfully', [
    ...DONATION_TYPE_OPTIONS,
  ]);
};

export const validateDonationEligibility = async (req, res, next) => {
  try {
    const donorId = getUserId(req);
    const body = req.body || {};
    const { hospitalId, date, donationType } = body;

    if (!hospitalId || !date) {
      return response.error(res, 400, 'hospitalId and date are required');
    }

    const donor = await Donor.findById(donorId);
    if (!donor) {
      return response.error(res, 404, 'Donor not found');
    }

    const requestedDate = new Date(date);
    if (Number.isNaN(requestedDate.getTime())) {
      return response.error(res, 400, 'Invalid date');
    }

    // Normalize donationType values from client (labels) to canonical request.type keys
    const donationTypeKey = donationType ? normalizeDonationTypeRequestKey(donationType) : 'blood';
    const eligibility = await eligibilityService.canDonate(donor, {
      persistTravelDeferral: false,
      donationType: donationTypeKey || 'blood',
    });
    if (!eligibility.eligible) {
      return response.success(res, 200, 'Donation eligibility checked', {
        canDonate: false,
        reason: req.t ? req.t(eligibility.reason || 'eligibility.donorNotEligible') : (eligibility.reason || 'eligibility.donorNotEligible'),
        ...(eligibility.nextEligibleDate ? { nextEligibleDate: eligibility.nextEligibleDate } : {}),
      });
    }

    const duplicateAppointment = await Appointment.findOne({
      donorId,
      hospitalId,
      appointmentDate: requestedDate,
      status: { $in: ['pending', 'confirmed'] },
    });

    if (duplicateAppointment) {
      return response.success(res, 200, 'Donation eligibility checked', {
        canDonate: false,
        reason: 'You already have a booking for this hospital and date',
      });
    }

    return response.success(res, 200, 'Donation eligibility checked', {
      canDonate: true,
      reason: null,
    });
  } catch (error) {
    next(error);
  }
};

export const verifyQr = async (req, res, next) => {
  try {
    const body = req.body || {};
    const qrToken = String(body.qrToken || body.qrCode || '').trim();
    if (!qrToken) return response.error(res, 400, 'qrToken is required');

    const appointment = await populateAppointmentForVerification(
      Appointment.findOne({ qrToken })
    );

    // appointment fetched

    if (!appointment) return response.error(res, 404, 'Invalid QR code');

    const activeError = ensureAppointmentIsActive(appointment);
    if (activeError) {
      return response.error(res, activeError.status, activeError.message);
    }

    if (appointment.qrScannedAt) {
      return response.error(res, 409, 'QR code already used');
    }

    const donor = appointment.donorId;
    if (!donor) {
      return response.error(res, 404, 'Donor not found');
    }

    // Normalize appointment donation label to request.type key before eligibility check
    const apptDonationKey = normalizeDonationTypeRequestKey(appointment.donationType) || 'blood';
    const donation = await Donation.findOne({ appointmentId: appointment._id });
    const eligibility = await eligibilityService.canDonate(donor, {
      persistTravelDeferral: false,
      donationType: apptDonationKey,
      excludeDonationId: donation?._id,
    });
    // eligibility computed
    if (!eligibility.eligible) {
      return response.error(res, 403, eligibility.reason || ELIGIBILITY_KEYS.DONOR_NOT_ELIGIBLE);
    }

    const now = new Date();
    const sessionId = crypto.randomBytes(16).toString('hex');
    const updatedAppointment = await populateAppointmentForVerification(
      Appointment.findOneAndUpdate(
        {
          _id: appointment._id,
          qrScannedAt: null,
          status: { $in: ['pending', 'confirmed'] },
        },
        {
          $set: {
            qrScannedAt: now,
            verificationStatus: 'pending',
            verificationSessionId: sessionId,
            verificationStartedAt: now,
            verificationVerifiedAt: null,
            verificationRejectedAt: null,
            verificationRejectedReason: null,
            verificationChecklist: {
              idVerified: false,
              questionnaireCompleted: false,
              consentSigned: false,
              completedAt: null,
            },
          },
        },
        { returnDocument: 'after' }
      )
    );

    if (!updatedAppointment) return response.error(res, 409, 'QR code already used');

    activityService.logActivity(donor._id, {
      type: 'donation',
      action: 'qr_verified',
      title: ACTIVITY_TITLE_MAP.donation_verified,
      description: 'Hospital QR verified',
      referenceId: updatedAppointment.requestId?._id?.toString?.() || updatedAppointment._id.toString(),
      referenceType: 'Request',
      metadata: {
        appointmentId: updatedAppointment._id.toString(),
        hospitalId: updatedAppointment.hospitalId?._id?.toString?.() || null,
        donationType: updatedAppointment.donationType,
      },
    }).catch(() => {});

    return response.success(res, 200, 'Donation verification started successfully', buildVerificationPayload(updatedAppointment, eligibility, sessionId, req.t));
  } catch (error) {
    next(error);
  }
};

export const confirmArrival = async (req, res, next) => {
  try {
    const body = req.body || {};
    const params = req.params || {};
    const appointmentId = body.appointmentId || params.appointmentId;
    if (!appointmentId) {
      return response.error(res, 400, 'appointmentId is required');
    }

    if (!mongoose.Types.ObjectId.isValid(appointmentId)) {
      return response.error(res, 400, 'Invalid appointmentId');
    }

    const appointment = await populateAppointmentForVerification(
      Appointment.findById(appointmentId)
    );

    if (!appointment) {
      return response.error(res, 404, 'Appointment not found');
    }

    const activeError = ensureAppointmentIsActive(appointment);
    if (activeError) {
      return response.error(res, activeError.status, activeError.message);
    }
        // Ensure donor and donationType are taken from the appointment
        const donor = appointment.donorId;
        const donationType = appointment.donationType;
        if (!donor) {
          return response.error(res, 404, 'Donor not found');
        }

        const donationTypeKey = normalizeDonationTypeRequestKey(donationType) || 'blood';
        const linkedDonation = await Donation.findOne({ appointmentId: appointment._id });
        const eligibility = await eligibilityService.canDonate(donor, {
          persistTravelDeferral: false,
          donationType: donationTypeKey,
          excludeDonationId: linkedDonation?._id,
        });

    if (appointment.verificationStatus === 'rejected') {
      return response.error(res, 409, 'Rejected appointments cannot continue');
    }

    const checklist = body.checklist || {};
    const checklistPayload = {
      idVerified: Boolean(checklist.idVerified),
      questionnaireCompleted: Boolean(checklist.questionnaireCompleted),
      consentSigned: Boolean(checklist.consentSigned),
    };

    if (!isChecklistComplete(checklistPayload)) {
      return response.error(res, 400, 'All checklist items must be completed');
    }

    if (appointment.status !== 'confirmed') {
      try {
        validateTransition('appointment', appointment.status, 'confirmed');
      } catch (err) {
        return response.error(res, 400, err.message);
      }
    }

    const now = new Date();
    const updatedAppointment = await populateAppointmentForVerification(
      Appointment.findByIdAndUpdate(
        appointment._id,
        {
          $set: {
            status: 'confirmed',
            verificationStatus: 'verified',
            verificationVerifiedAt: now,
            verificationChecklist: {
              ...checklistPayload,
              completedAt: now,
            },
          },
        },
        { returnDocument: 'after' }
      )
    );

    if (!updatedAppointment) {
      return response.error(res, 409, 'Verification has already been updated');
    }

    // Call orphan validation to assert cross-entity constraints
    const donation = await Donation.findOne({ appointmentId: updatedAppointment._id });
    try {
      validateOrphanState('appointment', updatedAppointment, { donation });
    } catch (err) {
      return response.error(res, 400, err.message);
    }

    return response.success(res, 200, 'Arrival confirmed successfully', {
      readyForDonation: true,
      appointment: buildVerificationPayload(updatedAppointment, {
        eligible: true,
        reason: 'Checklist completed',
      }),
      checklist: {
        ...checklistPayload,
        completedAt: now,
      },
      donationDetails: {
        appointmentId: updatedAppointment._id,
        donationType: updatedAppointment.donationType || DONATION_TYPE_LABELS.WHOLE_BLOOD,
        scheduledDate: updatedAppointment.appointmentDate,
        lastDonationDate: updatedAppointment.donorId?.lastDonationDate || null,
        bloodType: updatedAppointment.donorId?.bloodType || null,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const rejectVerification = async (req, res, next) => {
  try {
    const body = req.body || {};
    const params = req.params || {};
    const appointmentId = body.appointmentId || params.appointmentId;
    const reason = typeof body.reason === 'string' ? body.reason.trim() : '';

    if (!appointmentId) {
      return response.error(res, 400, 'appointmentId is required');
    }

    if (!mongoose.Types.ObjectId.isValid(appointmentId)) {
      return response.error(res, 400, 'Invalid appointmentId');
    }

    const appointment = await Appointment.findById(appointmentId);
    if (!appointment) {
      return response.error(res, 404, 'Appointment not found');
    }

    if (appointment.status === 'completed') {
      return response.error(res, 409, 'Appointment has already been completed');
    }

    // Guard: validate appointment transition to 'completed' status is not already in a terminal state
    // (the appointment itself moves to a verification-failed state, not completed,
    //  so we only block if it is already 'completed' or 'cancelled').
    try {
      // verificationStatus rejection does not change appointment.status directly;
      // the downstream rejectDonationLifecycle cancels the appointment.
      // We verify the appointment is not already terminal before proceeding.
      if (appointment.status === 'cancelled') {
        return response.error(res, 400, 'Appointment is already cancelled');
      }
    } catch (err) {
      return response.error(res, 400, err.message);
    }

    const now = new Date();
    const session = await mongoose.startSession();
    let updatedAppointment;
    let rejection;
    try {
      await session.withTransaction(async () => {
        updatedAppointment = await Appointment.findByIdAndUpdate(
          appointment._id,
          {
            $set: {
              verificationStatus: 'rejected',
              verificationRejectedAt: now,
              verificationRejectedReason: reason || 'Verification rejected by hospital',
            },
          },
          { returnDocument: 'after', session }
        );

        rejection = await rejectDonationLifecycle({
          appointmentId: updatedAppointment._id,
          requestId: updatedAppointment.requestId?._id || updatedAppointment.requestId,
          donorId: updatedAppointment.donorId?._id || updatedAppointment.donorId,
          reason: reason || 'Verification rejected by hospital',
          rejectedBy: req.user.userId,
          requestStatus: 'pending',
          session,
        });
      });
    } finally {
      session.endSession();
    }

    return response.success(res, 200, 'Verification rejected successfully', {
      appointmentId: updatedAppointment._id,
      verificationStatus: updatedAppointment.verificationStatus,
      rejectedAt: updatedAppointment.verificationRejectedAt,
      reason: updatedAppointment.verificationRejectedReason,
      requestStatus: rejection.request?.status || null,
      donationStatus: rejection.donation?.status || null,
    });
  } catch (error) {
    next(error);
  }
};

export const resetVerification = async (req, res, next) => {
  try {
    const body = req.body || {};
    const params = req.params || {};
    const appointmentId = body.appointmentId || params.appointmentId;
    if (!appointmentId) {
      return response.error(res, 400, 'appointmentId is required');
    }

    if (!mongoose.Types.ObjectId.isValid(appointmentId)) {
      return response.error(res, 400, 'Invalid appointmentId');
    }

    const appointment = await Appointment.findById(appointmentId);
    if (!appointment) {
      return response.error(res, 404, 'Appointment not found');
    }

    if (appointment.status === 'completed') {
      return response.error(res, 409, 'Completed appointments cannot be reset');
    }

    if (appointment.status !== 'pending') {
      try {
        validateTransition('appointment', appointment.status, 'pending', { isAdminOverride: true });
      } catch (err) {
        return response.error(res, 400, err.message);
      }
    }

    const updatedAppointment = await Appointment.findByIdAndUpdate(
      appointment._id,
      {
        $set: {
          status: 'pending',
          qrScannedAt: null,
          verificationStatus: 'pending',
          verificationSessionId: null,
          verificationStartedAt: null,
          verificationVerifiedAt: null,
          verificationRejectedAt: null,
          verificationRejectedReason: null,
          verificationChecklist: {
            idVerified: false,
            questionnaireCompleted: false,
            consentSigned: false,
            completedAt: null,
          },
        },
      },
      { returnDocument: 'after' }
    );

    return response.success(res, 200, 'Verification reset successfully', {
      appointmentId: updatedAppointment._id,
      verificationStatus: updatedAppointment.verificationStatus,
    });
  } catch (error) {
    next(error);
  }
};

export const scanQr = async (req, res, next) => {
  return verifyQr(req, res, next);
};
