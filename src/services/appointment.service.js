import mongoose from 'mongoose';
import crypto from 'crypto';
import Appointment from '../models/Appointment.model.js';
import User from '../models/User.model.js';
import Donor from '../models/Donor.model.js';
import Request from '../models/Request.model.js';
import Hospital from '../models/Hospital.model.js';
import Notification from '../models/Notification.model.js';
import * as donationService from './donation.service.js';
import * as eligibilityService from './eligibility.service.js';
import * as activityService from './activity.service.js';
import { rejectDonationLifecycle } from './request-lifecycle.service.js';
import ELIGIBILITY_KEYS from '../utils/eligibility-keys.js';
import { paginationMeta } from '../utils/pagination.js';
import { logger } from '../utils/logger.js';
import { appointmentPopulateOptions, donorAppointmentPopulateOptions, toAppointmentResponse } from '../utils/appointment.dto.js';
import { DONATION_TYPE_LABELS, DONATION_TYPE_OPTIONS } from '../constants/donation.constants.js';
import HospitalSettings from '../models/HospitalSettings.model.js';
import Donation from '../models/Donation.model.js';
import { validateTransition, validateOrphanState } from '../utils/state-machine.js';

const QR_VALIDITY_BUFFER_MS = 24 * 60 * 60 * 1000;
const DEFAULT_MAX_RESCHEDULES = 3;
const ACTIVE_APPOINTMENT_STATUSES = ['pending', 'confirmed'];
const ACTIVE_REQUEST_STATUSES = ['pending', 'accepted', 'in-progress'];
const APPOINTMENT_DAY_LABELS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const DONATION_TYPE_REQUEST_MAP = new Map([
  [DONATION_TYPE_LABELS.WHOLE_BLOOD.toLowerCase(), 'blood'],
  ['blood', 'blood'],
  ['blood donation', 'blood'],
  [DONATION_TYPE_LABELS.PLASMA.toLowerCase(), 'plasma'],
  ['plasma donation', 'plasma'],
  [DONATION_TYPE_LABELS.PLATELETS.toLowerCase(), 'platelets'],
  ['platelet donation', 'platelets'],
  [DONATION_TYPE_LABELS.DOUBLE_RED_CELLS.toLowerCase(), 'double_red_cells'],
  ['double red cells', 'double_red_cells'],
  ['double red cell', 'double_red_cells'],
  ['double red', 'double_red_cells'],
]);

const normalizeDonationType = (value) => {
  if (!value) return null;
  const rawValue = String(value).trim();
  if (DONATION_TYPE_OPTIONS.includes(rawValue)) {
    return rawValue;
  }

  return DONATION_TYPE_OPTIONS.find((option) => option.toLowerCase() === rawValue.toLowerCase()) || null;
};

export const normalizeDonationTypeRequestKey = (value) => {
  const normalizedLabel = normalizeDonationType(value);
  if (normalizedLabel) {
    return DONATION_TYPE_REQUEST_MAP.get(normalizedLabel.toLowerCase()) || null;
  }

  return DONATION_TYPE_REQUEST_MAP.get(String(value || '').trim().toLowerCase()) || null;
};

const getQrExpiryDate = (appointmentDate) => {
  const sourceDate = new Date(appointmentDate);
  if (Number.isNaN(sourceDate.getTime())) {
    return new Date(Date.now() + QR_VALIDITY_BUFFER_MS);
  }
  return new Date(sourceDate.getTime() + QR_VALIDITY_BUFFER_MS);
};

const getHospitalSettings = async (hospitalId) => {
  const settings = await HospitalSettings.findOneAndUpdate(
    { hospitalId },
    { $setOnInsert: { hospitalId } },
    { upsert: true, returnDocument: 'after' }
  );

  // Return appointmentSettings if they exist, otherwise return default active settings
  return settings?.appointmentSettings || {
    isActive: true,
    openingTime: '09:00',
    closingTime: '17:00',
    workingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
    defaultSlotsPerHour: 4,
    supportedDonationTypes: ['Whole Blood', 'Plasma', 'Platelets', 'Double Red Cells'],
    minAdvanceHours: 0,
    maxAdvanceDays: 30,
    rescheduleAllowed: true,
    maxReschedules: 3,
    cancellationAllowedHours: 12,
  };
};

const parseAppointmentTime = (value) => {
  if (!value) return null;

  const trimmed = String(value).trim();
  const twentyFourHourMatch = trimmed.match(/^(\d{2}):(\d{2})$/);
  if (twentyFourHourMatch) {
    return {
      hour: Number(twentyFourHourMatch[1]),
      minute: Number(twentyFourHourMatch[2]),
    };
  }

  const twelveHourMatch = trimmed.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (twelveHourMatch) {
    let hour = Number(twelveHourMatch[1]);
    const minute = Number(twelveHourMatch[2]);
    const period = twelveHourMatch[3].toUpperCase();

    if (period === 'PM' && hour !== 12) hour += 12;
    if (period === 'AM' && hour === 12) hour = 0;

    return { hour, minute };
  }

  return null;
};

