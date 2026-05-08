import { Router } from 'express';
import authMiddleware from '../middlewares/auth.middleware.js';
import requireRole from '../middlewares/role.middleware.js';
import * as adminController from '../controllers/admin.controller.js';
import * as hospitalController from '../controllers/hospital.controller.js';

const router = Router();

/**
 * @swagger
 * tags:
 *   - name: Admin
 *     description: Admin & Superadmin operations — user management, analytics, system maintenance, audit logs, reward adjustments
 */


/**
 * @swagger
 * /admin/login:
 *   post:
 *     summary: Login for admin and superadmin accounts
 *     tags: [Admin]
 *     description: Authenticate admin or superadmin user. Returns JWT token for subsequent requests
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password, adminKey]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 description: Admin email address
 *                 example: admin@lifelink.com
 *               password:
 *                 type: string
 *                 format: password
 *                 description: Admin password
 *                 example: SecurePassword123!
 *               adminKey:
 *                 type: string
 *                 description: Admin secret key for authentication
 *                 example: admin-secret-key-2026
 *     responses:
 *       200:
 *         description: Admin login successful - returns JWT token
 *       401:
 *         description: Invalid credentials
 *       403:
 *         description: Admin key invalid or account not authorized
 */
router.post('/login', adminController.loginAdmin);

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
 *     description: Retrieve the authenticated admin's profile information
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: Admin profile
 */
router.get('/profile', adminController.getAdminProfile);

// ──────────────────────────────────────────────
//  System Management
// ──────────────────────────────────────────────

/**
 * @swagger
 * /admin/system/health:
 *   get:
 *     summary: System health check
 *     tags: [Admin]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: System health status
 */
router.get('/system/health', adminController.getSystemHealth);
router.get('/system-health', adminController.getSystemHealth);
router.get('/system-health/check', adminController.getSystemHealth);

/**
 * @swagger
 * /admin/system/maintenance:
 *   post:
 *     summary: Toggle maintenance mode
 *     tags: [Admin]
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
 *     tags: [Admin]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: Maintenance status
 */
router.get('/system/maintenance', adminController.getMaintenanceStatus);
router.post('/maintenance-mode', adminController.setMaintenanceMode);
router.get('/maintenance-mode/status', adminController.getMaintenanceStatus);

/**
 * @swagger
 * /admin/statistics:
 *   get:
 *     summary: Get admin statistics summary
 *     tags: [Admin]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: Statistics summary
 */
router.get('/statistics', adminController.getStatistics);
router.get('/dashboard', adminController.getDashboard);
/**
 * @swagger
 * /admin/alerts:
 *   get:
 *     tags:
 *       - Admin
 *     summary: Get the admin alert summary
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '200':
 *         description: Alerts summary
 */
router.get('/alerts', adminController.getAlerts);
/**
 * @swagger
 * /admin/blood-inventory-summary:
 *   get:
 *     tags:
 *       - Admin
 *     summary: Get the system blood inventory summary
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '200':
 *         description: Blood inventory summary
 */
router.get('/blood-inventory-summary', adminController.getBloodInventorySummary);

// ──────────────────────────────────────────────
//  Audit Logs
// ──────────────────────────────────────────────

/**
 * @swagger
 * /admin/audit-logs:
 *   get:
 *     summary: List audit logs
 *     tags: [Admin]
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
// Dedicated donor/hospital listing aliases
/**
 * @swagger
 * /admin/donors:
 *   get:
 *     tags:
 *       - Admin
 *     summary: List donors
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '200':
 *         description: Donor list
 */
router.get('/donors', adminController.listDonors);
/**
 * @swagger
 * /admin/hospitals:
 *   get:
 *     tags:
 *       - Admin
 *     summary: List hospitals
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '200':
 *         description: Hospital list
 */
router.get('/hospitals', adminController.listHospitals);
// Dedicated donor/hospital detail routes
/**
 * @swagger
 * /admin/donors/{id}:
 *   get:
 *     tags:
 *       - Admin
 *     summary: Get a donor by id
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       '200':
 *         description: Donor details
 */
router.get('/donors/:id', adminController.getUserById);
/**
 * @swagger
 * /admin/hospitals/{id}:
 *   get:
 *     tags:
 *       - Admin
 *     summary: Get a hospital by id
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       '200':
 *         description: Hospital details
 */
router.get('/hospitals/:id', adminController.getUserById);
/**
 * @swagger
 * /admin/admins:
 *   get:
 *     tags:
 *       - Admin
 *     summary: List admin users
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '200':
 *         description: Admin list
 */
router.get('/', requireRole('superadmin'), adminController.getAllAdmins);
router.get('/admins', requireRole('superadmin'), adminController.getAllAdmins);
/**
 * @swagger
 * /admin/admins/{id}:
 *   get:
 *     tags:
 *       - Admin
 *     summary: Get an admin by id
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       '200':
 *         description: Admin details
 */
router.get('/admins/:id', requireRole('superadmin'), adminController.getAdminById);

