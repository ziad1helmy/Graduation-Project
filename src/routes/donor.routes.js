import { Router } from 'express';
import authMiddleware from '../middlewares/auth.middleware.js';
import requireRole from '../middlewares/role.middleware.js';
import * as donorController from '../controllers/donor.controller.js';
import * as rewardController from '../controllers/reward.controller.js';
import * as notificationController from '../controllers/notification.controller.js';

const router = Router();

/**
 * @swagger
 * tags:
 *   - name: Donor
 *     description: "Donor profile, requests, and donation management (Role: donor)"
 */

/**
 * @openapi
 * /donor/profile:
 *   get:
 *     tags:
 *       - Donor
 *     summary: Get the authenticated donor profile
 *     description: Retrieve the authenticated donor's profile information including blood type, availability status, and location
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '200':
 *         description: Donor profile retrieved successfully
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: Donor profile retrieved successfully
 *               data:
 *                 _id: 66f100000000000000000002
 *                 fullName: Ahmed Hassan
 *                 email: ahmed@example.com
 *                 role: donor
 *                 phoneNumber: '01012345678'
 *                 bloodType: O+
 *                 gender: male
 *                 isAvailable: true
 *                 dateOfBirth: '1995-05-15'
 *       '401':
 *         description: Missing or invalid JWT token
 *       '403':
 *         description: Access denied - donor role required
 *       '404':
 *         description: Donor profile not found
 *   put:
 *     tags:
 *       - Donor
 *     summary: Update the authenticated donor profile
 *     description: Update donor profile information such as name, phone, blood type, gender, location, and availability
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               fullName:
 *                 type: string
 *                 description: Donor full name
 *                 example: Ahmed Hassan
 *               phoneNumber:
 *                 type: string
 *                 description: Donor phone number
 *                 example: '01012345678'
 *               gender:
 *                 type: string
 *                 enum: [male, female, other]
 *                 description: Donor gender
 *                 example: male
 *               bloodType:
 *                 type: string
 *                 enum: [A+, A-, B+, B-, AB+, AB-, O+, O-]
 *                 description: Blood type of the donor
 *                 example: O+
 *               isAvailable:
 *                 type: boolean
 *                 description: Donation availability status
 *                 example: true
 *               location:
 *                 type: object
 *                 description: Donor location information
 *                 properties:
 *                   city:
 *                     type: string
 *                     example: Cairo
 *                   governorate:
 *                     type: string
 *                     example: Cairo
 *     responses:
 *       '200':
 *         description: Donor profile updated successfully
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: Donor profile updated successfully
 *               data:
 *                 _id: 66f100000000000000000002
 *                 fullName: Ahmed Hassan
 *                 email: ahmed@example.com
 *                 role: donor
 *                 isAvailable: true
 *       '400':
 *         description: Invalid profile data or validation error
 *       '401':
 *         description: Missing or invalid JWT token
 *       '403':
 *         description: Access denied - donor role required
 * /donor/requests:
 *   get:
 *     tags:
 *       - Donor
 *     summary: List active donation requests available to donors
 *     description: Retrieve paginated list of blood and organ donation requests that match donor eligibility criteria. Filters by type and urgency
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [blood, organ]
 *         description: Request type filter
 *       - in: query
 *         name: urgency
 *         schema:
 *           type: string
 *           enum: [low, medium, high, critical]
 *         description: Urgency level filter
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           example: 1
 *         description: Page number for pagination
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           example: 20
 *         description: Items per page
 *     responses:
 *       '200':
 *         description: Requests retrieved successfully
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: Requests retrieved successfully
 *               data:
 *                 requests: []
 *                 pagination:
 *                   page: 1
 *                   limit: 20
 *                   total: 0
 *       '401':
 *         description: Missing or invalid JWT token
 *       '403':
 *         description: Access denied - donor role required
 * /donor/matches:
 *   get:
 *     tags:
 *       - Donor
 *     summary: List donation requests matched to the authenticated donor
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: skip
 *         schema:
 *           type: integer
 *           example: 0
 *         description: Legacy pagination alias still supported.
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           example: 10
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           example: 1
 *     responses:
 *       '200':
 *         description: Matching requests retrieved successfully
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: Matching requests retrieved successfully
 *               data:
 *                 matches: []
 *                 pagination:
 *                   page: 1
 *                   limit: 10
 *                   total: 0
 *       '401':
 *         description: Missing or invalid JWT
 *       '403':
 *         description: Role not allowed
 * /donor/respond/{requestId}:
 *   post:
 *     tags:
 *       - Donor
 *     summary: Respond to a donation request
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: requestId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               quantity:
 *                 type: number
 *                 example: 1
 *     responses:
 *       '201':
 *         description: Response submitted successfully
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: Response submitted successfully
 *               data:
 *                 _id: 66f100000000000000000010
 *                 donorId: 66f100000000000000000002
 *                 requestId: 66f100000000000000000020
 *                 quantity: 1
 *                 status: pending
 *       '400':
 *         description: Invalid request or eligibility check failed
 *       '401':
 *         description: Missing or invalid JWT
 *       '403':
 *         description: Role not allowed
 *       '404':
 *         description: Request or donor not found
 * /donor/history:
 *   get:
 *     tags:
 *       - Donor
 *     summary: List donation history for the authenticated donor
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, scheduled, completed, cancelled]
 *       - in: query
 *         name: skip
 *         schema:
 *           type: integer
 *           example: 0
 *         description: Legacy pagination alias still supported.
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           example: 10
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           example: 1
 *     responses:
 *       '200':
 *         description: Donation history retrieved successfully
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: Donation history retrieved successfully
 *               data:
 *                 donations: []
 *                 pagination:
 *                   page: 1
 *                   limit: 10
 *                   total: 0
 *       '401':
 *         description: Missing or invalid JWT
 *       '403':
 *         description: Role not allowed
 * /donor/availability:
 *   put:
 *     tags:
 *       - Donor
 *     summary: Update donor availability
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [isAvailable]
 *             properties:
 *               isAvailable:
 *                 type: boolean
 *                 example: true
 *     responses:
 *       '200':
 *         description: Availability status updated successfully
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: Availability status updated successfully
 *       '400':
 *         description: Invalid availability payload
 *       '401':
 *         description: Missing or invalid JWT
 *       '403':
 *         description: Role not allowed
 * /donor/health-history:
 *   get:
 *     tags:
 *       - Donor
 *     summary: Get the authenticated donor health history
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '200':
 *         description: Health history retrieved successfully
 *       '401':
 *         description: Missing or invalid JWT
 *       '403':
 *         description: Role not allowed
 *   patch:
 *     tags:
 *       - Donor
 *     summary: Update the authenticated donor health history
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       '200':
 *         description: Health history updated successfully
 *       '400':
 *         description: Invalid health history payload
 *       '401':
 *         description: Missing or invalid JWT
 *       '403':
 *         description: Role not allowed
 */

