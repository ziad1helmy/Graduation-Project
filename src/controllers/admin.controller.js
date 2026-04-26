import response from '../utils/response.js';
import * as adminService from '../services/admin.service.js';
import * as analyticsService from '../services/analytics.service.js';
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
    if (error.message === 'Cannot suspend admin accounts') {
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
    if (error.message === 'Cannot delete admin accounts') {
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
    if (error.message === 'Email already registered') {
      return response.error(res, 409, error.message);
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
    if (error.message === 'Request is already fulfilled') {
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
    if (error.message === 'Request is already cancelled') {
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
