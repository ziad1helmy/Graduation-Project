import { Router } from 'express';
import authMiddleware from '../middlewares/auth.middleware.js';
import requireRole from '../middlewares/role.middleware.js';
import * as donorController from '../controllers/donor.controller.js';
import * as rewardController from '../controllers/reward.controller.js';
import * as notificationController from '../controllers/notification.controller.js';

// ─── API CONTRACT ────────────────────────────────────────────────────────────
// Swagger/OpenAPI documentation for this router lives in /openapi.yaml
// Update openapi.yaml whenever you add, change, or remove an endpoint here.
// Do NOT add inline @openapi JSDoc to this file.
// ─────────────────────────────────────────────────────────────────────────────


const router = Router();

// Apply auth and role middleware to all donor routes
router.use(authMiddleware, requireRole('donor'));

// Profile routes
router.get('/profile', donorController.getProfile);
router.put('/profile', donorController.updateProfile);
router.get('/stats', donorController.getDonorStats);
router.get('/rewards', donorController.getDonorRewards);

// Donor settings
router.get('/settings', donorController.getSettings);
router.put('/settings', donorController.updateSettings);

// Request and matching routes
router.get('/requests', donorController.getRequests);
router.get('/matches', donorController.getMatches);

// Donation response route
router.post('/respond/:requestId', donorController.respondToRequest);

// Donation eligibility (alias to internal eligibility logic)
router.get('/donation-eligibility', donorController.getDonationEligibility);

// Lightweight donor health history (removed)

// Donor dashboard and activity (Medium)
router.get('/dashboard', donorController.getDashboard);
router.get('/recent-activity', donorController.getRecentActivity);

// Urgent requests feed
router.get('/urgent-requests', donorController.getUrgentRequests);
router.get('/urgent-requests/:requestId', donorController.getUrgentRequestDetails);
router.post('/urgent-requests/:requestId/decline', donorController.declineUrgentRequest);

// Donation history
router.get('/history', donorController.getDonationHistory);
router.get('/donations', donorController.getDonationHistory);
router.get('/points', rewardController.getPoints);
router.get('/badges', rewardController.getBadges);
router.get('/redemptions', rewardController.getRedemptions);
router.get('/notifications', notificationController.getNotifications);

// Availability management
router.put('/availability', donorController.updateAvailability);

export default router;
