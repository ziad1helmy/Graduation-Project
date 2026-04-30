import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import AuditLog from '../models/AuditLog.model.js';
import SystemSettings from '../models/SystemSettings.model.js';
import User from '../models/User.model.js';
import Donor from '../models/Donor.model.js';
import Hospital from '../models/Hospital.model.js';
import Request from '../models/Request.model.js';
import Donation from '../models/Donation.model.js';
import Notification from '../models/Notification.model.js';
import HospitalSettings from '../models/HospitalSettings.model.js';
import RolePermission from '../models/RolePermission.model.js';
import { env } from '../config/env.js';
import { invalidateMaintenanceCache } from '../middlewares/maintenance.middleware.js';

// ──────────────────────────────────────────────
//  Audit Logging
// ──────────────────────────────────────────────

/**
 * Create an audit log entry.
 * @param {string} adminId - Admin who performed the action
 * @param {string} action  - Action identifier (e.g. 'user.verify')
 * @param {string} [targetType] - Entity type affected
 * @param {string} [targetId]   - Entity ID affected
 */
export const logAudit = async (adminId, action, targetType = null, targetId = null) => {
  try {
    await AuditLog.create({ adminId, action, targetType, targetId });
  } catch (error) {
    // Audit logging should never break the main operation
    console.error('Audit log error:', error.message);
  }
};

/**
 * List audit logs with pagination and optional filters.
 */
export const getAuditLogs = async (filters = {}, pagination = {}) => {
  const { action, targetType, adminId } = filters;
  const { page = 1, limit = 20 } = pagination;
  const skip = (page - 1) * limit;

  const query = {};
  if (action) query.action = action;
  if (targetType) query.targetType = targetType;
  if (adminId) query.adminId = adminId;

  const [logs, total] = await Promise.all([
    AuditLog.find(query)
      .populate('adminId', 'fullName email role')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit)),
    AuditLog.countDocuments(query),
  ]);

  return { logs, total, page: parseInt(page), limit: parseInt(limit) };
};

// ──────────────────────────────────────────────
//  System Health
// ──────────────────────────────────────────────

/**
 * Basic system health check.
 */
export const getSystemHealth = async () => {
  const dbState = mongoose.connection.readyState;
  const dbStates = { 0: 'disconnected', 1: 'connected', 2: 'connecting', 3: 'disconnecting' };

  return {
    status: dbState === 1 ? 'healthy' : 'degraded',
    uptime: process.uptime(),
    database: dbStates[dbState] || 'unknown',
    memory: {
      used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + ' MB',
      total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024) + ' MB',
    },
    timestamp: new Date(),
  };
};

// ──────────────────────────────────────────────
//  Maintenance Mode
// ──────────────────────────────────────────────

/**
 * Toggle maintenance mode.
 */
export const setMaintenanceMode = async (enabled, message, adminId) => {
  await SystemSettings.findOneAndUpdate(
    { key: 'maintenance_mode' },
    { value: enabled, updatedBy: adminId },
    { upsert: true, new: true }
  );

  if (message !== undefined) {
    await SystemSettings.findOneAndUpdate(
      { key: 'maintenance_message' },
      { value: message, updatedBy: adminId },
      { upsert: true, new: true }
    );
  }

  await logAudit(adminId, 'system.maintenance', 'System', null);

  // Immediately invalidate the in-memory cache so the change takes effect now
  invalidateMaintenanceCache();

  return { maintenanceMode: enabled, message: message || '' };
};

/**
 * Get current maintenance mode status.
 */
export const getMaintenanceStatus = async () => {
  const mode = await SystemSettings.findOne({ key: 'maintenance_mode' });
  const msg = await SystemSettings.findOne({ key: 'maintenance_message' });

  return {
    enabled: mode?.value || false,
    message: msg?.value || '',
  };
};

// ──────────────────────────────────────────────
//  Settings Seed
// ──────────────────────────────────────────────

const DEFAULT_SETTINGS = [
  { key: 'maintenance_mode', value: false },
  { key: 'maintenance_message', value: '' },
];

/**
 * Seed default system settings on startup (no-op if already exist).
 */
export const seedDefaultSettings = async () => {
  for (const setting of DEFAULT_SETTINGS) {
    await SystemSettings.findOneAndUpdate(
      { key: setting.key },
      { $setOnInsert: { value: setting.value } },
      { upsert: true }
    );
  }
};