const getAppointmentDayLabel = (dateValue) => APPOINTMENT_DAY_LABELS[new Date(dateValue).getDay()] || null;

const getAppointmentWindow = (hospital, hospitalSettings) => {
  const openingTime = hospitalSettings?.openingTime || `${String(hospital?.workingHoursStart ?? 9).padStart(2, '0')}:00`;
  const closingTime = hospitalSettings?.closingTime || `${String(hospital?.workingHoursEnd ?? 17).padStart(2, '0')}:00`;

  return {
    openingTime,
    closingTime,
    openingHour: Number(String(openingTime).split(':')[0]),
    closingHour: Number(String(closingTime).split(':')[0]),
  };
};

const getHourCapacity = (appointmentDate, hospital, hospitalSettings) => {
  const hourlySlots = hospitalSettings?.hourlySlots instanceof Map
    ? Object.fromEntries(hospitalSettings.hourlySlots.entries())
    : (hospitalSettings?.hourlySlots || {});
  const slotKey = `${String(appointmentDate.getHours()).padStart(2, '0')}:00`;
  const fallbackCapacity = Number(hospitalSettings?.defaultSlotsPerHour ?? hospital?.slotsPerHour ?? 5);
  return Number(hourlySlots[slotKey] ?? fallbackCapacity);
};

const getDailyCapacity = (hospital, hospitalSettings) => {
  const explicitDailyCapacity = Number(hospitalSettings?.totalDailyCapacity ?? hospital?.totalDailyCapacity ?? 0);
  if (Number.isFinite(explicitDailyCapacity) && explicitDailyCapacity > 0) {
    return explicitDailyCapacity;
  }

  const hourlySlots = hospitalSettings?.hourlySlots instanceof Map
    ? Object.fromEntries(hospitalSettings.hourlySlots.entries())
    : (hospitalSettings?.hourlySlots || {});
  const defaultSlotsPerHour = Number(hospitalSettings?.defaultSlotsPerHour ?? hospital?.slotsPerHour ?? 5);
  const slotValues = Object.values(hourlySlots);

  if (slotValues.length) {
    return slotValues.reduce((sum, value) => sum + Number(value || defaultSlotsPerHour), 0);
  }

  const { openingHour, closingHour } = getAppointmentWindow(hospital, hospitalSettings);
  return Math.max((closingHour - openingHour) * defaultSlotsPerHour, defaultSlotsPerHour);
};

const getNormalizedDonationType = (value, fallback = null) => normalizeDonationType(value) || normalizeDonationType(fallback) || DONATION_TYPE_LABELS.WHOLE_BLOOD;

const assertAppointmentWindow = ({ appointmentDate, hospital, hospitalSettings, mode = 'create' }) => {
  if (!(appointmentDate instanceof Date) || Number.isNaN(appointmentDate.getTime())) {
    throw new Error(mode === 'reschedule' ? 'New appointment date is invalid' : 'Appointment date is invalid');
  }

  const now = new Date();
  if (appointmentDate <= now) {
    throw new Error(mode === 'reschedule' ? 'New appointment date must be in the future' : 'Appointment date must be in the future');
  }

  const minAdvanceHours = Number(hospitalSettings?.minAdvanceHours ?? 24);
  const maxAdvanceDays = Number(hospitalSettings?.maxAdvanceDays ?? 30);
  const minAllowedDate = new Date(now.getTime() + minAdvanceHours * 60 * 60 * 1000);
  const maxAllowedDate = new Date(now.getTime() + maxAdvanceDays * 24 * 60 * 60 * 1000);

  if (appointmentDate < minAllowedDate) {
    throw new Error(mode === 'reschedule'
      ? `Reschedule must be at least ${minAdvanceHours} hours in advance`
      : `Appointment must be at least ${minAdvanceHours} hours in advance`);
  }

  if (appointmentDate > maxAllowedDate) {
    throw new Error(mode === 'reschedule'
      ? `Reschedule cannot be more than ${maxAdvanceDays} days in advance`
      : `Appointment cannot be more than ${maxAdvanceDays} days in advance`);
  }

  const dayLabel = getAppointmentDayLabel(appointmentDate);
  const workingDays = Array.isArray(hospitalSettings?.workingDays) && hospitalSettings.workingDays.length
    ? hospitalSettings.workingDays
    : ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  if (!workingDays.includes(dayLabel)) {
    throw new Error('Selected day is not available for appointments');
  }

  const { openingHour, closingHour } = getAppointmentWindow(hospital, hospitalSettings);
  const appointmentHour = appointmentDate.getHours();

  if (appointmentHour < openingHour || appointmentHour >= closingHour) {
    throw new Error('Selected time slot is outside operating hours');
  }
};

