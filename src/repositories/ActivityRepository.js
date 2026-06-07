/**
 * ActivityRepository - Data access layer for Activity model
 */

import { BaseRepository } from './BaseRepository.js';
import Activity from '../models/Activity.model.js';
import logger from '../utils/logger.js';

class ActivityRepository extends BaseRepository {
  constructor() {
    super(Activity, 'Activity');
  }

  /**
   * Get donor timeline (activity history)
   */
  async getDonorTimeline(donorId, options = {}) {
    try {
      const { skip = 0, limit = 50, lean = true } = options;
      const activities = await this.model
        .find({
          donorId,
          deletedAt: { $exists: false },
        })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(lean)
        .exec();

      return activities;
    } catch (error) {
      logger.error('Failed to get donor timeline', { error: error.message, donorId });
      throw error;
    }
  }

  /**
   * Count activities by type
   */
  async countByType(donorId) {
    try {
      const pipeline = [
        { $match: { donorId, deletedAt: { $exists: false } } },
        { $group: { _id: '$type', count: { $sum: 1 } } },
      ];
      const result = await this.aggregate(pipeline);
      const counts = {};
      result.forEach((r) => {
        counts[r._id] = r.count;
      });
      return counts;
    } catch (error) {
      logger.error('Failed to count activities by type', {
        error: error.message,
        donorId,
      });
      throw error;
    }
  }
}

export default new ActivityRepository();