// ──────────────────────────────────────────────
//  User Management (Phase 2)
// ──────────────────────────────────────────────

/**
 * List all users with filters and pagination.
 */
export const listUsers = async (filters = {}, pagination = {}) => {
  const { role, verified, suspended, search } = filters;
  const { page = 1, limit = 20 } = pagination;
  const skip = (page - 1) * limit;

  const query = { deletedAt: null };

  if (role) query.role = role;
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
      .limit(parseInt(limit)),
    User.countDocuments(query),
  ]);

  return { users, total, page: parseInt(page), limit: parseInt(limit) };
};

/**
 * Get a single user by ID with role-specific fields.
 */
export const getUserById = async (id) => {
  const user = await User.findOne({ _id: id, deletedAt: null })
    .select('-password -emailVerificationToken -emailVerificationExpires -resetPasswordToken -resetPasswordExpires -passwordChangedAt');

  if (!user) return null;

  // For donors, also get donation stats
  if (user.role === 'donor') {
    const donationCount = await Donation.countDocuments({ donorId: id, status: 'completed' });
    return { ...user.toObject(), completedDonations: donationCount };
  }

  // For hospitals, also get request stats
  if (user.role === 'hospital') {
    const requestCount = await Request.countDocuments({ hospitalId: id });
    return { ...user.toObject(), totalRequests: requestCount };
  }

  return user;
};

/**
 * Get user statistics (counts by role, verified, suspended).
 */
export const getUserStats = async () => {
  const [
    totalUsers,
    totalDonors,
    totalHospitals,
    totalAdmins,
    verifiedUsers,
    suspendedUsers,
  ] = await Promise.all([
    User.countDocuments({ deletedAt: null }),
    User.countDocuments({ role: 'donor', deletedAt: null }),
    User.countDocuments({ role: 'hospital', deletedAt: null }),
    User.countDocuments({ role: { $in: ['admin', 'superadmin'] }, deletedAt: null }),
    User.countDocuments({ isEmailVerified: true, deletedAt: null }),
    User.countDocuments({ isSuspended: true, deletedAt: null }),
  ]);

  return {
    totalUsers,
    totalDonors,
    totalHospitals,
    totalAdmins,
    verifiedUsers,
    unverifiedUsers: totalUsers - verifiedUsers,
    suspendedUsers,
  };
};

/**
 * Verify or unverify a user's email.
 */
export const verifyUser = async (id, adminId) => {
  const user = await User.findOne({ _id: id, deletedAt: null });
  if (!user) return null;

  user.isEmailVerified = true;
  user.emailVerifiedAt = new Date();
  await user.save({ validateBeforeSave: false });

  await logAudit(adminId, 'user.verify', 'User', id);
  return user;
};

export const unverifyUser = async (id, adminId) => {
  const user = await User.findOne({ _id: id, deletedAt: null });
  if (!user) return null;

  user.isEmailVerified = false;
  user.emailVerifiedAt = null;
  await user.save({ validateBeforeSave: false });

  await logAudit(adminId, 'user.unverify', 'User', id);
  return user;
};

/**
 * Suspend a user account.
 */
export const suspendUser = async (id, reason, adminId) => {
  const user = await User.findOne({ _id: id, deletedAt: null });
  if (!user) return null;

  // Prevent suspending admins/superadmins unless you are superadmin
  if (user.role === 'admin' || user.role === 'superadmin') {
    throw new Error('Cannot suspend admin accounts');
  }

  user.isSuspended = true;
  user.suspendedAt = new Date();
  user.suspendedReason = reason;
  await user.save({ validateBeforeSave: false });

  await logAudit(adminId, 'user.suspend', 'User', id);
  return user;
};

/**
 * Unsuspend a user account.
 */
export const unsuspendUser = async (id, adminId) => {
  const user = await User.findOne({ _id: id, deletedAt: null });
  if (!user) return null;

  user.isSuspended = false;
  user.suspendedAt = null;
  user.suspendedReason = null;
  await user.save({ validateBeforeSave: false });

  await logAudit(adminId, 'user.unsuspend', 'User', id);
  return user;
};

/**
 * Soft-delete a user account.
 */
