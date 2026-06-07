import response from '../utils/response.js';
import * as appointmentService from '../services/appointment.service.js';
import ERR from '../utils/errorCodes.js';
import { DONATION_TYPE_LABELS, DONATION_TYPE_OPTIONS } from '../constants/donation.constants.js';
import { toAppointmentResponse, appointmentPopulateOptions, donorAppointmentPopulateOptions, toAvailableSlotsResponse } from '../utils/appointment.dto.js';
import ELIGIBILITY_KEYS from '../utils/eligibility-keys.js';

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

  if (time) {
    const match = String(time).trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
    if (!match) return null;

    let hour = Number(match[1]);
    const minute = Number(match[2]);
    const period = match[3].toUpperCase();

    if (period === 'PM' && hour !== 12) hour += 12;
    if (period === 'AM' && hour === 12) hour = 0;

    scheduledDate.setHours(hour, minute, 0, 0);
  }

  return scheduledDate;
};

export const bookAppointment = async (req, res, next) => {
  try {
    console.log('BOOK_APPOINTMENT_START');
    console.log('AUTH_USER:', req.user);
    console.log('REQUEST_BODY:', req.body);

    const donorId = getDonorId(req);
    const { hospitalId, requestId, appointmentDate, date, time, notes, donationType } = req.body;

    const normalizedAppointmentDate = buildAppointmentDate({ appointmentDate, date, time });
    const normalizedDonationType = donationType || DONATION_TYPE_LABELS.WHOLE_BLOOD;

    if (!hospitalId || !normalizedAppointmentDate) {
      return response.error(res, 400, 'hospitalId and appointmentDate are required');
    }

    if (!DONATION_TYPE_OPTIONS.includes(normalizedDonationType)) {
      return response.error(res, 400, 'Invalid donation type');
    }

    const appointment = await appointmentService.bookAppointment(
      donorId,
      hospitalId,
      requestId || null,
      normalizedAppointmentDate,
      notes || '',
      normalizedDonationType
    );

    return response.success(res, 201, 'Appointment booked', toAppointmentResponse(appointment));
  } catch (error) {
    console.error('BOOK_APPOINTMENT_ERROR:', error);
    console.error('STACK:', error?.stack);

    if (error.message === 'Hospital not found' || error.message === ELIGIBILITY_KEYS.DONOR_NOT_FOUND) {
      return response.error(res, 404, error.message);
    }
    if (error.message === ELIGIBILITY_KEYS.REQUEST_NOT_FOUND) {
      return response.error(res, 404, error.message);
    }
    if (error.message === 'You already have an active appointment at this hospital') {
      return response.error(res, 409, ERR.APPOINTMENT_ALREADY_EXISTS);
    }
    if (
      error.message === 'Appointment date must be in the future' ||
      error.message === 'Appointment date is invalid' ||
      error.message === 'Appointment must be at least 24 hours in advance' ||
      error.message === 'Appointment cannot be more than 30 days in advance' ||
      error.message === 'Selected day is not available for appointments' ||
      error.message === 'Hospital appointment scheduling is currently disabled' ||
      error.message === 'Hospital does not support this donation type' ||
      error.message === 'Invalid donor or hospital id' ||
      error.message === 'Invalid appointment id' ||
      error.message === 'Invalid request id' ||
      error.message === 'Request does not belong to this hospital' ||
      error.message === 'The linked request is no longer active' ||
      error.message === ELIGIBILITY_KEYS.DONOR_CURRENTLY_UNAVAILABLE ||
      error.message === ELIGIBILITY_KEYS.DONOR_SUSPENDED ||
      error.message === ELIGIBILITY_KEYS.DONOR_HAS_NO_BLOOD_TYPE ||
      error.message === ELIGIBILITY_KEYS.ACTIVE_DONATION_IN_PROGRESS ||
      error.message === 'Selected time slot is outside operating hours' ||
      error.message === 'Selected time slot is no longer available' ||
      error.message === 'Daily appointment capacity has been reached' ||
      error.message === ELIGIBILITY_KEYS.BLOOD_TYPE_INCOMPATIBLE ||
      error.message === ELIGIBILITY_KEYS.DONATION_COOLDOWN_ACTIVE
    ) {
      return response.error(res, 400, error.message);
    }

    if (error?.name === 'ValidationError') {
      const details = Object.values(error.errors || {}).map((item) => item.message);
      return response.error(res, 400, 'error.validation_failed', details);
    }

    if (error?.name === 'CastError') {
      return response.error(res, 400, `Invalid ${error.path}`);
    }

    if (error?.code === 11000) {
      const field = Object.keys(error.keyPattern || {})[0];
      return response.error(res, 409, field ? `Duplicate ${field}` : error.message);
    }

    return response.error(res, 500, error?.message || 'Internal server error');
  }
};

