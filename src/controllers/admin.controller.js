import response from '../utils/response.js';
import mongoose from 'mongoose';
import { ERR } from '../utils/errorCodes.js';
import User from '../models/User.model.js';
import Badge from '../models/Badge.model.js';
import InboundEmail from '../models/InboundEmail.model.js';
import * as adminService from '../services/admin.service.js';
import * as analyticsService from '../services/analytics.service.js';
import * as rewardService from '../services/reward.service.js';
import * as rewardsConfigService from '../services/rewardsConfig.service.js';
import { parsePagination, paginationMeta } from '../utils/pagination.js';
import { parseBooleanQuery } from '../utils/query.js';
import {
  validateMaintenanceBody,
  validateListUsersQuery,
  validateCreateHospitalBody,
  validateCreateAdminBody,
  validateListRequestsQuery,
  validateBanDonorBody,
  validateUpdateAdminProfileBody,
  validateUpdateSystemSettingsBody,
} from '../validation/admin.validation.js';

import { asyncHandler } from '../middlewares/asyncHandler.js';
import { HttpError } from '../utils/HttpError.js';

// ──────────────────────────────────────────────
//  Phase 1: System & Foundation
// ──────────────────────────────────────────────

/** GET /admin/profile */
export const getAdminProfile = asyncHandler(async (req, res) => {
  const admin = await adminService.getAdminProfile(req.user._id);
  if (!admin) {
    throw new HttpError(404, 'Admin profile not found');
  }
  return response.success(res, 200, 'Admin profile', { admin });
});

export const updateAdminProfile = asyncHandler(async (req, res) => {
  const validation = validateUpdateAdminProfileBody(req.body);
  if (!validation.valid) {
    throw new HttpError(400, validation.errors.join(', '));
  }

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
      throw new HttpError(404, 'Admin profile not found');
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
      throw new HttpError(409, error.message);
    }
    if (error?.name === 'ValidationError') {
      const details = Object.values(error.errors || {}).map((item) => item.message);
      throw new HttpError(400, details[0] || error.message, details);
    }
    if (error?.code === 11000) {
      const field = Object.keys(error.keyPattern || {})[0];
      throw new HttpError(409, field ? `Duplicate ${field}` : error.message);
    }
    throw error;
  }
});

export const getProfile = getAdminProfile;

/** GET /admin/system/health */
export const getSystemHealth = asyncHandler(async (req, res) => {
  const health = await adminService.getSystemHealth();
  return response.success(res, 200, 'System health', health);
});

/** POST /admin/system/maintenance */
export const setMaintenanceMode = asyncHandler(async (req, res) => {
  const validation = validateMaintenanceBody(req.body);
  if (!validation.valid) {
    throw new HttpError(400, validation.errors.join(', '));
  }

  const result = await adminService.setMaintenanceMode(
    req.body.enabled,
    req.body.message,
    req.user._id
  );
  return response.success(res, 200, 'Maintenance mode updated', result);
});

/** GET /admin/system/maintenance */
export const getMaintenanceStatus = asyncHandler(async (req, res) => {
  const status = await adminService.getMaintenanceStatus();
  return response.success(res, 200, 'Maintenance status', status);
});

export const getAlerts = asyncHandler(async (req, res) => {
  const [dashboard, criticalRequests, shortageAlerts] = await Promise.all([
    analyticsService.getDashboardSummary(),
    adminService.getCriticalRequests(),
    adminService.getShortageAlerts(),
  ]);

  return response.success(res, 200, 'Alerts retrieved successfully', {
    alerts: {
      criticalAlerts: dashboard.criticalAlerts,
      criticalRequests,
      shortageAlerts,
    },
  });
});


