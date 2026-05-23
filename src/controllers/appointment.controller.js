import response from '../utils/response.js';
import * as appointmentService from '../services/appointment.service.js';
import ERR from '../utils/errorCodes.js';
import { DONATION_TYPE_LABELS, DONATION_TYPE_OPTIONS } from '../constants/donation.constants.js';
import { toAppointmentResponse, appointmentPopulateOptions } from '../utils/appointment.dto.js';

const getDonorId = (req) => req?.user?.userId || req?.user?._id;

const buildAppointmentDate = ({ appointmentDate, date, time }) => {
  if (appointmentDate) return new Date(appointmentDate);
  if (!date) return null;

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

    const appointmentObj = appointment.toObject ? appointment.toObject() : appointment;

    return response.success(res, 201, 'Appointment booked', appointmentObj);
  } catch (error) {
    if (error.message === 'Hospital not found' || error.message === 'Donor not found') {
      return response.error(res, 404, error.message);
    }
    if (error.message === 'Request not found') {
      return response.error(res, 404, error.message);
    }
    if (error.message === 'You already have an active appointment at this hospital') {
      return response.error(res, 409, ERR.APPOINTMENT_ALREADY_EXISTS);
    }
    if (
      error.message === 'Appointment date must be in the future' ||
      error.message === 'Invalid donor or hospital id' ||
      error.message === 'Invalid appointment id' ||
      error.message === 'Invalid request id' ||
      error.message === 'Request does not belong to this hospital' ||
      error.message === 'Donor is not currently available' ||
      error.message === 'Donor is suspended' ||
      error.message === 'Donor has not provided blood type information' ||
      error.message.startsWith('Donor blood type ') ||
      error.message.startsWith('Must wait ')
    ) {
      return response.error(res, 400, error.message);
    }
    next(error);
  }
};

export const getMyAppointments = async (req, res, next) => {
  try {
    const donorId = getDonorId(req);
    const { page, limit } = req.query;

    const result = await appointmentService.getMyAppointments(donorId, { page, limit });

    return response.success(res, 200, 'Appointments fetched', result);
  } catch (error) {
    next(error);
  }
};

export const getAvailableSlots = async (req, res, next) => {
  try {
    const { hospitalId, date } = req.query;

    if (!hospitalId || !date) {
      return response.error(res, 400, 'hospitalId and date are required');
    }

    const slots = await appointmentService.getAvailableSlots(hospitalId, date);
    return response.success(res, 200, 'Available slots retrieved successfully', slots);
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
    await appointment.populate(appointmentPopulateOptions);
    const appointmentDto = toAppointmentResponse(appointment);
    return response.success(res, 200, 'Appointment retrieved', appointmentDto);
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
    const { date, time, appointmentDate } = req.body;
    const newDate = buildAppointmentDate({ appointmentDate, date, time });

    if (!appointmentId) return response.error(res, 400, 'appointmentId is required');
    if (!newDate) return response.error(res, 400, 'date is required');

    const appointment = await appointmentService.rescheduleAppointment(appointmentId, donorId, newDate);

    const appointmentDto = toAppointmentResponse(appointment);
    return response.success(res, 200, 'Appointment rescheduled', appointmentDto);
  } catch (error) {
    if (error.message === 'Appointment not found') return response.error(res, 404, 'Appointment not found');
    if (error.message === 'Invalid appointment id') return response.error(res, 400, 'Invalid appointment id');
    if (error.message.includes('rescheduled')) return response.error(res, 400, error.message);
    if (error.message.includes('future')) return response.error(res, 400, error.message);
    next(error);
  }
};