const assertHospitalIsEligible = async (hospitalId) => {
  const hospital = await User.findById(hospitalId).select('role isEmailVerified isSuspended deletedAt fullName hospitalName workingHoursStart workingHoursEnd slotsPerHour totalDailyCapacity');

  if (!hospital || hospital.role !== 'hospital' || hospital.deletedAt) {
    throw new Error('Hospital not found');
  }

  if (hospital.isSuspended) {
    throw new Error('Hospital is suspended');
  }

  if (!hospital.isEmailVerified) {
    throw new Error('Hospital is not verified');
  }

  const hospitalSettings = await getHospitalSettings(hospitalId);
  if (!hospitalSettings?.isActive) {
    throw new Error('Hospital appointment scheduling is currently disabled');
  }

  return { hospital, hospitalSettings };
};

const assertAppointmentEligibility = async ({ donor, donationType, request = null, mode = 'create', excludeDonationId = null }) => {
  const normalizedDonationType = getNormalizedDonationType(donationType, request?.type);
  const requestType = normalizeDonationTypeRequestKey(normalizedDonationType) || request?.type || 'blood';

  if (request) {
    const requestObject = request.toObject?.() || request;
    const eligibilityRequest = { ...requestObject, type: requestType };
    const eligibility = await donationService.validateEligibility(donor, eligibilityRequest, { excludeDonationId });
    if (!eligibility.eligible) {
      throw new Error(eligibility.reason || ELIGIBILITY_KEYS.DONOR_NOT_ELIGIBLE);
    }
  } else {
    const eligibility = await eligibilityService.canDonate(donor, {
      persistTravelDeferral: false,
      donationType: requestType,
      excludeDonationId,
    });

    if (!eligibility.eligible) {
      throw new Error(eligibility.reason || ELIGIBILITY_KEYS.DONOR_NOT_ELIGIBLE);
    }
  }

  return normalizedDonationType;
};

const assertCapacityForAppointment = async ({ hospitalId, hospital, hospitalSettings, appointmentDate, excludeAppointmentId = null }) => {
  const dayStart = new Date(appointmentDate);
  dayStart.setHours(0, 0, 0, 0);
  const nextDay = new Date(dayStart);
  nextDay.setDate(nextDay.getDate() + 1);

  const activeAppointmentsQuery = {
    hospitalId,
    appointmentDate: { $gte: dayStart, $lt: nextDay },
    status: { $in: ACTIVE_APPOINTMENT_STATUSES },
  };

  if (excludeAppointmentId) {
    activeAppointmentsQuery._id = { $ne: excludeAppointmentId };
  }

  const appointments = await Appointment.find(activeAppointmentsQuery).select('appointmentDate');
  const appointmentHour = appointmentDate.getHours();
  const slotCapacity = getHourCapacity(appointmentDate, hospital, hospitalSettings);
  const bookedCount = appointments.filter((existing) => new Date(existing.appointmentDate).getHours() === appointmentHour).length;

  if (bookedCount >= slotCapacity) {
    throw new Error('Selected time slot is no longer available');
  }

  const dailyCapacity = getDailyCapacity(hospital, hospitalSettings);
  if (appointments.length >= dailyCapacity) {
    throw new Error('Daily appointment capacity has been reached');
  }
};

const validateAppointmentScheduling = async ({
  hospitalId,
  donor,
  appointmentDate,
  donationType,
  request = null,
  mode = 'create',
  excludeAppointmentId = null,
  excludeDonationId = null,
}) => {
  const { hospital, hospitalSettings } = await assertHospitalIsEligible(hospitalId);
  const normalizedDonationType = await assertAppointmentEligibility({ donor, donationType, request, mode, excludeDonationId });

  if (!DONATION_TYPE_OPTIONS.includes(normalizedDonationType)) {
    throw new Error('Invalid donation type');
  }

  if (hospitalSettings?.supportedDonationTypes?.length && !hospitalSettings.supportedDonationTypes.includes(normalizedDonationType)) {
    throw new Error('Hospital does not support this donation type');
  }

  assertAppointmentWindow({
    appointmentDate,
    hospital,
    hospitalSettings,
    mode,
  });

  await assertCapacityForAppointment({
    hospitalId,
    hospital,
    hospitalSettings,
    appointmentDate,
    excludeAppointmentId,
  });

  return { hospital, hospitalSettings, normalizedDonationType };
};