/** GET /admin/audit-logs */
export const getAuditLogs = asyncHandler(async (req, res) => {
  const { action, targetType, adminId, page, limit } = req.query;
  const result = await adminService.getAuditLogs(
    { action, targetType, adminId },
    { page, limit }
  );

  const actionKey = (actionCode) => `admin.audit.action.${actionCode.replace(/^(user|system)\./, '')}`;
  const detailsKey = (actionCode) => `admin.audit.details.${actionCode.replace(/^(user|system)\./, '')}`;

  const formattedLogs = result.logs.map((log) => {
    const logObj = log.toObject ? log.toObject() : log;
    const adminEmail = logObj.adminId?.email || 'System';

    const friendlyAction = req.t(actionKey(logObj.action), logObj);

    let details = logObj.changes?.details || '';
    if (!details) {
      details = req.t(detailsKey(logObj.action), { targetId: logObj.targetId, action: logObj.action, targetType: logObj.targetType });
    }

    return {
      _id: logObj._id,
      adminId: logObj.adminId?._id || logObj.adminId || null,
      adminName: adminEmail,
      action: friendlyAction,
      targetId: logObj.targetId,
      targetType: logObj.targetType ? logObj.targetType.toLowerCase() : null,
      details,
      createdAt: logObj.createdAt,
    };
  });

  const totalPages = Math.ceil(result.total / result.limit) || 1;
  const pagination = {
    page: result.page,
    limit: result.limit,
    total: result.total,
    totalPages,
  };

  return response.success(res, 200, 'admin.audit_logs', {
    logs: formattedLogs,
    pagination,
  });
});

/** GET /admin/system-settings */
export const getSystemSettings = asyncHandler(async (req, res) => {
  const user = await adminService.getUserById(req.user._id, req.user.role, null, req.user._id.toString());
  if (!user) {
    throw new HttpError(404, 'Admin user not found');
  }

  const userObj = user.toObject ? user.toObject() : user;
  const admin = {
    _id: userObj._id,
    fullName: userObj.fullName,
    email: userObj.email,
    role: userObj.role,
    position: userObj.position || (userObj.role === 'superadmin' ? 'Super Admin' : 'Admin'),
    phone: userObj.phone || userObj.phoneNumber || '',
    department: userObj.department || 'IT Department',
    adminAccessKey: userObj.adminKey || (userObj.role === 'superadmin' ? 'Super Admin' : 'Admin'),
  };

  const settings = await adminService.getSystemSettingsObj();
  const systemHealth = await adminService.getSystemHealth();

  return response.success(res, 200, 'System settings retrieved', {
    admin,
    settings,
    systemHealth,
  });
});

/** PUT /admin/system-settings */
export const updateSystemSettings = asyncHandler(async (req, res) => {
  const { valid, errors } = validateUpdateSystemSettingsBody(req.body);
  if (!valid) {
    return response.error(res, 400, 'invalid system settings', errors);
  }

  const { maintenanceModeEnabled, donorRegistrationEnabled, notificationsEnabled, maxMissedDonationsBeforeBan } = req.body;

  const updatedSettings = await adminService.updateSystemSettings({
    maintenanceModeEnabled,
    donorRegistrationEnabled,
    notificationsEnabled,
    maxMissedDonationsBeforeBan,
  }, req.user._id);

  return response.success(res, 200, 'System settings updated successfully', {
    settings: updatedSettings,
  });
});

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
    readAt: email.readAt,
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
export const listInboundEmails = asyncHandler(async (req, res) => {
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

  const [inboundEmails, total, supportResult] = await Promise.all([
    InboundEmail.find(filter)
      .sort({ receivedAt: -1, createdAt: -1 })
      .skip(offset)
      .limit(limit)
      .lean(),
    InboundEmail.countDocuments(filter),
    adminService.listSupportMessages(
      { status: req.query.supportStatus, category: req.query.supportCategory, search },
      { page, limit }
    ),
  ]);

  return response.success(res, 200, 'Inbound emails retrieved successfully', {
    inboundEmails: inboundEmails.map(toInboundEmailResponse),
    supportTickets: supportResult.tickets,
    pagination: paginationMeta(total, page, limit),
  });
});

/** GET /admin/inbound-emails/:id */
export const getInboundEmailById = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    throw new HttpError(400, 'Invalid inbound email ID');
  }

  const inboundEmail = await InboundEmail.findById(req.params.id).lean();
  if (!inboundEmail) {
    throw new HttpError(404, 'Inbound email not found');
  }

  return response.success(res, 200, 'Inbound email retrieved successfully', {
    inboundEmail: toInboundEmailResponse(inboundEmail),
  });
});

/** PATCH /admin/inbound-emails/:id/read */
export const markInboundEmailRead = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    throw new HttpError(400, 'Invalid inbound email ID');
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
    throw new HttpError(404, 'Inbound email not found');
  }

  return response.success(res, 200, 'Inbound email marked as read', {
    inboundEmail: toInboundEmailResponse(inboundEmail),
  });
});

