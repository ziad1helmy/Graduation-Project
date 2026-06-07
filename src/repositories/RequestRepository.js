/**
 * RequestRepository - Data access layer for Request model
 * 
 * Encapsulates all queries related to blood request documents:
 * - Finding requests by status, blood type, urgency
 * - Querying nearby requests
 * - Updating request status
 */

import { BaseRepository } from './BaseRepository.js';
import Request from '../models/Request.model.js';
import logger from '../utils/logger.js';

class RequestRepository extends BaseRepository {
  constructor() {
    super(Request, 'Request');
  }

  /**
   * Find urgent requests (status pending or partial)
   * @param {object} options - Query options
   * @returns {Promise<array>} Urgent requests
   */
  async findUrgent(options = {}) {
    try {
      const { skip = 0, limit = 50, lean = true, maxAge = 24 } = options;

      const cutoffDate = new Date(Date.now() - maxAge * 60 * 60 * 1000);

      const requests = await this.model
        .find({
          status: { $in: ['pending', 'partial'] },
          urgency: 'CRITICAL',
          createdAt: { $gt: cutoffDate },
          deletedAt: { $exists: false },
        })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(lean)
        .exec();

      return requests;
    } catch (error) {
      logger.error('Failed to find urgent requests', {
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Find requests by blood type
   * @param {string} bloodType - Blood type
   * @param {object} options - Query options
   * @returns {Promise<array>} Matching requests
   */
  async findByBloodType(bloodType, options = {}) {
    try {
      const { skip = 0, limit = 50, lean = true, status = 'pending' } = options;

      const requests = await this.model
        .find({
          bloodType,
          status,
          deletedAt: { $exists: false },
        })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(lean)
        .exec();

      return requests;
    } catch (error) {
      logger.error('Failed to find requests by blood type', {
        error: error.message,
        bloodType,
      });
      throw error;
    }
  }

  /**
   * Find requests near a location
   * @param {object} location - {lat, lng}
   * @param {object} criteria - {maxDistance, bloodType, status}
   * @returns {Promise<array>} Nearby requests sorted by distance
   */
  async findNearby(location, criteria = {}) {
    try {
      const { maxDistance = 100000, bloodType = null, status = 'pending' } = criteria;

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
        status,
        deletedAt: { $exists: false },
      };

      if (bloodType) {
        filter.bloodType = bloodType;
      }

      const requests = await this.model
        .find(filter)
        .select('_id bloodType quantity urgency location hospital createdAt')
        .lean()
        .exec();

      return requests;
    } catch (error) {
      logger.error('Failed to find nearby requests', {
        error: error.message,
        location,
      });
      throw error;
    }
  }

  /**
   * Find requests by hospital
   * @param {string} hospitalId - Hospital ID
   * @param {object} options - Query options
   * @returns {Promise<array>} Hospital's requests
   */
  async findByHospital(hospitalId, options = {}) {
    try {
      const { skip = 0, limit = 50, lean = true, status = null } = options;

      const filter = {
        hospitalId,
        deletedAt: { $exists: false },
      };

      if (status) {
        filter.status = status;
      }

      const requests = await this.model
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(lean)
        .exec();

      return requests;
    } catch (error) {
      logger.error('Failed to find requests by hospital', {
        error: error.message,
        hospitalId,
      });
      throw error;
    }
  }

  /**
   * Get request with hospital details
   * @param {string} requestId - Request ID
   * @returns {Promise<object>} Request with populated hospital
   */
  async findWithHospital(requestId) {
    try {
      const request = await this.model
        .findById(requestId)
        .populate('hospitalId', 'name location contactPhone')
        .lean();

      return request;
    } catch (error) {
      logger.error('Failed to find request with hospital', {
        error: error.message,
        requestId,
      });
      throw error;
    }
  }

  /**
   * Count active requests by status
   * @returns {Promise<object>} Counts by status
   */
  async countByStatus() {
    try {
      const pipeline = [
        {
          $match: { deletedAt: { $exists: false } },
        },
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
      logger.error('Failed to count requests by status', {
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Update request quantity received
   * @param {string} requestId - Request ID
   * @param {number} quantity - Quantity to add
   * @returns {Promise<object>} Updated request
   */
  async updateQuantityReceived(requestId, quantity) {
    try {
      const request = await this.findById(requestId);

      if (!request) {
        throw new Error('Request not found');
      }

      const newQuantityReceived = (request.quantityReceived || 0) + quantity;
      const newStatus = newQuantityReceived >= request.quantity ? 'fulfilled' : 'partial';

      return await this.updateById(requestId, {
        quantityReceived: newQuantityReceived,
        status: newStatus,
      });
    } catch (error) {
      logger.error('Failed to update quantity received', {
        error: error.message,
        requestId,
        quantity,
      });
      throw error;
    }
  }

  /**
   * Find expired pending requests (older than maxAge)
   * @param {number} maxAgeDays - Maximum age in days
   * @returns {Promise<array>} Expired requests
   */
  async findExpired(maxAgeDays = 30) {
    try {
      const cutoffDate = new Date(Date.now() - maxAgeDays * 24 * 60 * 60 * 1000);

      const requests = await this.model
        .find({
          status: { $in: ['pending', 'partial'] },
          createdAt: { $lt: cutoffDate },
          deletedAt: { $exists: false },
        })
        .lean()
        .exec();

      return requests;
    } catch (error) {
      logger.error('Failed to find expired requests', {
        error: error.message,
        maxAgeDays,
      });
      throw error;
    }
  }
}

export default new RequestRepository();
