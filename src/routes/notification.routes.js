import { Router } from 'express';
import authMiddleware from '../middlewares/auth.middleware.js';
import * as notificationController from '../controllers/notification.controller.js';

// ─── API CONTRACT ────────────────────────────────────────────────────────────
// Swagger/OpenAPI documentation for this router lives in /openapi.yaml
// Update openapi.yaml whenever you add, change, or remove an endpoint here.
// Do NOT add inline @openapi JSDoc to this file.
// ─────────────────────────────────────────────────────────────────────────────


const router = Router();

router.get('/', authMiddleware, notificationController.getNotifications);
router.delete('/', authMiddleware, notificationController.deleteAllNotifications);

router.patch('/:id/read', authMiddleware, notificationController.markNotificationRead);

router.patch('/read-all', authMiddleware, notificationController.markAllNotificationsRead);

router.get('/:id', authMiddleware, notificationController.getNotificationById);

router.delete('/:id', authMiddleware, notificationController.deleteNotificationById);

export default router;