// Donor management
/**
 * @swagger
 * /admin/donors/{id}:
 *   put:
 *     tags:
 *       - Admin
 *     summary: Update a donor
 *     security:
 *       - bearerAuth: []
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
 *             properties:
 *               fullName:
 *                 type: string
 *               email:
 *                 type: string
 *                 format: email
 *               phoneNumber:
 *                 type: string
 *               bloodType:
 *                 type: string
 *               gender:
 *                 type: string
 *               dateOfBirth:
 *                 type: string
 *                 format: date
 *               isAvailable:
 *                 type: boolean
 *     responses:
 *       '200':
 *         description: Donor updated successfully
 *       '404':
 *         description: Donor not found
 *       '409':
 *         description: Email already registered
 */
router.put('/donors/:id', adminController.updateDonor);
/**
 * @swagger
 * /admin/donors/{id}/ban:
 *   post:
 *     tags:
 *       - Admin
 *     summary: Ban a donor
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               reason:
 *                 type: string
 *     responses:
 *       '200':
 *         description: Donor banned successfully
 *       '400':
 *         description: Donor already banned
 *       '404':
 *         description: Donor not found
 */
router.post('/donors/:id/ban', adminController.banDonor);
/**
 * @swagger
 * /admin/donors/{id}/unban:
 *   post:
 *     tags:
 *       - Admin
 *     summary: Unban a donor
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       '200':
 *         description: Donor unbanned successfully
 *       '400':
 *         description: Donor is not banned
 *       '404':
 *         description: Donor not found
 */
router.post('/donors/:id/unban', adminController.unbanDonor);

// Hospital management
/**
 * @swagger
 * /admin/hospitals/{id}/status:
 *   put:
 *     tags:
 *       - Admin
 *     summary: Update hospital suspension status
 *     security:
 *       - bearerAuth: []
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
 *             required: [action]
 *             properties:
 *               action:
 *                 type: string
 *                 enum: [suspend, unsuspend]
 *               reason:
 *                 type: string
 *     responses:
 *       '200':
 *         description: Hospital status updated successfully
 *       '400':
 *         description: Invalid action payload
 *       '404':
 *         description: Hospital not found
 */
router.put('/hospitals/:id/status', adminController.updateHospitalStatus);

// Admin management (superadmin only)
/**
 * @swagger
 * /admin/admins:
 *   post:
 *     tags:
 *       - Admin
 *     summary: Create a new admin account
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [fullName, email, password]
 *             properties:
 *               fullName:
 *                 type: string
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *               role:
 *                 type: string
 *                 enum: [admin, superadmin]
 *               location:
 *                 type: object
 *     responses:
 *       '201':
 *         description: Admin created successfully
 *       '400':
 *         description: Invalid payload
 *       '403':
 *         description: Only superadmin can create admins
 *       '409':
 *         description: Email already registered
 */
router.post('/create', requireRole('superadmin'), adminController.createAdmin);
router.post('/admins', requireRole('superadmin'), adminController.createAdmin);
/**
 * @swagger
 * /admin/admins/{id}:
 *   put:
 *     tags:
 *       - Admin
 *     summary: Update an admin account
 *     security:
 *       - bearerAuth: []
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
 *             properties:
 *               fullName:
 *                 type: string
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *               role:
 *                 type: string
 *                 enum: [admin, superadmin]
 *               isEmailVerified:
 *                 type: boolean
 *               isSuspended:
 *                 type: boolean
 *     responses:
 *       '200':
 *         description: Admin updated successfully
 *       '404':
 *         description: Admin not found
 *       '409':
 *         description: Email already registered
 */
router.put('/admins/:id', requireRole('superadmin'), adminController.updateAdmin);
/**
 * @swagger
 * /admin/admins/{id}:
 *   delete:
 *     tags:
 *       - Admin
 *     summary: Delete an admin account
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       '200':
 *         description: Admin deleted successfully
 *       '403':
 *         description: Cannot delete own account or insufficient role
 *       '404':
 *         description: Admin not found
 */
router.delete('/admins/:id', requireRole('superadmin'), adminController.deleteAdmin);

// Role permissions (superadmin for mutations)
/**
 * @swagger
 * /admin/permissions/roles:
 *   get:
 *     tags:
 *       - Admin
 *     summary: List role permissions
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '200':
 *         description: Roles retrieved successfully
 */
router.get('/permissions/roles', adminController.listRolePermissions);
/**
 * @swagger
 * /admin/permissions/roles/{role}:
 *   get:
 *     tags:
 *       - Admin
 *     summary: Get a role permission record
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: role
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       '200':
 *         description: Role retrieved successfully
 */
router.get('/permissions/roles/:role', adminController.getRolePermissionDetails);
/**
 * @swagger
 * /admin/permissions/roles:
 *   post:
 *     tags:
 *       - Admin
 *     summary: Create a role permission record
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [role, displayName]
 *             properties:
 *               role:
 *                 type: string
 *                 description: Unique role identifier
 *               displayName:
 *                 type: string
 *                 description: Human-readable role name
 *               description:
 *                 type: string
 *                 description: Role description
 *               isSystemRole:
 *                 type: boolean
 *                 description: Whether this is a system role (cannot be modified)
 *               permissions:
 *                 type: object
 *                 description: Role permissions object
 *     responses:
 *       '201':
 *         description: Role created successfully
 *       '400':
 *         description: Invalid payload - role and displayName are required
 *       '403':
 *         description: System roles cannot be created or modified
 *       '409':
 *         description: Role already exists
 */