/** PATCH /admin/inbound-emails/:id/archive */
export const archiveInboundEmail = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    throw new HttpError(400, 'Invalid inbound email ID');
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
    throw new HttpError(404, 'Inbound email not found');
  }

  return response.success(res, 200, 'Inbound email archived', {
    inboundEmail: toInboundEmailResponse(inboundEmail),
  });
});

/** DELETE /admin/inbound-emails/:id */
export const deleteInboundEmail = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    throw new HttpError(400, 'Invalid inbound email ID');
  }

  const inboundEmail = await InboundEmail.findByIdAndDelete(req.params.id).lean();
  if (!inboundEmail) {
    throw new HttpError(404, 'Inbound email not found');
  }

  return response.success(res, 200, 'Inbound email deleted successfully', {
    inboundEmail: toInboundEmailResponse(inboundEmail),
  });
});

// ──────────────────────────────────────────────
//  Phase 2: User Management
// ──────────────────────────────────────────────

/** GET /admin/users */
export const listUsers = asyncHandler(async (req, res) => {
  const validation = validateListUsersQuery(req.query);
  if (!validation.valid) {
    throw new HttpError(400, validation.errors.join(', '));
  }

  const { role, verified, suspended, search, page, limit } = req.query;
  const result = await adminService.listUsers(
    { role, verified, suspended, search },
    { page, limit }
  );
  return response.success(res, 200, 'Users list', result);
});

/** GET /admin/donors — convenience alias for GET /admin/users?role=donor */
export const listDonors = asyncHandler(async (req, res) => {
  req.query.role = 'donor';
  return listUsers(req, res);
});

/** GET /admin/hospitals — convenience alias for GET /admin/users?role=hospital */
export const listHospitals = asyncHandler(async (req, res) => {
  req.query.role = 'hospital';
  return listUsers(req, res);
});

export const listAdmins = asyncHandler(async (req, res) => {
  const validation = validateListUsersQuery(req.query);
  if (!validation.valid) {
    throw new HttpError(400, validation.errors.join(', '));
  }

  const { page, limit } = parsePagination(req.query, 20);
  const result = await adminService.getAllAdmins({ page, limit }, req.user.role);
  return response.success(res, 200, 'Admins list', result);
});

export const getAllAdmins = listAdmins;

export const getAdminById = asyncHandler(async (req, res) => {
  const user = await adminService.getUserById(req.params.id, req.user.role);
  if (!user || !['admin', 'superadmin'].includes(user.role)) {
    throw new HttpError(404, 'Admin not found');
  }
  return response.success(res, 200, 'Admin details', { user });
});

/** GET /admin/users/:id */
export const getUserById = asyncHandler(async (req, res) => {
  const user = await adminService.getUserById(req.params.id, req.user.role, null, req.user._id);
  if (!user) {
    throw new HttpError(404, 'User not found');
  }
  return response.success(res, 200, 'User details', { user });
});

/** GET /admin/donors/:id */
export const getDonorById = asyncHandler(async (req, res) => {
  const user = await adminService.getUserById(req.params.id, req.user.role, 'donor', req.user._id);
  if (!user) {
    throw new HttpError(404, 'Donor not found');
  }
  return response.success(res, 200, 'Donor details', { user });
});

/** GET /admin/hospitals/:id */
export const getHospitalById = asyncHandler(async (req, res) => {
  const user = await adminService.getUserById(req.params.id, req.user.role, 'hospital', req.user._id);
  if (!user) {
    throw new HttpError(404, 'Hospital not found');
  }
  return response.success(res, 200, 'Hospital details', { user });
});

/** PUT /admin/users/donor/:id */
export const updateDonor = asyncHandler(async (req, res) => {
  try {
    const user = await adminService.updateDonor(req.params.id, req.body, req.user._id);
    if (!user) {
      throw new HttpError(404, 'Donor not found');
    }
    return response.success(res, 200, 'Donor updated successfully', { user });
  } catch (error) {
    if (error.message === 'Email cannot be changed via the admin endpoint. Users must use the self-service profile flow.') {
      throw new HttpError(400, error.message);
    }
    throw error;
  }
});

/** PUT /admin/users/hospital/:id */
export const updateHospital = asyncHandler(async (req, res) => {
  try {
    const user = await adminService.updateHospital(req.params.id, req.body, req.user._id);
    if (!user) {
      throw new HttpError(404, 'Hospital not found');
    }
    return response.success(res, 200, 'Hospital updated successfully', { user });
  } catch (error) {
    if (error.message === 'Email cannot be changed via the admin endpoint. Users must use the self-service profile flow.') {
      throw new HttpError(400, error.message);
    }
    throw error;
  }
});

