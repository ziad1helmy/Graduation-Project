import { Router } from 'express';
import authMiddleware from '../middlewares/auth.middleware.js';
import requireRole from '../middlewares/role.middleware.js';
import * as requestController from '../controllers/request.controller.js';

// ─── API CONTRACT ────────────────────────────────────────────────────────────
// Swagger/OpenAPI documentation for this router lives in /openapi.yaml
// Update openapi.yaml whenever you add, change, or remove an endpoint here.
// Do NOT add inline @openapi JSDoc to this file.
// ─────────────────────────────────────────────────────────────────────────────


const router = Router();

router.use(authMiddleware);


router.get('/nearby', requireRole('donor', 'hospital', 'admin', 'superadmin'), requestController.getNearbyRequests);


router.get('/:id/google-maps', requestController.getRequestGoogleMaps);


router.get('/:id', requestController.getRequestDetails);


router.post('/:id/generate-qr', requireRole('hospital', 'admin', 'superadmin'), requestController.generateQr);


router.post('/verify-qr', requireRole('hospital', 'admin', 'superadmin'), requestController.verifyQr);


router.post('/:id/accept', requireRole('donor'), requestController.acceptRequest);


router.post('/:id/reject', requireRole('hospital', 'admin', 'superadmin'), requestController.rejectRequest);


router.post('/:id/cancel', requestController.cancelRequest);

export default router;

// ─── API CONTRACT ────────────────────────────────────────────────────────────
// Swagger/OpenAPI documentation for this router lives in /openapi.yaml
// Update openapi.yaml whenever you add, change, or remove an endpoint here.
// Do NOT add inline @openapi JSDoc to this file.
// ─────────────────────────────────────────────────────────────────────────────