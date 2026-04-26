import { Router } from 'express';
import authMiddleware from '../middlewares/auth.middleware.js';
import requireRole from '../middlewares/role.middleware.js';
import * as adminController from '../controllers/admin.controller.js';

const router = Router();

// All admin routes require authentication + admin or superadmin role
router.use(authMiddleware, requireRole('admin', 'superadmin'));

// ──────────────────────────────────────────────
//  Profile
// ──────────────────────────────────────────────

/**
 * @swagger
 * /admin/profile:
 *   get:
 *     summary: Get admin profile
 *     tags: [Admin]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: Admin profile
 */
router.get('/profile', adminController.getProfile);

// ──────────────────────────────────────────────
//  System Management
// ──────────────────────────────────────────────

/**
 * @swagger
 * /admin/system/health:
 *   get:
 *     summary: System health check
 *     tags: [Admin - System]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: System health status
 */
router.get('/system/health', adminController.getSystemHealth);

/**
 * @swagger
 * /admin/system/maintenance:
 *   post:
 *     summary: Toggle maintenance mode
 *     tags: [Admin - System]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [enabled]
 *             properties:
 *               enabled:
 *                 type: boolean
 *               message:
 *                 type: string
 *     responses:
 *       200:
 *         description: Maintenance mode updated
 */
router.post('/system/maintenance', adminController.setMaintenanceMode);

/**
 * @swagger
 * /admin/system/maintenance:
 *   get:
 *     summary: Get maintenance mode status
 *     tags: [Admin - System]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: Maintenance status
 */
router.get('/system/maintenance', adminController.getMaintenanceStatus);

// ──────────────────────────────────────────────
//  Audit Logs
// ──────────────────────────────────────────────

/**
 * @swagger
 * /admin/audit-logs:
 *   get:
 *     summary: List audit logs
 *     tags: [Admin - Audit]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: action
 *         schema:
 *           type: string
 *       - in: query
 *         name: targetType
 *         schema:
 *           type: string
 *           enum: [User, Request, Donation, System]
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Audit logs list
 */
router.get('/audit-logs', adminController.getAuditLogs);

// ──────────────────────────────────────────────
//  User Management
// ──────────────────────────────────────────────

/**
 * @swagger
 * /admin/users:
 *   get:
 *     summary: List all users with filters and pagination
 *     tags: [Admin - Users]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: role
 *         schema:
 *           type: string
 *           enum: [donor, hospital, admin, superadmin]
 *       - in: query
 *         name: verified
 *         schema:
 *           type: string
 *           enum: ['true', 'false']
 *       - in: query
 *         name: suspended
 *         schema:
 *           type: string
 *           enum: ['true', 'false']
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Users list
 */
router.get('/users', adminController.listUsers);

/**
 * @swagger
 * /admin/users/stats:
 *   get:
 *     summary: Get user statistics
 *     tags: [Admin - Users]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: User statistics
 */
router.get('/users/stats', adminController.getUserStats);

/**
 * @swagger
 * /admin/users/hospital:
 *   post:
 *     summary: Create a new hospital (admin-created, pre-verified)
 *     tags: [Admin - Users]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [fullName, email, password, hospitalName, hospitalId, licenseNumber]
 *             properties:
 *               fullName:
 *                 type: string
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *               hospitalName:
 *                 type: string
 *               hospitalId:
 *                 type: number
 *               licenseNumber:
 *                 type: string
 *               address:
 *                 type: object
 *                 properties:
 *                   city:
 *                     type: string
 *                   governorate:
 *                     type: string
 *               contactNumber:
 *                 type: string
 *     responses:
 *       201:
 *         description: Hospital created
 *       409:
 *         description: Email already registered
 */
router.post('/users/hospital', adminController.createHospital);

/**
 * @swagger
 * /admin/users/{id}:
 *   get:
 *     summary: Get user details by ID
 *     tags: [Admin - Users]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: User details
 *       404:
 *         description: User not found
 */
router.get('/users/:id', adminController.getUserById);

/**
 * @swagger
 * /admin/users/{id}/verify:
 *   patch:
 *     summary: Verify a user's email
 *     tags: [Admin - Users]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: User verified
 */
router.patch('/users/:id/verify', adminController.verifyUser);

/**
 * @swagger
 * /admin/users/{id}/unverify:
 *   patch:
 *     summary: Unverify a user's email
 *     tags: [Admin - Users]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: User unverified
 */
router.patch('/users/:id/unverify', adminController.unverifyUser);

/**
 * @swagger
 * /admin/users/{id}/suspend:
 *   patch:
 *     summary: Suspend a user account
 *     tags: [Admin - Users]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [reason]
 *             properties:
 *               reason:
 *                 type: string
 *     responses:
 *       200:
 *         description: User suspended
 *       403:
 *         description: Cannot suspend admin accounts
 */
router.patch('/users/:id/suspend', adminController.suspendUser);

/**
 * @swagger
 * /admin/users/{id}/unsuspend:
 *   patch:
 *     summary: Unsuspend a user account
 *     tags: [Admin - Users]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: User unsuspended
 */
router.patch('/users/:id/unsuspend', adminController.unsuspendUser);

/**
 * @swagger
 * /admin/users/{id}:
 *   delete:
 *     summary: Soft-delete a user account
 *     tags: [Admin - Users]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: User deleted
 *       403:
 *         description: Cannot delete admin accounts
 */
