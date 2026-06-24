import { Router } from 'express';
import authMiddleware from '../middlewares/auth.middleware.js';
import requireRole from '../middlewares/role.middleware.js';
import * as requestController from '../controllers/request.controller.js';

// ─── API CONTRACT ────────────────────────────────────────────────────────────
// Swagger/OpenAPI documentation for this router lives in /openapi.yaml
// Update openapi.yaml whenever you add, change, or remove an endpoint here.
// Do NOT add inline @openapi JSDoc to this file.
// ─────────────────────────────────────────────────────────────────────────────
// IMPORTANT: Static paths (e.g., /accepted, /nearby, /verify-qr) MUST be
// registered BEFORE parameterized paths (e.g., /:id) to avoid route shadowing.
// ─────────────────────────────────────────────────────────────────────────────


const router = Router();

router.use(authMiddleware);


router.get('/nearby', requireRole('donor', 'hospital', 'admin', 'superadmin'), requestController.getNearbyRequests);


router.get('/accepted', requireRole('donor'), requestController.getAcceptedRequests);


router.get('/accepted/:id', requireRole('donor'), requestController.getAcceptedRequestDetails);


router.get('/:id/google-maps', requestController.getRequestGoogleMaps);


router.get('/:id', requestController.getRequestDetails);


router.post('/verify-qr', requireRole('hospital', 'admin', 'superadmin'), requestController.verifyQr);


router.post('/:id/accept', requireRole('donor'), requestController.acceptRequest);


router.post('/:id/cancel', requestController.cancelRequest);


router.post('/:id/confirm', requireRole('hospital', 'admin', 'superadmin'), requestController.confirmRequest);


router.post('/:id/reject', requireRole('hospital', 'admin', 'superadmin'), requestController.rejectRequest);


export default router;

// ─── API CONTRACT ────────────────────────────────────────────────────────────
// IMPORTANT: Static paths MUST be registered BEFORE parameterized paths.
// See top of file for full ordering constraints.
// ─────────────────────────────────────────────────────────────────────────────