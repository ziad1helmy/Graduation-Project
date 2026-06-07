import { Router } from 'express';
import authMiddleware from '../middlewares/auth.middleware.js';
import requireRole from '../middlewares/role.middleware.js';
import * as adminController from '../controllers/admin.controller.js';
import * as hospitalController from '../controllers/hospital.controller.js';

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


router.get('/statistics', adminController.getStatistics);
router.get('/dashboard', adminController.getDashboard);

router.get('/alerts', adminController.getAlerts);

router.get('/blood-inventory-summary', adminController.getBloodInventorySummary);


router.get('/rewards/config', adminController.getRewardsConfig);


router.put('/rewards/config', adminController.updateRewardsConfig);

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

// Donor management

router.put('/donors/:id', adminController.updateDonor);

router.post('/donors/:id/ban', adminController.banDonor);

router.post('/donors/:id/unban', adminController.unbanDonor);

// Hospital management

router.put('/hospitals/:id/status', adminController.updateHospitalStatus);

// Admin management (superadmin only)

router.post('/admins', requireRole('superadmin'), adminController.createAdmin);

router.put('/admins/:id', requireRole('superadmin'), adminController.updateAdmin);

router.delete('/admins/:id', requireRole('superadmin'), adminController.deleteAdmin);

// Role permissions (superadmin for mutations)

router.get('/permissions/roles', adminController.listRolePermissions);

router.get('/permissions/roles/:role', adminController.getRolePermissionDetails);

router.post('/permissions/roles', requireRole('superadmin'), adminController.createRolePermission);

router.put('/permissions/roles/:role', requireRole('superadmin'), adminController.updateRolePermissions);

router.delete('/permissions/roles/:role', requireRole('superadmin'), adminController.deleteRolePermission);

// ──────────────────────────────────────────────
//  User Management
// ──────────────────────────────────────────────


router.get('/users', adminController.listUsers);


router.get('/users/stats', adminController.getUserStats);


router.post('/users/hospital', adminController.createHospital);


router.get('/users/:id', adminController.getUserById);


router.patch('/users/:id/verify', adminController.verifyUser);


router.patch('/users/:id/unverify', adminController.unverifyUser);


// Note: service layer enforces that admins/superadmins cannot be
// suspended by regular admins. See admin.service.js suspendUser().
router.patch('/users/:id/suspend', adminController.suspendUser);


router.patch('/users/:id/unsuspend', adminController.unsuspendUser);


router.delete('/users/:id', adminController.deleteUser);

// ──────────────────────────────────────────────
//  Request Management
// ──────────────────────────────────────────────


router.get('/requests', adminController.listRequests);


router.get('/requests/stats', adminController.getRequestStats);


router.get('/requests/:id', adminController.getRequestDetails);


router.get('/requests/:id/donations', adminController.getRequestDonations);


router.patch('/requests/:id/fulfill', adminController.fulfillRequest);


router.patch('/requests/:id/cancel', adminController.cancelRequest);


router.post('/requests/:id/broadcast', adminController.broadcastRequest);

// ──────────────────────────────────────────────
//  Analytics
// ──────────────────────────────────────────────



router.get('/analytics/donations', adminController.getDonationTrends);


router.get('/analytics/blood-types', adminController.getBloodTypeDistribution);


router.get('/analytics/top-donors', adminController.getTopDonors);


router.get('/analytics/growth', adminController.getGrowthMetrics);

// ──────────────────────────────────────────────
//  Emergency
// ──────────────────────────────────────────────


router.post('/emergency/broadcast', adminController.sendEmergencyBroadcast);


router.get('/emergency/critical', adminController.getCriticalRequests);


router.get('/emergency/shortage-alerts', adminController.getShortageAlerts);

export default router;
