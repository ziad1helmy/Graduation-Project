import response from '../utils/response.js';
import mongoose from 'mongoose';
import { ERR } from '../utils/errorCodes.js';
import User from '../models/User.model.js';
import Badge from '../models/Badge.model.js';
import InboundEmail from '../models/InboundEmail.model.js';
import * as adminService from '../services/admin.service.js';
import * as analyticsService from '../services/analytics.service.js';
import * as rewardsConfigService from '../services/rewardsConfig.service.js';
import { parsePagination, paginationMeta } from '../utils/pagination.js';
import {
  validateMaintenanceBody,
  validateListUsersQuery,
  validateCreateHospitalBody,
  validateCreateAdminBody,
  validateListRequestsQuery,
  validateCancelRequestBody,
  validateEmergencyBroadcastBody,
} from '../validation/admin.validation.js';
import { validateRewardsConfigBody } from '../validation/reward.validation.js';

// ──────────────────────────────────────────────
//  Phase 1: System & Foundation
// ──────────────────────────────────────────────

/** GET /admin/profile */
export const getAdminProfile = async (req, res, next) => {
  try {
    const admin = await adminService.getAdminProfile(req.user._id);
    if (!admin) {
      return response.error(res, 404, 'Admin profile not found');
    }
    return response.success(res, 200, 'Admin profile', { admin });
  } catch (error) {
    next(error);
  }
};

export const updateAdminProfile = async (req, res, next) => {
  try {
    const { fullName, email, phone, address, location } = req.body;

    const result = await adminService.updateAdminProfile(req.user._id, {
      fullName,
      email,
      phone,
      address,
      location,
    });

    if (!result || !result.admin) {
      return response.error(res, 404, 'Admin profile not found');
    }

    const { admin, emailChanged } = result;
    const adminObj = admin.toObject();
    delete adminObj.password;

    const payload = { admin: adminObj };
    if (emailChanged) {
      payload.note = 'Email changed — check your inbox to re-verify your address';
    }

    return response.success(res, 200, 'Admin profile updated successfully', payload);
  } catch (error) {
    if (error.message === 'Email is already in use by another account') {
      return response.error(res, 409, error.message);
    }
    if (error?.name === 'ValidationError') {
      const details = Object.values(error.errors || {}).map((item) => item.message);
      return response.error(res, 400, details[0] || error.message, details);
    }
    if (error?.code === 11000) {
      const field = Object.keys(error.keyPattern || {})[0];
      return response.error(res, 409, field ? `Duplicate ${field}` : error.message);
    }
    next(error);
  }
};

export const getProfile = getAdminProfile;

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

const parseBooleanQuery = (value, defaultValue = null) => {
  if (value === undefined || value === null || value === '') return defaultValue;
  if (typeof value === 'boolean') return value;

  const normalized = String(value).trim().toLowerCase();
  if (['true', '1', 'yes'].includes(normalized)) return true;
  if (['false', '0', 'no'].includes(normalized)) return false;
  return defaultValue;
};

const toInboundEmailResponse = (email) => {
  if (!email) return null;

  return {
    _id: email._id,
    provider: email.provider,
    providerEventId: email.providerEventId,
    messageId: email.messageId,
    from: email.from,
    to: email.to,
    cc: email.cc,
    bcc: email.bcc,
    subject: email.subject,
    text: email.text,
    html: email.html,
    headers: email.headers,
    attachments: email.attachments,
    receivedAt: email.receivedAt,
    read: email.read,
    readAt: email.readAt,
    archived: email.archived,
    archivedAt: email.archivedAt,
    isRead: email.isRead,
    isArchived: email.isArchived,
    createdAt: email.createdAt,
    updatedAt: email.updatedAt,
  };
};

// ──────────────────────────────────────────────
//  Inbound Email Management
// ──────────────────────────────────────────────

/** GET /admin/inbound-emails */
export const listInboundEmails = async (req, res, next) => {
  try {
    const { page, limit, offset } = parsePagination(req.query, 20, 100);
    const read = parseBooleanQuery(req.query.read);
    const archived = parseBooleanQuery(req.query.archived);
    const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';

    const filter = {};
    if (read !== null) {
      filter.isRead = read;
    }
    if (archived !== null) {
      filter.isArchived = archived;
    }
    if (search) {
      filter.$or = [
        { from: { $regex: search, $options: 'i' } },
        { subject: { $regex: search, $options: 'i' } },
        { text: { $regex: search, $options: 'i' } },
        { to: { $regex: search, $options: 'i' } },
      ];
    }

    const [inboundEmails, total] = await Promise.all([
      InboundEmail.find(filter)
        .sort({ receivedAt: -1, createdAt: -1 })
        .skip(offset)
        .limit(limit)
        .lean(),
      InboundEmail.countDocuments(filter),
    ]);

    return response.success(res, 200, 'Inbound emails retrieved successfully', {
      inboundEmails: inboundEmails.map(toInboundEmailResponse),
      pagination: paginationMeta(total, page, limit),
    });
  } catch (error) {
    next(error);
  }
};

