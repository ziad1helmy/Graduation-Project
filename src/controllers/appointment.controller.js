import response from '../utils/response.js';
import * as appointmentService from '../services/appointment.service.js';
import ERR from '../utils/errorCodes.js';
import { DONATION_TYPE_LABELS, DONATION_TYPE_OPTIONS } from '../constants/donation.constants.js';
import { toAppointmentResponse, appointmentPopulateOptions, donorAppointmentPopulateOptions, toAvailableSlotsResponse } from '../utils/appointment.dto.js';
import ELIGIBILITY_KEYS from '../utils/eligibility-keys.js';
import { HttpError } from '../utils/HttpError.js';
import { asyncHandler } from '../middlewares/asyncHandler.js';

const getDonorId = (req) => req?.user?.userId || req?.user?._id;

const hasExplicitTime = (value) => {
  if (!value) return false;

  const rawValue = String(value).trim();
  return /T\d{2}:\d{2}/.test(rawValue) || /\d{1,2}:\d{2}\s*(AM|PM)/i.test(rawValue);
};

const buildAppointmentDate = ({ appointmentDate, date, time }) => {
  if (appointmentDate) {
    if (typeof appointmentDate === 'string' && !hasExplicitTime(appointmentDate)) {
      return null;
    }

    const parsedAppointmentDate = new Date(appointmentDate);
    return Number.isNaN(parsedAppointmentDate.getTime()) ? null : parsedAppointmentDate;
  }

  if (!date || !time) return null;

  const scheduledDate = new Date(date);
  if (Number.isNaN(scheduledDate.getTime())) return null;

  const timeStr = String(time).trim();
  let match = timeStr.match(/^(\d{1,2}):(\d{2})$/);
  if (match) {
    const hour = Number(match[1]);
    const minute = Number(match[2]);
    if (hour >= 0 && hour < 24 && minute >= 0 && minute < 60) {
      scheduledDate.setHours(hour, minute, 0, 0);
      return scheduledDate;
    }
  }

  match = timeStr.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (match) {
    let hour = Number(match[1]);
    const minute = Number(match[2]);
    const period = match[3].toUpperCase();
    if (hour >= 1 && hour <= 12 && minute >= 0 && minute < 60) {
      if (period === 'PM' && hour !== 12) hour += 12;
      if (period === 'AM' && hour === 12) hour = 0;
      scheduledDate.setHours(hour, minute, 0, 0);
      return scheduledDate;
    }
  }

  return null;
};

const RESCHEDULE_ERROR_PATTERNS = [
  'different from the current appointment',
  'maximum number of reschedules',
  'Hospital does not allow rescheduling',
  'linked request is no longer active',
  'Selected time slot is no longer available',
  'at least',
  'cannot be more than',
  'support this donation type',
  'Only pending or confirmed appointments can be rescheduled',
  'active donation in progress',
  'Donor is not eligible',
  'Donor account is',
  'Hospital not found',
  'Hospital is suspended',
  'Hospital is not verified',
  'Hospital appointment scheduling is currently disabled',
];

const BOOKING_ERROR_400_MESSAGES = [
  'Appointment date must be in the future',
  'Appointment date is invalid',
  'Appointment must be at least 24 hours in advance',
  'Appointment cannot be more than 30 days in advance',
  'Selected day is not available for appointments',
  'Hospital appointment scheduling is currently disabled',
  'Hospital does not support this donation type',
  'Invalid donor or hospital ID',
  'Invalid appointment ID',
  'Invalid request ID',
  'Request does not belong to this hospital',
  'The linked request is no longer active',
  ELIGIBILITY_KEYS.DONOR_CURRENTLY_UNAVAILABLE,
  ELIGIBILITY_KEYS.DONOR_SUSPENDED,
  ELIGIBILITY_KEYS.DONOR_HAS_NO_BLOOD_TYPE,
  ELIGIBILITY_KEYS.ACTIVE_DONATION_IN_PROGRESS,
  'Selected time slot is outside operating hours',
  'Selected time slot is no longer available',
  'Daily appointment capacity has been reached',
  ELIGIBILITY_KEYS.BLOOD_TYPE_INCOMPATIBLE,
  ELIGIBILITY_KEYS.DONATION_COOLDOWN_ACTIVE,
];

export const bookAppointment = asyncHandler(async (req, res) => {
  const donorId = getDonorId(req);
  const { hospitalId, requestId, appointmentDate, date, time, notes, donationType } = req.body;

  const normalizedAppointmentDate = buildAppointmentDate({ appointmentDate, date, time });
  const normalizedDonationType = donationType || DONATION_TYPE_LABELS.WHOLE_BLOOD;

  if (!hospitalId || !normalizedAppointmentDate) {
    throw new HttpError(400, 'hospitalId and appointmentDate are required');
  }

  if (!DONATION_TYPE_OPTIONS.includes(normalizedDonationType)) {
    throw new HttpError(400, 'Invalid donation type');
  }

  try {
    const appointment = await appointmentService.bookAppointment(
      donorId,
      hospitalId,
      requestId || null,
      normalizedAppointmentDate,
      notes || '',
      normalizedDonationType
    );

    return response.success(res, 201, 'Appointment booked', toAppointmentResponse(appointment, { isBooking: true }));
  } catch (error) {
    if (error.message === 'Hospital not found' || error.message === ELIGIBILITY_KEYS.DONOR_NOT_FOUND) {
      throw new HttpError(404, error.message);
    }
    if (error.message === ELIGIBILITY_KEYS.REQUEST_NOT_FOUND) {
      throw new HttpError(404, error.message);
    }
    if (error.message === 'You already have an active appointment at this hospital') {
      throw new HttpError(409, ERR.APPOINTMENT_ALREADY_EXISTS);
    }
    if (BOOKING_ERROR_400_MESSAGES.includes(error.message)) {
      throw new HttpError(400, error.message);
    }
    throw error;
  }
});

