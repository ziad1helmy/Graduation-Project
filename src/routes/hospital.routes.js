import { Router } from 'express';
import authMiddleware from '../middlewares/auth.middleware.js';
import requireRole from '../middlewares/role.middleware.js';
import * as hospitalController from '../controllers/hospital.controller.js';

const router = Router();

// Apply auth and role middleware to all hospital routes
router.use(authMiddleware, requireRole('hospital'));

// Profile routes
router.get('/profile', hospitalController.getProfile);
router.put('/profile', hospitalController.updateProfile);

// Request management routes
router.post('/request', hospitalController.createRequest);
// Backwards-compatible alias for emergency shortcut
router.post('/requests/create-emergency', hospitalController.createRequest);
// Hospital dashboard
router.get('/dashboard', hospitalController.getMonthlyReports);
// Close request (dedicated flow)
router.post('/requests/:requestId/close', hospitalController.closeRequest);
router.get('/requests', hospitalController.getRequests);
router.get('/requests/:requestId', hospitalController.getRequestDetails);
router.put('/requests/:requestId', hospitalController.updateRequest);
router.delete('/requests/:requestId', hospitalController.deleteRequest);

// Donation tracking
router.get('/donations', hospitalController.getDonations);

// Extended compatibility features
router.get('/blood-bank-settings', hospitalController.getBloodBankSettings);
router.put('/blood-bank-settings', hospitalController.updateBloodBankSettings);
router.get('/blood-inventory', hospitalController.getBloodInventory);
router.get('/notification-preferences', hospitalController.getNotificationPreferences);
router.put('/notification-preferences', hospitalController.updateNotificationPreferences);
router.get('/reports/monthly', hospitalController.getMonthlyReports);

// Appointment slot configuration
router.get('/appointment-settings', hospitalController.getAppointmentSettings);
router.put('/appointment-settings', hospitalController.updateAppointmentSettings);

export default router;
