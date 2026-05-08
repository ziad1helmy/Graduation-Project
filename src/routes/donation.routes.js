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
 */
router.get('/my-appointments', requireRole('donor'), appointmentController.getMyAppointments);

export default router;