export const softDeleteUser = async (id, adminId) => {
  const user = await User.findOne({ _id: id, deletedAt: null });
  if (!user) return null;

  if (user.role === 'admin' || user.role === 'superadmin') {
    throw new Error('Cannot delete admin accounts');
  }

  user.deletedAt = new Date();
  user.isSuspended = true;
  await user.save({ validateBeforeSave: false });

  await logAudit(adminId, 'user.delete', 'User', id);
  return user;
};

/**
 * Create a new hospital account (admin-created, pre-verified).
 */
export const createHospital = async (data, adminId) => {
  const existing = await User.findOne({ email: data.email });
  if (existing) {
    throw new Error('Email already registered');
  }

  const hospital = await Hospital.create({
    fullName: data.fullName,
    email: data.email,
    password: data.password, // hashed by pre-save hook
    role: 'hospital',
    isEmailVerified: true,
    emailVerifiedAt: new Date(),
    hospitalName: data.hospitalName,
    hospitalId: data.hospitalId,
    licenseNumber: data.licenseNumber,
    address: data.address || {},
    contactNumber: data.contactNumber || '',
  });

  await logAudit(adminId, 'user.create_hospital', 'User', hospital._id);
  return hospital;
};

export const updateDonor = async (donorId, data, adminId) => {
  const donor = await Donor.findOne({ _id: donorId, deletedAt: null });
  if (!donor) return null;

  const updateData = {};
  const allowedFields = ['fullName', 'email', 'phoneNumber', 'bloodType', 'gender', 'dateOfBirth', 'location', 'isAvailable'];
  for (const field of allowedFields) {
    if (data[field] !== undefined) updateData[field] = data[field];
  }

  if (updateData.email) {
    const existing = await User.findOne({ email: updateData.email, _id: { $ne: donorId } });
    if (existing) {
      throw new Error('Email already registered');
    }
  }

  const updated = await Donor.findByIdAndUpdate(donorId, updateData, { new: true, runValidators: true });
  await logAudit(adminId, 'user.update_donor', 'User', donorId);
  return updated;
};

export const banDonor = async (donorId, reason, adminId) => {
  const donor = await Donor.findOne({ _id: donorId, deletedAt: null });
  if (!donor) return null;
  if (donor.isSuspended) throw new Error('Donor is already banned');

  donor.isSuspended = true;
  donor.suspendedAt = new Date();
  donor.suspendedReason = reason || 'Banned by admin';
  await donor.save({ validateBeforeSave: false });

  await logAudit(adminId, 'user.ban_donor', 'User', donorId);
  return donor;
};

export const unbanDonor = async (donorId, adminId) => {
  const donor = await Donor.findOne({ _id: donorId, deletedAt: null });
  if (!donor) return null;
  if (!donor.isSuspended) throw new Error('Donor is not banned');

  donor.isSuspended = false;
  donor.suspendedAt = null;
  donor.suspendedReason = null;
  await donor.save({ validateBeforeSave: false });

  await logAudit(adminId, 'user.unban_donor', 'User', donorId);
  return donor;
};

export const updateHospitalStatus = async (hospitalId, action, reason, adminId) => {
  const hospital = await Hospital.findOne({ _id: hospitalId, deletedAt: null });
  if (!hospital) return null;

  if (action === 'suspend') {
    hospital.isSuspended = true;
    hospital.suspendedAt = new Date();
    hospital.suspendedReason = reason || 'Suspended by admin';
  } else if (action === 'unsuspend') {
    hospital.isSuspended = false;
    hospital.suspendedAt = null;
    hospital.suspendedReason = null;
  } else {
    throw new Error('Invalid hospital status action');
  }

  await hospital.save({ validateBeforeSave: false });
  await logAudit(adminId, `user.${action}_hospital`, 'User', hospitalId);
  return hospital;
};

export const createAdmin = async (data, adminId) => {
  const existing = await User.findOne({ email: data.email });
  if (existing) {
    throw new Error('Email already registered');
  }

  const role = (data.role || 'admin').toLowerCase();
  if (!['admin', 'superadmin'].includes(role)) {
    throw new Error('Invalid admin role');
  }

  const admin = await User.create({
    fullName: data.fullName,
    email: data.email,
    password: data.password,
    role,
    isEmailVerified: true,
    emailVerifiedAt: new Date(),
    location: data.location || {},
  });

  await logAudit(adminId, 'user.create_admin', 'User', admin._id);
  return admin;
};

