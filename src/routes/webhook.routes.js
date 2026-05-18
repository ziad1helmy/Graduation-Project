import express from 'express';
import { Router } from 'express';
import { handleResendWebhook } from '../controllers/webhook.controller.js';

// ─── API CONTRACT ────────────────────────────────────────────────────────────
// Swagger/OpenAPI documentation for this router lives in /openapi.yaml
// Update openapi.yaml whenever you add, change, or remove an endpoint here.
// Do NOT add inline @openapi JSDoc to this file.
// ─────────────────────────────────────────────────────────────────────────────
const router = Router();

// Use raw body parser for webhook route so signatures can be verified
router.post('/resend', express.raw({ type: 'application/json' }), handleResendWebhook);

export default router;