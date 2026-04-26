import { Router } from 'express';
import authMiddleware from '../middlewares/auth.middleware.js';
import requireRole from '../middlewares/role.middleware.js';
import * as donorController from '../controllers/donor.controller.js';

const router = Router();

/**
 * @openapi
 * /donor/profile:
 *   get:
 *     tags:
 *       - Donor
 *     summary: Get the authenticated donor profile
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
 *       '401':
 *         description: Missing or invalid JWT
 *       '403':
 *         description: Role not allowed
 *       '404':
 *         description: Donor profile not found
 *   put:
 *     tags:
 *       - Donor
 *     summary: Update the authenticated donor profile
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
 *                 example: Ahmed Hassan
 *               phoneNumber:
 *                 type: string
 *                 example: '01012345678'
 *               gender:
 *                 type: string
 *                 enum: [male, female, not specified]
 *                 example: male
 *               dateOfBirth:
 *                 type: string
 *                 format: date-time
 *                 example: '1995-07-12T00:00:00.000Z'
 *               bloodType:
 *                 type: string
 *                 enum: [A+, A-, B+, B-, AB+, AB-, O+, O-]
 *                 example: O+
 *               location:
 *                 type: object
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
 *       '400':
 *         description: Invalid profile data
 *       '401':
 *         description: Missing or invalid JWT
 *       '403':
 *         description: Role not allowed
 * /donor/requests:
 *   get:
 *     tags:
 *       - Donor
 *     summary: List active donation requests available to donors
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [blood, organ]
 *       - in: query
 *         name: urgency
 *         schema:
 *           type: string
 *           enum: [low, medium, high, critical]
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
 *                   limit: 10
 *                   total: 0
 *       '401':
 *         description: Missing or invalid JWT
 *       '403':
 *         description: Role not allowed
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
 */

// Apply auth and role middleware to all donor routes
router.use(authMiddleware, requireRole('donor'));

// Profile routes
router.get('/profile', donorController.getProfile);
router.put('/profile', donorController.updateProfile);

// Request and matching routes
router.get('/requests', donorController.getRequests);
router.get('/matches', donorController.getMatches);

// Donation response route
router.post('/respond/:requestId', donorController.respondToRequest);

// Donation history
router.get('/history', donorController.getDonationHistory);

// Availability management
router.put('/availability', donorController.updateAvailability);

export default router;
