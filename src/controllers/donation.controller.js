import response from '../utils/response.js';
import Appointment from '../models/Appointment.model.js';
import Donation from '../models/Donation.model.js';
import Donor from '../models/Donor.model.js';
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

const getUserId = (req) => req?.user?.userId || req?.user?._id;

export const completeDonation = async (req, res, next) => {
  try {
    const donationId = req.body.donationId || req.query.donationId || req.params.donationId;

    if (!donationId) {
      return response.error(res, 400, 'donationId is required');
    }

    const donation = await donationService.updateDonationStatus(donationId, 'completed', {
      completedDate: req.body.completedDate,
      notes: req.body.notes,
    });

    return response.success(res, 200, 'Donation completed successfully', donation);
  } catch (error) {
    if (error.message === 'Donation not found') {
      return response.error(res, 404, error.message);
    }
    if (error.message === 'Invalid donation status') {
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

const getAppointmentPoints = (donationType = DONATION_TYPE_LABELS.WHOLE_BLOOD) => {
  return APPOINTMENT_POINTS_BY_DONATION_TYPE[donationType]
    ?? APPOINTMENT_POINTS_BY_DONATION_TYPE[DONATION_TYPE_LABELS.WHOLE_BLOOD];
};

export const validateDonationEligibility = async (req, res, next) => {
  try {
    const donorId = getUserId(req);
    const { hospitalId, date, donationType } = req.body;

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

    // Pass donationType to check type-specific cooldowns (blood: 56d, plasma: 14d, platelets: 7d, organ: 365d)
    const eligibility = await eligibilityService.canDonate(donor, { 
      persistTravelDeferral: false,
      donationType: donationType || 'blood', // defaults to blood if not specified
    });
    if (!eligibility.eligible) {
      return response.success(res, 200, 'Donation eligibility checked', {
        canDonate: false,
        reason: eligibility.reason || 'Donor is not eligible',
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
    const qrToken = req.body.qrToken || req.body.qrCode;
    if (!qrToken) return response.error(res, 400, 'qrToken is required');

    const appointment = await Appointment.findOne({ qrToken })
      .populate('donorId', 'bloodType suspensionStatus lastDonationDate')
      .populate('hospitalId', 'fullName hospitalName');

    if (!appointment) return response.error(res, 404, 'Invalid QR code');
    if (appointment.status === 'cancelled') return response.error(res, 400, 'Appointment is cancelled');
    // If appointment already completed or previously scanned, treat as already-used
    if (appointment.status === 'completed' || appointment.qrScannedAt) return response.error(res, 409, 'QR code already used');
    if (!['pending', 'confirmed'].includes(appointment.status)) return response.error(res, 400, 'Appointment is not active');

    // Check QR expiry if qrExpiresAt is set
    if (appointment.qrExpiresAt && new Date() > appointment.qrExpiresAt)
      return response.error(res, 400, 'QR code expired');

    const donor = appointment.donorId;
    const eligibility = await eligibilityService.canDonate(donor, { persistTravelDeferral: false });
    if (!eligibility.eligible) return response.error(res, 403, eligibility.reason || 'Donor not eligible');

    // Atomic update: mark appointment as scanned only if not scanned yet
    const now = new Date();
    const updatedAppointment = await Appointment.findOneAndUpdate(
      { _id: appointment._id, qrScannedAt: null, status: { $in: ['pending', 'confirmed'] } },
      { $set: { status: 'completed', qrScannedAt: now } },
      { returnDocument: 'after' }
    ).populate('donorId', 'bloodType suspensionStatus lastDonationDate').populate('hospitalId', 'fullName hospitalName');

    if (!updatedAppointment) return response.error(res, 409, 'QR code already used');

    const donation = await Donation.create({
      donorId: donor._id,
      requestId: appointment.requestId || null,
      quantity: 1,
      status: 'completed',
      completedDate: now,
    });

    await Donor.findByIdAndUpdate(donor._id, { lastDonationDate: now });
    await rewardService.onDonationCompleted(donor._id, donation._id, false);

    activityService.logActivity(donor._id, {
      type: 'donation', action: 'qr_verified',
      title: ACTIVITY_TITLE_MAP.donation_verified, description: 'Hospital QR verified',
      referenceId: donation._id.toString(), referenceType: 'Donation',
    }).catch(() => {});

    const hospitalName = appointment.hospitalId?.hospitalName || appointment.hospitalId?.fullName || 'Hospital';
    const pointsEarned = getAppointmentPoints(appointment.donationType);

    return response.success(res, 200, 'Donation verified successfully', {
      donation: {
        donationId: donation._id,
        type: appointment.donationType || DONATION_TYPE_LABELS.WHOLE_BLOOD,
        date: appointment.qrScannedAt,
        location: hospitalName,
        status: 'confirmed',
      },
      pointsEarned,
    });
  } catch (error) {
    next(error);
  }
};

export const scanQr = async (req, res, next) => {
  try {
    const qrToken = req.body.qrToken || req.body.qrCode;
    const rawUnits = Number(req.body.units ?? 1);
    const units = Number.isFinite(rawUnits) && rawUnits > 0 ? rawUnits : 1;
    const complications = req.body.complications || '';

    if (!qrToken) {
      return response.error(res, 400, 'qrToken is required');
    }

    const appointment = await Appointment.findOne({ qrToken })
      .populate('donorId', 'bloodType suspensionStatus lastDonationDate gender dateOfBirth hemoglobinLevel temporaryDeferralUntil lastDeferralReason')
      .populate('hospitalId', 'fullName hospitalName');

    if (!appointment) {
      return response.error(res, 404, 'QR token not found');
    }

    if (!['pending', 'confirmed'].includes(appointment.status)) {
      return response.error(res, 400, 'Appointment cannot be confirmed in its current status');
    }

    if (!appointment.requestId) {
      return response.error(res, 400, 'Appointment is not linked to a donation request');
    }

    const donor = appointment.donorId;
    if (donor?.isSuspended) {
      return response.error(res, 403, 'Donor is not eligible');
    }

    const eligibility = await eligibilityService.canDonate(donor, { persistTravelDeferral: false });
    if (!eligibility.eligible) {
      return response.error(res, 403, eligibility.reason || 'Donor is not eligible');
    }

    // Atomic update appointment first to avoid double-scan race
    const now2 = new Date();
    const updatedAppointment2 = await Appointment.findOneAndUpdate(
      { _id: appointment._id, qrScannedAt: null, status: { $in: ['pending', 'confirmed'] } },
      { $set: { status: 'completed', qrScannedAt: now2 } },
      { returnDocument: 'after' }
    ).populate('donorId', 'bloodType suspensionStatus lastDonationDate').populate('hospitalId', 'fullName hospitalName');

    if (!updatedAppointment2) return response.error(res, 409, 'This QR code has already been scanned');

    const donation = await Donation.create({
      donorId: donor._id,
      requestId: appointment.requestId,
      quantity: units,
      status: 'completed',
      notes: complications,
      completedDate: now2,
    });

    await Donor.findByIdAndUpdate(donor._id, {
      lastDonationDate: now2,
    });

    await rewardService.onDonationCompleted(donor._id, donation._id, false);

    activityService.logActivity(donor._id, {
      type: 'donation',
      action: 'qr_scanned',
      title: ACTIVITY_TITLE_MAP.donation_confirmed,
      description: 'Hospital QR code scanned to confirm donation',
      referenceId: donation._id.toString(),
      referenceType: 'Donation',
      metadata: {
        appointmentId: appointment._id.toString(),
        hospitalId: appointment.hospitalId?._id?.toString?.() || appointment.hospitalId?.toString?.(),
        donationType: appointment.donationType,
      },
    }).catch(() => {});

    const pointsEarned = getAppointmentPoints(appointment.donationType);

    return response.success(res, 200, 'Donation confirmed successfully', {
      donationId: donation._id,
      pointsEarned,
      hospitalName: appointment.hospitalId?.hospitalName || appointment.hospitalId?.fullName || 'Hospital',
      donationType: appointment.donationType,
      timestamp: appointment.qrScannedAt,
      qrToken,
    });
  } catch (error) {
    next(error);
  }
};