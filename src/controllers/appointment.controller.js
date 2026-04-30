import response from '../utils/response.js';
import * as appointmentService from '../services/appointment.service.js';
import ERR from '../utils/errorCodes.js';

export const bookAppointment = async (req, res, next) => {
  try {
    const donorId = req.user._id;
    const { hospitalId, requestId, appointmentDate, notes } = req.body;

    if (!hospitalId || !appointmentDate) {
      return response.error(res, 400, 'hospitalId and appointmentDate are required');
    }

    const appointment = await appointmentService.bookAppointment(donorId, hospitalId, requestId || null, appointmentDate, notes || '');

    return response.success(res, 201, 'Appointment booked', appointment);
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
    const donorId = req.user._id;
    const { skip, limit } = req.query;

    const result = await appointmentService.getMyAppointments(donorId, { skip, limit });

    return response.success(res, 200, 'Appointments fetched', result);
  } catch (error) {
    next(error);
  }
};

export const cancelAppointment = async (req, res, next) => {
  try {
    const donorId = req.user._id;
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