export const getMyAppointments = async (req, res, next) => {
  try {
    const donorId = getDonorId(req);
    const { page, limit } = req.query;

    // Keep createdAt, updatedAt, verificationChecklist and rescheduleHistory for Flutter compatibility
    const projection = req.user?.role === 'donor'
      ? '-__v -donorId -notes -requestId -qrExpiresAt -verificationStatus -rescheduleCount -donorDetails'
      : null;

    const result = await appointmentService.getMyAppointments(donorId, { page, limit }, projection, { role: req.user?.role });

    return response.success(res, 200, 'Appointments fetched', {
      ...result,
    });
  } catch (error) {
    next(error);
  }
};

export const getAvailableSlots = async (req, res, next) => {
  try {
    const { hospitalId, date, excludeAppointmentId } = req.query;

    if (!hospitalId || !date) {
      return response.error(res, 400, 'hospitalId and date are required');
    }

    const slots = await appointmentService.getAvailableSlots(hospitalId, date, {
      excludeAppointmentId: excludeAppointmentId || undefined,
    });
    return response.success(res, 200, 'Available slots retrieved successfully', toAvailableSlotsResponse(slots, { role: req.user?.role }));
  } catch (error) {
    if (error.message === 'Invalid hospital id' || error.message === 'Invalid date') {
      return response.error(res, 400, error.message);
    }
    if (error.message === 'Hospital not found') {
      return response.error(res, 404, error.message);
    }
    next(error);
  }
};

export const cancelAppointment = async (req, res, next) => {
  try {
    const donorId = getDonorId(req);
    const appointmentId = req.params.appointmentId;

    if (!appointmentId) return response.error(res, 400, 'appointmentId is required');

    const appointment = await appointmentService.cancelAppointment(appointmentId, donorId);

    return response.success(res, 200, 'Appointment cancelled', appointment);
  } catch (error) {
    if (error.message === 'Appointment not found') return response.error(res, 404, ERR.APPOINTMENT_NOT_FOUND);
    if (error.message === 'This appointment cannot be cancelled') return response.error(res, 400, ERR.APPOINTMENT_CANNOT_CANCEL);
    if (error.message.includes('Cancellation must be at least')) return response.error(res, 400, error.message);
    next(error);
  }
};

export const getAppointmentById = async (req, res, next) => {
  try {
    const donorId = getDonorId(req);
    const appointmentId = req.params.appointmentId;

    if (!appointmentId) return response.error(res, 400, 'appointmentId is required');

    const appointment = await appointmentService.getAppointmentById(appointmentId, donorId);

    // Populate for HTTP response then apply DTO transformation.
    await appointment.populate(req.user?.role === 'donor' ? donorAppointmentPopulateOptions : appointmentPopulateOptions);
    return response.success(res, 200, 'Appointment retrieved', toAppointmentResponse(appointment, { role: req.user?.role }));
  } catch (error) {
    if (error.message === 'Appointment not found') return response.error(res, 404, 'Appointment not found');
    if (error.message === 'Invalid appointment id') return response.error(res, 400, 'Invalid appointment id');
    next(error);
  }
};

export const rescheduleAppointment = async (req, res, next) => {
  try {
    const donorId = getDonorId(req);
    const appointmentId = req.params.appointmentId;
    // Accept either { date, time } (human-readable) or a plain ISO date string in `date`.
    const { date, time, appointmentDate, donationType, reason, notes } = req.body;
    const newDate = buildAppointmentDate({ appointmentDate, date, time });
    // Support both 'notes' (preferred) and 'reason' (legacy) fields
    const rescheduleReason = notes || reason;

    if (!appointmentId) return response.error(res, 400, 'appointmentId is required');
    if (!newDate) return response.error(res, 400, 'date is required');

    const appointment = await appointmentService.rescheduleAppointment(appointmentId, donorId, {
      appointmentDate: newDate,
      donationType,
      reason: rescheduleReason,
    });

    return response.success(res, 200, 'Appointment rescheduled', toAppointmentResponse(appointment, { role: req.user?.role }));
  } catch (error) {
    if (error.message === 'Appointment not found') return response.error(res, 404, 'Appointment not found');
    if (error.message === 'Invalid appointment id') return response.error(res, 400, 'Invalid appointment id');
    if (error.message.includes('rescheduled')) return response.error(res, 400, error.message);
    if (error.message.includes('future')) return response.error(res, 400, error.message);
    if (
      error.message.includes('different from the current appointment')
      || error.message.includes('maximum number of reschedules')
      || error.message.includes('Hospital does not allow rescheduling')
      || error.message.includes('linked request is no longer active')
      || error.message.includes('Selected time slot is no longer available')
      || error.message.includes('at least')
      || error.message.includes('cannot be more than')
      || error.message.includes('support this donation type')
      || error.message.includes('Only pending or confirmed appointments can be rescheduled')
    ) {
      return response.error(res, 400, error.message);
    }
    next(error);
  }
};
