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
 *     summary: Get supported donation types with details
 *     description: |
 *       Returns all supported donation types including medical hold periods and point values.
 *       - Blood: 56-day cooldown, 200 points
 *       - Plasma: 14-day cooldown, 150 points
 *       - Platelets: 7-day cooldown, 175 points
 *       - Organ: 365-day cooldown, 500 points
 *     responses:
 *       '200':
 *         description: Donation types retrieved successfully
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: Donation types retrieved
 *               data:
 *                 types:
 *                   - type: blood
 *                     name: Whole Blood
 *                     cooldownDays: 56
 *                     pointsAward: 200
 *                     description: Standard blood donation - most common type
 *                   - type: plasma
 *                     name: Plasma
 *                     cooldownDays: 14
 *                     pointsAward: 150
 *                     description: Plasma donation - more frequent possible donations
 *                   - type: platelets
 *                     name: Platelets
 *                     cooldownDays: 7
 *                     pointsAward: 175
 *                     description: Platelet donation - shortest cooldown period
 *                   - type: organ
 *                     name: Organ
 *                     cooldownDays: 365
 *                     pointsAward: 500
 *                     description: Organ donation - highest point value
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
 *     description: |
 *       Checks donation eligibility based on:
 *       - Type-specific cooldown period (blood: 56d, plasma: 14d, platelets: 7d, organ: 365d)
 *       - Minimum age (17 years old)
 *       - Hemoglobin level (minimum 12.5 g/dL)
 *       - Travel deferrals
 *       - Temporary medical deferrals
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [hospitalId, date]
 *             properties:
 *               hospitalId:
 *                 type: string
 *                 description: Hospital ObjectId
 *               date:
 *                 type: string
 *                 format: date
 *                 description: Intended donation date (YYYY-MM-DD)
 *               donationType:
 *                 type: string
 *                 enum: [blood, plasma, platelets, organ]
 *                 default: blood
 *                 description: Type of donation - affects cooldown period
 *           examples:
 *             bloodDonation:
 *               summary: Blood donation eligibility check
 *               value:
 *                 hospitalId: 69f3df915f42685cbbbcbb1b
 *                 date: "2026-05-20"
 *                 donationType: blood
 *             plasmaDonation:
 *               summary: Plasma donation eligibility check (shorter cooldown)
 *               value:
 *                 hospitalId: 69f3df915f42685cbbbcbb1b
 *                 date: "2026-05-20"
 *                 donationType: plasma
 *             plateletsDonation:
 *               summary: Platelets donation eligibility check (7-day cooldown)
 *               value:
 *                 hospitalId: 69f3df915f42685cbbbcbb1b
 *                 date: "2026-05-20"
 *                 donationType: platelets
 *     responses:
 *       '200':
 *         description: Donation eligibility checked successfully
 *         content:
 *           application/json:
 *             examples:
 *               eligible:
 *                 summary: Donor is eligible to donate
 *                 value:
 *                   success: true
 *                   message: Donor is eligible to donate
 *                   data:
 *                     eligible: true
 *                     canProceed: true
 *                     reason: "Donor is eligible for blood donation"
 *               ineligibleCooldown:
 *                 summary: Donor has active cooldown period
 *                 value:
 *                   success: true
 *                   message: Donation eligibility checked
 *                   data:
 *                     eligible: false
 *                     canProceed: false
 *                     reason: "Blood donation cooldown: must wait 45 more days"
 *                     nextEligibleDate: "2026-06-25T00:00:00.000Z"
 *               ineligibleAge:
 *                 summary: Donor is too young
 *                 value:
 *                   success: true
 *                   message: Donation eligibility checked
 *                   data:
 *                     eligible: false
 *                     canProceed: false
 *                     reason: "Donor must be at least 17 years old to donate"
 *       '400':
 *         description: Missing required fields
 *       '401':
 *         description: Missing or invalid JWT
 *       '403':
 *         description: Role not allowed
 */
router.post('/validate', requireRole('donor'), donationController.validateDonationEligibility);

/**
 * @swagger
 * /donations/complete:
 *   post:
 *     tags:
 *       - Donor
 *     summary: Mark a donation as completed and award points
 *     description: |
 *       Completes a donation and triggers point award based on donation type:
 *       - Blood: 200 points (+ campaign multiplier if active)
 *       - Plasma: 150 points (+ campaign multiplier if active)
 *       - Platelets: 175 points (+ campaign multiplier if active)
 *       - Organ: 500 points (+ campaign multiplier if active)
 *       
 *       Also triggers first-donation bonus if applicable.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [donationId, isEmergency]
 *             properties:
 *               donationId:
 *                 type: string
 *                 description: Donation ObjectId to complete
 *               isEmergency:
 *                 type: boolean
 *                 description: Whether this was an emergency donation (for analytics)
 *           example:
 *             donationId: 69fe540565ff7785a0313157
 *             isEmergency: false
 *     responses:
 *       '200':
 *         description: Donation completed and points awarded
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: Donation completed successfully
 *               data:
 *                 donation:
 *                   _id: 69fe540565ff7785a0313157
 *                   donorId: 69f3df915f42685cbbbcbb18
 *                   requestId: 69fe540565ff7785a0313151
 *                   status: completed
 *                   completedDate: "2026-05-11T10:00:00.000Z"
 *                 points:
 *                   awarded: 200
 *                   multiplier: 1.0
 *                   bonusEarned: false
 *                   transaction:
 *                     type: BLOOD_DONATION
 *                     amount: 200
 *       '404':
 *         description: Donation not found
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