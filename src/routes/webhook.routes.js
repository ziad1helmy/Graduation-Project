import { Router } from 'express';
import { handleResendWebhook } from '../controllers/webhook.controller.js';

// ─── API CONTRACT ────────────────────────────────────────────────────────────
// Swagger/OpenAPI documentation for this router lives in /openapi.yaml
// Update openapi.yaml whenever you add, change, or remove an endpoint here.
// Do NOT add inline @openapi JSDoc to this file.
// ─────────────────────────────────────────────────────────────────────────────
const router = Router();

router.post('/resend', handleResendWebhook);

export default router;