const formatSlotLabel = (dateValue) => {
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return null;

  const hour = date.getHours();
  const period = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour % 12 === 0 ? 12 : hour % 12;
  return `${String(displayHour).padStart(2, '0')}:00 ${period}`;
};

const toObjectIdString = (value) => {
  if (!value) return null;
  if (typeof value === 'string') return value;
  return value._id?.toString?.() || value.toString?.() || null;
};

const syncDonorSnapshot = (appointment, donor) => {
  appointment.donorDetails = {
    fullName: donor?.fullName ?? appointment.donorDetails?.fullName ?? null,
    phoneNumber: donor?.phoneNumber ?? appointment.donorDetails?.phoneNumber ?? null,
    bloodType: donor?.bloodType ?? appointment.donorDetails?.bloodType ?? null,
    email: donor?.email ?? appointment.donorDetails?.email ?? null,
  };
};

const normalizeRescheduleReason = (value) => {
  if (value === undefined || value === null) return null;
  const trimmed = String(value).trim();
  return trimmed || null;
};

const isSameInstant = (left, right) => {
  const leftDate = new Date(left);
  const rightDate = new Date(right);
  if (Number.isNaN(leftDate.getTime()) || Number.isNaN(rightDate.getTime())) return false;
  return leftDate.getTime() === rightDate.getTime();
};

const isRequestStillActive = (request) => {
  if (!request) return true;
  if (!ACTIVE_REQUEST_STATUSES.includes(request.status)) return false;
  if (request.requiredBy && new Date(request.requiredBy) <= new Date()) return false;
  return true;
};

const buildAppointmentTimeLabel = (dateValue) => {
  const label = formatSlotLabel(dateValue);
  return label || 'selected time';
};

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

const notifyAppointmentReschedule = async ({ appointment, previousAppointmentDate, reason }) => {
  const hospitalId = toObjectIdString(appointment.hospitalId);
  const donorId = toObjectIdString(appointment.donorId);
  const newAppointmentDate = new Date(appointment.appointmentDate);
  const oldDateLabel = new Date(previousAppointmentDate).toLocaleString('en-EG');
  const newDateLabel = newAppointmentDate.toLocaleString('en-EG');
  const reasonSuffix = reason ? ` Reason: ${reason}` : '';

  const notifications = [
    {
      userId: donorId,
      type: 'appointment',
      title: 'Appointment Rescheduled',
      message: `Your appointment was moved from ${oldDateLabel} to ${newDateLabel}.${reasonSuffix}`.trim(),
      relatedId: appointment._id,
      relatedType: 'Appointment',
      data: {
        appointmentId: appointment._id,
        hospitalId,
        previousAppointmentDate,
        newAppointmentDate: appointment.appointmentDate,
        reason,
      },
    },
    {
      userId: hospitalId,
      type: 'appointment',
      title: 'Donor Rescheduled Appointment',
      message: `A donor moved an appointment from ${oldDateLabel} to ${newDateLabel}.${reasonSuffix}`.trim(),
      relatedId: appointment._id,
      relatedType: 'Appointment',
      data: {
        appointmentId: appointment._id,
        donorId,
        previousAppointmentDate,
        newAppointmentDate: appointment.appointmentDate,
        reason,
      },
    },
  ].filter((notification) => notification.userId);

  return Promise.all(
    notifications.map((notification) => Notification.create(notification))
  );
};

const logAppointmentRescheduleActivity = async ({ appointment, previousAppointmentDate, previousDonationType, reason }) => {
  const donorId = toObjectIdString(appointment.donorId);
  if (!donorId) return null;

  const previousDateLabel = new Date(previousAppointmentDate).toLocaleString('en-EG');
  const newDateLabel = new Date(appointment.appointmentDate).toLocaleString('en-EG');
  const previousType = previousDonationType || appointment.donationType || DONATION_TYPE_LABELS.WHOLE_BLOOD;
  const newType = appointment.donationType || DONATION_TYPE_LABELS.WHOLE_BLOOD;

  return activityService.logActivity(donorId, {
    type: 'appointment',
    action: 'rescheduled_appointment',
    title: 'Appointment Rescheduled',
    description: reason
      ? `Moved appointment from ${previousDateLabel} to ${newDateLabel}. Reason: ${reason}`
      : `Moved appointment from ${previousDateLabel} to ${newDateLabel}`,
    referenceId: appointment._id.toString(),
    metadata: {
      appointmentId: appointment._id.toString(),
      hospitalId: toObjectIdString(appointment.hospitalId),
      requestId: toObjectIdString(appointment.requestId),
      previousAppointmentDate,
      newAppointmentDate: appointment.appointmentDate,
      previousDonationType: previousType,
      newDonationType: newType,
      reason,
    },
    icon: 'calendar',
  });
};

