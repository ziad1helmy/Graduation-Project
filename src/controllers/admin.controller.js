import response from '../utils/response.js';
import { ERR } from '../utils/errorCodes.js';
import User from '../models/User.model.js';
import * as adminService from '../services/admin.service.js';
import * as analyticsService from '../services/analytics.service.js';
import { parsePagination } from '../utils/pagination.js';
import {
  validateMaintenanceBody,
  validateListUsersQuery,
  validateSuspendBody,
  validateCreateHospitalBody,
  validateListRequestsQuery,
  validateCancelRequestBody,
  validateEmergencyBroadcastBody,
} from '../validation/admin.validation.js';

// ──────────────────────────────────────────────
//  Phase 1: System & Foundation
// ──────────────────────────────────────────────

/** GET /admin/profile */
export const getProfile = (req, res) => {
  return response.success(res, 200, 'Admin profile', { user: req.user });
};

/** GET /admin/system/health */
export const getSystemHealth = async (req, res, next) => {
  try {
    const health = await adminService.getSystemHealth();
    return response.success(res, 200, 'System health', health);
  } catch (error) {
    next(error);
  }
};

/** POST /admin/system/maintenance */
export const setMaintenanceMode = async (req, res, next) => {
  try {
    const validation = validateMaintenanceBody(req.body);
    if (!validation.valid) {
      return response.error(res, 400, validation.errors.join(', '));
    }

    const result = await adminService.setMaintenanceMode(
      req.body.enabled,
      req.body.message,
      req.user._id
    );
    return response.success(res, 200, 'Maintenance mode updated', result);
  } catch (error) {
    next(error);
  }
};

/** GET /admin/system/maintenance */
export const getMaintenanceStatus = async (req, res, next) => {
  try {
    const status = await adminService.getMaintenanceStatus();
    return response.success(res, 200, 'Maintenance status', status);
  } catch (error) {
    next(error);
  }
};

