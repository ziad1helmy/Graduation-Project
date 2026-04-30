import mongoose from 'mongoose';
import Appointment from '../models/Appointment.model.js';
import User from '../models/User.model.js';
import Donor from '../models/Donor.model.js';
import Request from '../models/Request.model.js';
import Notification from '../models/Notification.model.js';
import * as donationService from './donation.service.js';
import { paginationMeta } from '../utils/pagination.js';

/**
 * Book an appointment
 * @param {string} donorId
 * @param {string} hospitalId
 * @param {string|null} requestId
 * @param {Date|string} appointmentDate
 * @param {string} notes
 */
export const bookAppointment = async (donorId, hospitalId, requestId = null, appointmentDate, notes = '') => {
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

    const hospital = await User.findById(hospitalId);
    if (!hospital || hospital.role !== 'hospital') throw new Error('Hospital not found');

    if (requestId) {
      const request = await Request.findById(requestId);
      if (!request) throw new Error('Request not found');

      if (request.hospitalId?.toString?.() !== hospitalId.toString()) {
        throw new Error('Request does not belong to this hospital');
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

    // Prevent duplicate active appointment for same donor + hospital
    const existing = await Appointment.findOne({
      donorId,
      hospitalId,
      status: { $in: ['pending', 'confirmed'] },
    });
    if (existing) {
      throw new Error('You already have an active appointment at this hospital');
    }

    const appointment = await Appointment.create({
      donorId,
      hospitalId,
      requestId,
      appointmentDate: apptDate,
      notes,
    });

    // Fire-and-forget notification to hospital
    Notification.create({
      userId: hospitalId,
      type: 'system',
      title: 'New Appointment Booked',
      message: `A donor has booked an appointment for ${apptDate.toLocaleDateString()}`,
      relatedId: appointment._id,
      relatedType: 'User',
      data: { appointmentId: appointment._id, donorId },
    }).catch((err) => console.error('[AppointmentService] notification error:', err && err.message));

    return appointment;
  } catch (error) {
    throw error;
  }
};

export const getMyAppointments = async (donorId, filters = {}) => {
  try {
    const { skip = 0, limit = 10 } = filters;

    const filter = { donorId };

    const appointments = await Appointment.find(filter)
      .populate('hospitalId', 'hospitalName fullName address contactNumber location')
      .skip(parseInt(skip))
      .limit(parseInt(limit))
      .sort({ appointmentDate: -1 });

    const total = await Appointment.countDocuments(filter);

    return { appointments, total, meta: paginationMeta(total, skip, limit) };
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

    appointment.status = 'cancelled';
    appointment.cancelledAt = new Date();
    await appointment.save();

    return appointment;
  } catch (error) {
    throw error;
  }
};
