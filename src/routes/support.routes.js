import { Router } from 'express';
import authMiddleware from '../middlewares/auth.middleware.js';
import * as helpController from '../controllers/help.controller.js';

const router = Router();

/**
 * @swagger
 * tags:
 *   - name: Support
 *     description: Support contact endpoint
 */

/**
 * @swagger
 * /support/contact:
 *   post:
 *     summary: Submit a support request
 *     tags: [Support]
 *     security: [{ bearerAuth: [] }]
 *     description: Authenticated submissions are linked to the current user id, email, and role for traceability.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [subject, message]
 *     responses:
 *       201:
 *         description: Support request submitted successfully
 */
router.post('/contact', authMiddleware, helpController.contactSupport);

export default router;
