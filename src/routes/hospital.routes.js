import { Router } from 'express';
import authMiddleware from '../middlewares/auth.middleware.js';
import requireRole from '../middlewares/role.middleware.js';
import * as hospitalController from '../controllers/hospital.controller.js';

const router = Router();

/**
 * @openapi
 * /hospital/profile:
 *   get:
 *     tags:
 *       - Hospital
 *     summary: Get the authenticated hospital profile
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '200':
 *         description: Hospital profile retrieved successfully
 *       '401':
 *         description: Missing or invalid JWT
 *       '403':
 *         description: Role not allowed
 *       '404':
 *         description: Hospital profile not found
 *   put:
 *     tags:
 *       - Hospital
 *     summary: Update the authenticated hospital profile
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
 *                 example: City Care Hospital
 *               hospitalName:
 *                 type: string
 *                 example: City Care Hospital
 *               contactNumber:
 *                 type: string
 *                 example: '01099998888'
 *               address:
 *                 type: object
 *                 properties:
 *                   city:
 *                     type: string
 *                     example: Cairo
 *                   governrate:
 *                     type: string
 *                     example: Cairo
 *               licenseNumber:
 *                 type: string
 *                 example: LIC-2026-001
 *     responses:
 *       '200':
 *         description: Hospital profile updated successfully
 *       '400':
 *         description: Invalid profile data
 *       '401':
 *         description: Missing or invalid JWT
 *       '403':
 *         description: Role not allowed
 * /hospital/request:
 *   post:
 *     tags:
 *       - Hospital
 *     summary: Create a donation request
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [type, urgency, requiredBy]
 *             properties:
 *               type:
 *                 type: string
 *                 enum: [blood, organ]
 *                 example: blood
 *               bloodType:
 *                 type: string
 *                 enum: [A+, A-, B+, B-, AB+, AB-, O+, O-]
 *                 example: O+
 *               organType:
 *                 type: string
 *                 enum: [kidney, liver, heart, lung, pancreas, cornea]
 *                 example: kidney
 *               urgency:
 *                 type: string
 *                 enum: [low, medium, high, critical]
 *                 example: high
 *               requiredBy:
 *                 type: string
 *                 format: date-time
 *                 example: '2026-04-15T00:00:00.000Z'
 *               quantity:
 *                 type: number
 *                 example: 2
 *               notes:
 *                 type: string
 *                 example: Need compatible donors urgently
 *     responses:
 *       '201':
 *         description: Donation request created successfully
 *       '400':
 *         description: Invalid request payload
 *       '401':
 *         description: Missing or invalid JWT
 *       '403':
 *         description: Role not allowed
 * /hospital/requests:
 *   get:
 *     tags:
 *       - Hospital
 *     summary: List requests created by the authenticated hospital
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, in-progress, completed, cancelled]
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [blood, organ]
 *       - in: query
 *         name: skip
 *         schema:
 *           type: integer
 *           example: 0
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           example: 10
 *     responses:
 *       '200':
 *         description: Requests retrieved successfully
 *       '401':
 *         description: Missing or invalid JWT
 *       '403':
 *         description: Role not allowed
 * /hospital/requests/{requestId}:
 *   get:
 *     tags:
 *       - Hospital
 *     summary: Get details for a specific hospital request
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: requestId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       '200':
 *         description: Request details retrieved successfully
 *       '401':
 *         description: Missing or invalid JWT
 *       '403':
 *         description: Role not allowed or unauthorized access
 *       '404':
 *         description: Request not found
 *   put:
 *     tags:
 *       - Hospital
 *     summary: Update the status of a hospital request
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
 *             required: [status]
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [pending, in-progress, completed, cancelled]
 *                 example: in-progress
 *     responses:
 *       '200':
 *         description: Request status updated successfully
 *       '400':
 *         description: Invalid status payload
 *       '401':
 *         description: Missing or invalid JWT
 *       '403':
 *         description: Role not allowed or unauthorized access
 *       '404':
 *         description: Request not found
 *   delete:
 *     tags:
 *       - Hospital
 *     summary: Cancel a hospital request
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: requestId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       '200':
 *         description: Request cancelled successfully
 *       '401':
 *         description: Missing or invalid JWT
 *       '403':
 *         description: Role not allowed or unauthorized access
 *       '404':
 *         description: Request not found
 * /hospital/donations:
 *   get:
 *     tags:
 *       - Hospital
 *     summary: List donations for the authenticated hospital's requests
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
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           example: 10
 *     responses:
 *       '200':
 *         description: Donations retrieved successfully
 *       '401':
 *         description: Missing or invalid JWT
 *       '403':
 *         description: Role not allowed
 */

// Apply auth and role middleware to all hospital routes
router.use(authMiddleware, requireRole('hospital'));

// Profile routes
router.get('/profile', hospitalController.getProfile);
router.put('/profile', hospitalController.updateProfile);

// Request management routes
router.post('/request', hospitalController.createRequest);
router.get('/requests', hospitalController.getRequests);
router.get('/requests/:requestId', hospitalController.getRequestDetails);
router.put('/requests/:requestId', hospitalController.updateRequest);
router.delete('/requests/:requestId', hospitalController.deleteRequest);

// Donation tracking
router.get('/donations', hospitalController.getDonations);

export default router;
