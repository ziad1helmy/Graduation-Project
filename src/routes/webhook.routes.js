import { Router } from 'express';
import { handleResendWebhook } from '../controllers/webhook.controller.js';

const router = Router();

router.post('/resend', handleResendWebhook);

export default router;