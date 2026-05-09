import { Router } from 'express';
import authMiddleware from '../middlewares/auth.middleware.js';
import * as requestController from '../controllers/request.controller.js';

const router = Router();

/**
 * @openapi
 * /requests/{id}/generate-qr:
 *   post:
 *     tags:
 *       - Requests
 *     summary: Generate a secure QR token for a request
 *     security:
 *       - bearerAuth: []
 */
router.post('/:id/generate-qr', authMiddleware, requestController.generateQr);

/**
 * @openapi
 * /requests/verify-qr:
 *   post:
 *     tags:
 *       - Requests
 *     summary: Verify a request QR token
 *     security:
 *       - bearerAuth: []
 */
router.post('/verify-qr', authMiddleware, requestController.verifyQr);

/**
 * @openapi
 * /requests/{id}/accept:
 *   post:
 *     tags:
 *       - Requests
 *     summary: Accept a request as a donor
 *     security:
 *       - bearerAuth: []
 */
router.post('/:id/accept', authMiddleware, requestController.acceptRequest);

/**
 * @openapi
 * /requests/{id}/cancel:
 *   post:
 *     tags:
 *       - Requests
 *     summary: Cancel a request or your acceptance of it
 *     security:
 *       - bearerAuth: []
 */
router.post('/:id/cancel', authMiddleware, requestController.cancelRequest);

export default router;