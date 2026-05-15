import response from '../utils/response.js';
import { parsePagination } from '../utils/pagination.js';
import * as activityService from '../services/activity.service.js';
import { logger } from '../utils/logger.js';
import { formatActivityForTimeline } from '../utils/activity.formatter.js';

/**
 * Activity Controller
 *
 * Handles HTTP requests for the activity timeline API.
 * All handlers use response.success() / response.error() for consistent response formatting.
 *
 * Fire-and-forget friendly — activity operations don't block critical paths.
 */

/**
 * Get user activity timeline with pagination
 *
 * @endpoint GET /donor/activity?page=1&limit=20
 * @auth JWT required (donor only)
 * @query {number} page - Page number (default: 1)
 * @query {number} limit - Items per page (default: 20, max: 100)
 *
 * @returns {object} activities array + pagination metadata
 * @example
 * GET /donor/activity?page=1&limit=20
 * Response:
 * {
 *   "success": true,
 *   "data": {
 *     "activities": [
 *       {
 *         "id": "5f9d4a1b9d7c2e3c4f5a6b7c",
 *         "title": "Blood Donation Completed",
 *         "hospital": "Cairo Hospital",
 *         "points": 200,
 *         "createdAt": "2026-05-04T12:00:00.000Z",
 *         "relativeTime": "3 days ago",
 *         "type": "donation",
 *         "status": "success",
 *         "icon": "heart"
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
const isPositiveIntegerString = (value) => /^\d+$/.test(String(value).trim());

export const getTimeline = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const { page: pageParam, limit: limitParam } = req.query;

    if (pageParam !== undefined && !isPositiveIntegerString(pageParam)) {
      return response.error(res, 400, 'Page must be a positive integer');
    }

    if (limitParam !== undefined && !isPositiveIntegerString(limitParam)) {
      return response.error(res, 400, 'Limit must be a positive integer');
    }

    const { page, limit } = parsePagination(req.query, 20, 100);

    // Call service with pagination only.
    const result = await activityService.getUserTimeline(userId, {
      page,
      limit,
    });

    response.success(res, 200, 'Activity timeline retrieved successfully', {
      activities: result.activities.map(formatActivityForTimeline),
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