/** PUT /admin/users/admin/:id */
export const updateAdmin = asyncHandler(async (req, res) => {
  try {
    const user = await adminService.updateAdmin(req.params.id, req.body, req.user._id, req.user.role);
    if (!user) {
      throw new HttpError(404, 'Admin not found');
    }
    return response.success(res, 200, 'Admin updated successfully', { user });
  } catch (error) {
    if (error.message === 'Email cannot be changed via the admin endpoint. Users must use the self-service profile flow.') {
      throw new HttpError(400, error.message);
    }
    if (error.message === 'Role changes are not supported. The role field cannot be updated.') {
      throw new HttpError(400, error.message);
    }
    throw error;
  }
});

/** DELETE /admin/users/:id */
export const deleteUser = asyncHandler(async (req, res) => {
  try {
    const user = await adminService.softDeleteUser(req.params.id, req.user._id);
    if (!user) {
      throw new HttpError(404, 'User not found');
    }
    return response.success(res, 200, 'User deleted successfully');
  } catch (error) {
    if (error.message === ERR.ADMIN_CANNOT_DELETE) {
      throw new HttpError(403, error.message);
    }
    throw error;
  }
});


/** POST /admin/users/hospital */
export const createHospital = asyncHandler(async (req, res) => {
  try {
    const validation = validateCreateHospitalBody(req.body);
    if (!validation.valid) {
      throw new HttpError(400, validation.errors.join(', '));
    }

    const hospital = await adminService.createHospital(req.body, req.user._id);
    return response.success(res, 201, 'Hospital created successfully', { hospital });
  } catch (error) {
    if (error.message === ERR.ADMIN_EMAIL_EXISTS) {
      throw new HttpError(409, error.message);
    }
    throw error;
  }
});

export const banUser = asyncHandler(async (req, res) => {
  const validation = validateBanDonorBody(req.body);
  if (!validation.valid) {
    throw new HttpError(400, validation.errors.join(', '));
  }

  try {
    const user = await adminService.banUser(req.params.id, req.body.reason, req.user._id, req.user.role);
    if (!user) {
      throw new HttpError(404, 'User not found');
    }
    return response.success(res, 200, 'User banned successfully', { user });
  } catch (error) {
    if (error.message === 'User is already banned') {
      throw new HttpError(400, ERR.DONOR_ALREADY_BANNED);
    }
    if (error.message === 'Only superadmin can ban admin accounts') {
      throw new HttpError(403, error.message);
    }
    throw error;
  }
});

export const unbanUser = asyncHandler(async (req, res) => {
  try {
    const user = await adminService.unbanUser(req.params.id, req.user._id, req.user.role);
    if (!user) {
      throw new HttpError(404, 'User not found');
    }
    return response.success(res, 200, 'User unbanned successfully', { user });
  } catch (error) {
    if (error.message === 'User is not banned') {
      throw new HttpError(400, ERR.DONOR_NOT_BANNED);
    }
    if (error.message === 'Only superadmin can unban admin accounts') {
      throw new HttpError(403, error.message);
    }
    throw error;
  }
});

export const createAdmin = asyncHandler(async (req, res) => {
  try {
    const validation = validateCreateAdminBody(req.body);
    if (!validation.valid) {
      throw new HttpError(400, validation.errors.join(', '));
    }

    const admin = await adminService.createAdmin(req.body, req.user._id);
    return response.success(res, 201, 'Admin created successfully', { admin });
  } catch (error) {
    if (error.message === ERR.ADMIN_EMAIL_EXISTS) {
      throw new HttpError(409, error.message);
    }
    if (error.message === 'Only superadmin can create admin accounts') {
      throw new HttpError(403, error.message);
    }
    if (error.message.startsWith('Superadmin limit reached')) {
      throw new HttpError(400, error.message);
    }
    throw error;
  }
});

export const deleteAdmin = asyncHandler(async (req, res) => {
  try {
    const admin = await adminService.deleteAdmin(req.params.id, req.user._id, req.user.role);
    if (!admin) {
      throw new HttpError(404, 'Admin not found');
    }
    return response.success(res, 200, 'Admin deleted successfully');
  } catch (error) {
    if (error.message === 'Cannot delete your own account') {
      throw new HttpError(403, ERR.ADMIN_CANNOT_DELETE_SELF);
    }
    throw error;
  }
});

