/**
 * DonationRepository - Data access layer for Donation model
 * 
 * Encapsulates all queries related to donation documents:
 * - Finding donations by status
 * - Querying donor donation history
 * - Updating donation status and details
 */

import { BaseRepository } from './BaseRepository.js';
import Donation from '../models/Donation.model.js';
import logger from '../utils/logger.js';

class DonationRepository extends BaseRepository {
  constructor() {
    super(Donation, 'Donation');
  }

  /**
   * Find donations by donor
   * @param {string} donorId - Donor ID
   * @param {object} options - Query options
   * @returns {Promise<array>} Donor's donations
   */
  async findByDonor(donorId, options = {}) {
    try {
      const { skip = 0, limit = 50, lean = true, status = null, sort = { createdAt: -1 } } = options;

      const filter = {
        donorId,
        deletedAt: { $exists: false },
      };

      if (status) {
        filter.status = status;
      }

      const donations = await this.model
        .find(filter)
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .lean(lean)
        .exec();

      return donations;
    } catch (error) {
      logger.error('Failed to find donations by donor', {
        error: error.message,
        donorId,
      });
      throw error;
    }
  }

  /**
   * Find donations for a request
   * @param {string} requestId - Request ID
   * @param {object} options - Query options
   * @returns {Promise<array>} Request's donations
   */
  async findByRequest(requestId, options = {}) {
    try {
      const { skip = 0, limit = 100, lean = true, status = null } = options;

      const filter = {
        requestId,
        deletedAt: { $exists: false },
      };

      if (status) {
        filter.status = status;
      }

      const donations = await this.model
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(lean)
        .exec();

      return donations;
    } catch (error) {
      logger.error('Failed to find donations by request', {
        error: error.message,
        requestId,
      });
      throw error;
    }
  }

  /**
   * Get donation with related details (donor, request, appointment)
   * @param {string} donationId - Donation ID
   * @returns {Promise<object>} Donation with populated fields
   */
  async findWithDetails(donationId) {
    try {
      const donation = await this.model
        .findById(donationId)
        .populate('donorId', 'firstName lastName bloodType phone email')
        .populate('requestId', 'bloodType quantity hospital')
        .populate('appointmentId', 'appointmentDate hospitalLocation')
        .lean();

      return donation;
    } catch (error) {
      logger.error('Failed to find donation with details', {
        error: error.message,
        donationId,
      });
      throw error;
    }
  }

  /**
   * Get donor's donation statistics
   * @param {string} donorId - Donor ID
   * @returns {Promise<object>} Statistics
   */
  async getDonorStats(donorId) {
    try {
      const pipeline = [
        { $match: { donorId, deletedAt: { $exists: false } } },
        {
          $group: {
            _id: null,
            totalDonations: { $sum: 1 },
            completedDonations: {
              $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] },
            },
            pendingDonations: {
              $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] },
            },
            rejectedDonations: {
              $sum: { $cond: [{ $eq: ['$status', 'rejected'] }, 1, 0] },
            },
            cancelledDonations: {
              $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0] },
            },
            lastDonationDate: { $max: '$completedAt' },
            totalPoints: { $sum: '$pointsAwarded' },
          },
        },
      ];

      const result = await this.aggregate(pipeline);
      return result[0] || {
        totalDonations: 0,
        completedDonations: 0,
        pendingDonations: 0,
        rejectedDonations: 0,
        cancelledDonations: 0,
        lastDonationDate: null,
        totalPoints: 0,
      };
    } catch (error) {
      logger.error('Failed to get donor stats', {
        error: error.message,
        donorId,
      });
      throw error;
    }
  }

  /**
   * Find pending donations requiring action
   * @param {object} options - Query options
   * @returns {Promise<array>} Pending donations
   */
  async findPending(options = {}) {
    try {
      const { skip = 0, limit = 100, lean = true } = options;

      const donations = await this.model
        .find({
          status: 'pending',
          deletedAt: { $exists: false },
        })
        .sort({ createdAt: 1 })
        .skip(skip)
        .limit(limit)
        .lean(lean)
        .exec();

      return donations;
    } catch (error) {
      logger.error('Failed to find pending donations', {
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Find donations scheduled for appointment
   * @param {string} appointmentId - Appointment ID
   * @returns {Promise<array>} Scheduled donations
   */
  async findScheduled(appointmentId) {
    try {
      const donations = await this.model
        .find({
          appointmentId,
          status: 'scheduled',
          deletedAt: { $exists: false },
        })
        .lean()
        .exec();

      return donations;
    } catch (error) {
      logger.error('Failed to find scheduled donations', {
        error: error.message,
        appointmentId,
      });
      throw error;
    }
  }

  /**
   * Count donations by status
   * @param {string} donorId - Optional donor filter
   * @returns {Promise<object>} Counts by status
   */
  async countByStatus(donorId = null) {
    try {
      const filter = { deletedAt: { $exists: false } };
      if (donorId) {
        filter.donorId = donorId;
      }

      const pipeline = [
        { $match: filter },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 },
          },
        },
      ];

      const result = await this.aggregate(pipeline);
      const counts = {};
      result.forEach((r) => {
        counts[r._id] = r.count;
      });

      return counts;
    } catch (error) {
      logger.error('Failed to count donations by status', {
        error: error.message,
        donorId,
      });
      throw error;
    }
  }

  /**
   * Update donation status with validation
   * @param {string} donationId - Donation ID
   * @param {string} newStatus - New status value
   * @returns {Promise<object>} Updated donation
   */
  async updateStatus(donationId, newStatus) {
    try {
      const donation = await this.findById(donationId);

      if (!donation) {
        throw new Error('Donation not found');
      }

      // Validate state transition (can be customized with state machine)
      const validTransitions = {
        pending: ['scheduled', 'rejected', 'cancelled'],
        scheduled: ['completed', 'cancelled', 'rejected'],
        completed: [],
        rejected: [],
        cancelled: [],
      };

      if (!validTransitions[donation.status]?.includes(newStatus)) {
        throw new Error(
          `Invalid status transition from ${donation.status} to ${newStatus}`
        );
      }

      return await this.updateById(donationId, {
        status: newStatus,
        ...(newStatus === 'completed' && { completedAt: new Date() }),
        ...(newStatus === 'rejected' && { rejectedAt: new Date() }),
        ...(newStatus === 'cancelled' && { cancelledAt: new Date() }),
      });
    } catch (error) {
      logger.error('Failed to update donation status', {
        error: error.message,
        donationId,
        newStatus,
      });
      throw error;
    }
  }

  /**
   * Find donations that haven't been scheduled within X hours
   * @param {number} hoursThreshold - Hours threshold
   * @returns {Promise<array>} Overdue donations
   */
  async findOverdueScheduling(hoursThreshold = 48) {
    try {
      const cutoffDate = new Date(Date.now() - hoursThreshold * 60 * 60 * 1000);

      const donations = await this.model
        .find({
          status: 'pending',
          createdAt: { $lt: cutoffDate },
          deletedAt: { $exists: false },
        })
        .lean()
        .exec();

      return donations;
    } catch (error) {
      logger.error('Failed to find overdue donations', {
        error: error.message,
        hoursThreshold,
      });
      throw error;
    }
  }
}

export default new DonationRepository();
