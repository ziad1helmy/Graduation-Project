/**
 * DonorRepository - Data access layer for Donor model
 * 
 * Encapsulates all queries related to donor documents, including:
 * - Finding donors by various criteria
 * - Updating donor profiles
 * - Querying donor statistics
 * - Location-based queries
 */

import { BaseRepository } from './BaseRepository.js';
import Donor from '../models/Donor.model.js';
import logger from '../utils/logger.js';

class DonorRepository extends BaseRepository {
  constructor() {
    super(Donor, 'Donor');
  }

  /**
   * Find donor with full profile details
   * @param {string} donorId - Donor ID
   * @returns {Promise<object>} Donor document with full details
   */
  async findWithProfile(donorId) {
    try {
      const donor = await this.model.findById(donorId)
        .select('-password -refreshTokens')
        .lean();
      return donor;
    } catch (error) {
      logger.error('Failed to find donor with profile', {
        error: error.message,
        donorId,
      });
      throw error;
    }
  }

  /**
   * Find donors by blood type
   * @param {string} bloodType - Blood type (e.g., 'O+')
   * @param {object} options - Query options
   * @returns {Promise<array>} Matching donors
   */
  async findByBloodType(bloodType, options = {}) {
    try {
      const { skip = 0, limit = 50, lean = true } = options;
      const donors = await this.model
        .find({ bloodType, deletedAt: { $exists: false } })
        .select('_id firstName lastName location bloodType phone')
        .skip(skip)
        .limit(limit)
        .lean(lean)
        .exec();

      return donors;
    } catch (error) {
      logger.error('Failed to find donors by blood type', {
        error: error.message,
        bloodType,
      });
      throw error;
    }
  }

  /**
   * Find eligible donors near location (geospatial query)
   * @param {object} location - {lat, lng}
   * @param {object} criteria - {maxDistance, bloodType, etc.}
   * @returns {Promise<array>} Donors sorted by distance
   */
  async findNearby(location, criteria = {}) {
    try {
      const { maxDistance = 100000, bloodType = null, isActive = true } = criteria;

      const filter = {
        location: {
          $near: {
            $geometry: {
              type: 'Point',
              coordinates: [location.lng, location.lat],
            },
            $maxDistance: maxDistance,
          },
        },
        isActive,
        deletedAt: { $exists: false },
      };

      if (bloodType) {
        filter.bloodType = bloodType;
      }

      const donors = await this.model
        .find(filter)
        .select('_id firstName lastName location bloodType distance')
        .lean()
        .exec();

      return donors;
    } catch (error) {
      logger.error('Failed to find nearby donors', {
        error: error.message,
        location,
      });
      throw error;
    }
  }

  /**
   * Get donor statistics (total donations, points, badges)
   * @param {string} donorId - Donor ID
   * @returns {Promise<object>} Statistics object
   */
  async getStatistics(donorId) {
    try {
      const pipeline = [
        { $match: { _id: donorId } },
        {
          $lookup: {
            from: 'donations',
            localField: '_id',
            foreignField: 'donorId',
            as: 'donations',
          },
        },
        {
          $lookup: {
            from: 'donorpoints',
            localField: '_id',
            foreignField: 'donorId',
            as: 'points',
          },
        },
        {
          $lookup: {
            from: 'userbadges',
            localField: '_id',
            foreignField: 'donorId',
            as: 'badges',
          },
        },
        {
          $project: {
            totalDonations: { $size: '$donations' },
            completedDonations: {
              $size: {
                $filter: {
                  input: '$donations',
                  as: 'donation',
                  cond: { $eq: ['$$donation.status', 'completed'] },
                },
              },
            },
            totalPoints: { $arrayElemAt: ['$points.pointsBalance', 0] },
            badgesCount: { $size: '$badges' },
          },
        },
      ];

      const result = await this.model.aggregate(pipeline);
      return result[0] || { totalDonations: 0, completedDonations: 0, totalPoints: 0, badgesCount: 0 };
    } catch (error) {
      logger.error('Failed to get donor statistics', {
        error: error.message,
        donorId,
      });
      throw error;
    }
  }

  /**
   * Check if donor is eligible to donate
   * @param {string} donorId - Donor ID
   * @returns {Promise<object>} {isEligible, reason}
   */
  async checkEligibility(donorId) {
    try {
      const donor = await this.findById(donorId, { projection: 'age lastDonationDate health' });

      if (!donor) {
        return { isEligible: false, reason: 'Donor not found' };
      }

      // Age check (18-65)
      if (donor.age < 18 || donor.age > 65) {
        return { isEligible: false, reason: 'Age outside eligible range' };
      }

      // Donation interval check (56 days minimum)
      if (donor.lastDonationDate) {
        const daysSinceLastDonation = Math.floor(
          (Date.now() - new Date(donor.lastDonationDate)) / (1000 * 60 * 60 * 24)
        );
        if (daysSinceLastDonation < 56) {
          return { isEligible: false, reason: `Must wait ${56 - daysSinceLastDonation} more days` };
        }
      }

      // Health check
      if (donor.health?.suspended) {
        return { isEligible: false, reason: 'Health check deferred' };
      }

      return { isEligible: true };
    } catch (error) {
      logger.error('Failed to check donor eligibility', {
        error: error.message,
        donorId,
      });
      throw error;
    }
  }

  /**
   * Update donor's last donation date
   * @param {string} donorId - Donor ID
   * @returns {Promise<object>} Updated donor
   */
  async updateLastDonationDate(donorId) {
    try {
      return await this.updateById(donorId, {
        lastDonationDate: new Date(),
      });
    } catch (error) {
      logger.error('Failed to update last donation date', {
        error: error.message,
        donorId,
      });
      throw error;
    }
  }

  /**
   * Find active donors (not suspended, not deleted)
   * @param {object} options - Query options
   * @returns {Promise<array>} Active donors
   */
  async findActive(options = {}) {
    try {
      const { skip = 0, limit = 100, lean = true } = options;
      const donors = await this.model
        .find({
          isActive: true,
          deletedAt: { $exists: false },
        })
        .skip(skip)
        .limit(limit)
        .lean(lean)
        .exec();

      return donors;
    } catch (error) {
      logger.error('Failed to find active donors', {
        error: error.message,
      });
      throw error;
    }
  }
}

export default new DonorRepository();