export const getAlerts = async (req, res, next) => {
  try {
    const [dashboard, criticalRequests, shortageAlerts] = await Promise.all([
      analyticsService.getDashboardSummary(),
      adminService.getCriticalRequests(),
      adminService.getShortageAlerts(),
    ]);

    return response.success(res, 200, 'Alerts retrieved successfully', {
      alerts: {
        ...dashboard.alerts,
        criticalRequests,
        shortageAlerts,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const getBloodInventorySummary = async (req, res, next) => {
  try {
    const summary = await adminService.getBloodInventorySummary();

    return response.success(res, 200, 'Blood inventory summary', summary);
  } catch (error) {
    next(error);
  }
};

/** GET /admin/audit-logs */
export const getAuditLogs = async (req, res, next) => {
  try {
    const { action, targetType, adminId, page, limit } = req.query;
    const result = await adminService.getAuditLogs(
      { action, targetType, adminId },
      { page, limit }
    );
    return response.success(res, 200, 'Audit logs', result);
  } catch (error) {
    next(error);
  }
};

// ──────────────────────────────────────────────
//  Phase 2: User Management
// ──────────────────────────────────────────────

/** GET /admin/users */
export const listUsers = async (req, res, next) => {
  try {
    const validation = validateListUsersQuery(req.query);
    if (!validation.valid) {
      return response.error(res, 400, validation.errors.join(', '));
    }

    const { role, verified, suspended, search, page, limit } = req.query;
    const result = await adminService.listUsers(
      { role, verified, suspended, search },
      { page, limit }
    );
    return response.success(res, 200, 'Users list', result);
  } catch (error) {
    next(error);
  }
};

/** GET /admin/donors */
export const listDonors = async (req, res, next) => {
  try {
    return await listUsers({ query: { ...req.query, role: 'donor' } }, res, next);
  } catch (error) {
    next(error);
  }
};

/** GET /admin/hospitals */
export const listHospitals = async (req, res, next) => {
  try {
    return await listUsers({ query: { ...req.query, role: 'hospital' } }, res, next);
  } catch (error) {
    next(error);
  }
};

export const listAdmins = async (req, res, next) => {
  try {
    const validation = validateListUsersQuery(req.query);
    if (!validation.valid) {
      return response.error(res, 400, validation.errors.join(', '));
    }

    const { verified, suspended, search } = req.query;
    const { page, limit, skip } = parsePagination(req.query, 20);
    const query = { deletedAt: null, role: { $in: ['admin', 'superadmin'] } };

    if (verified !== undefined) query.isEmailVerified = verified === 'true' || verified === true;
    if (suspended !== undefined) query.isSuspended = suspended === 'true' || suspended === true;
    if (search) {
      query.$or = [
        { fullName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
      ];
    }

    const [users, total] = await Promise.all([
      User.find(query)
        .select('-password -emailVerificationToken -emailVerificationExpires -resetPasswordToken -resetPasswordExpires -passwordChangedAt')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      User.countDocuments(query),
    ]);

    return response.success(res, 200, 'Admins list', { users, total, page, limit });
  } catch (error) {
    next(error);
  }
};

export const getAdminById = async (req, res, next) => {
  try {
    const user = await adminService.getUserById(req.params.id);
    if (!user || !['admin', 'superadmin'].includes(user.role)) {
      return response.error(res, 404, 'Admin not found');
    }
    return response.success(res, 200, 'Admin details', { user });
  } catch (error) {
    next(error);
  }
};

/** GET /admin/users/stats */
export const getUserStats = async (req, res, next) => {
  try {
    const stats = await adminService.getUserStats();
    return response.success(res, 200, 'User statistics', stats);
  } catch (error) {
    next(error);
  }
};

/** GET /admin/users/:id */
export const getUserById = async (req, res, next) => {
  try {
    const user = await adminService.getUserById(req.params.id);
    if (!user) {
      return response.error(res, 404, 'User not found');
    }
    return response.success(res, 200, 'User details', { user });
  } catch (error) {
    next(error);
  }
};

/** PATCH /admin/users/:id/verify */
export const verifyUser = async (req, res, next) => {
  try {
    const user = await adminService.verifyUser(req.params.id, req.user._id);
    if (!user) {
      return response.error(res, 404, 'User not found');
    }
    return response.success(res, 200, 'User verified successfully', { user });
  } catch (error) {
    next(error);
  }
};

/** PATCH /admin/users/:id/unverify */
export const unverifyUser = async (req, res, next) => {
  try {
    const user = await adminService.unverifyUser(req.params.id, req.user._id);
    if (!user) {
      return response.error(res, 404, 'User not found');
    }
    return response.success(res, 200, 'User unverified successfully', { user });
  } catch (error) {
    next(error);
  }
};

/** PATCH /admin/users/:id/suspend */
export const suspendUser = async (req, res, next) => {
  try {
    const validation = validateSuspendBody(req.body);
    if (!validation.valid) {
      return response.error(res, 400, validation.errors.join(', '));
    }

    const user = await adminService.suspendUser(req.params.id, req.body.reason, req.user._id);
    if (!user) {
      return response.error(res, 404, 'User not found');
    }
    return response.success(res, 200, 'User suspended successfully', { user });
  } catch (error) {
    if (error.message === ERR.ADMIN_CANNOT_SUSPEND) {
      return response.error(res, 403, error.message);
    }
    next(error);
  }
};

/** PATCH /admin/users/:id/unsuspend */
export const unsuspendUser = async (req, res, next) => {
  try {
    const user = await adminService.unsuspendUser(req.params.id, req.user._id);
    if (!user) {
      return response.error(res, 404, 'User not found');
    }
    return response.success(res, 200, 'User unsuspended successfully', { user });
  } catch (error) {
    next(error);
  }
};

/** DELETE /admin/users/:id */
export const deleteUser = async (req, res, next) => {
  try {
    const user = await adminService.softDeleteUser(req.params.id, req.user._id);
    if (!user) {
      return response.error(res, 404, 'User not found');
    }
    return response.success(res, 200, 'User deleted successfully');
  } catch (error) {
    if (error.message === ERR.ADMIN_CANNOT_DELETE) {
      return response.error(res, 403, error.message);
    }
    next(error);
  }
};

/** POST /admin/users/hospital */
export const createHospital = async (req, res, next) => {
  try {
    const validation = validateCreateHospitalBody(req.body);
    if (!validation.valid) {
      return response.error(res, 400, validation.errors.join(', '));
    }

    const hospital = await adminService.createHospital(req.body, req.user._id);
    return response.success(res, 201, 'Hospital created successfully', { hospital });
  } catch (error) {
    if (error.message === ERR.ADMIN_EMAIL_EXISTS) {
      return response.error(res, 409, error.message);
    }
    next(error);
  }
};

export const updateDonor = async (req, res, next) => {
  try {
    const donor = await adminService.updateDonor(req.params.id, req.body, req.user._id);
    if (!donor) {
      return response.error(res, 404, 'Donor not found');
    }
    return response.success(res, 200, 'Donor updated successfully', { donor });
  } catch (error) {
    if (error.message === ERR.ADMIN_EMAIL_EXISTS) {
      return response.error(res, 409, error.message);
    }
    next(error);
  }
};

export const banDonor = async (req, res, next) => {
  try {
    const donor = await adminService.banDonor(req.params.id, req.body.reason, req.user._id);
    if (!donor) {
      return response.error(res, 404, 'Donor not found');
    }
    return response.success(res, 200, 'Donor banned successfully', { donor });
  } catch (error) {
    if (error.message === 'Donor is already banned') {
      return response.error(res, 400, ERR.DONOR_ALREADY_BANNED);
    }
    next(error);
  }
};

export const unbanDonor = async (req, res, next) => {
  try {
    const donor = await adminService.unbanDonor(req.params.id, req.user._id);
    if (!donor) {
      return response.error(res, 404, 'Donor not found');
    }
    return response.success(res, 200, 'Donor unbanned successfully', { donor });
  } catch (error) {
    if (error.message === 'Donor is not banned') {
      return response.error(res, 400, ERR.DONOR_NOT_BANNED);
    }
    next(error);
  }
};

export const updateHospitalStatus = async (req, res, next) => {
  try {
    const { action, reason } = req.body;
    if (!action || !['suspend', 'unsuspend'].includes(action)) {
      return response.error(res, 400, 'action must be suspend or unsuspend');
    }

    const hospital = await adminService.updateHospitalStatus(req.params.id, action, reason, req.user._id);
    if (!hospital) {
      return response.error(res, 404, 'Hospital not found');
    }

    return response.success(res, 200, `Hospital ${action}ed successfully`, { hospital });
  } catch (error) {
    next(error);
  }
};

export const createAdmin = async (req, res, next) => {
  try {
    const { fullName, email, password, role, location } = req.body;
    if (!fullName || !email || !password) {
      return response.error(res, 400, 'fullName, email and password are required');
    }

    const admin = await adminService.createAdmin({ fullName, email, password, role, location }, req.user._id);
    return response.success(res, 201, 'Admin created successfully', { admin });
  } catch (error) {
    if (error.message === ERR.ADMIN_EMAIL_EXISTS) {
      return response.error(res, 409, error.message);
    }
    next(error);
  }
};

export const updateAdmin = async (req, res, next) => {
  try {
    const admin = await adminService.updateAdmin(req.params.id, req.body, req.user._id);
    if (!admin) {
      return response.error(res, 404, 'Admin not found');
    }
    return response.success(res, 200, 'Admin updated successfully', { admin });
  } catch (error) {
    if (error.message === ERR.ADMIN_EMAIL_EXISTS) {
      return response.error(res, 409, error.message);
    }
    next(error);
  }
};

export const deleteAdmin = async (req, res, next) => {
  try {
    const admin = await adminService.deleteAdmin(req.params.id, req.user._id);
    if (!admin) {
      return response.error(res, 404, 'Admin not found');
    }
    return response.success(res, 200, 'Admin deleted successfully');
  } catch (error) {
    if (error.message === 'Cannot delete your own account') {
      return response.error(res, 403, ERR.ADMIN_CANNOT_DELETE_SELF);
    }
    next(error);
  }
};

export const listRolePermissions = async (req, res, next) => {
  try {
    const roles = await adminService.listRolePermissions();
    return response.success(res, 200, 'Roles retrieved successfully', { roles });
  } catch (error) {
    next(error);
  }
};

export const getRolePermissionDetails = async (req, res, next) => {
  try {
    const role = await adminService.getRolePermissionDetails(req.params.role);
    if (!role) {
      return response.error(res, 404, ERR.ADMIN_ROLE_NOT_FOUND);
    }
    return response.success(res, 200, 'Role retrieved successfully', { role });
  } catch (error) {
    next(error);
  }
};

export const createRolePermission = async (req, res, next) => {
  try {
    const { role, displayName, description, isSystemRole, permissions } = req.body;
    if (!role || !displayName) {
      return response.error(res, 400, 'role and displayName are required');
    }

    const created = await adminService.createRolePermission({ role, displayName, description, isSystemRole, permissions }, req.user._id);
    return response.success(res, 201, 'Role created successfully', { role: created });
  } catch (error) {
    if (error.message === 'Cannot modify a system role') {
      return response.error(res, 403, ERR.ADMIN_ROLE_IS_SYSTEM);
    }
    if (error.message === 'Role already exists') {
      return response.error(res, 409, ERR.ADMIN_ROLE_ALREADY_EXISTS);
    }
    next(error);
  }
};

export const updateRolePermissions = async (req, res, next) => {
  try {
    const updated = await adminService.updateRolePermissions(req.params.role, req.body, req.user._id);
    if (!updated) {
      return response.error(res, 404, ERR.ADMIN_ROLE_NOT_FOUND);
    }
    return response.success(res, 200, 'Role permissions updated successfully', { role: updated });
  } catch (error) {
    if (error.message === 'Cannot modify a system role') {
      return response.error(res, 403, ERR.ADMIN_ROLE_IS_SYSTEM);
    }
    next(error);
  }
};

// ──────────────────────────────────────────────
//  Phase 3: Request Management
// ──────────────────────────────────────────────

/** GET /admin/requests */
export const listRequests = async (req, res, next) => {
  try {
    const validation = validateListRequestsQuery(req.query);
    if (!validation.valid) {
      return response.error(res, 400, validation.errors.join(', '));
    }

    const { status, urgency, bloodType, hospitalId, type, page, limit } = req.query;
    const result = await adminService.listAllRequests(
      { status, urgency, bloodType, hospitalId, type },
      { page, limit }
    );
    return response.success(res, 200, 'Requests list', result);
  } catch (error) {
    next(error);
  }
};

/** GET /admin/requests/stats */
export const getRequestStats = async (req, res, next) => {
  try {
    const stats = await adminService.getRequestStats();
    return response.success(res, 200, 'Request statistics', stats);
  } catch (error) {
    next(error);
  }
};

/** GET /admin/requests/:id */
export const getRequestDetails = async (req, res, next) => {
  try {
    const result = await adminService.getRequestDetails(req.params.id);
    if (!result) {
      return response.error(res, 404, 'Request not found');
    }
    return response.success(res, 200, 'Request details', result);
  } catch (error) {
    next(error);
  }
};

/** GET /admin/requests/:id/donations */
export const getRequestDonations = async (req, res, next) => {
  try {
    const { page, limit } = req.query;
    const result = await adminService.getRequestDonations(req.params.id, { page, limit });
    return response.success(res, 200, 'Request donations', result);
  } catch (error) {
    next(error);
  }
};

/** PATCH /admin/requests/:id/fulfill */
export const fulfillRequest = async (req, res, next) => {
  try {
    const request = await adminService.fulfillRequest(req.params.id, req.user._id);
    if (!request) {
      return response.error(res, 404, 'Request not found');
    }
    return response.success(res, 200, 'Request marked as fulfilled', { request });
  } catch (error) {
    if (error.message === ERR.REQUEST_ALREADY_FULFILLED) {
      return response.error(res, 400, error.message);
    }
    next(error);
  }
};

/** PATCH /admin/requests/:id/cancel */
export const cancelRequest = async (req, res, next) => {
  try {
    const validation = validateCancelRequestBody(req.body);
    if (!validation.valid) {
      return response.error(res, 400, validation.errors.join(', '));
    }

    const request = await adminService.cancelRequest(req.params.id, req.body.reason, req.user._id);
    if (!request) {
      return response.error(res, 404, 'Request not found');
    }
    return response.success(res, 200, 'Request cancelled', { request });
  } catch (error) {
    if (error.message === ERR.REQUEST_ALREADY_CANCELLED) {
      return response.error(res, 400, error.message);
    }
    next(error);
  }
};

/** POST /admin/requests/:id/broadcast */
export const broadcastRequest = async (req, res, next) => {
  try {
    const result = await adminService.broadcastRequest(req.params.id, req.user._id);
    if (!result) {
      return response.error(res, 404, 'Request not found');
    }
    return response.success(res, 200, 'Broadcast sent', result);
  } catch (error) {
    next(error);
  }
};

// ──────────────────────────────────────────────
//  Phase 4: Analytics
// ──────────────────────────────────────────────

/** GET /admin/analytics/dashboard */
export const getDashboard = async (req, res, next) => {
  try {
    const summary = await analyticsService.getDashboardSummary();
    return response.success(res, 200, 'Dashboard summary', summary);
  } catch (error) {
    next(error);
  }
};

/** GET /admin/statistics */
export const getStatistics = async (req, res, next) => {
  try {
    const summary = await analyticsService.getDashboardSummary();
    return response.success(res, 200, 'Statistics summary', summary);
  } catch (error) {
    next(error);
  }
};

/** GET /admin/analytics/donations */
export const getDonationTrends = async (req, res, next) => {
  try {
    const months = parseInt(req.query.months) || 6;
    const trends = await analyticsService.getDonationTrends(months);
    return response.success(res, 200, 'Donation trends', { trends });
  } catch (error) {
    next(error);
  }
};

/** GET /admin/analytics/blood-types */
export const getBloodTypeDistribution = async (req, res, next) => {
  try {
    const distribution = await analyticsService.getBloodTypeDistribution();
    return response.success(res, 200, 'Blood type distribution', { distribution });
  } catch (error) {
    next(error);
  }
};

/** GET /admin/analytics/top-donors */
export const getTopDonors = async (req, res, next) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const topDonors = await analyticsService.getTopDonors(limit);
    return response.success(res, 200, 'Top donors', { topDonors });
  } catch (error) {
    next(error);
  }
};

/** GET /admin/analytics/growth */
export const getGrowthMetrics = async (req, res, next) => {
  try {
    const months = parseInt(req.query.months) || 6;
    const growth = await analyticsService.getGrowthMetrics(months);
    return response.success(res, 200, 'Growth metrics', growth);
  } catch (error) {
    next(error);
  }
};

// ──────────────────────────────────────────────
//  Phase 5: Emergency
// ──────────────────────────────────────────────

/** POST /admin/emergency/broadcast */
export const sendEmergencyBroadcast = async (req, res, next) => {
  try {
    const validation = validateEmergencyBroadcastBody(req.body);
    if (!validation.valid) {
      return response.error(res, 400, validation.errors.join(', '));
    }

    const result = await adminService.sendEmergencyBroadcast(req.body, req.user._id);
    return response.success(res, 200, 'Emergency broadcast sent', result);
  } catch (error) {
    next(error);
  }
};

/** GET /admin/emergency/critical */
export const getCriticalRequests = async (req, res, next) => {
  try {
    const requests = await adminService.getCriticalRequests();
    return response.success(res, 200, 'Critical requests', { requests });
  } catch (error) {
    next(error);
  }
};

/** GET /admin/emergency/shortage-alerts */
export const getShortageAlerts = async (req, res, next) => {
  try {
    const alerts = await adminService.getShortageAlerts();
    return response.success(res, 200, 'Shortage alerts', { alerts });
  } catch (error) {
    next(error);
  }
};
