import { Router } from 'express';
import authMiddleware from '../middlewares/auth.middleware.js';
import requireRole from '../middlewares/role.middleware.js';
import * as rc from '../controllers/reward.controller.js';

const router = Router();

// All reward routes require authentication
router.use(authMiddleware);

/**
 * @swagger
 * tags:
 *   - name: Donor
 *     description: All donor-facing endpoints
 *   - name: Admin
 *     description: All admin endpoints
 */

// ── Donor routes ──────────────────────────────────────────

/**
 * @openapi
 * /rewards/points:
 *   get:
 *     summary: Get donor's points summary and tier
 *     tags: [Donor]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Points summary with tier info
 */
router.get('/points', requireRole('donor'), rc.getPoints);

/**
 * @openapi
 * /rewards/earning-rules:
 *   get:
 *     summary: Get the current reward earning rules
 *     tags: [Donor]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Dynamic earning rules for the rewards UI
 */
router.get('/earning-rules', requireRole('donor'), rc.getEarningRules);

/**
 * @openapi
 * /rewards/dashboard:
 *   get:
 *     tags: [Donor]
 *     summary: Get full rewards screen data in one request
 *     description: |
 *       Returns all data needed to render the Rewards screen in a single call:
 *       current points, rewards catalog, points history (last 10), and badge progress.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '200':
 *         description: Rewards dashboard retrieved
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: Rewards dashboard retrieved
 *               data:
 *                 points: 2340
 *                 progressPercentage: 46
 *                 nextRewardPoints: 500
 *                 pointsToNextReward: 160
 *                 rewards:
 *                   - id: "664a..."
 *                     title: "Coffee Voucher"
 *                     pointsRequired: 500
 *                     isAvailable: true
 *                 history:
 *                   - id: "664b..."
 *                     type: "BLOOD_DONATION"
 *                     title: "Blood Donation - Successful"
 *                     points: 100
 *                     createdAt: "2026-05-01T10:00:00Z"
 *                 badges:
 *                   unlocked: 2
 *                   total: 7
 *                   completion: 28
 *                   list:
 *                     - id: "664c..."
 *                       title: "First Timer"
 *                       description: "Completed your first blood donation"
 *                       isUnlocked: true
 *                       progress: 1
 *                       target: 1
 *       '401':
 *         description: Unauthorized
 */
router.get('/dashboard', requireRole('donor'), rc.getRewardsDashboard);

/**
 * @openapi
 * /rewards/stats:
 *   get:
 *     tags: [Donor]
 *     summary: Get rewards screen header stats
 *     description: Returns current points, next reward distance, badge counts, and completion percentage.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '200':
 *         description: Rewards stats retrieved
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: Rewards stats retrieved
 *               data:
 *                 points: 2340
 *                 nextReward:
 *                   pointsToGo: 160
 *                 badgesUnlocked: 3
 *                 totalBadges: 7
 *                 completionPercent: 43
 *       '401':
 *         description: Unauthorized
 */
router.get('/stats', requireRole('donor'), rc.getRewardsStats);


/**
 * @swagger
 * /rewards/points/history:
 *   get:
 *     summary: Get donor's points transaction history
 *     tags: [Donor]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *       - in: query
 *         name: filter
 *         schema: { type: string, enum: [ALL, EARNED, REDEEMED, ADJUSTMENTS], default: ALL }
 *       - in: query
 *         name: date_from
 *         schema: { type: string, format: date-time }
 *       - in: query
 *         name: date_to
 *         schema: { type: string, format: date-time }
 *     responses:
 *       200:
 *         description: Paginated points history
 */
router.get('/points/history', requireRole('donor'), rc.getPointsHistory);

/**
 * @swagger
 * /rewards/badges:
 *   get:
 *     summary: Get all badges and donor's progress
 *     tags: [Donor]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Badge list with unlock status and progress
 */