export const cancelActiveAppointmentsForRequest = async (requestId, options = {}) => {
  if (!mongoose.Types.ObjectId.isValid(requestId)) {
    throw new Error('Invalid request id');
  }

  const { session = null } = options;

  return runInSession(session, async (activeSession) => {
    const now = options.cancelledAt instanceof Date ? options.cancelledAt : new Date();
    const update = {
      status: 'cancelled',
      cancelledAt: now,
    };

    if (options.notes) {
      update.notes = options.notes;
    }

    const appointmentsToCancel = await Appointment.find({
      requestId,
      status: { $in: ACTIVE_APPOINTMENT_STATUSES },
    }).session(activeSession);

    for (const appt of appointmentsToCancel) {
      validateTransition('appointment', appt.status, 'cancelled');
    }

    const result = await Appointment.updateMany(
      {
        requestId,
        status: { $in: ACTIVE_APPOINTMENT_STATUSES },
      },
      { $set: update },
      { session: activeSession }
    );

    return result;
  });
};

const assertRescheduleAvailability = async ({ appointment, appointmentDate, donationType }) => {
  const hospitalId = toObjectIdString(appointment.hospitalId);
  const hospitalSettings = await getHospitalSettings(hospitalId);

  if (!hospitalSettings?.isActive) {
    throw new Error('Hospital appointment scheduling is currently disabled');
  }

  if (hospitalSettings.rescheduleAllowed === false) {
    throw new Error('Hospital does not allow rescheduling');
  }

  const maxAdvanceDays = Number(hospitalSettings.maxAdvanceDays ?? 30);
  const minAdvanceHours = Number(hospitalSettings.minAdvanceHours ?? 24);
  const maxReschedules = Number(hospitalSettings.maxReschedules ?? DEFAULT_MAX_RESCHEDULES);
  const supportedDonationTypes = Array.isArray(hospitalSettings.supportedDonationTypes)
    ? hospitalSettings.supportedDonationTypes
    : DONATION_TYPE_OPTIONS;

  const normalizedDonationType = normalizeDonationType(donationType || appointment.donationType);
  if (appointment.rescheduleCount >= maxReschedules) {
    throw new Error('This appointment has reached the maximum number of reschedules');
  }

  if (normalizedDonationType && !supportedDonationTypes.includes(normalizedDonationType)) {
    throw new Error('Hospital does not support this donation type');
  }

  const now = new Date();
  const minAllowedDate = new Date(now.getTime() + minAdvanceHours * 60 * 60 * 1000);
  const maxAllowedDate = new Date(now.getTime() + maxAdvanceDays * 24 * 60 * 60 * 1000);

  if (appointmentDate < minAllowedDate) {
    throw new Error(`Reschedule must be at least ${minAdvanceHours} hours in advance`);
  }

  if (appointmentDate > maxAllowedDate) {
    throw new Error(`Reschedule cannot be more than ${maxAdvanceDays} days in advance`);
  }

  const dayStart = new Date(appointmentDate);
  dayStart.setHours(0, 0, 0, 0);
  const nextDay = new Date(dayStart);
  nextDay.setDate(nextDay.getDate() + 1);

  const existingAppointments = await Appointment.find({
    hospitalId,
    appointmentDate: { $gte: dayStart, $lt: nextDay },
    status: { $in: ACTIVE_APPOINTMENT_STATUSES },
    _id: { $ne: appointment._id },
  }).select('appointmentDate');

  const hour = appointmentDate.getHours();
  const bookedCount = existingAppointments.filter((existing) => new Date(existing.appointmentDate).getHours() === hour).length;
  const slotsPerHour = Number(hospitalSettings.defaultSlotsPerHour ?? 4);

  if (bookedCount >= slotsPerHour) {
    throw new Error('Selected time slot is no longer available');
  }

  return {
    hospitalSettings,
    requestedSlot: formatSlotLabel(appointmentDate),
  };
};

/**
 * Book an appointment
 * @param {string} donorId
 * @param {string} hospitalId
 * @param {string|null} requestId
 * @param {Date|string} appointmentDate
 * @param {string} notes
 * @param {string} donationType
 */