export const updateAdmin = async (id, data, adminId) => {
  const existing = await User.findOne({ _id: id, deletedAt: null });
  if (!existing) return null;
  if (!['admin', 'superadmin'].includes(existing.role)) return null;

  if (data.email && data.email !== existing.email) {
    const dup = await User.findOne({ email: data.email, _id: { $ne: id } });
    if (dup) throw new Error('Email already registered');
  }

  if (data.role && !['admin', 'superadmin'].includes(data.role)) {
    throw new Error('Invalid admin role');
  }

  const updateData = {};
  const allowedFields = ['fullName', 'email', 'role', 'location', 'isEmailVerified', 'isSuspended'];
  for (const field of allowedFields) {
    if (data[field] !== undefined) updateData[field] = data[field];
  }

  if (data.password) updateData.password = data.password;
  if (data.isEmailVerified !== undefined && data.isEmailVerified) updateData.emailVerifiedAt = new Date();
  if (data.isSuspended !== undefined && !data.isSuspended) {
    updateData.suspendedAt = null;
    updateData.suspendedReason = null;
  }

  const admin = await User.findById(id);
  if (!admin) return null;
  Object.assign(admin, updateData);
  await admin.save();

  await logAudit(adminId, 'user.update_admin', 'User', id);
  return admin;
};

export const deleteAdmin = async (id, adminId) => {
  const admin = await User.findOne({ _id: id, deletedAt: null });
  if (!admin) return null;
  if (!['admin', 'superadmin'].includes(admin.role)) return null;
  if (admin._id.toString() === adminId?.toString()) {
    throw new Error('Cannot delete your own account');
  }

  admin.deletedAt = new Date();
  admin.isSuspended = true;
  await admin.save({ validateBeforeSave: false });

  await logAudit(adminId, 'user.delete_admin', 'User', id);
  return admin;
};

const DEFAULT_ROLE_PERMISSIONS = [
  {
    role: 'admin',
    displayName: 'Administrator',
    description: 'Standard administrative access for operations and moderation.',
    isSystemRole: true,
    permissions: {
      donor_management: { view: true, manage: true, ban: true },
      hospital_management: { view: true, manage: true, suspend: true },
      admin_management: { view: true, create: false, delete: false },
      system_settings: { view: true, manage: true },
      audit_logging: { view: true, export: false },
      reporting: { view: true, export: true },
    },
  },
  {
    role: 'superadmin',
    displayName: 'Super Administrator',
    description: 'Full system access including admin and permission management.',
    isSystemRole: true,
    permissions: {
      donor_management: { view: true, manage: true, ban: true },
      hospital_management: { view: true, manage: true, suspend: true },
      admin_management: { view: true, create: true, delete: true },
      system_settings: { view: true, manage: true },
      audit_logging: { view: true, export: true },
      reporting: { view: true, export: true },
    },
  },
];

export const seedDefaultRolePermissions = async () => {
  for (const rolePermission of DEFAULT_ROLE_PERMISSIONS) {
    await RolePermission.findOneAndUpdate(
      { role: rolePermission.role },
      { $setOnInsert: rolePermission },
      { upsert: true, new: true }
    );
  }
};

export const listRolePermissions = async () => {
  return RolePermission.find().sort({ createdAt: 1 });
};

export const getRolePermissionDetails = async (role) => {
  return RolePermission.findOne({ role: role.toLowerCase() });
};

export const createRolePermission = async (data, adminId) => {
  const normalizedRole = String(data.role || '').toLowerCase();
  if (['admin', 'superadmin'].includes(normalizedRole)) {
    throw new Error('Cannot modify a system role');
  }

  const existing = await RolePermission.findOne({ role: normalizedRole });
  if (existing) {
    throw new Error('Role already exists');
  }

  const rolePermission = await RolePermission.create({
    role: data.role,
    displayName: data.displayName,
    description: data.description || '',
    isSystemRole: Boolean(data.isSystemRole),
    permissions: data.permissions || {},
    updatedBy: adminId,
  });

  await logAudit(adminId, 'permissions.create_role', 'RolePermission', rolePermission._id);
  return rolePermission;
};