export const getMyAppointments = asyncHandler(async (req, res) => {
  const donorId = getDonorId(req);
  const { page, limit } = req.query;

  const result = await appointmentService.getMyAppointments(donorId, { page, limit }, null, { role: req.user?.role });

  return response.success(res, 200, 'Appointments fetched', {
    ...result,
  });
});

export const getAvailableSlots = asyncHandler(async (req, res) => {
  const { hospitalId, date, excludeAppointmentId } = req.query;

  if (!hospitalId || !date) {
    throw new HttpError(400, 'hospitalId and date are required');
  }

  try {
    const slots = await appointmentService.getAvailableSlots(hospitalId, date, {
      excludeAppointmentId: excludeAppointmentId || undefined,
    });
    return response.success(res, 200, 'Available slots retrieved successfully', toAvailableSlotsResponse(slots, { role: req.user?.role }));
  } catch (error) {
    if (error.message === 'Invalid hospital id' || error.message === 'Invalid date') {
      throw new HttpError(400, error.message);
    }
    if (error.message === 'Hospital not found') {
      throw new HttpError(404, error.message);
    }
    throw error;
  }
});

export const cancelAppointment = asyncHandler(async (req, res) => {
  const donorId = getDonorId(req);
  const appointmentId = req.params.appointmentId;

  if (!appointmentId) throw new HttpError(400, 'Appointment ID is required');

  try {
    const appointment = await appointmentService.cancelAppointment(appointmentId, donorId);
    return response.success(res, 200, 'Appointment cancelled', appointment);
  } catch (error) {
    if (error.message === 'Appointment not found') throw new HttpError(404, ERR.APPOINTMENT_NOT_FOUND);
    if (error.message === 'This appointment cannot be cancelled') throw new HttpError(400, ERR.APPOINTMENT_CANNOT_CANCEL);
    if (error.message.includes('Cancellation must be at least')) throw new HttpError(400, error.message);
    throw error;
  }
});

export const getAppointmentById = asyncHandler(async (req, res) => {
  const donorId = getDonorId(req);
  const appointmentId = req.params.appointmentId;

  if (!appointmentId) throw new HttpError(400, 'Appointment ID is required');

  try {
    const appointment = await appointmentService.getAppointmentById(appointmentId, donorId);

    // Populate for HTTP response then apply DTO transformation.
    await appointment.populate(req.user?.role === 'donor' ? donorAppointmentPopulateOptions : appointmentPopulateOptions);
    return response.success(res, 200, 'Appointment retrieved', toAppointmentResponse(appointment, { role: req.user?.role }));
  } catch (error) {
    if (error.message === 'Appointment not found') throw new HttpError(404, 'Appointment not found');
    if (error.message === 'Invalid appointment ID') throw new HttpError(400, 'Invalid appointment ID');
    throw error;
  }
});

export const rescheduleAppointment = asyncHandler(async (req, res) => {
  const donorId = getDonorId(req);
  const appointmentId = req.params.appointmentId;
  const { date, time, appointmentDate, appointmentTime, donationType, reason, notes } = req.body;
  const targetDate = date || (appointmentTime ? appointmentDate : null);
  const targetTime = time || appointmentTime;
  const targetAppointmentDate = appointmentTime ? null : appointmentDate;
  const newDate = buildAppointmentDate({ appointmentDate: targetAppointmentDate, date: targetDate, time: targetTime });
  // Support both 'notes' (preferred) and 'reason' (legacy) fields
  const rescheduleReason = notes || reason;

  if (!appointmentId) throw new HttpError(400, 'Appointment ID is required');
  if (!newDate) throw new HttpError(400, 'New date is required');

  try {
    const appointment = await appointmentService.rescheduleAppointment(appointmentId, donorId, {
      appointmentDate: newDate,
      donationType,
      reason: rescheduleReason,
    });

    return response.success(res, 200, 'Appointment rescheduled', toAppointmentResponse(appointment, { role: req.user?.role, isReschedule: true }));
  } catch (error) {
    if (error.message === 'Appointment not found') throw new HttpError(404, 'Appointment not found');
    if (error.message === 'Invalid appointment ID') throw new HttpError(400, 'Invalid appointment ID');
    if (error.message.includes('rescheduled')) throw new HttpError(400, error.message);
    if (error.message.includes('future')) throw new HttpError(400, error.message);
    if (RESCHEDULE_ERROR_PATTERNS.some((p) => error.message.includes(p))) {
      throw new HttpError(400, error.message);
    }
    throw error;
  }
});