export const bookAppointment = async (donorId, hospitalId, requestId = null, appointmentDate, notes = '', donationType = DONATION_TYPE_LABELS.WHOLE_BLOOD) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(donorId) || !mongoose.Types.ObjectId.isValid(hospitalId)) {
      throw new Error('Invalid donor or hospital id');
    }

    if (requestId && !mongoose.Types.ObjectId.isValid(requestId)) {
      throw new Error('Invalid request id');
    }

    const donor = await Donor.findById(donorId);
    if (!donor) throw new Error(ELIGIBILITY_KEYS.DONOR_NOT_FOUND);
    if (donor.isSuspended) throw new Error(ELIGIBILITY_KEYS.DONOR_SUSPENDED);

    const donorDetails = toAppointmentResponse({ donorId: donor }).donorDetails;

    let request = null;
    if (requestId) {
      request = await Request.findById(requestId);
      if (!request) throw new Error(ELIGIBILITY_KEYS.REQUEST_NOT_FOUND);

      if (request.hospitalId?.toString?.() !== hospitalId.toString()) {
        throw new Error('Request does not belong to this hospital');
      }

      if (!isRequestStillActive(request)) {
        throw new Error('The linked request is no longer active');
      }
    }

    const apptDate = new Date(appointmentDate);

    // Prevent duplicate active appointment (BEFORE expensive validation to fail fast)
    const existing = await Appointment.findOne({
      donorId,
      hospitalId,
      status: { $in: ACTIVE_APPOINTMENT_STATUSES },
    });
    if (existing) {
      throw new Error('You already have an active appointment at this hospital');
    }

    const pendingDonation = requestId ? await Donation.findOne({ donorId, requestId, status: 'pending' }) : null;

    const { normalizedDonationType } = await validateAppointmentScheduling({
      hospitalId,
      donor,
      appointmentDate: apptDate,
      donationType,
      request,
      mode: 'create',
      excludeDonationId: pendingDonation?._id,
    });

    const qrToken = crypto.randomBytes(32).toString('hex');

    const payload = {
      donorId,
      donorDetails,
      hospitalId,
      requestId,
      appointmentDate: apptDate,
      notes,
      status: 'pending',
      donationType: normalizedDonationType,
      qrToken,
      qrExpiresAt: getQrExpiryDate(apptDate),
    };

    const session = await mongoose.startSession();
    let appointment;
    let donation;

    try {
      await session.withTransaction(async () => {
        [appointment] = await Appointment.create([payload], { session });

        // Create/link a scheduled donation record for the appointment.
        if (requestId) {
          // Find the pending donation created when the donor responded to the request.
          donation = await Donation.findOne({ donorId, requestId, status: 'pending' }).session(session);
          if (donation) {
            validateTransition('donation', donation.status, 'scheduled');
            donation.status = 'scheduled';
            donation.appointmentId = appointment._id;
            donation.scheduledDate = apptDate;
            await donation.save({ session });
          } else {
            // Fallback: create a scheduled donation if it wasn't created yet.
            [donation] = await Donation.create([{
              donorId,
              requestId,
              appointmentId: appointment._id,
              status: 'scheduled',
              scheduledDate: apptDate,
              quantity: 1,
            }], { session });
          }

          if (request.status === 'accepted') {
            validateTransition('request', request.status, 'in-progress');
            request.status = 'in-progress';
            await request.save({ session });
          }
        } else {
          // General appointment: create a scheduled donation.
          [donation] = await Donation.create([{
            donorId,
            appointmentId: appointment._id,
            status: 'scheduled',
            scheduledDate: apptDate,
            quantity: 1,
          }], { session });
        }

        // Validate the relationship before committing the transaction.
        validateOrphanState('appointment', appointment, { donation });
        validateOrphanState('donation', donation, { appointment });
      });
    } finally {
      session.endSession();
    }

    await appointment.populate(appointmentPopulateOptions);

    Notification.create({
      userId: hospitalId,
      type: 'system',
      title: 'New Appointment Booked',
      message: `A donor has booked an appointment for ${apptDate.toLocaleDateString()}`,
      relatedId: appointment._id,
      relatedType: 'User',
      data: { appointmentId: appointment._id, donorId },
    }).catch((err) => logger.error('Appointment notification error', {
      message: err?.message,
    }));

    return appointment;
  } catch (error) {
    if (error.code === 11000 && error.keyPattern?.donorId && error.keyPattern?.hospitalId) {
      throw new Error('You already have an active appointment at this hospital');
    }
    throw error;
  }
};

export const getMyAppointments = async (donorId, filters = {}, projection = null, options = {}) => {
  try {
    const { page = 1, limit = 10 } = filters;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const filter = { donorId };

    const populateOptions = options.role === 'donor' ? donorAppointmentPopulateOptions : appointmentPopulateOptions;
    const appointments = await Appointment.find(filter, projection)
      .populate(populateOptions)
      .skip(offset)
      .limit(parseInt(limit))
      .sort({ appointmentDate: -1 });

    const total = await Appointment.countDocuments(filter);

    return {
      appointments: appointments.map((appointment) => toAppointmentResponse(appointment, { role: options.role })),
      total,
      meta: paginationMeta(total, page, limit),
    };
  } catch (error) {
    throw error;
  }
};

