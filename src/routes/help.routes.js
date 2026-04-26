import { Router } from 'express';
import * as helpController from '../controllers/help.controller.js';

const router = Router();

/**
 * @swagger
 * tags:
 *   - name: Help
 *     description: Help and document endpoints
 */

/**
 * @swagger
 * /help/faq:
 *   get:
 *     summary: Get FAQ list
 *     tags: [Help]
 *     responses:
 *       200:
 *         description: FAQ retrieved successfully
 */
router.get('/faq', helpController.getFaq);

/**
 * @swagger
 * /help/documents/{type}:
 *   get:
 *     summary: Get help document by type
 *     tags: [Help]
 *     description: Returns a stored help document, or 404 if that document has not been configured.
 *     parameters:
 *       - in: path
 *         name: type
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Document retrieved successfully
 */
router.get('/documents/:type', helpController.getDocument);

export default router;