export const updateRolePermissions = async (role, data, adminId) => {
  const normalizedRole = String(role || '').toLowerCase();
  if (['admin', 'superadmin'].includes(normalizedRole)) {
    throw new Error('Cannot modify a system role');
  }

  const rolePermission = await RolePermission.findOne({ role: normalizedRole });
  if (!rolePermission) return null;
  if (rolePermission.isSystemRole || ['admin', 'superadmin'].includes(rolePermission.role)) {
    throw new Error('Cannot modify a system role');
  }

  const updateData = {};
  const allowedFields = ['displayName', 'description', 'permissions'];
  for (const field of allowedFields) {
    if (data[field] !== undefined) updateData[field] = data[field];
  }
  updateData.updatedBy = adminId;

  const updated = await RolePermission.findOneAndUpdate(
    { role: normalizedRole },
    { $set: updateData },
    { new: true, runValidators: true }
  );

  await logAudit(adminId, 'permissions.update_role', 'RolePermission', updated._id);
  return updated;
};

// ──────────────────────────────────────────────
//  Request Management (Phase 3)
// ──────────────────────────────────────────────

/**
 * List all blood/organ requests with filters and pagination.
 */
export const listAllRequests = async (filters = {}, pagination = {}) => {
  const { status, urgency, bloodType, hospitalId, type } = filters;
  const { page = 1, limit = 20 } = pagination;
  const skip = (page - 1) * limit;

  const query = {};
  if (status) query.status = status;
  if (urgency) query.urgency = urgency;
  if (bloodType) query.bloodType = bloodType;
  if (hospitalId) query.hospitalId = hospitalId;
  if (type) query.type = type;

  const [requests, total] = await Promise.all([
    Request.find(query)
      .populate('hospitalId', 'fullName email hospitalName address contactNumber')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit)),
    Request.countDocuments(query),
  ]);

  return { requests, total, page: parseInt(page), limit: parseInt(limit) };
};

/**
 * Get request statistics (by status, urgency, blood type).
 */
export const getRequestStats = async (hospitalId = null) => {
  const baseMatch = hospitalId ? { hospitalId } : {};
  const activeMatch = { ...baseMatch, status: { $in: ['pending', 'in-progress'] } };

  const [byStatus, byUrgency, byBloodType, total] = await Promise.all([
    Request.aggregate([
      { $match: baseMatch },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]),
    Request.aggregate([
      { $match: activeMatch },
      { $group: { _id: '$urgency', count: { $sum: 1 } } },
    ]),
    Request.aggregate([
      { $match: { ...activeMatch, type: 'blood' } },
      { $group: { _id: '$bloodType', count: { $sum: 1 } } },
    ]),
    Request.countDocuments(baseMatch),
  ]);

  return {
    total,
    byStatus: byStatus.reduce((acc, i) => ({ ...acc, [i._id]: i.count }), {}),
    byUrgency: byUrgency.reduce((acc, i) => ({ ...acc, [i._id]: i.count }), {}),
    byBloodType: byBloodType.reduce((acc, i) => ({ ...acc, [i._id]: i.count }), {}),
  };
};

const BLOOD_TYPES = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

const buildBloodInventoryMap = () => BLOOD_TYPES.reduce((acc, bloodType) => {
  acc[bloodType] = {
    bloodType,
    donatedUnits: 0,
    requestedUnits: 0,
    netUnits: 0,
    shortageUnits: 0,
    shortage: false,
    lowStock: false,
  };
  return acc;
}, {});

const getThresholdForBloodType = (thresholds = {}, bloodType, fallback = 2) => {
  if (thresholds && typeof thresholds === 'object') {
    const value = thresholds[bloodType] ?? thresholds.default;
    if (Number.isFinite(Number(value))) return Number(value);
  }

  return fallback;
};

