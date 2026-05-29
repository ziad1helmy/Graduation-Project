import mongoose from 'mongoose';
import crypto from 'crypto';
import Appointment from '../models/Appointment.model.js';
import User from '../models/User.model.js';
import Donor from '../models/Donor.model.js';
import Request from '../models/Request.model.js';
import Hospital from '../models/Hospital.model.js';
import Notification from '../models/Notification.model.js';
import * as donationService from './donation.service.js';
import * as activityService from './activity.service.js';
import { paginationMeta } from '../utils/pagination.js';
import { logger } from '../utils/logger.js';
import { appointmentPopulateOptions, toAppointmentResponse } from '../utils/appointment.dto.js';
import { DONATION_TYPE_LABELS, DONATION_TYPE_OPTIONS } from '../constants/donation.constants.js';
import HospitalSettings from '../models/HospitalSettings.model.js';

const QR_VALIDITY_BUFFER_MS = 24 * 60 * 60 * 1000;
const DEFAULT_MAX_RESCHEDULES = 3;
const ACTIVE_APPOINTMENT_STATUSES = ['pending', 'confirmed'];
const ACTIVE_REQUEST_STATUSES = ['pending', 'accepted', 'in-progress'];

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

  return settings?.appointmentSettings || null;
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

  const now = options.cancelledAt instanceof Date ? options.cancelledAt : new Date();
  const update = {
    status: 'cancelled',
    cancelledAt: now,
  };

  if (options.notes) {
    update.notes = options.notes;
  }

  const result = await Appointment.updateMany(
    {
      requestId,
      status: { $in: ACTIVE_APPOINTMENT_STATUSES },
    },
    { $set: update }
  );

  return result;
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
    if (!donor) throw new Error('Donor not found');
    if (donor.isSuspended) throw new Error('Donor is suspended');

    const donorDetails = toAppointmentResponse({ donorId: donor }).donorDetails;

    const hospital = await User.findById(hospitalId);
    if (!hospital || hospital.role !== 'hospital') throw new Error('Hospital not found');

    if (requestId) {
      const request = await Request.findById(requestId);
      if (!request) throw new Error('Request not found');

      if (request.hospitalId?.toString?.() !== hospitalId.toString()) {
        throw new Error('Request does not belong to this hospital');
      }

      if (!isRequestStillActive(request)) {
        throw new Error('The linked request is no longer active');
      }

      const eligibility = await donationService.validateEligibility(donor, request);
      if (!eligibility.eligible) {
        throw new Error(eligibility.reason || 'Donor is not eligible for this request');
      }
    }

    const apptDate = new Date(appointmentDate);
    if (isNaN(apptDate.getTime()) || apptDate <= new Date()) {
      throw new Error('Appointment date must be in the future');
    }

    const normalizedDonationType = normalizeDonationType(donationType) || DONATION_TYPE_LABELS.WHOLE_BLOOD;
    if (!DONATION_TYPE_OPTIONS.includes(normalizedDonationType)) {
      throw new Error('Invalid donation type');
    }

    const hospitalSettings = await getHospitalSettings(hospitalId);
    const supportedDonationTypes = Array.isArray(hospitalSettings?.supportedDonationTypes)
      ? hospitalSettings.supportedDonationTypes
      : DONATION_TYPE_OPTIONS;

    if (!supportedDonationTypes.includes(normalizedDonationType)) {
      throw new Error('Hospital does not support this donation type');
    }

    // Prevent duplicate active appointment for same donor + hospital
    const existing = await Appointment.findOne({
      donorId,
      hospitalId,
      status: { $in: ACTIVE_APPOINTMENT_STATUSES },
    });
    if (existing) {
      throw new Error('You already have an active appointment at this hospital');
    }

    // Generate unique QR token
    const qrToken = crypto.randomBytes(32).toString('hex');

    const appointment = await Appointment.create({
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
    });

    await appointment.populate(appointmentPopulateOptions);

    // Fire-and-forget notification to hospital
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

    // Return the Mongoose document for internal callers; controllers format to DTO.
    return appointment;
  } catch (error) {
    throw error;
  }
};

export const getMyAppointments = async (donorId, filters = {}) => {
  try {
    const { page = 1, limit = 10 } = filters;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const filter = { donorId };

    const appointments = await Appointment.find(filter)
      .populate(appointmentPopulateOptions)
      .skip(offset)
      .limit(parseInt(limit))
      .sort({ appointmentDate: -1 });

    const total = await Appointment.countDocuments(filter);

    return {
      appointments: appointments.map(toAppointmentResponse),
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

    if (['completed', 'cancelled'].includes(appointment.status)) {
      throw new Error('This appointment cannot be cancelled');
    }

    const hospitalSettings = await getHospitalSettings(toObjectIdString(appointment.hospitalId));
    const cancellationAllowedHours = Number(hospitalSettings?.cancellationAllowedHours ?? 12);
    const cancellationCutoff = new Date(Date.now() + cancellationAllowedHours * 60 * 60 * 1000);
    if (appointment.appointmentDate < cancellationCutoff) {
      throw new Error(`Cancellation must be at least ${cancellationAllowedHours} hours in advance`);
    }

    appointment.status = 'cancelled';
    appointment.cancelledAt = new Date();
    await appointment.save();

    await appointment.populate(appointmentPopulateOptions);

    return toAppointmentResponse(appointment);
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
    if (!donor) throw new Error('Donor not found');

    const request = appointment.requestId ? await Request.findById(appointment.requestId) : null;
    const normalizedDonationType = normalizeDonationType(updatePayload.donationType)
      || normalizeDonationType(appointment.donationType)
      || DONATION_TYPE_LABELS.WHOLE_BLOOD;

    if (!DONATION_TYPE_OPTIONS.includes(normalizedDonationType)) {
      throw new Error('Invalid donation type');
    }

    if (
      isSameInstant(appointment.appointmentDate, apptDate)
      && normalizeDonationType(appointment.donationType) === normalizedDonationType
    ) {
      throw new Error('New appointment details must be different from the current appointment');
    }

    const requestType = normalizeDonationTypeRequestKey(normalizedDonationType) || request?.type || 'blood';
    const eligibilityRequest = request
      ? { ...(request.toObject?.() || request), type: requestType }
      : { type: requestType, bloodType: appointment.requestId?.bloodType || null };

    const eligibility = await donationService.validateEligibility(donor, eligibilityRequest);
    if (!eligibility.eligible) {
      throw new Error(eligibility.reason || 'Donor is not eligible for this donation type');
    }

    if (!isRequestStillActive(request)) {
      throw new Error('The linked request is no longer active');
    }

    await assertRescheduleAvailability({
      appointment,
      appointmentDate: apptDate,
      donationType: normalizedDonationType,
    });

    const previousAppointmentDate = appointment.appointmentDate;
    const previousDonationType = appointment.donationType || null;

    appointment.appointmentDate = apptDate;
    appointment.donationType = normalizedDonationType;
    appointment.status = 'pending';
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
      if (bookedCount < slotCapacity) {
        timeSlots.push(formatHourLabel(hour));
      }
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
