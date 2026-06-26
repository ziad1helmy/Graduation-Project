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
import { DISQUALIFYING_DISEASES, DISEASE_SCREENING_DEFAULTS } from '../constants/disease.constants.js';
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

const requireHospitalOwnership = (resource, req) => {
  if (req.user.role !== 'hospital') return;
  const hospitalId = resource?.hospitalId?._id?.toString?.() || resource?.hospitalId?.toString?.();
  if (!hospitalId || hospitalId !== req.user.userId.toString()) {
    throw new HttpError(403, 'donation.error_unauthorized_access_resource');
  }
};

const requireDonationHospitalOwnership = (donation, req) => {
  if (req.user.role !== 'hospital') return;
  const requestHospitalId = donation?.requestId?.hospitalId?._id?.toString?.()
    || donation?.requestId?.hospitalId?.toString?.();
  if (requestHospitalId && requestHospitalId !== req.user.userId.toString()) {
    throw new HttpError(403, 'donation.error_unauthorized_access_donation');
  }
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
    return { status: 404, message: 'donation.error_appointment_not_found' };
  }

  if (appointment.status === 'cancelled') {
    return { status: 400, message: 'Appointment has been cancelled' };
  }

  if (appointment.status === 'completed') {
    return { status: 409, message: 'appointment.error_already_completed' };
  }

  if (!['pending', 'confirmed'].includes(appointment.status)) {
    return { status: 400, message: `Appointment status "${appointment.status}" is not active. Only pending or confirmed appointments can proceed` };
  }

  if (appointment.verificationStatus === 'rejected') {
    return { status: 409, message: 'Appointment verification was rejected' };
  }

  if (appointment.qrExpiresAt && new Date() > new Date(appointment.qrExpiresAt)) {
    return { status: 400, message: 'donation.error_qr_expired' };
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
      throw new HttpError(400, 'donation.error_invalid_appointment_id');
    }

    const appointment = await populateAppointmentForVerification(
      Appointment.findById(appointmentId)
    );

    if (!appointment) {
      throw new HttpError(404, 'donation.error_appointment_not_found');
    }

    requireHospitalOwnership(appointment, req);

    const activeError = ensureAppointmentIsActive(appointment);
    if (activeError) {
      throw new HttpError(activeError.status, activeError.message);
    }

    if (!appointment.qrScannedAt || appointment.verificationStatus !== 'verified') {
      throw new HttpError(400, 'appointment.error_must_verify_before_donation');
    }

    if (!isChecklistComplete(appointment.verificationChecklist || {})) {
      throw new HttpError(400, 'appointment.error_checklist_required');
    }

    const donor = appointment.donorId;
    if (!donor) {
      throw new HttpError(404, 'donation.error_donor_not_found');
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
      throw new HttpError(409, 'appointment.error_already_confirmed');
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
        throw new HttpError(409, 'appointment.error_already_confirmed');
      }
      if (error.message === 'donation.error_donation_not_found') {
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

    return response.success(res, 200, 'donation.completed', buildDonationSummary(result.donation, appointment, result.pointsEarned));
  }

  if (!donationId) {
    throw new HttpError(400, 'donation.error_appointment_or_donation_id_required');
  }

  if (!mongoose.Types.ObjectId.isValid(donationId)) {
    throw new HttpError(400, 'donation.error_invalid_donation_id');
  }

  const donation = await Donation.findById(donationId).populate([
    { path: 'donorId', select: 'fullName phoneNumber email bloodType location lastDonationDate hemoglobinLevel weight isOptedIn isSuspended gender dateOfBirth temporaryDeferralUntil lastDeferralReason' },
    { path: 'requestId', select: 'type bloodType urgency quantity unitsNeeded isEmergency hospitalContact hospitalName contactNumber requiredBy status hospitalId' },
  ]);

  if (!donation) {
    throw new HttpError(404, 'donation.error_donation_not_found');
  }

  requireDonationHospitalOwnership(donation, req);

  const isRequestDonation = Boolean(donation.requestId) && Boolean(donation.qrToken);

  if (isRequestDonation) {
    if (donation.status === 'completed') {
      throw new HttpError(409, 'donation.error_donation_already_completed');
    }
    if (!isChecklistComplete(donation.verificationChecklist || {})) {
      throw new HttpError(400, 'appointment.error_checklist_required');
    }

    const donor = donation.donorId;
    if (!donor) {
      throw new HttpError(404, 'donation.error_donor_not_found');
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

    return response.success(res, 200, 'donation.completed', {
      donation: result.donation,
      pointsEarned: result.pointsEarned,
    });
  }

  const updatedDonation = await donationService.updateDonationStatus(donationId, 'completed', {
    completedDate: body.completedDate,
    notes: body.notes,
  });

  return response.success(res, 200, 'donation.completed', updatedDonation);
});

