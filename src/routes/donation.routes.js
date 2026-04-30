import { Router } from 'express';
import authMiddleware from '../middlewares/auth.middleware.js';
import requireRole from '../middlewares/role.middleware.js';
import * as appointmentController from '../controllers/appointment.controller.js';
import * as donationController from '../controllers/donation.controller.js';

const router = Router();

/**
 * @swagger
 * /donations/my-appointments:
 *   get:
 *     tags:
 *       - Appointments
 *     summary: Get donor appointments via the donations compatibility alias
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '200':
 *         description: Appointments fetched successfully
 *       '401':
 *         description: Missing or invalid JWT
 *       '403':
 *         description: Role not allowed
 */
router.get('/my-appointments', authMiddleware, requireRole('donor'), appointmentController.getMyAppointments);

router.use(authMiddleware, requireRole('hospital', 'admin', 'superadmin'));

/**
 * @swagger
 * /donations/complete:
 *   post:
 *     tags:
 *       - Donations
 *     summary: Mark a donation as completed
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [donationId]
 *     responses:
 *       '200':
 *         description: Donation completed successfully
 *       '400':
 *         description: Invalid donation payload
 *       '401':
 *         description: Missing or invalid JWT
 *       '403':
 *         description: Role not allowed
 */
router.post('/complete', donationController.completeDonation);

export default router;