import { Router } from 'express';
import authMiddleware from '../middlewares/auth.middleware.js';
import requireRole from '../middlewares/role.middleware.js';
import * as ctrl from '../controllers/appointment.controller.js';

// ─── API CONTRACT ────────────────────────────────────────────────────────────
// Swagger/OpenAPI documentation for this router lives in /openapi.yaml
// Update openapi.yaml whenever you add, change, or remove an endpoint here.
// Do NOT add inline @openapi JSDoc to this file.
// ─────────────────────────────────────────────────────────────────────────────


const router = Router();

router.use(authMiddleware, requireRole('donor'));


router.post('/', ctrl.bookAppointment);


router.get('/available-slots', ctrl.getAvailableSlots);


router.get('/my-appointments', ctrl.getMyAppointments);


router.get('/:appointmentId', ctrl.getAppointmentById);


router.patch('/:appointmentId', ctrl.rescheduleAppointment);


router.delete('/:appointmentId', ctrl.cancelAppointment);

export default router;

