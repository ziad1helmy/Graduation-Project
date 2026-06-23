import crypto from 'node:crypto';
import mongoose from 'mongoose';
import response from '../utils/response.js';
import { logger } from '../utils/logger.js';
import Appointment from '../models/Appointment.model.js';
import Donation from '../models/Donation.model.js';
import Donor from '../models/Donor.model.js';
import * as activityService from '../services/activity.service.js';
import { ACTIVITY_TITLE_MAP } from '../constants/rewards.constants.js';
import {
  DONATION_TYPE_LABELS,
  DONATION_TYPE_OPTIONS,
} from '../constants/donation.constants.js';
import * as eligibilityService from '../services/eligibility.service.js';
import * as donationService from '../services/donation.service.js';
import { normalizeDonationTypeRequestKey } from '../services/appointment.service.js';
import { completeAppointmentDonation, completeRequestDonation, validateMedicalInputs } from '../services/donation-completion.service.js';
import { rejectDonationLifecycle } from '../services/request-lifecycle.service.js';
import ELIGIBILITY_KEYS from '../utils/eligibility-keys.js';
import { validateTransition, validateOrphanState } from '../utils/state-machine.js';
import { toLocation, isValidObjectId } from '../utils/query.js';
import { asyncHandler } from '../middlewares/asyncHandler.js';
import { HttpError } from '../utils/HttpError.js';

const getUserId = (req) => req?.user?.userId || req?.user?._id;

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

