import { Router } from 'express';
import authMiddleware from '../middlewares/auth.middleware.js';
import requireRole from '../middlewares/role.middleware.js';
import * as appointmentController from '../controllers/appointment.controller.js';
import * as donationController from '../controllers/donation.controller.js';

const router = Router();

/**
 * @swagger
 * /donations/types:
 *   get:
 *     tags:
 *       - Donor
 *     summary: Get supported donation types
 *     responses:
 *       '200':
 *         description: Donation types retrieved successfully
 */
router.get('/types', donationController.getDonationTypes);

router.use(authMiddleware);

/**
 * @swagger
 * /donations/validate:
 *   post:
 *     tags:
 *       - Donor
 *     summary: Validate if a donor can donate for a given hospital and date
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [hospitalId, date]
 *     responses:
 *       '200':
 *         description: Donation eligibility checked successfully
 */
router.post('/validate', requireRole('donor'), donationController.validateDonationEligibility);

/**
 * @swagger
 * /donations/complete:
 *   post:
 *     tags:
 *       - Donor
 *     summary: Mark a donation as completed
 *     security:
 *       - bearerAuth: []
 */
router.post('/complete', requireRole('hospital', 'admin', 'superadmin'), donationController.completeDonation);

/**
 * @swagger
 * /donations/my-appointments:
 *   get:
 *     tags:
 *       - Donor
 *     summary: Get donor appointments via the donations compatibility alias
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '200':
 *         description: Appointments fetched successfully
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: Appointments fetched
 *               data:
 *                 appointments:
 *                   - _id: 69fe540565ff7785a031315c
 *                     appointmentDate: '2026-05-12T10:00:00.000Z'
 *                     status: pending
 *                     notes: Test appointment
 *                     qrToken: 8f3a4f2f6a6d4f3a9e2c1b0a7d6c5e4f3a2b1c0d9e8f7a6b5c4d3e2f1a0b9c8d
 *                     donationType: Whole Blood
 *                 total: 1
 *                 meta:
 *                   page: 1
 *                   limit: 10
 *                   total: 1
 *       '401':
 *         description: Missing or invalid JWT
 *       '403':
 *         description: Role not allowed
 */
router.get('/my-appointments', requireRole('donor'), appointmentController.getMyAppointments);

export default router;