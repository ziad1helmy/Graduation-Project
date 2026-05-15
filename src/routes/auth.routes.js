import { Router } from 'express';
import AUC from '../controllers/auth.controller.js';
import authMiddleware from '../middlewares/auth.middleware.js';

// ─── API CONTRACT ────────────────────────────────────────────────────────────
// Swagger/OpenAPI documentation for this router lives in /openapi.yaml
// Update openapi.yaml whenever you add, change, or remove an endpoint here.
// Do NOT add inline @openapi JSDoc to this file.
// ─────────────────────────────────────────────────────────────────────────────


const router = Router();

router.post('/reset-password', AUC.resetPassword);
router.post('/change-password', authMiddleware, AUC.changePassword);
router.post('/signup', AUC.register);
router.post('/login', AUC.loginUser);
router.post('/hospital/login', AUC.loginHospital);
router.post('/admin/login', AUC.loginAdmin);
router.post('/logout', AUC.logout);
router.post('/refresh-token', AUC.refreshToken);
router.post('/forgot-password', AUC.forgotPassword);

import { strict2FALimiter } from '../middlewares/rateLimit.middleware.js';

router.post('/verify-otp', AUC.verifyOtp);
router.post('/2fa/setup', authMiddleware, AUC.setup2FA);
router.post('/2fa/confirm-setup', authMiddleware, AUC.confirm2FASetup);
router.post('/2fa/verify', strict2FALimiter, AUC.verify2FA);
router.post('/2fa/disable', authMiddleware, AUC.disable2FA);

router.get('/me', authMiddleware, AUC.getMe);
router.post('/validate-token', authMiddleware, AUC.validateToken);
router.post('/verify-email', AUC.verifyEmail);
router.post('/verify-email-otp', AUC.verifyEmailOtp);
router.post('/fcm-token', authMiddleware, AUC.registerFcmToken);
router.put('/fcm-token', authMiddleware, AUC.replaceFcmToken);
router.delete('/fcm-token', authMiddleware, AUC.removeFcmToken);

export default router;

// ─── API CONTRACT ────────────────────────────────────────────────────────────
// Swagger/OpenAPI documentation for this router lives in /openapi.yaml
// Update openapi.yaml whenever you add, change, or remove an endpoint here.
// Do NOT add inline @openapi JSDoc to this file.
// ─────────────────────────────────────────────────────────────────────────────
