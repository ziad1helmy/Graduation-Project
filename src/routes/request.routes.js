import { Router } from 'express';
import authMiddleware from '../middlewares/auth.middleware.js';
import requireRole from '../middlewares/role.middleware.js';
import * as requestController from '../controllers/request.controller.js';

const router = Router();

router.use(authMiddleware);

/**
 * @openapi
 * /requests/nearby:
 *   get:
 *     tags:
 *       - Requests
 *     summary: Get nearby urgent requests within an optional radius
 *     security:
 *       - bearerAuth: []
 */
router.get('/nearby', requireRole('donor', 'hospital', 'admin', 'superadmin'), requestController.getNearbyRequests);

/**
 * @openapi
 * /requests/{id}/google-maps:
 *   get:
 *     tags:
 *       - Requests
 *     summary: Get Google Maps navigation URL for a request
 *     security:
 *       - bearerAuth: []
 */
router.get('/:id/google-maps', requestController.getRequestGoogleMaps);

/**
 * @openapi
 * /requests/{id}:
 *   get:
 *     tags:
 *       - Requests
 *     summary: Get full request details for Flutter
 *     security:
 *       - bearerAuth: []
 */
router.get('/:id', requestController.getRequestDetails);

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
router.post('/:id/generate-qr', requireRole('hospital', 'admin', 'superadmin'), requestController.generateQr);

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
router.post('/verify-qr', requireRole('hospital', 'admin', 'superadmin'), requestController.verifyQr);

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
router.post('/:id/accept', requireRole('donor'), requestController.acceptRequest);

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
router.post('/:id/cancel', requestController.cancelRequest);

export default router;