import { Router } from 'express';
import authMiddleware from '../middlewares/auth.middleware.js';
import requireRole from '../middlewares/role.middleware.js';
import * as helpController from '../controllers/help.controller.js';

// ─── API CONTRACT ────────────────────────────────────────────────────────────
// Swagger/OpenAPI documentation for this router lives in /openapi.yaml
// Update openapi.yaml whenever you add, change, or remove an endpoint here.
// Do NOT add inline @openapi JSDoc to this file.
// ─────────────────────────────────────────────────────────────────────────────


const router = Router();

router.post('/contact', authMiddleware, helpController.contactSupport);
router.get('/my-tickets', authMiddleware, requireRole('donor'), helpController.getMyTickets);
router.get('/my-tickets/:id', authMiddleware, requireRole('donor'), helpController.getMyTicketById);

export default router;
