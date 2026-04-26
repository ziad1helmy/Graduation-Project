import { Router } from 'express';
import authMiddleware from '../middlewares/auth.middleware.js';
import * as notificationController from '../controllers/notification.controller.js';

const router = Router();

/**
 * @swagger
 * tags:
 *   - name: Notifications
 *     description: Authenticated user notifications
 */

/**
 * @swagger
 * /notifications:
 *   get:
 *     summary: List notifications for authenticated user
 *     tags: [Notifications]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *       - in: query
 *         name: read
 *         schema: { type: boolean }
 *       - in: query
 *         name: type
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Notifications list
 */
router.get('/', authMiddleware, notificationController.getNotifications);

/**
 * @swagger
 * /notifications/{id}/read:
 *   patch:
 *     summary: Mark one notification as read
 *     tags: [Notifications]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Notification marked as read
 */
router.patch('/:id/read', authMiddleware, notificationController.markNotificationRead);

/**
 * @swagger
 * /notifications/read-all:
 *   patch:
 *     summary: Mark all notifications as read
 *     tags: [Notifications]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: All notifications marked as read
 */
router.patch('/read-all', authMiddleware, notificationController.markAllNotificationsRead);

/**
 * @swagger
 * /notifications/{id}:
 *   delete:
 *     summary: Delete one notification
 *     tags: [Notifications]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Notification deleted
 */
router.delete('/:id', authMiddleware, notificationController.deleteNotificationById);

export default router;