/** GET /admin/inbound-emails/:id */
export const getInboundEmailById = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return response.error(res, 400, 'Invalid inbound email id');
    }

    const inboundEmail = await InboundEmail.findById(req.params.id).lean();
    if (!inboundEmail) {
      return response.error(res, 404, 'Inbound email not found');
    }

    return response.success(res, 200, 'Inbound email retrieved successfully', {
      inboundEmail: toInboundEmailResponse(inboundEmail),
    });
  } catch (error) {
    next(error);
  }
};

/** PATCH /admin/inbound-emails/:id/read */
export const markInboundEmailRead = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return response.error(res, 400, 'Invalid inbound email id');
    }

    const inboundEmail = await InboundEmail.findByIdAndUpdate(
      req.params.id,
      {
        $set: {
          isRead: true,
          readAt: new Date(),
        },
      },
      { new: true }
    ).lean();

    if (!inboundEmail) {
      return response.error(res, 404, 'Inbound email not found');
    }

    return response.success(res, 200, 'Inbound email marked as read', {
      inboundEmail: toInboundEmailResponse(inboundEmail),
    });
  } catch (error) {
    next(error);
  }
};

/** PATCH /admin/inbound-emails/:id/archive */
export const archiveInboundEmail = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return response.error(res, 400, 'Invalid inbound email id');
    }

    const inboundEmail = await InboundEmail.findByIdAndUpdate(
      req.params.id,
      {
        $set: {
          isArchived: true,
          archivedAt: new Date(),
        },
      },
      { new: true }
    ).lean();

    if (!inboundEmail) {
      return response.error(res, 404, 'Inbound email not found');
    }

    return response.success(res, 200, 'Inbound email archived', {
      inboundEmail: toInboundEmailResponse(inboundEmail),
    });
  } catch (error) {
    next(error);
  }
};

/** DELETE /admin/inbound-emails/:id */
export const deleteInboundEmail = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return response.error(res, 400, 'Invalid inbound email id');
    }

    const inboundEmail = await InboundEmail.findByIdAndDelete(req.params.id).lean();
    if (!inboundEmail) {
      return response.error(res, 404, 'Inbound email not found');
    }

    return response.success(res, 200, 'Inbound email deleted successfully', {
      inboundEmail: toInboundEmailResponse(inboundEmail),
    });
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

    const { page, limit } = parsePagination(req.query, 20);
    const result = await adminService.getAllAdmins({ page, limit });
    return response.success(res, 200, 'Admins list', result);
  } catch (error) {
    next(error);
  }
};

export const getAllAdmins = listAdmins;

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
    const user = await adminService.getUserById(req.params.id, req.user.role);
    if (!user) {
      return response.error(res, 404, 'User not found');
    }
    return response.success(res, 200, 'User details', { user });
  } catch (error) {
    next(error);
  }
};

/** GET /admin/donors/:id */
export const getDonorById = async (req, res, next) => {
  try {
    const user = await adminService.getUserById(req.params.id, req.user.role, 'donor');
    if (!user) {
      return response.error(res, 404, 'Donor not found');
    }
    return response.success(res, 200, 'Donor details', { user });
  } catch (error) {
    next(error);
  }
};

