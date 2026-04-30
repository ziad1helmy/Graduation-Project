import { Router } from 'express';
import authMiddleware from '../middlewares/auth.middleware.js';
import requireRole from '../middlewares/role.middleware.js';
import * as ctrl from '../controllers/appointment.controller.js';

const router = Router();

router.use(authMiddleware, requireRole('donor'));

/**
 * @swagger
 * /donations/book-appointment:
 *   post:
 *     tags:
 *       - Appointments
 *     summary: Book a donor appointment with a hospital
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [hospitalId, appointmentDate]
 *             properties:
 *               hospitalId:
 *                 type: string
 *               requestId:
 *                 type: string
 *                 nullable: true
 *               appointmentDate:
 *                 type: string
 *                 format: date-time
 *               notes:
 *                 type: string
 *                 maxLength: 500
 *           example:
 *             hospitalId: 66f100000000000000000010
 *             requestId: 66f100000000000000000020
 *             appointmentDate: 2026-05-10T10:00:00.000Z
 *             notes: First-time donor, available in the morning.
 *     responses:
 *       '201':
 *         description: Appointment booked
 *       '400':
 *         description: Invalid appointment payload
 *       '404':
 *         description: Hospital, donor, or request not found
 *       '409':
 *         description: Active appointment already exists for this hospital
 *       '401':
 *         description: Missing or invalid JWT
 *       '403':
 *         description: Role not allowed
 */
router.post('/', ctrl.bookAppointment);

/**
 * @swagger
 * /donations/book-appointment/my-appointments:
 *   get:
 *     tags:
 *       - Appointments
 *     summary: Get the authenticated donor appointments
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: skip
 *         schema:
 *           type: integer
 *           minimum: 0
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *     responses:
 *       '200':
 *         description: Appointments fetched successfully
 *       '401':
 *         description: Missing or invalid JWT
 *       '403':
 *         description: Role not allowed
 */
router.get('/my-appointments', ctrl.getMyAppointments);

/**
 * @swagger
 * /donations/book-appointment/{appointmentId}:
 *   delete:
 *     tags:
 *       - Appointments
 *     summary: Cancel a donor appointment
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: appointmentId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       '200':
 *         description: Appointment cancelled
 *       '400':
 *         description: Invalid appointment id
 *       '401':
 *         description: Missing or invalid JWT
 *       '403':
 *         description: Role not allowed
 *       '404':
 *         description: Appointment not found
 */
router.delete('/:appointmentId', ctrl.cancelAppointment);

export default router;
