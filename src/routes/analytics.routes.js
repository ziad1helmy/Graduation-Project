import { Router } from 'express';
import authMiddleware from '../middlewares/auth.middleware.js';
import requireRole from '../middlewares/role.middleware.js';
import * as ac from '../controllers/analytics.controller.js';

const router = Router();

// All analytics routes require authentication
router.use(authMiddleware);

/**
 * @openapi
 * /analytics/my-stats:
 *   get:
 *     summary: Get donor's personal donation statistics
 *     tags: [Donor]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Donor statistics including donation count by type
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 donorId:
 *                   type: string
 *                 fullName:
 *                   type: string
 *                 email:
 *                   type: string
 *                 bloodType:
 *                   type: string
 *                 pointsBalance:
 *                   type: number
 *                 totalPointsEarned:
 *                   type: number
 *                 totalDonations:
 *                   type: number
 *                 donationsByType:
 *                   type: object
 *                   properties:
 *                     blood:
 *                       type: number
 *                     plasma:
 *                       type: number
 *                     platelets:
 *                       type: number
 *                     organ:
 *                       type: number
 *                 lastDonationDate:
 *                   type: string
 *                   format: date-time
 *                 joinDate:
 *                   type: string
 *                   format: date-time
 */
router.get('/my-stats', requireRole('donor'), ac.getMyStats);

/**
 * @openapi
 * /analytics/leaderboard:
 *   get:
 *     summary: Get top donors leaderboard
 *     tags: [Donor]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Number of top donors to return
 *       - in: query
 *         name: days
 *         schema:
 *           type: integer
 *           default: 30
 *         description: Time period in days for leaderboard
 *     responses:
 *       200:
 *         description: Top donors leaderboard
 */
router.get('/leaderboard', requireRole('donor'), ac.getLeaderboard);

/**
 * @openapi
 * /analytics/donation-types:
 *   get:
 *     summary: Get donation statistics by type
 *     tags: [Donor]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Donation statistics grouped by type
 */
router.get('/donation-types', requireRole('donor'), ac.getDonationTypeStats);

/**
 * @openapi
 * /analytics/dashboard:
 *   get:
 *     summary: Get dashboard summary with key metrics (Admin only)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Dashboard summary with system metrics
 */
router.get('/dashboard', requireRole('admin'), ac.getDashboardSummary);

export default router;
