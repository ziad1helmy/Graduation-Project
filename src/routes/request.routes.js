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
 *     description: |
 *       Returns urgent donation requests from nearby hospitals.
 *       Supports all request types: blood, plasma, platelets, and organ.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: lat
 *         schema: { type: number }
 *         required: false
 *       - in: query
 *         name: lng
 *         schema: { type: number }
 *         required: false
 *       - in: query
 *         name: radius
 *         schema: { type: number, default: 50 }
 *         description: Search radius in km
 *       - in: query
 *         name: type
 *         schema: { type: string, enum: [blood, plasma, platelets, organ] }
 *         description: Filter by request type
 *       - in: query
 *         name: bloodType
 *         schema: { type: string }
 *         description: Filter by blood type (for blood/plasma/platelets)
 *     responses:
 *       200:
 *         description: Nearby requests retrieved
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: Nearby urgent requests retrieved
 *               data:
 *                 requests:
 *                   - _id: 69fe540565ff7785a031314f
 *                     type: blood
 *                     bloodType: O+
 *                     hospitalName: Cairo Care Hospital
 *                     urgency: critical
 *                     quantity: 3
 *                     distance: 2.5
 *                     cause: Emergency surgery support
 *                   - _id: 69fe540565ff7785a0313150
 *                     type: plasma
 *                     bloodType: AB+
 *                     hospitalName: Cairo Care Hospital
 *                     urgency: critical
 *                     quantity: 5
 *                     distance: 2.5
 *                     cause: Trauma patient requiring urgent plasma
 *                   - _id: 69fe540565ff7785a0313154
 *                     type: platelets
 *                     bloodType: O+
 *                     hospitalName: Nile Hope Medical Center
 *                     urgency: high
 *                     quantity: 3
 *                     distance: 12.8
 *                     cause: Cancer patient undergoing chemotherapy
 *                 total: 3
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
 *     summary: Get full request details including all donation type information
 *     description: |
 *       Returns complete request details with donor responses and history.
 *       Works for blood, plasma, platelets, and organ requests.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Request details retrieved
 *         content:
 *           application/json:
 *             examples:
 *               bloodRequest:
 *                 summary: Blood request details
 *                 value:
 *                   success: true
 *                   data:
 *                     _id: 69fe540565ff7785a031314f
 *                     type: blood
 *                     bloodType: O+
 *                     urgency: critical
 *                     quantity: 3
 *                     requiredBy: "2026-05-20T00:00:00Z"
 *                     hospitalName: Cairo Care Hospital
 *                     cause: Emergency surgery support
 *                     respondents: 5
 *                     acceptedBy: 2
 *               plasmaRequest:
 *                 summary: Plasma request details
 *                 value:
 *                   success: true
 *                   data:
 *                     _id: 69fe540565ff7785a0313155
 *                     type: plasma
 *                     bloodType: AB+
 *                     urgency: critical
 *                     quantity: 5
 *                     requiredBy: "2026-05-19T00:00:00Z"
 *                     hospitalName: Cairo Care Hospital
 *                     cause: Trauma patient requiring urgent plasma transfusion
 *                     respondents: 3
 *                     acceptedBy: 1
 *               plateletRequest:
 *                 summary: Platelets request details
 *                 value:
 *                   success: true
 *                   data:
 *                     _id: 69fe540565ff7785a0313156
 *                     type: platelets
 *                     bloodType: O+
 *                     urgency: high
 *                     quantity: 3
 *                     requiredBy: "2026-05-20T00:00:00Z"
 *                     hospitalName: Nile Hope Medical Center
 *                     cause: Cancer patient undergoing chemotherapy
 *                     respondents: 2
 *                     acceptedBy: 1
 *       404:
 *         description: Request not found
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