export const getBloodInventorySummary = async (hospitalId = null) => {
  const [requests, completedDonations, settings, requestStats, shortageAlerts] = await Promise.all([
    Request.find({
      type: 'blood',
      ...(hospitalId ? { hospitalId } : {}),
      status: { $in: ['pending', 'in-progress'] },
    }).select('bloodType quantity hospitalId status'),
    Donation.find({ status: 'completed' })
      .populate({
        path: 'requestId',
        select: 'bloodType type hospitalId',
      })
      .select('quantity requestId'),
    hospitalId ? HospitalSettings.findOne({ hospitalId }) : Promise.resolve(null),
    getRequestStats(hospitalId),
    getShortageAlerts(hospitalId),
  ]);

  const inventory = buildBloodInventoryMap();

  for (const request of requests) {
    if (!request.bloodType || !inventory[request.bloodType]) continue;
    inventory[request.bloodType].requestedUnits += Number(request.quantity || 1);
  }

  for (const donation of completedDonations) {
    const request = donation.requestId;
    if (!request || request.type !== 'blood' || !request.bloodType || !inventory[request.bloodType]) continue;
    if (hospitalId && request.hospitalId?.toString?.() !== hospitalId.toString()) continue;
    inventory[request.bloodType].donatedUnits += Number(donation.quantity || 1);
  }

  for (const bloodType of BLOOD_TYPES) {
    const entry = inventory[bloodType];
    entry.netUnits = entry.donatedUnits - entry.requestedUnits;
    entry.shortageUnits = Math.max(0, entry.requestedUnits - entry.donatedUnits);
    entry.shortage = entry.shortageUnits > 0;

    const lowThreshold = hospitalId
      ? getThresholdForBloodType(settings?.bloodBankSettings?.lowThreshold, bloodType, 2)
      : 2;

    entry.lowStock = entry.netUnits <= lowThreshold;
  }

  const lowStockAlerts = BLOOD_TYPES
    .map((bloodType) => inventory[bloodType])
    .filter((entry) => entry.lowStock || entry.shortage)
    .map((entry) => ({
      bloodType: entry.bloodType,
      message: entry.shortage
        ? `Shortage detected for ${entry.bloodType}: ${entry.shortageUnits} unit(s) needed`
        : `${entry.bloodType} stock is low with ${entry.netUnits} net unit(s)`,
      severity: entry.shortage ? 'high' : 'medium',
    }));

  return {
    scope: hospitalId ? 'hospital' : 'system',
    hospitalId: hospitalId || null,
    bloodTypeTotals: inventory,
    lowStockAlerts,
    shortageAlerts,
    requestStats,
  };
};

/**
 * Get full request details with associated donations.
 */
export const getRequestDetails = async (id) => {
  const request = await Request.findById(id)
    .populate('hospitalId', 'fullName email hospitalName address contactNumber');

  if (!request) return null;

  const donations = await Donation.find({ requestId: id })
    .populate('donorId', 'fullName email phoneNumber bloodType location')
    .sort({ createdAt: -1 });

  return { request, donations };
};

/**
 * Get paginated donations for a request.
 */
export const getRequestDonations = async (id, pagination = {}) => {
  const { page = 1, limit = 20 } = pagination;
  const skip = (page - 1) * limit;

  const [donations, total] = await Promise.all([
    Donation.find({ requestId: id })
      .populate('donorId', 'fullName email phoneNumber bloodType location')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit)),
    Donation.countDocuments({ requestId: id }),
  ]);

  return { donations, total, page: parseInt(page), limit: parseInt(limit) };
};

/**
 * Mark a request as fulfilled.
 */
export const fulfillRequest = async (id, adminId) => {
  const request = await Request.findById(id);
  if (!request) return null;

  if (request.status === 'completed') {
    throw new Error('Request is already fulfilled');
  }

  request.status = 'completed';
  await request.save({ validateBeforeSave: false });

  await logAudit(adminId, 'request.fulfill', 'Request', id);
  return request;
};

/**
 * Cancel a request.
 */
export const cancelRequest = async (id, reason, adminId) => {
  const request = await Request.findById(id);
  if (!request) return null;

  if (request.status === 'cancelled') {
    throw new Error('Request is already cancelled');
  }

  request.status = 'cancelled';
  if (reason) request.notes = (request.notes ? request.notes + '\n' : '') + `[Admin cancelled]: ${reason}`;
  await request.save({ validateBeforeSave: false });

  await logAudit(adminId, 'request.cancel', 'Request', id);
  return request;
};

/**
 * Broadcast a request to eligible donors (by blood type + governorate).
 * Creates in-app notifications for matched donors.
 */
