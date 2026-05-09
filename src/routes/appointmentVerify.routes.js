import { Router } from 'express';
import authMiddleware from '../middlewares/auth.middleware.js';
import requireRole from '../middlewares/role.middleware.js';
import { verifyQr } from '../controllers/donation.controller.js';

const router = Router();

/**
 * @openapi
 * /appointments/verify-qr:
 *   post:
 *     tags:
 *       - Hospital
 *     summary: Verify donor QR code at hospital check-in
 *     description: |
 *       Hospital staff scans the donor's QR code to confirm the donation.
 *       - Validates the QR token, checks expiry and one-time usage
 *       - Marks the appointment as completed
 *       - Creates a Donation record
 *       - Updates donor statistics and triggers reward/badge flow
 *
 *       **Role required:** hospital | admin | superadmin
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - qrToken
 *             properties:
 *               qrToken:
 *                 type: string
 *                 description: The secure QR token scanned from the donor's device
 *                 example: "a3f9c1e82b4d..."
 *           example:
 *             qrToken: "a3f9c1e82b4d7890abcd1234ef567890"
 *     responses:
 *       '200':
 *         description: Donation verified successfully
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: Donation verified successfully
 *               data:
 *                 donation:
 *                   donationId: "664a0f1a2b3c4d5e6f7a8b9c"
 *                   type: "Whole Blood"
 *                   date: "2026-05-07T12:00:00.000Z"
 *                   location: "City General Hospital"
 *                   status: "confirmed"
 *                 pointsEarned: 100
 *       '401':
 *         description: Missing or invalid JWT token
 *       '400':
 *         description: |
 *           One of:
 *           - qrToken is required
 *           - QR code expired
 *           - Appointment is cancelled
 *           - Appointment is not active
 *       '403':
 *         description: Donor is not eligible to donate
 *       '404':
 *         description: Invalid QR code (token not found)
 *       '409':
 *         description: QR code already used
 */
router.post('/verify-qr', authMiddleware, requireRole('hospital', 'admin', 'superadmin'), verifyQr);

export default router;