// Apply auth and role middleware to all donor routes
router.use(authMiddleware, requireRole('donor'));

// Profile routes
router.get('/profile', donorController.getProfile);
router.put('/profile', donorController.updateProfile);
router.get('/stats', donorController.getDonorStats);
router.get('/rewards', donorController.getDonorRewards);

// Donor settings
router.get('/settings', donorController.getSettings);
router.put('/settings', donorController.updateSettings);

// Request and matching routes
router.get('/requests', donorController.getRequests);
router.get('/matches', donorController.getMatches);

// Donation response route
router.post('/respond/:requestId', donorController.respondToRequest);

// Donation eligibility (alias to internal eligibility logic)
router.get('/donation-eligibility', donorController.getDonationEligibility);

// Lightweight donor health history
router.get('/health-history', donorController.getHealthHistory);
router.patch('/health-history', donorController.updateHealthHistory);

// Donor dashboard and activity (Medium)
router.get('/dashboard', donorController.getDashboard);
router.get('/recent-activity', donorController.getRecentActivity);

// Urgent requests feed
router.get('/urgent-requests', donorController.getUrgentRequests);
router.get('/urgent-requests/:requestId', donorController.getUrgentRequestDetails);
router.post('/urgent-requests/:requestId/decline', donorController.declineUrgentRequest);