/** GET /admin/hospitals/:id */
export const getHospitalById = async (req, res, next) => {
  try {
    const user = await adminService.getUserById(req.params.id, req.user.role, 'hospital');
    if (!user) {
      return response.error(res, 404, 'Hospital not found');
    }
    return response.success(res, 200, 'Hospital details', { user });
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
    const validation = validateCreateAdminBody(req.body);
    if (!validation.valid) {
      return response.error(res, 400, validation.errors.join(', '));
    }

    const admin = await adminService.createAdmin(req.body, req.user._id);
    return response.success(res, 201, 'Admin created successfully', { admin });
  } catch (error) {
    if (error.message === ERR.ADMIN_EMAIL_EXISTS) {
      return response.error(res, 409, error.message);
    }
    if (error.message === 'Only superadmin can create admin accounts') {
      return response.error(res, 403, error.message);
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
    if (error.message === 'Email changes are not supported via this endpoint. Admins must use the self-service profile flow.') {
      return response.error(res, 400, error.message);
    }
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

export const rotateAdminKey = async (req, res, next) => {
  try {
    const result = await adminService.rotateAdminKey(req.params.id, req.user._id);
    if (!result) {
      return response.error(res, 404, 'Admin not found');
    }
    return response.success(res, 200, 'Admin key rotated successfully. The new key is shown only once — store it securely.', {
      admin: result.admin.toObject(),
      adminKey: result.plaintextKey,
    });
  } catch (error) {
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

export const deleteRolePermission = async (req, res, next) => {
  try {
    const deleted = await adminService.deleteRolePermission(req.params.role, req.user._id);
    if (!deleted) {
      return response.error(res, 404, ERR.ADMIN_ROLE_NOT_FOUND);
    }
    return response.success(res, 200, 'Role deleted successfully', { role: deleted });
  } catch (error) {
    if (error.message === 'Cannot delete a system role') {
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
    // Fix #7 (MEDIUM): Return 429 with nextAllowedAt when the broadcast
    // cooldown window has not elapsed since the last broadcast.
    if (error.code === 'BROADCAST_COOLDOWN_ACTIVE') {
      return response.error(res, 429, 'Broadcast cooldown active. Try again later.', {
        code: 'BROADCAST_COOLDOWN_ACTIVE',
        nextAllowedAt: error.nextAllowedAt,
      });
    }
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
    const result = await analyticsService.getDonationTrends(months);
    return response.success(res, 200, 'Donation trends', result);
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

/** GET /admin/rewards/config */
export const getRewardsConfig = async (req, res, next) => {
  try {
    const data = await rewardsConfigService.getRewardsConfig();
    return response.success(res, 200, 'Rewards config retrieved successfully', data);
  } catch (error) {
    next(error);
  }
};

/** PUT /admin/rewards/config */
export const updateRewardsConfig = async (req, res, next) => {
  try {
    const validation = validateRewardsConfigBody(req.body);
    if (!validation.valid) {
      return response.error(res, 400, validation.errors.join(', '));
    }

    const data = await rewardsConfigService.updateRewardsConfig(req.body, req.user._id);
    return response.success(res, 200, 'Rewards config updated successfully', data);
  } catch (error) {
    next(error);
  }
};

// ──────────────────────────────────────────────
//  Support Inbox
// ──────────────────────────────────────────────

export const listSupportMessages = async (req, res, next) => {
  try {
    const { status, category, search, page, limit } = req.query;
    const result = await adminService.listSupportMessages(
      { status, category, search },
      { page, limit }
    );

    return response.success(res, 200, 'Support messages retrieved successfully', result);
  } catch (error) {
    next(error);
  }
};

export const getSupportMessageById = async (req, res, next) => {
  try {
    const ticket = await adminService.getSupportMessageById(req.params.id);
    if (!ticket) {
      return response.error(res, 404, 'Support message not found');
    }

    return response.success(res, 200, 'Support message retrieved successfully', { ticket });
  } catch (error) {
    next(error);
  }
};

export const reviewSupportMessage = async (req, res, next) => {
  try {
    const ticket = await adminService.reviewSupportMessage(req.params.id, req.user._id);
    if (!ticket) {
      return response.error(res, 404, 'Support message not found');
    }

    return response.success(res, 200, 'Support message marked as reviewed', { ticket });
  } catch (error) {
    next(error);
  }
};

export const replySupportMessage = async (req, res, next) => {
  try {
    const reply = String(req.body?.reply || '').trim();
    if (!reply) {
      return response.error(res, 400, 'reply is required');
    }

    const ticket = await adminService.replySupportMessage(req.params.id, reply, req.user._id);
    if (!ticket) {
      return response.error(res, 404, 'Support message not found');
    }

    return response.success(res, 200, 'Support reply saved successfully', { ticket });
  } catch (error) {
    next(error);
  }
};

// ──────────────────────────────────────────────
//  Badges Management
// ──────────────────────────────────────────────

/** GET /admin/badges */
export const getBadges = async (req, res, next) => {
  try {
    const badges = await Badge.find().sort({ sortOrder: 1 });
    return response.success(res, 200, 'Badges retrieved successfully', { badges });
  } catch (error) {
    next(error);
  }
};

/** PATCH /admin/badges/:id */
export const updateBadge = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return response.error(res, 400, 'Invalid badge ID');
    }

    const { unlockThreshold, pointsReward, bonusPoints } = req.body;
    const update = {};

    if (unlockThreshold !== undefined) {
      if (typeof unlockThreshold !== 'number' || unlockThreshold < 1) {
        return response.error(res, 400, 'unlockThreshold must be a number greater than or equal to 1');
      }
      update.unlockThreshold = unlockThreshold;
    }

    // Support both pointsReward (model name) and bonusPoints (plan name)
    const pointsVal = pointsReward !== undefined ? pointsReward : bonusPoints;
    if (pointsVal !== undefined) {
      if (typeof pointsVal !== 'number' || pointsVal < 0) {
        return response.error(res, 400, 'pointsReward/bonusPoints must be a non-negative number');
      }
      update.pointsReward = pointsVal;
    }

    if (Object.keys(update).length === 0) {
      return response.error(res, 400, 'At least one field to update is required');
    }

    const badge = await Badge.findByIdAndUpdate(
      id,
      { $set: update },
      { new: true, runValidators: true }
    );

    if (!badge) {
      return response.error(res, 404, 'Badge not found');
    }

    await adminService.logBadgeUpdate(req.user?._id, badge._id, update);

    return response.success(res, 200, 'Badge updated successfully', { badge });
  } catch (error) {
    next(error);
  }
};
