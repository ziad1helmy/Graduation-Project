/**
 * AppointmentRepository - Data access layer for Appointment model
 */

import { BaseRepository } from './BaseRepository.js';
import Appointment from '../models/Appointment.model.js';
import logger from '../utils/logger.js';

class AppointmentRepository extends BaseRepository {
  constructor() {
    super(Appointment, 'Appointment');
  }

  async findByDonor(donorId, options = {}) {
    try {
      const { skip = 0, limit = 50, lean = true } = options;
      return await this.model
        .find({ donorId, deletedAt: { $exists: false } })
        .sort({ appointmentDate: -1 })
        .skip(skip)
        .limit(limit)
        .lean(lean)
        .exec();
    } catch (error) {
      logger.error('Failed to find appointments by donor', { error: error.message, donorId });
      throw error;
    }
  }

  async findByHospital(hospitalId, options = {}) {
    try {
      const { skip = 0, limit = 50, lean = true } = options;
      return await this.model
        .find({ hospitalId, deletedAt: { $exists: false } })
        .sort({ appointmentDate: 1 })
        .skip(skip)
        .limit(limit)
        .lean(lean)
        .exec();
    } catch (error) {
      logger.error('Failed to find appointments by hospital', { error: error.message, hospitalId });
      throw error;
    }
  }

  async findUpcoming(donorId, hoursFromNow = 48) {
    try {
      const cutoffDate = new Date(Date.now() + hoursFromNow * 60 * 60 * 1000);
      return await this.model
        .find({
          donorId,
          appointmentDate: { $lte: cutoffDate, $gte: new Date() },
          status: { $in: ['pending', 'confirmed'] },
          deletedAt: { $exists: false },
        })
        .sort({ appointmentDate: 1 })
        .lean()
        .exec();
    } catch (error) {
      logger.error('Failed to find upcoming appointments', { error: error.message, donorId });
      throw error;
    }
  }
}

export default new AppointmentRepository();
