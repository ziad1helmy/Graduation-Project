import response from '../utils/response.js';
import { parsePagination } from '../utils/pagination.js';
import * as activityService from '../services/activity.service.js';
import { logger } from '../utils/logger.js';
import { formatActivityForTimeline, ACTIVITY_TYPES } from '../utils/activity.formatter.js';
import { asyncHandler } from '../middlewares/asyncHandler.js';


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
 *         "title": "200 Points Earned — Blood Donation",
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

export const getTimeline = asyncHandler(async (req, res) => {
  const userId = req.user.userId;
  const { page: pageParam, limit: limitParam } = req.query;

  if (pageParam !== undefined && !isPositiveIntegerString(pageParam)) {
    return response.error(res, 400, 'activity.error_invalid_page');
  }

  if (limitParam !== undefined && !isPositiveIntegerString(limitParam)) {
    return response.error(res, 400, 'activity.error_invalid_limit');
  }

  const { page, limit } = parsePagination(req.query, 20, 100);

  // Validate optional `type` filter when provided
  const typeParam = req.query?.type;
  if (typeParam !== undefined && String(typeParam).trim() !== '') {
    if (!ACTIVITY_TYPES.includes(String(typeParam))) {
      return response.error(res, 400, `Invalid type filter: ${typeParam}`);
    }
  }

  // Exclude __v always; also exclude createdAt for donor viewers (not needed by Flutter).
  const projection = req.user?.role === 'donor' ? '-__v -createdAt' : '-__v';
  const result = await activityService.getUserTimeline(userId, {
    page,
    limit,
  }, projection);

  const formattedActivities = result.activities.map(formatActivityForTimeline);

  response.success(res, 200, 'activity.timeline_retrieved', {
    activities: formattedActivities,
    pagination: result.pagination,
  });
});

export default {
  getTimeline,
};
