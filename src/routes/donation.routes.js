import { Router } from 'express';
import authMiddleware from '../middlewares/auth.middleware.js';
import requireRole from '../middlewares/role.middleware.js';
import * as donationController from '../controllers/donation.controller.js';

// ─── API CONTRACT ────────────────────────────────────────────────────────────
// Swagger/OpenAPI documentation for this router lives in /openapi.yaml
// Update openapi.yaml whenever you add, change, or remove an endpoint here.
// Do NOT add inline @openapi JSDoc to this file.
// ─────────────────────────────────────────────────────────────────────────────


const router = Router();

router.get('/types', donationController.getDonationTypes);

router.use(authMiddleware);

router.post('/validate', requireRole('donor'), donationController.validateDonationEligibility);

router.post('/complete', requireRole('hospital', 'admin', 'superadmin'), donationController.completeDonation);

export default router;