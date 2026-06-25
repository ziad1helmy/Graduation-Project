import { Router } from 'express';
import authMiddleware from '../middlewares/auth.middleware.js';
import requireRole from '../middlewares/role.middleware.js';
import * as adminController from '../controllers/admin.controller.js';
import * as hospitalController from '../controllers/hospital.controller.js';
import * as analyticsController from '../controllers/analytics.controller.js';

// ─── API CONTRACT ────────────────────────────────────────────────────────────
// Swagger/OpenAPI documentation for this router lives in /openapi.yaml
// Update openapi.yaml whenever you add, change, or remove an endpoint here.
// Do NOT add inline @openapi JSDoc to this file.
// ─────────────────────────────────────────────────────────────────────────────


const router = Router();

// All admin routes require authentication + admin or superadmin role
router.use(authMiddleware, requireRole('admin', 'superadmin'));

// ──────────────────────────────────────────────
//  Profile
// ──────────────────────────────────────────────


router.get('/profile', adminController.getAdminProfile);
router.patch('/profile', adminController.updateAdminProfile);

// ──────────────────────────────────────────────
//  System Management
// ──────────────────────────────────────────────


router.get('/system/health', adminController.getSystemHealth);


router.post('/system/maintenance', adminController.setMaintenanceMode);


router.get('/system/maintenance', adminController.getMaintenanceStatus);
router.get('/system-settings', adminController.getSystemSettings);
router.put('/system-settings', adminController.updateSystemSettings);


router.get('/dashboard', adminController.getDashboard);

router.get('/analytics/top-donors', analyticsController.getTopDonors);

router.get('/alerts', adminController.getAlerts);


// ──────────────────────────────────────────────
//  Rewards Management (Overview, Config, Adjust)
// ──────────────────────────────────────────────


router.get('/rewards', adminController.getAdminRewards);

router.post('/rewards', adminController.createReward);

router.patch('/rewards/:rewardId/status', adminController.updateRewardStatus);

router.patch('/rewards/bulk-points', adminController.bulkUpdateRewardPoints);

router.post('/rewards/users/:userId/points/adjust', adminController.adjustUserPoints);

// Badges Management
router.get('/badges', adminController.getBadges);
router.patch('/badges/:id', adminController.updateBadge);

// ──────────────────────────────────────────────
//  Audit Logs
// ──────────────────────────────────────────────


router.get('/audit-logs', adminController.getAuditLogs);

// Inbound email management

router.get('/inbound-emails', adminController.listInboundEmails);

router.get('/inbound-emails/:id', adminController.getInboundEmailById);

router.patch('/inbound-emails/:id/read', adminController.markInboundEmailRead);

router.patch('/inbound-emails/:id/archive', adminController.archiveInboundEmail);

router.delete('/inbound-emails/:id', adminController.deleteInboundEmail);

// Support inbox management

router.get('/support', adminController.listSupportMessages);

router.get('/support/:id', adminController.getSupportMessageById);

router.patch('/support/:id/review', adminController.reviewSupportMessage);

router.post('/support/:id/reply', adminController.replySupportMessage);
// Dedicated donor/hospital listing aliases

router.get('/donors', adminController.listDonors);

router.get('/hospitals', adminController.listHospitals);
// Dedicated donor/hospital detail routes

router.get('/donors/:id', adminController.getUserById);

router.get('/hospitals/:id', adminController.getUserById);

router.get('/admins', requireRole('superadmin'), adminController.getAllAdmins);

router.get('/admins/:id', requireRole('superadmin'), adminController.getAdminById);

router.post('/admins/:id/rotate-key', requireRole('superadmin'), adminController.rotateAdminKey);

// User management (ban/unban works for donors, hospitals, and admins — superadmin only for admins)

router.post('/users/:id/ban', adminController.banUser);

router.post('/users/:id/unban', adminController.unbanUser);

// Hospital management

// Admin management (superadmin only)

router.post('/admins', requireRole('superadmin'), adminController.createAdmin);

router.delete('/admins/:id', requireRole('superadmin'), adminController.deleteAdmin);

// Role permissions (superadmin for mutations) — deactivated
// router.get('/permissions/roles', adminController.listRolePermissions);
// router.get('/permissions/roles/:role', adminController.getRolePermissionDetails);
// router.post('/permissions/roles', requireRole('superadmin'), adminController.createRolePermission);
// router.put('/permissions/roles/:role', requireRole('superadmin'), adminController.updateRolePermissions);
// router.delete('/permissions/roles/:role', requireRole('superadmin'), adminController.deleteRolePermission);

// ──────────────────────────────────────────────
//  User Management
// ──────────────────────────────────────────────


router.get('/users', adminController.listUsers);


router.post('/users/hospital', adminController.createHospital);


router.get('/users/:id', adminController.getUserById);

router.put('/users/donor/:id', adminController.updateDonor);
router.put('/users/hospital/:id', adminController.updateHospital);
router.put('/users/admin/:id', requireRole('superadmin'), adminController.updateAdmin);

router.delete('/users/:id', adminController.deleteUser);

// ──────────────────────────────────────────────
//  Request Management
// ──────────────────────────────────────────────


router.get('/requests', adminController.listRequests);


router.get('/requests/:id', adminController.getRequestDetails);


router.get('/requests/:id/donations', adminController.getRequestDonations);


router.post('/requests/:id/fulfill', adminController.fulfillRequest);


router.patch('/requests/:id/cancel', adminController.cancelRequest);


router.patch('/requests/:id/broadcast', adminController.broadcastRequest);

// ──────────────────────────────────────────────
//  Emergency
// ──────────────────────────────────────────────


router.get('/emergency/critical', adminController.getCriticalRequests);


router.get('/emergency/shortage-alerts', adminController.getShortageAlerts);

export default router;
