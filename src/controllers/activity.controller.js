import response from '../utils/response.js';
import { parsePagination } from '../utils/pagination.js';
import * as activityService from '../services/activity.service.js';
import { logger } from '../utils/logger.js';

/**
 * Activity Controller
 *
 * Handles HTTP requests for the activity timeline API.
 * All handlers use response.success() / response.error() for consistent response formatting.
 *
 * Fire-and-forget friendly — activity operations don't block critical paths.
 */

/**
 * Get user activity timeline with optional filtering
 *
 * @endpoint GET /donor/activity?page=1&limit=20&type=donation
 * @auth JWT required (any authenticated user)
 * @query {number} page - Page number (default: 1)
 * @query {number} limit - Items per page (default: 20, max: 100)
 * @query {string} type - Optional type filter: donation, reward, emergency_response, profile_update
 *
 * @returns {object} activities array + pagination metadata
 * @example
 * GET /donor/activity?page=1&limit=20&type=donation
 * Response:
 * {
 *   "success": true,
 *   "data": {
 *     "activities": [
 *       {
 *         "_id": "...",
 *         "type": "donation",
 *         "action": "completed_donation",
 *         "title": "Blood Donation Completed",
 *         "description": "Donated 1 unit of A+ blood to Cairo Hospital",
 *         "icon": "heart",
 *         "referenceId": "...",
 *         "referenceType": "Donation",
 *         "metadata": { "bloodType": "A+", "hospitalName": "Cairo Hospital" },
 *         "createdAt": "2026-05-04T12:00:00Z"
 *       }
 *     ],
 *     "pagination": {
 *       "total": 42,
 *       "page": 1,
 *       "limit": 20,
 *       "totalPages": 3,
 *       "hasNextPage": true,
 *       "hasPrevPage": false
 *     }
 *   }
 * }
 */
export const getTimeline = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const { page, limit } = parsePagination(req.query, 20, 100);
    const { type } = req.query;

    // Validate optional type filter
    const validTypes = ['donation', 'reward', 'emergency_response', 'profile_update'];
    if (type && !validTypes.includes(type)) {
      return response.error(res, 400, `Invalid type. Must be one of: ${validTypes.join(', ')}`);
    }

    // Call service with filters
    const result = await activityService.getUserTimeline(userId, {
      page,
      limit,
      type: type || undefined, // pass undefined if not provided to skip filter
    });

    response.success(res, 200, 'Activity timeline retrieved successfully', {
      activities: result.activities.map(a => ({
        id: a._id,
        type: a.type,
        title: a.title,
        subTitle: a.description,
        points: a.metadata?.pointsAmount || 0,
        createdAt: a.createdAt,
      })),
      pagination: result.pagination,
    });
  } catch (error) {
    logger.error('getTimeline error', {
      userId: req.user.userId,
      error: error.message,
    });
    next(error);
  }
};

export default {
  getTimeline,
};
