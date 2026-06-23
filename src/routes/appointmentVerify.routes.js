import { Router } from 'express';
import authMiddleware from '../middlewares/auth.middleware.js';
import requireRole from '../middlewares/role.middleware.js';
import { verifyQr } from '../controllers/donation.controller.js';
import * as donationController from '../controllers/donation.controller.js';
import * as apptCtrl from '../controllers/appointment.controller.js';

// ─── API CONTRACT ────────────────────────────────────────────────────────────
// Swagger/OpenAPI documentation for this router lives in /openapi.yaml
// Update openapi.yaml whenever you add, change, or remove an endpoint here.
// Do NOT add inline @openapi JSDoc to this file.
// ─────────────────────────────────────────────────────────────────────────────


const router = Router();


router.post('/verify-qr', authMiddleware, requireRole('hospital', 'admin', 'superadmin'), verifyQr);

// Donor-facing appointment detail & reschedule endpoints (also reachable via /donations/book-appointment/:id)
router.get('/:appointmentId', authMiddleware, requireRole('donor'), apptCtrl.getAppointmentById);
router.patch('/:appointmentId', authMiddleware, requireRole('donor'), apptCtrl.rescheduleAppointment);

router.post('/:appointmentId/reject', authMiddleware, requireRole('hospital', 'admin', 'superadmin'), donationController.rejectVerification);

router.post('/:appointmentId/rescan', authMiddleware, requireRole('hospital', 'admin', 'superadmin'), donationController.resetVerification);

export default router;
