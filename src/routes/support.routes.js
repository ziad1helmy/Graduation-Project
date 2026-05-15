import { Router } from 'express';
import authMiddleware from '../middlewares/auth.middleware.js';
import * as helpController from '../controllers/help.controller.js';

// ─── API CONTRACT ────────────────────────────────────────────────────────────
// Swagger/OpenAPI documentation for this router lives in /openapi.yaml
// Update openapi.yaml whenever you add, change, or remove an endpoint here.
// Do NOT add inline @openapi JSDoc to this file.
// ─────────────────────────────────────────────────────────────────────────────


const router = Router();

router.post('/contact', authMiddleware, helpController.contactSupport);

export default router;