export const getDonationTypes = (req, res) => {
  return response.success(res, 200, 'donation.types_retrieved', [
    ...DONATION_TYPE_OPTIONS,
  ]);
};

export const validateDonationEligibility = asyncHandler(async (req, res) => {
  const donorId = getUserId(req);
  const body = req.body || {};
  const { hospitalId, date, donationType } = body;

  if (!hospitalId || !date) {
    throw new HttpError(400, 'appointment.error_hospital_date_required');
  }

  const donor = await Donor.findById(donorId);
  if (!donor) {
    throw new HttpError(404, 'donation.error_donor_not_found');
  }

  const requestedDate = new Date(date);
  if (Number.isNaN(requestedDate.getTime())) {
    throw new HttpError(400, 'appointment.error_invalid_date');
  }

  // Normalize donationType values from client (labels) to canonical request.type keys
  const donationTypeKey = donationType ? normalizeDonationTypeRequestKey(donationType) : 'blood';
  const eligibility = await eligibilityService.canDonate(donor, {
    persistTravelDeferral: false,
    donationType: donationTypeKey || 'blood',
  });
  if (!eligibility.eligible) {
    return response.success(res, 200, 'donation.eligibility_checked', {
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
    return response.success(res, 200, 'donation.eligibility_checked', {
      canDonate: false,
      reason: 'You already have a booking for this hospital and date',
    });
  }

  return response.success(res, 200, 'donation.eligibility_checked', {
    canDonate: true,
    reason: null,
  });
});

const validateDonationStatus = (donation) => {
  if (donation.status === 'cancelled') throw new HttpError(400, 'donation.error_donation_request_cancelled');
  if (donation.status === 'completed') throw new HttpError(409, 'donation.error_donation_already_completed');
  if (donation.status === 'expired') throw new HttpError(400, 'donation.error_donation_request_expired');
  if (donation.status === 'abandoned') throw new HttpError(400, 'donation.error_donation_request_abandoned');
  if (!['pending', 'scheduled'].includes(donation.status)) throw new HttpError(400, `Donation status "${donation.status}" is not active. Only pending or scheduled donations can proceed`);
  if (donation.verificationStatus === 'rejected') throw new HttpError(409, 'donation.error_verification_rejected');
  if (donation.qrExpiresAt && new Date() > new Date(donation.qrExpiresAt)) throw new HttpError(400, 'donation.error_qr_expired');
  if (donation.qrScannedAt) throw new HttpError(409, 'donation.qr_already_used');
};

const validateAppointmentStatus = (appointment) => {
  const activeError = ensureAppointmentIsActive(appointment);
  if (activeError) throw new HttpError(activeError.status, activeError.message);
  if (appointment.qrScannedAt) throw new HttpError(409, 'donation.qr_already_used');
};

export const verifyQr = asyncHandler(async (req, res) => {
  const body = req.body || {};
  const qrToken = String(body.qrToken || body.qrCode || '').trim();
  if (!qrToken) throw new HttpError(400, 'donation.error_qr_token_required');

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
      throw new HttpError(404, 'donation.error_no_donation_found_qr');
    }

    isRequestDonation = true;
  }

  if (isRequestDonation) {
    requireDonationHospitalOwnership(donation, req);
    validateDonationStatus(donation);
  } else {
    requireHospitalOwnership(appointment, req);
    validateAppointmentStatus(appointment);
  }

  const donor = isRequestDonation ? donation.donorId : appointment.donorId;
  if (!donor) {
    throw new HttpError(404, 'donation.error_donor_not_found');
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
    const updateFields = {
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

    if (!updatedDonation) throw new HttpError(409, 'donation.qr_already_used');

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

    return response.success(res, 200, 'donation.verified', buildDonationVerificationPayload(updatedDonation, eligibility, sessionId, req.t));
  } else {
    const updateFields = {
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

    if (!updatedAppointment) throw new HttpError(409, 'donation.qr_already_used');

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

    return response.success(res, 200, 'donation.verified', buildVerificationPayload(updatedAppointment, eligibility, sessionId, req.t));
  }
});


const parseConfirmChecklist = (body) => {
  const checklist = body.checklist || {};
  return {
    idVerified: Boolean(checklist.idVerified),
    questionnaireCompleted: Boolean(checklist.questionnaireCompleted),
    consentSigned: Boolean(checklist.consentSigned),
  };
};

const isConfirmChecklistComplete = (checklist) => {
  return Boolean(
    checklist.idVerified
    && checklist.questionnaireCompleted
    && checklist.consentSigned
  );
};

const parseDiseaseScreening = (body) => {
  const screening = body.diseaseScreening || {};
  return {
    screeningCompleted: Boolean(screening.screeningCompleted),
    disqualifyingDiseaseFound: Boolean(screening.disqualifyingDiseaseFound),
    disqualifyingDiseases: Array.isArray(screening.disqualifyingDiseases) ? screening.disqualifyingDiseases : [],
    notes: typeof screening.notes === 'string' ? screening.notes.trim() : '',
  };
};

const computeDeferralDate = (disqualifyingDiseases) => {
  let maxDays = null;
  for (const diseaseCode of disqualifyingDiseases) {
    const disease = DISQUALIFYING_DISEASES.find((d) => d.code === diseaseCode);
    if (disease) {
      if (disease.deferralDays === null) return null;
      if (maxDays === null || disease.deferralDays > maxDays) {
        maxDays = disease.deferralDays;
      }
    }
  }
  return maxDays;
};

const applyDonorDeferral = async (donorId, diseaseCodes, reason) => {
  const deferralDays = computeDeferralDate(diseaseCodes);
  const deferralDate = deferralDays === null
    ? new Date(Date.now() + 100 * 365 * 24 * 60 * 60 * 1000)
    : new Date(Date.now() + deferralDays * 24 * 60 * 60 * 1000);

  await Donor.findByIdAndUpdate(donorId, {
    $set: {
      temporaryDeferralUntil: deferralDate,
      lastDeferralReason: reason || 'Disqualifying disease found during hospital screening',
    },
  });
};

export const confirmVerification = asyncHandler(async (req, res) => {
  const { appointmentId } = req.params;
  if (!appointmentId || !isValidObjectId(appointmentId)) {
    throw new HttpError(400, 'donation.error_valid_appointment_id_required');
  }

  const body = req.body || {};

  if (!body.verificationSessionId) {
    throw new HttpError(400, 'donation.error_session_id_required');
  }

  const checklistPayload = parseConfirmChecklist(body);
  if (!isConfirmChecklistComplete(checklistPayload)) {
    throw new HttpError(400, 'appointment.error_all_checklist_required');
  }

  const screeningPayload = parseDiseaseScreening(body);
  if (!screeningPayload.screeningCompleted) {
    throw new HttpError(400, 'donation.error_disease_screening_required');
  }

  const appointment = await populateAppointmentForVerification(
    Appointment.findById(appointmentId)
  );

  if (!appointment) {
    throw new HttpError(404, 'donation.error_appointment_not_found');
  }

  requireHospitalOwnership(appointment, req);

  if (appointment.verificationSessionId !== body.verificationSessionId) {
    throw new HttpError(400, 'donation.error_invalid_verification_session');
  }

  if (appointment.verificationStatus !== 'pending') {
    throw new HttpError(409, `Verification is already ${appointment.verificationStatus}`);
  }

  if (appointment.status !== 'pending' && appointment.status !== 'confirmed') {
    throw new HttpError(400, `Appointment status "${appointment.status}" cannot be verified`);
  }

  const donor = appointment.donorId;
  if (!donor) {
    throw new HttpError(404, 'donation.error_donor_not_found');
  }

  const now = new Date();
  const linkedDonation = await Donation.findOne({ appointmentId: appointment._id });

  let updatedAppointment;

  if (screeningPayload.disqualifyingDiseaseFound && screeningPayload.disqualifyingDiseases.length > 0) {
    await applyDonorDeferral(donor._id, screeningPayload.disqualifyingDiseases, `Disqualifying disease: ${screeningPayload.disqualifyingDiseases.join(', ')}`);

    updatedAppointment = await Appointment.findByIdAndUpdate(
      appointmentId,
      {
        $set: {
          verificationStatus: 'rejected',
          verificationRejectedAt: now,
          verificationRejectedReason: `Disqualifying disease found: ${screeningPayload.disqualifyingDiseases.join(', ')}`,
          verificationChecklist: {
            ...checklistPayload,
            completedAt: now,
          },
          diseaseScreening: {
            ...screeningPayload,
            screenedAt: now,
          },
        },
      },
      { returnDocument: 'after' }
    );

    try {
      await rejectDonationLifecycle({
        appointmentId: updatedAppointment._id,
        requestId: updatedAppointment.requestId?._id || updatedAppointment.requestId,
        donorId: donor._id,
        reason: `Disqualifying disease found: ${screeningPayload.disqualifyingDiseases.join(', ')}`,
        rejectedBy: req.user.userId,
        session: null,
      });
    } catch (err) {
      logger.warn('rejectDonationLifecycle failed after disease deferral', { error: err.message, appointmentId });
    }

    return response.success(res, 200, 'donation.error_donor_deferred_disease', {
      verificationStatus: 'rejected',
      verificationRejectedReason: `Disqualifying disease found: ${screeningPayload.disqualifyingDiseases.join(', ')}`,
      donorDeferred: true,
      appointmentId: updatedAppointment._id,
    });
  }

  updatedAppointment = await populateAppointmentForVerification(
    Appointment.findByIdAndUpdate(
      appointmentId,
      {
        $set: {
          status: 'confirmed',
          verificationStatus: 'verified',
          verificationVerifiedAt: now,
          verificationChecklist: {
            ...checklistPayload,
            completedAt: now,
          },
          diseaseScreening: {
            ...screeningPayload,
            screenedAt: now,
          },
        },
      },
      { returnDocument: 'after' }
    )
  );

  try {
    validateOrphanState('appointment', updatedAppointment, { donation: linkedDonation });
  } catch (err) {
    throw new HttpError(400, err.message);
  }

  activityService.logActivity(donor._id, {
    type: 'donation',
    action: 'donation_completed',
    title: 'Donation Verified',
    description: 'Hospital confirmed arrival after checklist and disease screening',
    referenceId: updatedAppointment.requestId?._id?.toString?.() || updatedAppointment._id.toString(),
    referenceType: 'Appointment',
    metadata: {
      appointmentId: updatedAppointment._id.toString(),
      hospitalId: updatedAppointment.hospitalId?._id?.toString?.() || null,
      screeningPassed: true,
    },
  }).catch(() => {});

  return response.success(res, 200, 'donation.arrival_confirmed', {
    verificationStatus: 'verified',
    appointmentId: updatedAppointment._id,
    appointment: {
      id: updatedAppointment._id,
      status: updatedAppointment.status,
      verificationStatus: updatedAppointment.verificationStatus,
      donationType: updatedAppointment.donationType,
    },
    donor: {
      id: donor._id,
      fullName: donor.fullName,
      initials: buildInitials(donor.fullName),
      bloodType: donor.bloodType,
    },
    diseaseScreening: {
      screeningCompleted: screeningPayload.screeningCompleted,
      disqualifyingDiseaseFound: false,
    },
  });
});


export const rejectVerification = asyncHandler(async (req, res) => {
  const body = req.body || {};
  const params = req.params || {};
  const targetId = body.appointmentId || body.donationId || params.appointmentId;
  const reason = typeof body.reason === 'string' ? body.reason.trim() : '';

  if (!targetId) {
    throw new HttpError(400, 'donation.error_appointment_or_donation_id_required');
  }

  if (!mongoose.Types.ObjectId.isValid(targetId)) {
    throw new HttpError(400, 'error.invalid_id');
  }

  const appointment = await Appointment.findById(targetId);
  let donation = null;
  let isRequestDonation = false;

  if (!appointment) {
    donation = await Donation.findById(targetId).populate('donorId', 'fullName phoneNumber email bloodType');
    if (!donation) {
      throw new HttpError(404, 'donation.error_appointment_or_donation_not_found');
    }
    isRequestDonation = true;
  }

  if (isRequestDonation) {
    requireDonationHospitalOwnership(donation, req);
    if (donation.status === 'completed') {
      throw new HttpError(409, 'donation.error_donation_already_completed');
    }
    if (donation.status === 'rejected') {
      throw new HttpError(409, 'donation.error_donation_rejected');
    }
    if (donation.status === 'cancelled') {
      throw new HttpError(400, 'donation.error_donation_cancelled');
    }
    if (donation.status === 'expired') {
      throw new HttpError(400, 'donation.error_donation_expired');
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

    return response.success(res, 200, 'donation.verification_rejected', {
      donationId: updatedDonation._id,
      verificationStatus: updatedDonation.verificationStatus,
      rejectedAt: updatedDonation.verificationRejectedAt,
      reason: updatedDonation.verificationRejectedReason,
      requestStatus: rejection.request?.status || null,
      donationStatus: rejection.donation?.status || null,
    });
  }

  requireHospitalOwnership(appointment, req);

  if (appointment.status === 'completed') {
    throw new HttpError(409, 'appointment.error_already_completed');
  }

  if (appointment.status === 'cancelled') {
    throw new HttpError(400, 'donation.error_appointment_already_cancelled');
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

  return response.success(res, 200, 'donation.verification_rejected', {
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
    throw new HttpError(400, 'donation.error_appointment_or_donation_id_required');
  }

  if (!mongoose.Types.ObjectId.isValid(targetId)) {
    throw new HttpError(400, 'error.invalid_id');
  }

  const appointment = await Appointment.findById(targetId);
  let donation = null;
  let isRequestDonation = false;

  if (!appointment) {
    donation = await Donation.findById(targetId);
    if (!donation) {
      throw new HttpError(404, 'donation.error_appointment_or_donation_not_found');
    }
    isRequestDonation = true;
  }

  if (isRequestDonation) {
    requireDonationHospitalOwnership(donation, req);
    if (donation.status === 'completed') {
      throw new HttpError(409, 'donation.error_completed_donations_cannot_reset');
    }
    if (donation.status === 'expired') {
      throw new HttpError(400, 'donation.error_expired_donations_cannot_reset');
    }
    if (donation.status === 'cancelled') {
      throw new HttpError(400, 'donation.error_cancelled_donations_cannot_reset');
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

    return response.success(res, 200, 'donation.verification_reset', {
      donationId: updatedDonation._id,
      verificationStatus: updatedDonation.verificationStatus,
    });
  }

  requireHospitalOwnership(appointment, req);

  if (appointment.status === 'completed') {
    throw new HttpError(409, 'appointment.error_completed_cannot_reset');
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

  return response.success(res, 200, 'donation.verification_reset', {
    appointmentId: updatedAppointment._id,
    verificationStatus: updatedAppointment.verificationStatus,
  });
});

export const scanQr = async (req, res, next) => {
  return verifyQr(req, res, next);
};
