import { Router } from 'express';
import authMiddleware from '../middlewares/auth.middleware.js';
import requireRole from '../middlewares/role.middleware.js';
import * as hospitalController from '../controllers/hospital.controller.js';
import * as notificationController from '../controllers/notification.controller.js';

// ─── API CONTRACT ────────────────────────────────────────────────────────────
// Swagger/OpenAPI documentation for this router lives in /openapi.yaml
// Update openapi.yaml whenever you add, change, or remove an endpoint here.
// Do NOT add inline @openapi JSDoc to this file.
// ─────────────────────────────────────────────────────────────────────────────


const router = Router();

router.get(
  '/find-donors',
  authMiddleware,
  requireRole('hospital', 'admin', 'superadmin'),
  hospitalController.findDonors
);

// Apply auth and role middleware to all hospital routes
router.use(authMiddleware, requireRole('hospital'));

router.post('/donors/:donorId/appointments', hospitalController.bookDonorAppointment);
// Hospital appointments listing
router.get('/appointments', hospitalController.getAppointments);
// Get single appointment details (hospital-only)
router.get('/appointments/:appointmentId', hospitalController.getAppointmentDetails);

// Profile routes
router.get('/profile', hospitalController.getProfile);
router.put('/profile', hospitalController.updateProfile);
router.put('/profile/working-hours', hospitalController.updateWorkingHours);
router.put('/profile/notifications', hospitalController.updateNotificationPreferences);
router.put('/profile/password', hospitalController.changePassword);
router.put('/profile/location', hospitalController.updateProfileLocation);

// Request management routes
router.post('/request', hospitalController.createRequest);
// Backwards-compatible alias for emergency shortcut
router.post('/requests/create-emergency', hospitalController.createEmergencyRequest);
// Hospital dashboard
router.get('/dashboard', hospitalController.getMonthlyReports);
router.get('/activity', hospitalController.getActivity);
router.get('/history', hospitalController.getRequestHistory);
router.get('/requests', hospitalController.getRequests);
router.get('/requests/:requestId/responses', hospitalController.getRequestResponses);
router.get('/requests/:requestId', hospitalController.getRequestDetails);
router.put('/requests/:requestId', hospitalController.updateRequest);
router.delete('/requests/:requestId', hospitalController.deleteRequest);
router.post('/confirm-donation', hospitalController.confirmDonation);

// Donation tracking
router.get('/donations', hospitalController.getDonations);

// Hospital notifications
router.get('/notifications', notificationController.getNotifications);
router.delete('/notifications', notificationController.deleteAllNotifications);
router.patch('/notifications/read-all', notificationController.markAllNotificationsRead);
router.patch('/notifications/:id/read', notificationController.markNotificationRead);
// Allow PUT as an alias for clients that use PUT to mark read
router.put('/notifications/:id/read', notificationController.markNotificationRead);
router.get('/notifications/:id', notificationController.getNotificationById);
router.delete('/notifications/:id', notificationController.deleteNotificationById);


router.get('/reports/monthly', hospitalController.getMonthlyReports);

export default router;

// ─── API CONTRACT ────────────────────────────────────────────────────────────
// Swagger/OpenAPI documentation for this router lives in /openapi.yaml
// Update openapi.yaml whenever you add, change, or remove an endpoint here.
// Do NOT add inline @openapi JSDoc to this file.
// ─────────────────────────────────────────────────────────────────────────────