router.delete('/users/:id', adminController.deleteUser);

// ──────────────────────────────────────────────
//  Request Management
// ──────────────────────────────────────────────

/**
 * @swagger
 * /admin/requests:
 *   get:
 *     summary: List all blood/organ requests
 *     tags: [Admin - Requests]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, in-progress, completed, cancelled]
 *       - in: query
 *         name: urgency
 *         schema:
 *           type: string
 *           enum: [low, medium, high, critical]
 *       - in: query
 *         name: bloodType
 *         schema:
 *           type: string
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [blood, organ]
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Requests list
 */
router.get('/requests', adminController.listRequests);

/**
 * @swagger
 * /admin/requests/stats:
 *   get:
 *     summary: Get request statistics
 *     tags: [Admin - Requests]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: Request statistics
 */
router.get('/requests/stats', adminController.getRequestStats);

/**
 * @swagger
 * /admin/requests/{id}:
 *   get:
 *     summary: Get full request details with donations
 *     tags: [Admin - Requests]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Request details
 */
router.get('/requests/:id', adminController.getRequestDetails);

/**
 * @swagger
 * /admin/requests/{id}/donations:
 *   get:
 *     summary: Get donations for a specific request
 *     tags: [Admin - Requests]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Request donations
 */
router.get('/requests/:id/donations', adminController.getRequestDonations);

/**
 * @swagger
 * /admin/requests/{id}/fulfill:
 *   patch:
 *     summary: Mark a request as fulfilled
 *     tags: [Admin - Requests]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Request fulfilled
 */
router.patch('/requests/:id/fulfill', adminController.fulfillRequest);

/**
 * @swagger
 * /admin/requests/{id}/cancel:
 *   patch:
 *     summary: Cancel a request
 *     tags: [Admin - Requests]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [reason]
 *             properties:
 *               reason:
 *                 type: string
 *     responses:
 *       200:
 *         description: Request cancelled
 */
router.patch('/requests/:id/cancel', adminController.cancelRequest);

/**
 * @swagger
 * /admin/requests/{id}/broadcast:
 *   post:
 *     summary: Broadcast request to eligible donors
 *     tags: [Admin - Requests]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Broadcast sent
 */
router.post('/requests/:id/broadcast', adminController.broadcastRequest);

// ──────────────────────────────────────────────
//  Analytics
// ──────────────────────────────────────────────

/**
 * @swagger
 * /admin/analytics/dashboard:
 *   get:
 *     summary: Dashboard summary with key metrics
 *     tags: [Admin - Analytics]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: Dashboard summary
 */
router.get('/analytics/dashboard', adminController.getDashboard);

/**
 * @swagger
 * /admin/analytics/donations:
 *   get:
 *     summary: Monthly donation trends
 *     tags: [Admin - Analytics]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: months
 *         schema:
 *           type: integer
 *           default: 6
 *     responses:
 *       200:
 *         description: Donation trends
 */
router.get('/analytics/donations', adminController.getDonationTrends);

/**
 * @swagger
 * /admin/analytics/blood-types:
 *   get:
 *     summary: Blood type distribution
 *     tags: [Admin - Analytics]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: Blood type distribution
 */
router.get('/analytics/blood-types', adminController.getBloodTypeDistribution);

/**
 * @swagger
 * /admin/analytics/top-donors:
 *   get:
 *     summary: Top donors leaderboard
 *     tags: [Admin - Analytics]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *     responses:
 *       200:
 *         description: Top donors
 */
router.get('/analytics/top-donors', adminController.getTopDonors);

/**
 * @swagger
 * /admin/analytics/growth:
 *   get:
 *     summary: Growth metrics over time
 *     tags: [Admin - Analytics]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: months
 *         schema:
 *           type: integer
 *           default: 6
 *     responses:
 *       200:
 *         description: Growth metrics
 */
router.get('/analytics/growth', adminController.getGrowthMetrics);

// ──────────────────────────────────────────────
//  Emergency
// ──────────────────────────────────────────────

/**
 * @swagger
 * /admin/emergency/broadcast:
 *   post:
 *     summary: Send emergency broadcast to donors
 *     tags: [Admin - Emergency]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [title, message]
 *             properties:
 *               title:
 *                 type: string
 *               message:
 *                 type: string
 *               governorate:
 *                 type: string
 *               city:
 *                 type: string
 *               bloodTypes:
 *                 type: array
 *                 items:
 *                   type: string
 *                   enum: [A+, A-, B+, B-, AB+, AB-, O+, O-]
 *     responses:
 *       200:
 *         description: Emergency broadcast sent
 */
router.post('/emergency/broadcast', adminController.sendEmergencyBroadcast);

/**
 * @swagger
 * /admin/emergency/critical:
 *   get:
 *     summary: List critical and high urgency active requests
 *     tags: [Admin - Emergency]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: Critical requests
 */
router.get('/emergency/critical', adminController.getCriticalRequests);

/**
 * @swagger
 * /admin/emergency/shortage-alerts:
 *   get:
 *     summary: Blood shortage alerts
 *     tags: [Admin - Emergency]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: Shortage alerts by blood type
 */
router.get('/emergency/shortage-alerts', adminController.getShortageAlerts);

export default router;
