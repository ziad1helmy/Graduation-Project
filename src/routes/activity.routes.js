import { Router } from 'express';
import authMiddleware from '../middlewares/auth.middleware.js';
import requireRole from '../middlewares/role.middleware.js';
import * as activityController from '../controllers/activity.controller.js';

const router = Router();

/**
 * Activity Routes
 *
 * All activity endpoints require JWT authentication and donor authorization.
 * Routes are scoped to the donor role.
 *
 * Rate limiting is applied at the parent route level (see app.js).
 */

/**
 * @openapi
 * /donor/activity:
 *   get:
 *     tags:
 *       - Donor
 *     summary: Get the authenticated user's activity timeline
 *     description: |
 *       Returns a paginated, timestamped history of all user actions (donations, rewards, urgent responses, profile updates).
 *       Supports optional filtering by activity type.
 *       Results are sorted newest-first.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: page
 *         in: query
 *         description: Page number (1-indexed, default 1)
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *       - name: limit
 *         in: query
 *         description: Items per page (default 20, max 100)
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 20
 *       - name: type
 *         in: query
 *         description: Optional activity type filter
 *         schema:
 *           type: string
 *           enum: [donation, reward, emergency_response, profile_update, appointment, badge, achievement, referral, subscription, admin_action]
 *     responses:
 *       '200':
 *         description: Activity timeline retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     activities:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                             example: "5f9d4a1b9d7c2e3c4f5a6b7c"
 *                           title:
 *                             type: string
 *                             example: "Blood Donation Completed"
 *                           hospital:
 *                             type: string
 *                             nullable: true
 *                             example: "Cairo Hospital"
 *                           points:
 *                             type: number
 *                             example: 200
 *                           createdAt:
 *                             type: string
 *                             format: date-time
 *                             example: "2026-05-04T12:00:00.000Z"
 *                           relativeTime:
 *                             type: string
 *                             example: "3 days ago"
 *                           type:
 *                             type: string
 *                             enum: [donation, reward, emergency_response, profile_update, appointment, badge, achievement, referral, subscription, admin_action]
 *                           status:
 *                             type: string
 *                             example: "success"
 *                           icon:
 *                             type: string
 *                             example: "heart"
 *                     pagination:
 *                       type: object
 *                       properties:
 *                         total:
 *                           type: integer
 *                           example: 42
 *                         page:
 *                           type: integer
 *                           example: 1
 *                         limit:
 *                           type: integer
 *                           example: 20
 *                         totalPages:
 *                           type: integer
 *                           example: 3
 *                         hasNextPage:
 *                           type: boolean
 *                           example: true
 *                         hasPrevPage:
 *                           type: boolean
 *                           example: false
 *       '400':
 *         description: Invalid query parameters
 *       '401':
 *         description: Missing or invalid JWT
 *       '500':
 *         description: Server error
 */
router.get(
  '/activity',
  authMiddleware,
  requireRole('donor'),
  activityController.getTimeline
);

export default router;
