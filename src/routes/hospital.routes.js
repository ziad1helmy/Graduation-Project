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
 *                   governorate:
 *                     type: string
 *                     example: Cairo
 *               location:
 *                 type: object
 *                 properties:
 *                   city:
 *                     type: string
 *                   governorate:
 *                     type: string
 *                   coordinates:
 *                     type: object
 *                     properties:
 *                       lat:
 *                         type: number
 *                         example: 30.0444
 *                       lng:
 *                         type: number
 *                         example: 31.2357
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
 *         description: Donations retrieved successfully
 *       '401':
 *         description: Missing or invalid JWT
 *       '403':
 *         description: Role not allowed
 * /hospital/blood-inventory:
 *   get:
 *     tags:
 *       - Hospital
 *     summary: Get a read-only blood inventory summary for the authenticated hospital
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '200':
 *         description: Blood inventory retrieved successfully
 *       '401':
 *         description: Missing or invalid JWT
 *       '403':
 *         description: Role not allowed
 */

/**
 * @swagger
 * /hospital/blood-bank-settings:
 *   get:
 *     tags: [Hospital]
 *     summary: Get hospital blood bank settings
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: Blood bank settings retrieved successfully
 *   put:
 *     tags: [Hospital]
 *     summary: Update hospital blood bank settings
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Blood bank settings updated successfully
 *
 * /hospital/notification-preferences:
 *   get:
 *     tags: [Hospital]
 *     summary: Get hospital notification preferences
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: Notification preferences retrieved successfully
 *   put:
 *     tags: [Hospital]
 *     summary: Update hospital notification preferences
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Notification preferences updated successfully
 *
 * /hospital/reports/monthly:
 *   get:
 *     tags: [Hospital]
 *     summary: Get monthly hospital report
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: month
 *         schema:
 *           type: string
 *           example: 2026-04
 *     responses:
 *       200:
 *         description: Monthly report retrieved successfully
 *
 * /hospital/staff:
 *   get:
 *     tags: [Hospital]
 *     summary: List hospital staff
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: Staff retrieved successfully
 *   post:
 *     tags: [Hospital]
 *     summary: Create hospital staff member
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, position]
 *     responses:
 *       201:
 *         description: Staff created successfully
 *
 * /hospital/staff/{id}:
 *   delete:
 *     tags: [Hospital]
 *     summary: Delete hospital staff member
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Staff deleted successfully
 */

// Apply auth and role middleware to all hospital routes
router.use(authMiddleware, requireRole('hospital'));

// Profile routes
router.get('/profile', hospitalController.getProfile);
router.put('/profile', hospitalController.updateProfile);

// Request management routes
router.post('/request', hospitalController.createRequest);
// Compatibility alias for emergency-style request creation
router.post('/requests/create-emergency', hospitalController.createRequest);
// Hospital dashboard
router.get('/dashboard', hospitalController.getMonthlyReports);
// Close request (dedicated flow)
router.post('/requests/:requestId/close', hospitalController.closeRequest);
router.get('/requests', hospitalController.getRequests);
router.get('/requests/:requestId', hospitalController.getRequestDetails);
router.get('/requests/:requestId/responses', hospitalController.getRequestDetails);
router.put('/requests/:requestId', hospitalController.updateRequest);
router.delete('/requests/:requestId', hospitalController.deleteRequest);

// Donation tracking
router.get('/donations', hospitalController.getDonations);

// Extended compatibility features
router.get('/blood-bank-settings', hospitalController.getBloodBankSettings);
router.put('/blood-bank-settings', hospitalController.updateBloodBankSettings);
router.get('/blood-inventory', hospitalController.getBloodInventory);
router.get('/notification-preferences', hospitalController.getNotificationPreferences);
router.put('/notification-preferences', hospitalController.updateNotificationPreferences);
router.get('/reports/monthly', hospitalController.getMonthlyReports);
router.get('/staff', hospitalController.listStaff);
router.post('/staff', hospitalController.createStaff);
router.delete('/staff/:id', hospitalController.deleteStaff);

export default router;