export const broadcastRequest = async (id, adminId) => {
  const request = await Request.findById(id)
    .populate('hospitalId', 'fullName hospitalName location');
  if (!request) return null;

  // Build donor query: available, verified, not suspended, matching blood type
  const donorQuery = {
    role: 'donor',
    isAvailable: true,
    isEmailVerified: true,
    isSuspended: false,
    deletedAt: null,
  };

  // Match blood type for blood requests
  if (request.type === 'blood' && request.bloodType) {
    donorQuery.bloodType = request.bloodType;
  }

  // Match governorate if hospital has location
  const hospitalLocation = request.hospitalId?.location;
  if (hospitalLocation?.governorate) {
    donorQuery['location.governorate'] = hospitalLocation.governorate;
  }

  const donors = await Donor.find(donorQuery).select('_id fullName');

  // Create in-app notifications for all matched donors
  if (donors.length > 0) {
    const notifications = donors.map((donor) => ({
      userId: donor._id,
      type: 'request',
      title: 'Urgent Blood Request',
      message: `${request.hospitalId?.hospitalName || 'A hospital'} needs ${request.bloodType || request.organType} donors urgently. ${request.urgency} priority.`,
      relatedId: request._id,
      relatedType: 'Request',
      data: {
        requestId: request._id,
        requestType: request.type,
        urgency: request.urgency,
        bloodType: request.bloodType,
      },
    }));

    await Notification.insertMany(notifications);
  }

  await logAudit(adminId, 'request.broadcast', 'Request', id);

  return {
    donorsNotified: donors.length,
    governorate: hospitalLocation?.governorate || 'all',
    bloodType: request.bloodType || 'all',
  };
};

// ──────────────────────────────────────────────
//  Emergency Management (Phase 5)
// ──────────────────────────────────────────────

/**
 * Send emergency broadcast to donors by governorate and blood type.
 */
export const sendEmergencyBroadcast = async (data, adminId) => {
  const { governorate, city, bloodTypes, title, message } = data;

  const donorQuery = {
    role: 'donor',
    isAvailable: true,
    isEmailVerified: true,
    isSuspended: false,
    deletedAt: null,
  };

  if (governorate) donorQuery['location.governorate'] = governorate;
  if (city) donorQuery['location.city'] = city;
  if (bloodTypes && bloodTypes.length > 0) donorQuery.bloodType = { $in: bloodTypes };

  const donors = await Donor.find(donorQuery).select('_id fullName fcmTokens');

  // Create in-app notifications
  if (donors.length > 0) {
    const notifications = donors.map((donor) => ({
      userId: donor._id,
      type: 'emergency',
      title: title || 'Emergency Blood Request',
      message: message || 'An emergency blood request has been issued in your area.',
      data: { governorate, city, bloodTypes },
    }));

    await Notification.insertMany(notifications);
  }

  await logAudit(adminId, 'emergency.broadcast', 'System', null);

  // Collect FCM tokens for push notifications (handled by fcm.js utility)
  const fcmTokens = donors.flatMap((d) => d.fcmTokens || []).filter(Boolean);

  return {
    donorsNotified: donors.length,
    fcmTokens, // caller can pass these to fcm.sendToMultiple()
    governorate: governorate || 'all',
    city: city || 'all',
  };
};

/**
 * Get all critical/high urgency active requests.
 */
export const getCriticalRequests = async () => {
  const requests = await Request.find({
    urgency: { $in: ['critical', 'high'] },
    status: { $in: ['pending', 'in-progress'] },
  })
    .populate('hospitalId', 'fullName hospitalName location contactNumber')
    .sort({ urgency: 1, createdAt: -1 }); // critical first

  return requests;
};

/**
 * Get blood shortage alerts: blood types where demand exceeds supply.
 */
export const getShortageAlerts = async (hospitalId = null) => {
  const bloodTypes = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
  const requestFilter = {
    type: 'blood',
    status: { $in: ['pending', 'in-progress'] },
    ...(hospitalId ? { hospitalId } : {}),
  };

  const alerts = await Promise.all(
    bloodTypes.map(async (bt) => {
      const [demand, supply] = await Promise.all([
        Request.countDocuments({ ...requestFilter, bloodType: bt }),
        Donor.countDocuments({
          bloodType: bt,
          isAvailable: true,
          isSuspended: false,
          deletedAt: null,
        }),
      ]);

      return {
        bloodType: bt,
        activeRequests: demand,
        availableDonors: supply,
        ratio: supply > 0 ? (demand / supply).toFixed(2) : demand > 0 ? 'critical' : '0.00',
        status: demand === 0 ? 'ok' : supply === 0 ? 'critical' : demand > supply ? 'shortage' : 'ok',
      };
    })
  );

  return alerts.sort((a, b) => {
    const priority = { critical: 0, shortage: 1, ok: 2 };
    return (priority[a.status] ?? 2) - (priority[b.status] ?? 2);
  });
};