router.get('/badges', requireRole('donor'), rc.getBadges);

/**
 * @swagger
 * /rewards/catalog:
 *   get:
 *     summary: Get available rewards catalog
 *     tags: [Donor]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: category
 *         schema: { type: string, enum: [ALL, FOOD, ENTERTAINMENT, HEALTH, STATUS] }
 *       - in: query
 *         name: sort_by
 *         schema: { type: string, enum: [COST_ASC, COST_DESC, POPULARITY] }
 *     responses:
 *       200:
 *         description: Rewards catalog
 */
router.get('/catalog', requireRole('donor'), rc.getRewards);

/**
 * @swagger
 * /rewards/history:
 *   get:
 *     summary: Get donor reward history
 *     tags: [Donor]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [ALL, PENDING, CONFIRMED, DELIVERED, CANCELLED, EXPIRED] }
 *       - in: query
 *         name: page
 *         schema: { type: integer }
 *       - in: query
 *         name: limit
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Reward history retrieved successfully
 */
router.get('/history', requireRole('donor'), rc.getHistory);

/**
 * @swagger
 * /rewards/catalog/{rewardId}/redeem:
 *   post:
 *     summary: Redeem a reward using points
 *     tags: [Donor]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: rewardId
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               delivery_preference:
 *                 type: string
 *                 enum: [IN_APP, EMAIL]
 *                 default: IN_APP
 *               delivery_contact:
 *                 type: string
 *                 description: Email address if delivery_preference is EMAIL
 *     responses:
 *       200:
 *         description: Redemption confirmed with confirmation code
 *       409:
 *         description: Insufficient points or limit exceeded
 */
router.post('/catalog/:rewardId/redeem', requireRole('donor'), rc.redeemReward);

/**
 * @swagger
 * /rewards/redemptions:
 *   get:
 *     summary: Get donor's redemption history
 *     tags: [Donor]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [ALL, PENDING, CONFIRMED, DELIVERED, CANCELLED, EXPIRED] }
 *       - in: query
 *         name: page
 *         schema: { type: integer }
 *       - in: query
 *         name: limit
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Paginated redemption history
 */
router.get('/redemptions', requireRole('donor'), rc.getRedemptions);

/**
 * @swagger
 * /rewards/leaderboard:
 *   get:
 *     summary: Get the top donors leaderboard
 *     tags: [Donor]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20, maximum: 50 }
 *         description: Number of top donors to return
 *     responses:
 *       200:
 *         description: Ranked list of top donors by lifetime points
 */
router.get('/leaderboard', rc.getLeaderboard);

// ── Admin routes ──────────────────────────────────────────

/**
 * @swagger
 * /rewards/admin/users/{userId}/points/adjust:
 *   post:
 *     summary: Manually adjust a donor's points (admin only)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [amount, reason]
 *             properties:
 *               amount:
 *                 type: integer
 *                 description: Positive to add, negative to deduct
 *               reason:
 *                 type: string
 *     responses:
 *       200:
 *         description: Points adjusted and transaction logged
 */
router.post('/admin/users/:userId/points/adjust', requireRole('admin', 'superadmin'), rc.adminAdjustPoints);

/**
 * @swagger
 * /rewards/admin/catalog/{rewardId}/status:
 *   patch:
 *     summary: Update a reward's status (admin only)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: rewardId
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [status]
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [ACTIVE, INACTIVE, LIMITED]
 *     responses:
 *       200:
 *         description: Reward status updated
 */
router.patch('/admin/catalog/:rewardId/status', requireRole('admin', 'superadmin'), rc.adminUpdateRewardStatus);

/**
 * @swagger
 * /rewards/admin/analytics:
 *   get:
 *     summary: Get rewards system analytics (admin only)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Top rewards, tier distribution, total points issued
 */
router.get('/admin/analytics', requireRole('admin', 'superadmin'), rc.adminGetRewardsAnalytics);

export default router;