export const rotateAdminKey = asyncHandler(async (req, res) => {
  const result = await adminService.rotateAdminKey(req.params.id, req.user._id, req.user.role);
  if (!result) {
    throw new HttpError(404, 'Admin not found');
  }
  return response.success(res, 200, 'Admin key rotated successfully. The new key is shown only once — store it securely.', {
    admin: result.admin,
    adminKey: result.plaintextKey,
  });
});

export const listRolePermissions = asyncHandler(async (req, res) => {
  const roles = await adminService.listRolePermissions();
  return response.success(res, 200, 'Roles retrieved successfully', { roles });
});

export const getRolePermissionDetails = asyncHandler(async (req, res) => {
  const role = await adminService.getRolePermissionDetails(req.params.role);
  if (!role) {
    throw new HttpError(404, ERR.ADMIN_ROLE_NOT_FOUND);
  }
  return response.success(res, 200, 'Role retrieved successfully', { role });
});

export const createRolePermission = asyncHandler(async (req, res) => {
  try {
    const { role, displayName, description, isSystemRole, permissions } = req.body;
    if (!role || !displayName) {
      throw new HttpError(400, 'role and displayName are required');
    }

    const created = await adminService.createRolePermission({ role, displayName, description, isSystemRole, permissions }, req.user._id);
    return response.success(res, 201, 'Role created successfully', { role: created });
  } catch (error) {
    if (error.message === 'Cannot modify a system role') {
      throw new HttpError(403, ERR.ADMIN_ROLE_IS_SYSTEM);
    }
    if (error.message === 'Role already exists') {
      throw new HttpError(409, ERR.ADMIN_ROLE_ALREADY_EXISTS);
    }
    throw error;
  }
});

export const updateRolePermissions = asyncHandler(async (req, res) => {
  try {
    const updated = await adminService.updateRolePermissions(req.params.role, req.body, req.user._id);
    if (!updated) {
      throw new HttpError(404, ERR.ADMIN_ROLE_NOT_FOUND);
    }
    return response.success(res, 200, 'Role permissions updated successfully', { role: updated });
  } catch (error) {
    if (error.message === 'Cannot modify a system role') {
      throw new HttpError(403, ERR.ADMIN_ROLE_IS_SYSTEM);
    }
    throw error;
  }
});

export const deleteRolePermission = asyncHandler(async (req, res) => {
  try {
    const deleted = await adminService.deleteRolePermission(req.params.role, req.user._id);
    if (!deleted) {
      throw new HttpError(404, ERR.ADMIN_ROLE_NOT_FOUND);
    }
    return response.success(res, 200, 'Role deleted successfully', { role: deleted });
  } catch (error) {
    if (error.message === 'Cannot delete a system role') {
      throw new HttpError(403, ERR.ADMIN_ROLE_IS_SYSTEM);
    }
    throw error;
  }
});

// ──────────────────────────────────────────────
//  Phase 3: Request Management
// ──────────────────────────────────────────────

/** GET /admin/requests */
export const listRequests = asyncHandler(async (req, res) => {
  const validation = validateListRequestsQuery(req.query);
  if (!validation.valid) {
    throw new HttpError(400, validation.errors.join(', '));
  }

  const { status, urgency, bloodType, hospitalId, type, page, limit } = req.query;
  const result = await adminService.listAllRequests(
    { status, urgency, bloodType, hospitalId, type },
    { page, limit }
  );
  return response.success(res, 200, 'Requests list', result);
});

/** GET /admin/requests/:id */
export const getRequestDetails = asyncHandler(async (req, res) => {
  const result = await adminService.getRequestDetails(req.params.id);
  if (!result) {
    throw new HttpError(404, 'Request not found');
  }
  return response.success(res, 200, 'Request details', result);
});

/** GET /admin/requests/:id/donations */
export const getRequestDonations = asyncHandler(async (req, res) => {
  const { page, limit } = req.query;
  const result = await adminService.getRequestDonations(req.params.id, { page, limit });
  return response.success(res, 200, 'Request donations', result);
});