const populateAppointmentForVerification = (query) => {
  return query
    .populate('donorId', 'fullName phoneNumber email bloodType location lastDonationDate hemoglobinLevel weight isOptedIn isSuspended gender dateOfBirth temporaryDeferralUntil lastDeferralReason')
    .populate('hospitalId', 'fullName hospitalName phone contactNumber location')
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
            contactNumber: hospital.contactNumber || hospital.phone || null,
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

const buildDonationVerificationPayload = (donation, eligibility, sessionId = null, translate = (value) => value) => {
  const donor = donation.donorId;
  const request = donation.requestId;
  const hospital = request?.hospitalId;
  const donorLocation = donor?.location?.coordinates;

  return {
    verificationStatus: donation.verificationStatus || 'pending',
    verificationSessionId: sessionId || donation.verificationSessionId || null,
    appointment: {
      id: donation._id,
      appointmentDate: donation.createdAt,
      status: donation.status,
      donationType: donation.requestId?.type || DONATION_TYPE_LABELS.WHOLE_BLOOD,
      qrToken: donation.qrToken || null,
      qrScannedAt: donation.qrScannedAt || null,
      qrExpiresAt: donation.qrExpiresAt || null,
      requestId: request?._id || null,
      hospital: hospital
        ? {
            id: hospital._id,
            fullName: hospital.fullName || null,
            hospitalName: hospital.hospitalName || null,
            contactNumber: hospital.contactNumber || hospital.phone || null,
            location: hospital.location || null,
          }
        : null,
    },
    donationDetails: {
      id: donation._id,
      requestId: request?._id || null,
      status: donation.status,
      donationType: donation.requestId?.type || DONATION_TYPE_LABELS.WHOLE_BLOOD,
      qrToken: donation.qrToken || null,
      qrScannedAt: donation.qrScannedAt || null,
      qrExpiresAt: donation.qrExpiresAt || null,
      hospital: hospital
        ? {
            id: hospital._id,
            fullName: hospital.fullName || null,
            hospitalName: hospital.hospitalName || null,
            contactNumber: hospital.contactNumber || hospital.phone || null,
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

export const completeDonation = asyncHandler(async (req, res) => {
  const body = req.body || {};
  const query = req.query || {};
  const params = req.params || {};
  const donationId = body.donationId || query.donationId || params.donationId;
  const appointmentId = body.appointmentId || query.appointmentId || params.appointmentId;

  if (appointmentId) {
    if (!mongoose.Types.ObjectId.isValid(appointmentId)) {
      throw new HttpError(400, 'Invalid appointmentId');
    }

    const appointment = await populateAppointmentForVerification(
      Appointment.findById(appointmentId)
    );

    if (!appointment) {
      throw new HttpError(404, 'Appointment not found');
    }

    const activeError = ensureAppointmentIsActive(appointment);
    if (activeError) {
      throw new HttpError(activeError.status, activeError.message);
    }

    if (!appointment.qrScannedAt || appointment.verificationStatus !== 'verified') {
      throw new HttpError(400, 'Appointment must be verified before confirming donation');
    }

    if (!isChecklistComplete(appointment.verificationChecklist || {})) {
      throw new HttpError(400, 'Pre-donation checklist must be completed');
    }

    const donor = appointment.donorId;
    if (!donor) {
      throw new HttpError(404, 'Donor not found');
    }

    const medicalValidation = validateMedicalInputs(body, appointment.donationType);
    if (medicalValidation.errors.length) {
      throw new HttpError(400, medicalValidation.errors[0], medicalValidation.errors);
    }

    try {
      validateTransition('appointment', appointment.status, 'completed');
    } catch (err) {
      throw new HttpError(400, err.message);
    }

    let donation = await Donation.findOne({ appointmentId: appointment._id });
    if (donation && donation.status === 'completed') {
      throw new HttpError(409, 'Donation has already been confirmed for this appointment');
    }

    if (!donation && appointment.requestId?._id) {
      donation = await Donation.findOne({
        donorId: donor._id,
        requestId: appointment.requestId._id,
        status: { $in: ['pending', 'scheduled'] },
      });
    }

    let result;
    try {
      result = await completeAppointmentDonation({
        appointment,
        donor,
        donation,
        medicalValidation,
        rejectedBy: req.user.userId,
      });
    } catch (error) {
      if (error.code === 11000 && error.keyPattern?.appointmentId) {
        throw new HttpError(409, 'Donation has already been confirmed for this appointment');
      }
      if (error.message === 'Donation not found') {
        throw new HttpError(404, error.message);
      }
      if (error.message === 'Invalid donation status') {
        throw new HttpError(400, error.message);
      }
      if (error.message === 'Completed donation requires a completed appointment') {
        throw new HttpError(400, error.message);
      }
      throw error;
    }

    if (result.rejected) {
      throw new HttpError(403, result.reason);
    }

    return response.success(res, 200, 'Donation completed successfully', buildDonationSummary(result.donation, appointment, result.pointsEarned));
  }

  if (!donationId) {
    throw new HttpError(400, 'appointmentId or donationId is required');
  }

  if (!mongoose.Types.ObjectId.isValid(donationId)) {
    throw new HttpError(400, 'Invalid donationId');
  }

  const donation = await Donation.findById(donationId).populate([
    { path: 'donorId', select: 'fullName phoneNumber email bloodType location lastDonationDate hemoglobinLevel weight isOptedIn isSuspended gender dateOfBirth temporaryDeferralUntil lastDeferralReason' },
    { path: 'requestId', select: 'type bloodType urgency quantity unitsNeeded isEmergency hospitalContact hospitalName contactNumber requiredBy status hospitalId' },
  ]);

  if (!donation) {
    throw new HttpError(404, 'Donation not found');
  }

  const isRequestDonation = Boolean(donation.requestId) && Boolean(donation.qrToken);

  if (isRequestDonation) {
    if (donation.status === 'completed') {
      throw new HttpError(409, 'Donation has already been completed');
    }
    if (!isChecklistComplete(donation.verificationChecklist || {})) {
      throw new HttpError(400, 'Pre-donation checklist must be completed');
    }

    const donor = donation.donorId;
    if (!donor) {
      throw new HttpError(404, 'Donor not found');
    }

    const medicalValidation = validateMedicalInputs(body, donation.requestId?.type || 'blood');
    if (medicalValidation.errors.length) {
      throw new HttpError(400, medicalValidation.errors[0], medicalValidation.errors);
    }

    const result = await completeRequestDonation({
      donation,
      donor,
      medicalValidation,
      rejectedBy: req.user.userId,
    });

    if (result.rejected) {
      throw new HttpError(403, result.reason);
    }

    return response.success(res, 200, 'Donation completed successfully', {
      donation: result.donation,
      pointsEarned: result.pointsEarned,
    });
  }

  const updatedDonation = await donationService.updateDonationStatus(donationId, 'completed', {
    completedDate: body.completedDate,
    notes: body.notes,
  });

  return response.success(res, 200, 'Donation completed successfully', updatedDonation);
});

export const getDonationTypes = (req, res) => {
  return response.success(res, 200, 'Donation types retrieved successfully', [
    ...DONATION_TYPE_OPTIONS,
  ]);
};

export const validateDonationEligibility = asyncHandler(async (req, res) => {
  const donorId = getUserId(req);
  const body = req.body || {};
  const { hospitalId, date, donationType } = body;

  if (!hospitalId || !date) {
    throw new HttpError(400, 'hospitalId and date are required');
  }

  const donor = await Donor.findById(donorId);
  if (!donor) {
    throw new HttpError(404, 'Donor not found');
  }

  const requestedDate = new Date(date);
  if (Number.isNaN(requestedDate.getTime())) {
    throw new HttpError(400, 'Invalid date');
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
});

const parseChecklist = (body) => {
  const checklist = body.checklist || {};
  return {
    idVerified: Boolean(checklist.idVerified),
    questionnaireCompleted: Boolean(checklist.questionnaireCompleted),
    consentSigned: Boolean(checklist.consentSigned),
  };
};

const buildChecklistUpdate = (checklistPayload, now, isVerified) => {
  if (!isVerified) {
    return {
      idVerified: false,
      questionnaireCompleted: false,
      consentSigned: false,
      completedAt: null,
    };
  }
  return {
    ...checklistPayload,
    completedAt: now,
  };
};

const validateDonationStatus = (donation) => {
  if (donation.status === 'cancelled') throw new HttpError(400, 'Donation request is cancelled');
  if (donation.status === 'completed') throw new HttpError(409, 'Donation has already been completed');
  if (donation.status === 'expired') throw new HttpError(400, 'Donation request has expired');
  if (donation.status === 'abandoned') throw new HttpError(400, 'Donation request was abandoned');
  if (!['pending', 'scheduled'].includes(donation.status)) throw new HttpError(400, 'Donation is not active');
  if (donation.verificationStatus === 'rejected') throw new HttpError(409, 'Donation verification was rejected');
  if (donation.qrExpiresAt && new Date() > new Date(donation.qrExpiresAt)) throw new HttpError(400, 'QR code expired');
  if (donation.qrScannedAt) throw new HttpError(409, 'QR code already used');
};

const validateAppointmentStatus = (appointment) => {
  const activeError = ensureAppointmentIsActive(appointment);
  if (activeError) throw new HttpError(activeError.status, activeError.message);
  if (appointment.qrScannedAt) throw new HttpError(409, 'QR code already used');
};

export const verifyQr = asyncHandler(async (req, res) => {
  const body = req.body || {};
  const qrToken = String(body.qrToken || body.qrCode || '').trim();
  if (!qrToken) throw new HttpError(400, 'qrToken is required');

  const checklistPayload = parseChecklist(body);
  const hasChecklist = body.checklist != null;
  const isVerified = hasChecklist && isChecklistComplete(checklistPayload);

  if (hasChecklist && !isVerified) {
    throw new HttpError(400, 'All checklist items must be completed');
  }

  let appointment = await populateAppointmentForVerification(
    Appointment.findOne({ qrToken })
  );

  let donation = null;
  let isRequestDonation = false;

  if (!appointment) {
    donation = await Donation.findOne({ qrToken }).populate([
      { path: 'donorId', select: 'fullName phoneNumber email bloodType location lastDonationDate hemoglobinLevel weight isOptedIn isSuspended gender dateOfBirth temporaryDeferralUntil lastDeferralReason' },
      { path: 'requestId', populate: { path: 'hospitalId', select: 'fullName hospitalName phone location' } },
    ]);

    if (!donation || !donation.requestId) {
      throw new HttpError(404, 'Invalid QR code');
    }

    isRequestDonation = true;
  }

  if (isRequestDonation) {
    validateDonationStatus(donation);
  } else {
    validateAppointmentStatus(appointment);
  }

  const donor = isRequestDonation ? donation.donorId : appointment.donorId;
  if (!donor) {
    throw new HttpError(404, 'Donor not found');
  }

  const donationType = isRequestDonation
    ? (donation.requestId?.type || 'blood')
    : (normalizeDonationTypeRequestKey(appointment.donationType) || 'blood');

  const eligibility = await eligibilityService.canDonate(donor, {
    persistTravelDeferral: false,
    donationType,
    excludeDonationId: isRequestDonation ? donation._id : (await Donation.findOne({ appointmentId: appointment._id }))?._id,
  });

  if (!eligibility.eligible) {
    throw new HttpError(403, eligibility.reason || ELIGIBILITY_KEYS.DONOR_NOT_ELIGIBLE);
  }

  const now = new Date();
  const sessionId = crypto.randomBytes(16).toString('hex');

  if (isRequestDonation) {
    const finalStatus = isVerified ? 'verified' : 'pending';
    const updateFields = {
      qrScannedAt: now,
      verificationStatus: finalStatus,
      verificationSessionId: sessionId,
      verificationStartedAt: now,
      verificationVerifiedAt: isVerified ? now : null,
      verificationRejectedAt: null,
      verificationRejectedReason: null,
      verificationChecklist: buildChecklistUpdate(checklistPayload, now, isVerified),
    };

    const updatedDonation = await Donation.findOneAndUpdate(
      {
        _id: donation._id,
        qrScannedAt: null,
        status: { $in: ['pending', 'scheduled'] },
      },
      { $set: updateFields },
      { returnDocument: 'after' }
    ).populate([
      { path: 'donorId', select: 'fullName phoneNumber email bloodType location lastDonationDate hemoglobinLevel weight isOptedIn isSuspended gender dateOfBirth temporaryDeferralUntil lastDeferralReason' },
      { path: 'requestId', populate: { path: 'hospitalId', select: 'fullName hospitalName phone location' } },
    ]);

    if (!updatedDonation) throw new HttpError(409, 'QR code already used');

    if (isVerified) {
      try {
        validateOrphanState('donation', updatedDonation);
      } catch (err) {
        throw new HttpError(400, err.message);
      }
    }

    activityService.logActivity(donor._id, {
      type: 'donation',
      action: 'qr_verified',
      title: ACTIVITY_TITLE_MAP.donation_verified,
      description: 'Hospital QR verified',
      referenceId: updatedDonation.requestId?._id?.toString?.() || updatedDonation._id.toString(),
      referenceType: 'Request',
      metadata: {
        donationId: updatedDonation._id.toString(),
        hospitalId: updatedDonation.requestId?.hospitalId?._id?.toString?.() || updatedDonation.requestId?.hospitalId?.toString?.() || null,
        donationType: updatedDonation.requestId?.type || 'blood',
      },
    }).catch(() => {});

    const message = isVerified ? 'Arrival confirmed successfully' : 'Donation verification started successfully';
    const eligibilityPayload = isVerified ? { eligible: true, reason: 'Checklist completed' } : eligibility;
    return response.success(res, 200, message, buildDonationVerificationPayload(updatedDonation, eligibilityPayload, sessionId, req.t));
  } else {
    const finalStatus = isVerified ? 'verified' : 'pending';
    const updateFields = {
      qrScannedAt: now,
      status: isVerified ? 'confirmed' : appointment.status,
      verificationStatus: finalStatus,
      verificationSessionId: sessionId,
      verificationStartedAt: now,
      verificationVerifiedAt: isVerified ? now : null,
      verificationRejectedAt: null,
      verificationRejectedReason: null,
      verificationChecklist: buildChecklistUpdate(checklistPayload, now, isVerified),
    };

    const updatedAppointment = await populateAppointmentForVerification(
      Appointment.findOneAndUpdate(
        {
          qrToken,
          qrScannedAt: null,
          status: { $in: ['pending', 'confirmed'] },
        },
        { $set: updateFields },
        { returnDocument: 'after' }
      )
    );

    if (!updatedAppointment) throw new HttpError(409, 'QR code already used');

    if (isVerified) {
      const linkedDonation = await Donation.findOne({ appointmentId: updatedAppointment._id });
      try {
        validateOrphanState('appointment', updatedAppointment, { donation: linkedDonation });
      } catch (err) {
        throw new HttpError(400, err.message);
      }
    }

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

    const message = isVerified ? 'Arrival confirmed successfully' : 'Donation verification started successfully';
    const eligibilityPayload = isVerified ? { eligible: true, reason: 'Checklist completed' } : eligibility;
    return response.success(res, 200, message, buildVerificationPayload(updatedAppointment, eligibilityPayload, sessionId, req.t));
  }
});


export const rejectVerification = asyncHandler(async (req, res) => {
  const body = req.body || {};
  const params = req.params || {};
  const targetId = body.appointmentId || body.donationId || params.appointmentId;
  const reason = typeof body.reason === 'string' ? body.reason.trim() : '';

  if (!targetId) {
    throw new HttpError(400, 'appointmentId or donationId is required');
  }

  if (!mongoose.Types.ObjectId.isValid(targetId)) {
    throw new HttpError(400, 'Invalid id');
  }

  const appointment = await Appointment.findById(targetId);
  let donation = null;
  let isRequestDonation = false;

  if (!appointment) {
    donation = await Donation.findById(targetId).populate('donorId', 'fullName phoneNumber email bloodType');
    if (!donation) {
      throw new HttpError(404, 'Appointment or Donation not found');
    }
    isRequestDonation = true;
  }

  if (isRequestDonation) {
    if (donation.status === 'completed') {
      throw new HttpError(409, 'Donation has already been completed');
    }
    if (donation.status === 'rejected') {
      throw new HttpError(409, 'Donation has already been rejected');
    }
    if (donation.status === 'cancelled') {
      throw new HttpError(400, 'Donation is already cancelled');
    }
    if (donation.status === 'expired') {
      throw new HttpError(400, 'Donation has expired');
    }

    const now = new Date();
    const session = await mongoose.startSession();
    let updatedDonation;
    let rejection;
    try {
      await session.withTransaction(async () => {
        updatedDonation = await Donation.findByIdAndUpdate(
          donation._id,
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
          donationId: updatedDonation._id,
          requestId: donation.requestId?._id || donation.requestId,
          donorId: donation.donorId?._id || donation.donorId,
          reason: reason || 'Verification rejected by hospital',
          rejectedBy: req.user.userId,
          requestStatus: 'pending',
          donationStatus: 'rejected',
          session,
        });
      });
    } finally {
      session.endSession();
    }

    return response.success(res, 200, 'Verification rejected successfully', {
      donationId: updatedDonation._id,
      verificationStatus: updatedDonation.verificationStatus,
      rejectedAt: updatedDonation.verificationRejectedAt,
      reason: updatedDonation.verificationRejectedReason,
      requestStatus: rejection.request?.status || null,
      donationStatus: rejection.donation?.status || null,
    });
  }

  if (appointment.status === 'completed') {
    throw new HttpError(409, 'Appointment has already been completed');
  }

  if (appointment.status === 'cancelled') {
    throw new HttpError(400, 'Appointment is already cancelled');
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
});

export const resetVerification = asyncHandler(async (req, res) => {
  const body = req.body || {};
  const params = req.params || {};
  const targetId = body.appointmentId || body.donationId || params.appointmentId;
  if (!targetId) {
    throw new HttpError(400, 'appointmentId or donationId is required');
  }

  if (!mongoose.Types.ObjectId.isValid(targetId)) {
    throw new HttpError(400, 'Invalid id');
  }

  const appointment = await Appointment.findById(targetId);
  let donation = null;
  let isRequestDonation = false;

  if (!appointment) {
    donation = await Donation.findById(targetId);
    if (!donation) {
      throw new HttpError(404, 'Appointment or Donation not found');
    }
    isRequestDonation = true;
  }

  if (isRequestDonation) {
    if (donation.status === 'completed') {
      throw new HttpError(409, 'Completed donations cannot be reset');
    }
    if (donation.status === 'expired') {
      throw new HttpError(400, 'Expired donations cannot be reset');
    }
    if (donation.status === 'cancelled') {
      throw new HttpError(400, 'Cancelled donations cannot be reset');
    }

    if (donation.verificationStatus !== 'rejected' && donation.verificationStatus !== 'pending') {
      try {
        validateTransition('donation', donation.status, 'pending', { isAdminOverride: true });
      } catch (err) {
        throw new HttpError(400, err.message);
      }
    }

    const updatedDonation = await Donation.findByIdAndUpdate(
      donation._id,
      {
        $set: {
          verificationStatus: 'pending',
          qrScannedAt: null,
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
      donationId: updatedDonation._id,
      verificationStatus: updatedDonation.verificationStatus,
    });
  }

  if (appointment.status === 'completed') {
    throw new HttpError(409, 'Completed appointments cannot be reset');
  }

  if (appointment.status !== 'pending') {
    try {
      validateTransition('appointment', appointment.status, 'pending', { isAdminOverride: true });
    } catch (err) {
      throw new HttpError(400, err.message);
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
});

export const scanQr = async (req, res, next) => {
  return verifyQr(req, res, next);
};