router.post('/permissions/roles', requireRole('superadmin'), adminController.createRolePermission);
/**
 * @swagger
 * /admin/permissions/roles/{role}:
 *   put:
 *     tags:
 *       - Admin
 *     summary: Update role permissions - Only allows updating displayName, description, and permissions
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: role
 *         required: true
 *         schema:
 *           type: string
 *         description: Role identifier (cannot be changed)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               displayName:
 *                 type: string
 *                 description: Human-readable role name - CAN BE UPDATED
 *                 example: Senior Moderator
 *               description:
 *                 type: string
 *                 description: Role description - CAN BE UPDATED
 *                 example: Manages content and escalates issues
 *               permissions:
 *                 type: object
 *                 description: Role permissions object - CAN BE UPDATED
 *                 properties:
 *                   donor_management:
 *                     type: object
 *                     properties:
 *                       view: { type: boolean }
 *                       manage: { type: boolean }
 *                       ban: { type: boolean }
 *                       suspend: { type: boolean }
 *                       create: { type: boolean }
 *                       delete: { type: boolean }
 *                       export: { type: boolean }
 *                   hospital_management:
 *                     type: object
 *                     properties:
 *                       view: { type: boolean }
 *                       manage: { type: boolean }
 *                       ban: { type: boolean }
 *                       suspend: { type: boolean }
 *                       create: { type: boolean }
 *                       delete: { type: boolean }
 *                       export: { type: boolean }
 *                   admin_management:
 *                     type: object
 *                     properties:
 *                       view: { type: boolean }
 *                       manage: { type: boolean }
 *                       create: { type: boolean }
 *                       delete: { type: boolean }
 *                   system_settings:
 *                     type: object
 *                     properties:
 *                       view: { type: boolean }
 *                       manage: { type: boolean }
 *                   audit_logging:
 *                     type: object
 *                     properties:
 *                       view: { type: boolean }
 *                       export: { type: boolean }
 *                   reporting:
 *                     type: object
 *                     properties:
 *                       view: { type: boolean }
 *                       export: { type: boolean }
 *     responses:
 *       '200':
 *         description: Role permissions updated successfully
 *       '403':
 *         description: System roles (admin, superadmin, donor, hospital) cannot be modified
 *       '404':
 *         description: Role not found
 */
router.put('/permissions/roles/:role', requireRole('superadmin'), adminController.updateRolePermissions);
/**
 * @swagger
 * /admin/permissions/roles/{role}:
 *   delete:
 *     tags:
 *       - Admin
 *     summary: Delete a role permission record
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: role
 *         required: true
 *         schema:
 *           type: string
 *         description: Role identifier to delete
 *     responses:
 *       '200':
 *         description: Role deleted successfully
 *       '403':
 *         description: System roles (admin, superadmin, donor, hospital) cannot be deleted
 *       '404':
 *         description: Role not found
 */
router.delete('/permissions/roles/:role', requireRole('superadmin'), adminController.deleteRolePermission);

// ──────────────────────────────────────────────
//  User Management
// ──────────────────────────────────────────────

/**
 * @swagger
 * /admin/users:
 *   get:
 *     summary: List all users with filters and pagination
 *     tags: [Admin]
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
 *     tags: [Admin]
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
 *     tags: [Admin]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [fullName, email, password, hospitalName, hospitalId, licenseNumber, lat, long]
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
 *               lat:
 *                 type: number
 *                 format: double
 *                 description: Hospital latitude coordinate (-90 to 90)
 *                 example: 30.0444
 *               long:
 *                 type: number
 *                 format: double
 *                 description: Hospital longitude coordinate (-180 to 180)
 *                 example: 31.2357
 *     responses:
 *       201:
 *         description: Hospital created
 *       409:
 *         description: Email already registered
 *       400:
 *         description: Invalid lat/long coordinates
 */
router.post('/hospitals', hospitalController.createHospital);
router.post('/users/hospital', adminController.createHospital);

/**
 * @swagger
 * /admin/users/{id}:
 *   get:
 *     summary: Get user details by ID
 *     tags: [Admin]
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
 *     tags: [Admin]
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
 *     tags: [Admin]
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
 *     tags: [Admin]
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
 *     tags: [Admin]
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
 *     tags: [Admin]
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
 *     tags: [Admin]
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
 *     tags: [Admin]
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
 *     tags: [Admin]
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
 *     tags: [Admin]
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
 *     tags: [Admin]
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
 *     tags: [Admin]
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
 *     tags: [Admin]
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
 *     tags: [Admin]
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
 *     tags: [Admin]
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
 *     tags: [Admin]
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
 *     tags: [Admin]
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
 *     tags: [Admin]
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
 *     tags: [Admin]
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
 *     tags: [Admin]
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
 *     tags: [Admin]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: Shortage alerts by blood type
 */
router.get('/emergency/shortage-alerts', adminController.getShortageAlerts);

export default router;