/** PATCH /admin/requests/:id/fulfill */
export const fulfillRequest = asyncHandler(async (req, res) => {
  try {
    const request = await adminService.fulfillRequest(req.params.id, req.user._id);
    if (!request) {
      throw new HttpError(404, 'Request not found');
    }
    return response.success(res, 200, 'Request marked as fulfilled', { request });
  } catch (error) {
    if (error.message === ERR.REQUEST_ALREADY_FULFILLED) {
      throw new HttpError(400, error.message);
    }
    throw error;
  }
});

/** PATCH /admin/requests/:id/cancel */
export const cancelRequest = asyncHandler(async (req, res) => {
  try {
    const request = await adminService.cancelRequest(req.params.id, req.body.reason, req.user._id);
    if (!request) {
      throw new HttpError(404, 'Request not found');
    }
    return response.success(res, 200, 'Request cancelled', { request });
  } catch (error) {
    if (error.message === ERR.REQUEST_ALREADY_CANCELLED) {
      throw new HttpError(400, error.message);
    }
    throw error;
  }
});

/** POST /admin/requests/:id/broadcast */
export const broadcastRequest = asyncHandler(async (req, res) => {
  const result = await adminService.broadcastRequest(req.params.id, req.user._id);
  if (!result) {
    throw new HttpError(404, 'Request not found');
  }
  return response.success(res, 200, 'Broadcast sent', result);
});

// ──────────────────────────────────────────────
//  Phase 4: Analytics
// ──────────────────────────────────────────────

/** GET /admin/dashboard */
export const getDashboard = asyncHandler(async (req, res) => {
  const summary = await analyticsService.getDashboardSummary();
  return response.success(res, 200, 'Dashboard summary', summary);
});



// ──────────────────────────────────────────────
//  Phase 5: Emergency
// ──────────────────────────────────────────────

/** GET /admin/emergency/critical */
export const getCriticalRequests = asyncHandler(async (req, res) => {
  const requests = await adminService.getCriticalRequests();
  return response.success(res, 200, 'Critical requests', { requests });
});

/** GET /admin/emergency/shortage-alerts */
export const getShortageAlerts = asyncHandler(async (req, res) => {
  const alerts = await adminService.getShortageAlerts();
  return response.success(res, 200, 'Shortage alerts', { alerts });
});

// ──────────────────────────────────────────────
//  Rewards Management (Overview, Config, Adjust)
// ──────────────────────────────────────────────

export const getAdminRewards = asyncHandler(async (req, res) => {
  const { query, limit, adjustments: adjLimit } = req.query;
  const topLimit = parseInt(limit) || 5;
  const adjustmentsLimit = parseInt(adjLimit) || 20;

  const [pointsSummary, tiers, topRedeemed, catalog, adjustments, users] = await Promise.all([
    rewardService.adminGetPointsSummary(),
    rewardService.adminGetTierDistribution(),
    rewardService.adminGetTopRedeemed(topLimit),
    rewardService.adminGetRewardCatalog(),
    rewardService.adminGetPointsAdjustments(adjustmentsLimit),
    query && typeof query === 'string' && query.trim()
      ? rewardService.adminLookupUser(query.trim())
      : Promise.resolve([]),
  ]);

  return response.success(res, 200, 'Rewards data retrieved successfully', {
    totalPoints: pointsSummary.totalPoints,
    percentageChange: pointsSummary.percentageChange,
    tiers,
    topRedeemed,
    catalog,
    adjustments,
    ...(users.length > 0 ? { users } : {}),
  });
});

export const createReward = asyncHandler(async (req, res) => {
  const { rewardName, category, pointsRequired, status, rewardSubtitle } = req.body;

  if (!rewardName || !category || pointsRequired === undefined) {
    throw new HttpError(400, 'rewardName, category, and pointsRequired are required');
  }

  const data = await rewardService.adminCreateReward({
    rewardName,
    rewardSubtitle: rewardSubtitle || '',
    category,
    pointsRequired,
    status,
  });

  return response.success(res, 201, 'Reward created successfully', data);
});

export const updateRewardStatus = asyncHandler(async (req, res) => {
  const { rewardId } = req.params;
  const { status } = req.body;

  if (!status) {
    throw new HttpError(400, 'status is required');
  }

  if (!['ACTIVE', 'INACTIVE', 'LIMITED'].includes(status)) {
    throw new HttpError(400, 'Status must be ACTIVE, INACTIVE, or LIMITED');
  }

  const data = await rewardService.adminUpdateRewardStatus(rewardId, status, req.user._id);
  if (!data) throw new HttpError(404, 'Reward not found');

  return response.success(res, 200, 'Reward status updated successfully', {
    id: data._id,
    rewardName: data.name,
    status: data.status,
  });
});