export const cancelAppointment = async (appointmentId, donorId) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(appointmentId)) throw new Error('Invalid appointment id');

    const appointment = await Appointment.findOne({ _id: appointmentId, donorId });
    if (!appointment) throw new Error('Appointment not found');

    // Guard: validate transition through the centralized state machine.
    try {
      validateTransition('appointment', appointment.status, 'cancelled');
    } catch (err) {
      throw new Error(err.message);
    }

    const hospitalSettings = await getHospitalSettings(toObjectIdString(appointment.hospitalId));
    const cancellationAllowedHours = Number(hospitalSettings?.cancellationAllowedHours ?? 12);
    const cancellationDeadline = new Date(appointment.appointmentDate.getTime() - cancellationAllowedHours * 60 * 60 * 1000);
    if (new Date() > cancellationDeadline) {
      throw new Error(`Cancellation must be at least ${cancellationAllowedHours} hours in advance`);
    }

    // Call the centralized lifecycle service to transition states of donation, appointment, and request.
    // Setting requestStatus to 'pending' triggers the recovery of request quantity and matching/re-broadcast.
    await rejectDonationLifecycle({
      appointmentId: appointment._id,
      donorId,
      donationStatus: 'cancelled',
      requestStatus: 'pending',
      reason: 'Donor cancelled appointment',
    });

    const updatedAppointment = await Appointment.findById(appointment._id).populate(appointmentPopulateOptions);
    return toAppointmentResponse(updatedAppointment);
  } catch (error) {
    throw error;
  }
};

export const getAppointmentById = async (appointmentId, donorId) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(appointmentId)) throw new Error('Invalid appointment id');

    const appointment = await Appointment.findOne({ _id: appointmentId, donorId });

    if (!appointment) throw new Error('Appointment not found');

    // Return the raw Mongoose document; controllers should populate and call toAppointmentResponse.
    return appointment;
  } catch (error) {
    throw error;
  }
};

export const rescheduleAppointment = async (appointmentId, donorId, updateInput, donationTypeInput = null) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(appointmentId)) throw new Error('Invalid appointment id');

    const updatePayload = updateInput && typeof updateInput === 'object' && !(updateInput instanceof Date)
      ? updateInput
      : { appointmentDate: updateInput, donationType: donationTypeInput };

    const appointment = await Appointment.findOne({ _id: appointmentId, donorId });
    if (!appointment) throw new Error('Appointment not found');

    if (!['pending', 'confirmed'].includes(appointment.status)) {
      throw new Error('Only pending or confirmed appointments can be rescheduled');
    }

    const apptDate = new Date(updatePayload.appointmentDate ?? updatePayload.newDate ?? updatePayload.date);
    if (isNaN(apptDate.getTime()) || apptDate <= new Date()) {
      throw new Error('New appointment date must be in the future');
    }

    const reason = normalizeRescheduleReason(updatePayload.reason);

    const donor = await Donor.findById(donorId);
    if (!donor) throw new Error(ELIGIBILITY_KEYS.DONOR_NOT_FOUND);

    const request = appointment.requestId ? await Request.findById(appointment.requestId) : null;
    const donation = await Donation.findOne({ appointmentId: appointment._id });

    await assertRescheduleAvailability({
      appointment,
      appointmentDate: apptDate,
      donationType: updatePayload.donationType || appointment.donationType,
    });

    const { normalizedDonationType } = await validateAppointmentScheduling({
      hospitalId: appointment.hospitalId,
      donor,
      appointmentDate: apptDate,
      donationType: updatePayload.donationType || appointment.donationType,
      request,
      mode: 'reschedule',
      excludeAppointmentId: appointment._id,
      excludeDonationId: donation?._id,
    });

    if (
      isSameInstant(appointment.appointmentDate, apptDate)
      && normalizeDonationType(appointment.donationType) === normalizedDonationType
    ) {
      throw new Error('New appointment details must be different from the current appointment');
    }

    if (!isRequestStillActive(request)) {
      throw new Error('The linked request is no longer active');
    }

    const previousAppointmentDate = appointment.appointmentDate;
    const previousDonationType = appointment.donationType || null;

    appointment.appointmentDate = apptDate;
    appointment.donationType = normalizedDonationType;
    if (appointment.status !== 'pending') {
      validateTransition('appointment', appointment.status, 'pending');
      appointment.status = 'pending';
    }
    appointment.verificationStatus = 'pending';
    appointment.qrToken = crypto.randomBytes(32).toString('hex');
    appointment.qrExpiresAt = getQrExpiryDate(apptDate);
    appointment.qrScannedAt = null;
    appointment.verificationSessionId = null;
    appointment.verificationStartedAt = null;
    appointment.verificationVerifiedAt = null;
    appointment.verificationRejectedAt = null;
    appointment.verificationRejectedReason = null;
    appointment.verificationChecklist = {
      idVerified: false,
      questionnaireCompleted: false,
      consentSigned: false,
      completedAt: null,
    };
    appointment.rescheduleCount = Number(appointment.rescheduleCount || 0) + 1;
    appointment.rescheduleHistory = Array.isArray(appointment.rescheduleHistory) ? appointment.rescheduleHistory : [];
    appointment.rescheduleHistory.push({
      previousAppointmentDate,
      newAppointmentDate: apptDate,
      previousDonationType,
      newDonationType: normalizedDonationType,
      reason,
      rescheduledAt: new Date(),
      rescheduledBy: donorId,
    });

    syncDonorSnapshot(appointment, donor);
    await appointment.save();

    if (donation) {
      donation.scheduledDate = apptDate;
      await donation.save();
    }

    try {
      validateOrphanState('appointment', appointment, { donation });
      if (donation) {
        validateOrphanState('donation', donation, { appointment });
      }
    } catch (err) {
      throw new Error(err.message);
    }

    await appointment.populate(appointmentPopulateOptions);

    void notifyAppointmentReschedule({
      appointment,
      previousAppointmentDate,
      reason,
    }).catch((err) => logger.error('Appointment reschedule notification error', {
      message: err?.message,
      appointmentId: appointment._id?.toString?.(),
    }));

    void logAppointmentRescheduleActivity({
      appointment,
      previousAppointmentDate,
      previousDonationType,
      reason,
    }).catch(() => {});

    return toAppointmentResponse(appointment);
  } catch (error) {
    throw error;
  }
};