// Donation history
router.get('/history', donorController.getDonationHistory);
router.get('/donations', donorController.getDonationHistory);
router.get('/points', rewardController.getPoints);
router.get('/badges', rewardController.getBadges);
router.get('/redemptions', rewardController.getRedemptions);
router.get('/notifications', notificationController.getNotifications);

// Availability management
router.put('/availability', donorController.updateAvailability);

/**
 * @swagger
 * /donor/settings:
 *   get:
 *     tags:
 *       - Donor
 *     summary: Get donor notification and preference settings
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '200':
 *         description: Settings retrieved successfully
 *       '401':
 *         description: Missing or invalid JWT
 *       '403':
 *         description: Role not allowed
 *       '404':
 *         description: Donor profile not found
 *   put:
 *     tags:
 *       - Donor
 *     summary: Update donor settings
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               pushNotifications:
 *                 type: boolean
 *               emergencyAlerts:
 *                 type: boolean
 *               privacyMode:
 *                 type: boolean
 *               language:
 *                 type: string
 *                 enum: [en, ar]
 *           example:
 *             pushNotifications: true
 *             emergencyAlerts: true
 *             privacyMode: false
 *             language: en
 *     responses:
 *       '200':
 *         description: Settings updated successfully
 *       '400':
 *         description: Invalid settings payload
 *       '401':
 *         description: Missing or invalid JWT
 *       '403':
 *         description: Role not allowed
 *       '404':
 *         description: Donor profile not found
 */

/**
 * @openapi
 * /donor/stats:
 *   get:
 *     tags:
 *       - Donor
 *     summary: Get lightweight donor statistics
 *     description: Returns totalDonations, points balance, and livesSaved. Used in home header and profile stats row.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '200':
 *         description: Donor stats retrieved
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: Donor stats retrieved
 *               data:
 *                 totalDonations: 5
 *                 points: 1200
 *                 livesSaved: 15
 *       '401':
 *         description: Unauthorized
 */

/**
 * @openapi
 * /donor/rewards:
 *   get:
 *     tags:
 *       - Donor
 *     summary: Get donor rewards and badge progress
 *     description: Returns current points, earned badges, locked badges with progress, and next milestone.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '200':
 *         description: Donor rewards retrieved
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: Donor rewards retrieved
 *               data:
 *                 currentPoints: 1200
 *                 earnedBadges:
 *                   - id: "664a0f1a2b3c4d5e6f7a8b9c"
 *                     title: "First Timer"
 *                     description: "Completed your first blood donation"
 *                 lockedBadges:
 *                   - id: "664a0f1a2b3c4d5e6f7a8b9d"
 *                     title: "Regular Donor"
 *                     progress: 2
 *                     target: 5
 *                 nextMilestone: 1800
 *       '401':
 *         description: Unauthorized
 */

/**
 * @openapi
 * /donor/donations:
 *   get:
 *     tags:
 *       - Donor
 *     summary: Get donor donation history with pointsEarned
 *     description: |
 *       Paginated donation history for the authenticated donor.
 *       Each record includes `pointsEarned` calculated from the points transaction log.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 10 }
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, scheduled, completed, cancelled, rejected]
 *     responses:
 *       '200':
 *         description: Donation history retrieved
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: Donation history retrieved successfully
 *               data:
 *                 donations:
 *                   - _id: "664a0f1a2b3c4d5e6f7a8b9c"
 *                     status: "completed"
 *                     quantity: 1
 *                     pointsEarned: 100
 *                     createdAt: "2026-05-01T10:00:00Z"
 *                 pagination:
 *                   total: 1
 *                   page: 1
 *                   limit: 10
 *                   pages: 1
 *       '401':
 *         description: Unauthorized
 */

export default router;