export const bulkUpdateRewardPoints = asyncHandler(async (req, res) => {
  const { updates } = req.body;

  if (!Array.isArray(updates) || updates.length === 0) {
    throw new HttpError(400, 'updates array must have at least one entry');
  }

  for (const item of updates) {
    if (!item.id || typeof item.pointsRequired !== 'number') {
      throw new HttpError(400, 'Each update must have an id and pointsRequired number');
    }
  }

  const result = await rewardService.adminBulkUpdateRewardPoints(updates);
  return response.success(res, 200, 'Reward points updated successfully', { updated: result });
});

export const adjustUserPointsByEmail = asyncHandler(async (req, res) => {
  const { email, amount, reason } = req.body;

  if (!email || amount === undefined || !reason) {
    throw new HttpError(400, 'email, amount, and reason are required');
  }

  if (typeof amount !== 'number' || amount === 0) {
    throw new HttpError(400, 'amount must be a non-zero number');
  }

  const data = await rewardService.adminAdjustPointsByEmail(email, amount, reason, req.user._id);
  return response.success(res, 200, 'Points adjusted successfully', {
    email,
    newBalance: data.pointsBalance,
  });
});

/** GET /admin/rewards/earning-rules */
export const getRewardsEarningRules = asyncHandler(async (req, res) => {
  const config = await rewardsConfigService.getRewardsConfig();
  return response.success(res, 200, 'Rewards earning rules retrieved', config);
});

/** PUT /admin/rewards/earning-rules */
export const updateRewardsEarningRules = asyncHandler(async (req, res) => {
  const { points } = req.body;

  if (!points || typeof points !== 'object') {
    throw new HttpError(400, 'points object is required');
  }

  const allowedFields = [
    'bloodDonation', 'plasmaDonation', 'plateletsDonation',
    'doubleRedCellsDonation', 'emergencyResponse', 'profileCompletion',
    'referral', 'firstDonation',
  ];

  const unknownFields = Object.keys(points).filter(k => !allowedFields.includes(k));
  if (unknownFields.length > 0) {
    throw new HttpError(400, `Unknown point fields: ${unknownFields.join(', ')}`);
  }

  for (const [key, value] of Object.entries(points)) {
    if (typeof value !== 'number' || value < 0) {
      throw new HttpError(400, `${key} must be a non-negative number`);
    }
  }

  const config = await rewardsConfigService.updateRewardsConfig(
    { points },
    req.user._id
  );

  return response.success(res, 200, 'Rewards earning rules updated', config);
});

// ──────────────────────────────────────────────
//  Badges Management
// ──────────────────────────────────────────────

/** GET /admin/badges */
export const getBadges = asyncHandler(async (req, res) => {
  const badges = await Badge.find().sort({ sortOrder: 1 });
  return response.success(res, 200, 'Badges retrieved successfully', { badges });
});

/** PATCH /admin/badges/:id */
export const updateBadge = asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new HttpError(400, 'Invalid badge ID');
  }

  const { unlockThreshold, pointsReward, bonusPoints } = req.body;
  const update = {};

  if (unlockThreshold !== undefined) {
    if (typeof unlockThreshold !== 'number' || unlockThreshold < 1) {
      throw new HttpError(400, 'unlockThreshold must be a number greater than or equal to 1');
    }
    update.unlockThreshold = unlockThreshold;
  }

  // Support both pointsReward (model name) and bonusPoints (plan name)
  const pointsVal = pointsReward !== undefined ? pointsReward : bonusPoints;
  if (pointsVal !== undefined) {
    if (typeof pointsVal !== 'number' || pointsVal < 0) {
      throw new HttpError(400, 'pointsReward/bonusPoints must be a non-negative number');
    }
    update.pointsReward = pointsVal;
  }

  if (Object.keys(update).length === 0) {
    throw new HttpError(400, 'At least one field to update is required');
  }

  const badge = await Badge.findByIdAndUpdate(
    id,
    { $set: update },
    { new: true, runValidators: true }
  );

  if (!badge) {
    throw new HttpError(404, 'Badge not found');
  }

  await adminService.logBadgeUpdate(req.user?._id, badge._id, update);

  return response.success(res, 200, 'Badge updated successfully', { badge });
});