const formatHourLabel = (hour) => {
  const period = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour % 12 === 0 ? 12 : hour % 12;
  return `${String(displayHour).padStart(2, '0')}:00 ${period}`;
};

export const getAvailableSlots = async (hospitalId, date, options = {}) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(hospitalId)) {
      throw new Error('Invalid hospital id');
    }

    const targetDate = new Date(date);
    if (Number.isNaN(targetDate.getTime())) {
      throw new Error('Invalid date');
    }

    const hospital = await Hospital.findById(hospitalId).select('slotsPerHour workingHoursStart workingHoursEnd');
    if (!hospital) {
      throw new Error('Hospital not found');
    }

    const hospitalSettings = await getHospitalSettings(hospitalId);

    const dayStart = new Date(targetDate);
    dayStart.setHours(0, 0, 0, 0);
    const nextDay = new Date(dayStart);
    nextDay.setDate(nextDay.getDate() + 1);

    const appointments = await Appointment.find({
      hospitalId,
      appointmentDate: { $gte: dayStart, $lt: nextDay },
      status: { $in: ACTIVE_APPOINTMENT_STATUSES },
      ...(options.excludeAppointmentId ? { _id: { $ne: options.excludeAppointmentId } } : {}),
    }).select('appointmentDate');

    const countsByHour = appointments.reduce((accumulator, appointment) => {
      const hour = new Date(appointment.appointmentDate).getHours();
      accumulator[hour] = (accumulator[hour] || 0) + 1;
      return accumulator;
    }, {});

    const startHour = Number(
      hospitalSettings?.openingTime ? String(hospitalSettings.openingTime).split(':')[0] : (hospital.workingHoursStart ?? 9)
    );
    const endHour = Number(
      hospitalSettings?.closingTime ? String(hospitalSettings.closingTime).split(':')[0] : (hospital.workingHoursEnd ?? 17)
    );
    const capacity = Number(hospitalSettings?.defaultSlotsPerHour ?? hospital.slotsPerHour ?? 5);
    const hourlySlots = hospitalSettings?.hourlySlots instanceof Map
      ? Object.fromEntries(hospitalSettings.hourlySlots.entries())
      : (hospitalSettings?.hourlySlots || {});
    const timeSlots = [];

    for (let hour = startHour; hour < endHour; hour += 1) {
      const slotKey = `${String(hour).padStart(2, '0')}:00`;
      const slotCapacity = Number(hourlySlots[slotKey] ?? capacity);
      const bookedCount = countsByHour[hour] || 0;
      const remainingCapacity = slotCapacity - bookedCount;
      const isAvailable = remainingCapacity > 0;
      
      // Always include slot info (even if full) to let frontend show "Full" status
      timeSlots.push({
        time: slotKey,
        remainingCapacity,
        maxCapacity: slotCapacity,
        available: isAvailable,
      });
    }

    return {
      timeSlots,
      hospitalId: hospital._id,
      date: dayStart,
      slotsPerHour: capacity,
      openingTime: hospitalSettings?.openingTime || null,
      closingTime: hospitalSettings?.closingTime || null,
    };
  } catch (error) {
    throw error;
  }
};
