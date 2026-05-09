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
 *       - Donor
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
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: Appointment booked
 *               data:
 *                 _id: 69fe540565ff7785a031315c
 *                 donorId: 69f3df915f42685cbbbcbb18
 *                 hospitalId: 69f3df915f42685cbbbcbb1b
 *                 requestId: 69fe540565ff7785a031314f
 *                 appointmentDate: '2026-05-12T10:00:00.000Z'
 *                 status: confirmed
 *                 qrToken: 8f3a4f2f6a6d4f3a9e2c1b0a7d6c5e4f3a2b1c0d9e8f7a6b5c4d3e2f1a0b9c8d
 *                 qrExpiresAt: '2026-05-13T10:00:00.000Z'
 *                 notes: First-time donor, available in the morning.
 *                 donationType: Whole Blood
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
 * /donations/book-appointment/available-slots:
 *   get:
 *     tags:
 *       - Donor
 *     summary: Get available appointment slots for a hospital on a given date
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: hospitalId
 *         required: true
 *         schema:
 *           type: string
 *         example: 69f3df915f42685cbbbcbb1b
 *       - in: query
 *         name: date
 *         required: true
 *         schema:
 *           type: string
 *           format: date
 *         example: 2026-05-12
 *     responses:
 *       '200':
 *         description: Available appointment slots retrieved successfully
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: Available slots retrieved successfully
 *               data:
 *                 timeSlots:
 *                   - '09:00 AM'
 *                   - '10:00 AM'
 *                   - '11:00 AM'
 *                 hospitalId: 69f3df915f42685cbbbcbb1b
 *                 date: '2026-05-12T00:00:00.000Z'
 *                 slotsPerHour: 5
 *       '400':
 *         description: Invalid hospitalId or date
 *       '404':
 *         description: Hospital not found
 */
router.get('/available-slots', ctrl.getAvailableSlots);

/**
 * @swagger
 * /donations/book-appointment/my-appointments:
 *   get:
 *     tags:
 *       - Donor
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
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: Appointments fetched
 *               data:
 *                 appointments:
 *                   - _id: 69fe540565ff7785a031315c
 *                     donorId: 69f3df915f42685cbbbcbb18
 *                     hospitalId:
 *                       _id: 69f3df915f42685cbbbcbb1b
 *                       hospitalName: Cairo Care Hospital
 *                       fullName: Cairo Care Operations
 *                       address:
 *                         city: Cairo
 *                         governorate: Cairo
 *                     requestId: 69fe540565ff7785a031314f
 *                     appointmentDate: '2026-05-12T10:00:00.000Z'
 *                     status: pending
 *                     notes: Test appointment
 *                     qrToken: 8f3a4f2f6a6d4f3a9e2c1b0a7d6c5e4f3a2b1c0d9e8f7a6b5c4d3e2f1a0b9c8d
 *                     qrExpiresAt: '2026-05-13T10:00:00.000Z'
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
router.get('/my-appointments', ctrl.getMyAppointments);

/**
 * @swagger
 * /donations/book-appointment/{appointmentId}:
 *   get:
 *     tags:
 *       - Donor
 *     summary: Get appointment details
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
 *         description: Appointment retrieved
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: Appointment retrieved
 *               data:
 *                 _id: 69fe540565ff7785a031315c
 *                 donorId: 69f3df915f42685cbbbcbb18
 *                 hospitalId:
 *                   _id: 69f3df915f42685cbbbcbb1b
 *                   hospitalName: Cairo Care Hospital
 *                   fullName: Cairo Care Operations
 *                   address:
 *                     city: Cairo
 *                     governorate: Cairo
 *                 requestId: 69fe540565ff7785a031314f
 *                 appointmentDate: '2026-05-12T10:00:00.000Z'
 *                 status: pending
 *                 notes: Test appointment
 *                 qrToken: 8f3a4f2f6a6d4f3a9e2c1b0a7d6c5e4f3a2b1c0d9e8f7a6b5c4d3e2f1a0b9c8d
 *                 qrExpiresAt: '2026-05-13T10:00:00.000Z'
 *                 donationType: Whole Blood
 *       '401':
 *         description: Missing or invalid JWT
 *       '403':
 *         description: Role not allowed
 *       '404':
 *         description: Appointment not found
 */
router.get('/:appointmentId', ctrl.getAppointmentById);

/**
 * @swagger
 * /donations/book-appointment/{appointmentId}:
 *   patch:
 *     tags:
 *       - Donor
 *     summary: Reschedule a donor appointment
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: appointmentId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [date]
 *             properties:
 *               date:
 *                 type: string
 *                 format: date-time
 *           example:
 *             date: 2026-05-15T14:00:00.000Z
 *     responses:
 *       '200':
 *         description: Appointment rescheduled
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: Appointment rescheduled
 *               data:
 *                 _id: 69fe540565ff7785a031315c
 *                 donorId: 69f3df915f42685cbbbcbb18
 *                 hospitalId: 69f3df915f42685cbbbcbb1b
 *                 requestId: 69fe540565ff7785a031314f
 *                 appointmentDate: '2026-05-15T14:00:00.000Z'
 *                 status: pending
 *                 notes: Test appointment
 *                 qrToken: 8f3a4f2f6a6d4f3a9e2c1b0a7d6c5e4f3a2b1c0d9e8f7a6b5c4d3e2f1a0b9c8d
 *                 qrExpiresAt: '2026-05-13T10:00:00.000Z'
 *                 donationType: Whole Blood
 *       '400':
 *         description: Invalid appointment payload
 *       '401':
 *         description: Missing or invalid JWT
 *       '403':
 *         description: Role not allowed
 *       '404':
 *         description: Appointment not found
 */
router.patch('/:appointmentId', ctrl.rescheduleAppointment);

/**
 * @swagger
 * /donations/book-appointment/{appointmentId}:
 *   delete:
 *     tags:
 *       - Donor
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
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: Appointment cancelled
 *               data:
 *                 _id: 69fe540565ff7785a031315c
 *                 donorId: 69f3df915f42685cbbbcbb18
 *                 hospitalId: 69f3df915f42685cbbbcbb1b
 *                 requestId: 69fe540565ff7785a031314f
 *                 appointmentDate: '2026-05-12T10:00:00.000Z'
 *                 status: cancelled
 *                 cancelledAt: '2026-05-09T10:30:00.000Z'
 *                 notes: Test appointment
 *                 qrToken: 8f3a4f2f6a6d4f3a9e2c1b0a7d6c5e4f3a2b1c0d9e8f7a6b5c4d3e2f1a0b9c8d
 *                 donationType: Whole Blood
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
