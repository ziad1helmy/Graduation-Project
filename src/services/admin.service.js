import mongoose from 'mongoose';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import * as jwt from '../utils/jwt.js';
import { logger } from '../utils/logger.js';
import { sendEmailVerificationEmail } from '../utils/mailer.js';
import { logAudit } from './audit.service.js';
export { logAudit } from './audit.service.js';
import AuditLog from '../models/AuditLog.model.js';
import { canDonate } from './eligibility.service.js';
import SystemSettings from '../models/SystemSettings.model.js';
import User from '../models/User.model.js';
import Donor from '../models/Donor.model.js';
import DonorPoints from '../models/DonorPoints.model.js';
import Hospital from '../models/Hospital.model.js';
import Request from '../models/Request.model.js';
import Donation from '../models/Donation.model.js';
import Notification from '../models/Notification.model.js';
import HospitalSettings from '../models/HospitalSettings.model.js';
import SupportMessage from '../models/SupportMessage.model.js';
import RolePermission from '../models/RolePermission.model.js';
import * as hospitalService from './hospital.service.js';
import * as appointmentService from './appointment.service.js';
import { sendToMultiple } from '../utils/fcm.js';
import { ERR } from '../utils/errorCodes.js';
import { env } from '../config/env.js';
import { invalidateMaintenanceCache } from '../middlewares/maintenance.middleware.js';
import { buildRequestPayload } from '../controllers/request.controller.js';
import { validateTransition } from '../utils/state-machine.js';
import { extractFirstBloodType } from '../utils/blood-type.js';
import { parsePagination } from '../utils/pagination.js';

/**
 * List audit logs with pagination and optional filters.
 */
export const getAuditLogs = async (filters = {}, pagination = {}) => {
  const { action, targetType, adminId } = filters;
  const { offset, limit, page } = parsePagination(pagination, 20);

  const query = {};
  if (action) query.action = action;
  if (targetType) query.targetType = targetType;
  if (adminId) query.adminId = adminId;

  const [logs, total] = await Promise.all([
    AuditLog.find(query)
      .populate('adminId', 'fullName email role')
      .sort({ createdAt: -1 })
      .skip(offset)
      .limit(limit),
    AuditLog.countDocuments(query),
  ]);

  return { logs, total, page: parseInt(page), limit: parseInt(limit) };
};

const toPlain = (value) => {
  if (!value) return {};
  if (typeof value.toObject === 'function') return value.toObject();
  return { ...value };
};

const buildEligibilitySummary = async (donor) => {
  if (!donor) return null;

  const result = await canDonate(donor, { persistTravelDeferral: false });
  return {
    eligible: Boolean(result.eligible),
    reason: result.reason || null,
    nextEligibleDate: result.nextEligibleDate ? new Date(result.nextEligibleDate).toISOString() : null,
  };
};

const enrichDonorUsers = async (users = []) => {
  if (!Array.isArray(users) || users.length === 0) return users;

  const donorUsers = users.filter((user) => user?.role === 'donor');
  if (donorUsers.length === 0) return users;

  const donorIds = donorUsers.map((user) => user._id);
  const pointsAccounts = await DonorPoints.find({ donorId: { $in: donorIds } }).lean();
  const pointsMap = new Map(pointsAccounts.map((account) => [String(account.donorId), account]));

  const enrichedDonors = await Promise.all(donorUsers.map(async (donor) => {
    const donorId = String(donor._id);
    const pointsAccount = pointsMap.get(donorId);
    const donorObject = toPlain(donor);

    return {
      ...donorObject,
      pointsBalance: pointsAccount?.pointsBalance ?? 0,
      lifetimePointsEarned: pointsAccount?.lifetimePointsEarned ?? 0,
      tier: pointsAccount?.tier || DonorPoints.calculateTier(pointsAccount?.lifetimePointsEarned ?? 0),
      eligibilitySummary: await buildEligibilitySummary(donorObject),
    };
  }));

  const enrichedMap = new Map(enrichedDonors.map((donor) => [String(donor._id), donor]));

  return users.map((user) => (user?.role === 'donor' ? enrichedMap.get(String(user._id)) || toPlain(user) : toPlain(user)));
};

const buildRequestTimeline = (request) => {
  if (!request) return [];

  const source = toPlain(request);
  const timeline = [];

  if (source.createdAt) {
    timeline.push({
      event: 'REQUEST_CREATED',
      timestamp: source.createdAt,
      actorType: 'system',
      actorId: null,
      metadata: {
        status: source.status,
        urgency: source.urgency,
      },
    });
  }

  if (source.acceptedAt) {
    timeline.push({
      event: 'REQUEST_ACCEPTED',
      timestamp: source.acceptedAt,
      actorType: 'donor',
      actorId: source.acceptedBy || null,
      metadata: {
        acceptedByName: source.acceptedByName || null,
        acceptedByBloodType: source.acceptedByBloodType || null,
        acceptedDonationId: source.acceptedDonationId || null,
      },
    });
  }

  if (source.completedAt) {
    timeline.push({
      event: 'REQUEST_COMPLETED',
      timestamp: source.completedAt,
      actorType: 'system',
      actorId: null,
      metadata: {
        acceptedDonationId: source.acceptedDonationId || null,
      },
    });
  }

  if (source.cancelledAt) {
    timeline.push({
      event: 'REQUEST_CANCELLED',
      timestamp: source.cancelledAt,
      actorType: 'admin',
      actorId: null,
      metadata: {
        status: 'cancelled',
      },
    });
  }

  return timeline.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
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
    uptime: Math.floor(process.uptime()),
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
    { upsert: true, returnDocument: 'after' }
  );

  if (message !== undefined) {
    await SystemSettings.findOneAndUpdate(
      { key: 'maintenance_message' },
      { value: message, updatedBy: adminId },
      { upsert: true, returnDocument: 'after' }
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
  const { offset, limit, page } = parsePagination(pagination, 20);

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
      .select('-password -emailVerificationOtp -emailVerificationOtpExpires -resetPasswordToken -resetPasswordExpires -passwordChangedAt')
      .sort({ createdAt: -1 })
      .skip(offset)
      .limit(limit),
    User.countDocuments(query),
  ]);

  return {
    users: (await enrichDonorUsers(users)).map(toAdminUserListItem),
    total,
    page: parseInt(page),
    limit: parseInt(limit),
  };
};

export const toAdminUserListItem = (user) => {
  if (!user) return user;
  const object = user.toObject ? user.toObject() : { ...user };
  const isSuspended = Boolean(object.isSuspended);
  const isVerified = Boolean(object.isEmailVerified);
  const joinedAt = object.createdAt || null;

  return {
    ...object,
    name: object.fullName ?? null,
    phone: object.phoneNumber ?? null,
    isActive: !isSuspended,
    isSuspended,
    isVerified,
    isEmailVerified: isVerified,
    joinedAt,
    createdAt: joinedAt,
  };
};

/**
 * Get a single user by ID with role-specific fields.
 *
 * Authorization rules:
 * - Non-superadmin callers cannot retrieve admin or superadmin accounts.
 * - If `expectedRole` is provided, the target user must match that role
 *   (used by /admin/donors/:id and /admin/hospitals/:id routes so an
 *   admin cannot pass a hospital ID to a donor endpoint or vice versa).
 * Pass `callerRole` from the request to enforce this; omit to allow all
 * (used internally by superadmin-only routes like `getAdminById`).
 */
export const getUserById = async (id, callerRole = null, expectedRole = null) => {
  const user = await User.findOne({ _id: id, deletedAt: null })
    .select('-password -emailVerificationOtp -emailVerificationOtpExpires -resetPasswordToken -resetPasswordExpires -passwordChangedAt');

  if (!user) return null;

  if (
    callerRole &&
    callerRole !== 'superadmin' &&
    (user.role === 'admin' || user.role === 'superadmin')
  ) {
    return null;
  }

  if (expectedRole && user.role !== expectedRole) {
    return null;
  }

  // For donors, also get donation stats
  if (user.role === 'donor') {
    const [donationCount, pointsAccount, eligibilitySummary] = await Promise.all([
      Donation.countDocuments({ donorId: id, status: 'completed' }),
      DonorPoints.findOne({ donorId: id }).lean(),
      buildEligibilitySummary(toPlain(user)),
    ]);

    return {
      ...user.toObject(),
      completedDonations: donationCount,
      pointsBalance: pointsAccount?.pointsBalance ?? 0,
      lifetimePointsEarned: pointsAccount?.lifetimePointsEarned ?? 0,
      tier: pointsAccount?.tier || DonorPoints.calculateTier(pointsAccount?.lifetimePointsEarned ?? 0),
      eligibilitySummary,
    };
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
  const result = await hospitalService.createHospitalByAdmin(
    {
      name: data.fullName || data.name || data.hospitalName,
      type: data.type || 'hospital',
      email: data.email,
      phone: data.contactNumber || data.phone,
      address: data.address || null,
      city: data.city,
      state: data.state,
      zipCode: data.zipCode,

      hospitalId: data.hospitalId,
      adminContactName: data.adminContactName,
      adminContactPhone: data.adminContactPhone,
      emergencyContact: data.emergencyContact,
      bloodBanksAvailable: data.bloodBanksAvailable,
      capacity: data.capacity,
      lat: data.lat,
      long: data.long,
      password: data.password,
    },
    adminId
  );

  return result.hospital;
};

export const updateDonor = async (donorId, data, adminId) => {
  const donor = await Donor.findOne({ _id: donorId, deletedAt: null });
  if (!donor) return null;

  const allowedFields = [
    'fullName',
    'phoneNumber',
    'bloodType',
    'gender',
    'location',
    'hemoglobinLevel',
    'travelHistory',
    'temporaryDeferralUntil',
    'lastDeferralReason',
    'isOptedIn',
  ];
  for (const field of allowedFields) {
    if (data[field] !== undefined) donor[field] = data[field];
  }

  await donor.save();
  await logAudit(adminId, 'user.update_donor', 'User', donorId);
  return donor;
};

export const banDonor = async (donorId, reason, adminId) => {
  const donor = await Donor.findOne({ _id: donorId, deletedAt: null });
  if (!donor) return null;
  if (donor.isSuspended) throw new Error('Donor is already banned');

  donor.isSuspended = true;
  donor.suspendedAt = new Date();
  donor.suspendedReason = reason;
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
  const requestingAdmin = await User.findById(adminId).select('role');
  if (!requestingAdmin || requestingAdmin.role !== 'superadmin') {
    throw new Error('Only superadmin can create admin accounts');
  }

  const existing = await User.findOne({ email: data.email });
  if (existing) {
    throw new Error('Email already registered');
  }

  const role = (data.role || 'admin').toLowerCase();
  if (!['admin', 'superadmin'].includes(role)) {
    throw new Error('Invalid admin role');
  }

  if (role === 'superadmin') {
    const superadminCount = await User.countDocuments({
      role: 'superadmin',
      deletedAt: null,
    });
    if (superadminCount >= (env.MAX_SUPERADMINS || 3)) {
      throw new Error(`Superadmin limit reached (max ${env.MAX_SUPERADMINS || 3}). Demote an existing superadmin before creating a new one.`);
    }
  }

  const plaintextKey = crypto.randomBytes(16).toString('hex');
  const adminKeyHash = await bcrypt.hash(plaintextKey, env.BCRYPT_SALT_ROUNDS || 10);

  const admin = await User.create({
    fullName: data.fullName,
    email: data.email,
    password: data.password,
    role,
    isEmailVerified: true,
    emailVerifiedAt: new Date(),
    phone: data.phone || null,
    address: data.address || null,
    adminKey: adminKeyHash,
    location: data.location || {},
  });

  await logAudit(adminId, 'user.create_admin', 'User', admin._id);
  return { ...admin.toObject(), adminKey: plaintextKey };
};

export const loginAdmin = async (email, password, adminKey) => {
  if (!email) throw new Error('Email is required');
  if (!password) throw new Error('Password is required');
  if (!adminKey) throw new Error('adminKey is required');

  const normalizedEmail = String(email).trim().toLowerCase();
  const user = await User.findOne({ email: normalizedEmail, role: { $in: ['admin', 'superadmin'] } })
    .select('+password +adminKey +passwordChangedAt +deletedAt +isSuspended +isEmailVerified +phone +address')
    .lean();

  if (!user) throw new Error('Invalid credentials');
  if (user.deletedAt) throw new Error('Invalid credentials');
  if (user.isSuspended) throw new Error('Account is suspended. Contact support.');
  if (!user.isEmailVerified) throw new Error('Email address is not verified');

  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) throw new Error('Invalid credentials');

  const isAdminKeyValid = await bcrypt.compare(
    String(adminKey).trim(),
    String(user.adminKey || '').trim()
  );
  if (!isAdminKeyValid) {
    throw new Error(ERR.AUTH_INVALID_ADMIN_KEY);
  }

  const admin = {
    _id: user._id,
    fullName: user.fullName,
    email: user.email,
    role: user.role,
    phone: user.phone || null,
    address: user.address || null,
  };

  const tokens = {
    accessToken: jwt.signToken({ userId: user._id.toString(), role: user.role }),
    refreshToken: jwt.signRefreshToken({ userId: user._id.toString(), role: user.role }),
  };

  return {
    ...tokens,
    admin,
  };
};

export const getAllAdmins = async (pagination = {}) => {
  const { offset, limit, page } = parsePagination(pagination, 20);

  const query = { deletedAt: null, role: { $in: ['admin', 'superadmin'] } };

  const [admins, total] = await Promise.all([
    User.find(query)
      .select('fullName email role phone address isEmailVerified isSuspended createdAt updatedAt')
      .sort({ createdAt: -1 })
      .skip(offset)
      .limit(limit),
    User.countDocuments(query),
  ]);

  return { admins, total, page, limit };
};

export const getAdminProfile = async (adminId) => {
  const admin = await User.findOne({ _id: adminId, deletedAt: null, role: { $in: ['admin', 'superadmin'] } })
    .select('fullName email role phone address isEmailVerified isSuspended createdAt updatedAt');

  if (!admin) {
    return null;
  }

  return admin;
};

const buildFieldDiff = (current, incoming, fields) => {
  const diff = {};
  for (const field of fields) {
    if (incoming[field] !== undefined && String(incoming[field]) !== String(current[field])) {
      diff[field] = { from: current[field], to: incoming[field] };
    }
  }
  return diff;
};

export const updateAdminProfile = async (adminId, data) => {
  const admin = await User.findOne({ _id: adminId, deletedAt: null, role: { $in: ['admin', 'superadmin'] } });
  if (!admin) return null;

  const emailChanged = data.email && data.email !== admin.email;
  let verificationOtp;

  if (emailChanged) {
    const normalizedEmail = String(data.email).trim().toLowerCase();
    const dup = await User.findOne({ email: normalizedEmail, _id: { $ne: adminId } });
    if (dup) throw new Error('Email is already in use by another account');
    admin.email = normalizedEmail;
    admin.isEmailVerified = false;
    admin.passwordChangedAt = new Date();
    verificationOtp = admin.createEmailVerificationOtp();
  }

  const changedFields = buildFieldDiff(admin, data, ['fullName', 'email', 'phone', 'address']);
  for (const field of Object.keys(changedFields)) {
    admin[field] = data[field];
  }

  if (data.location) {
    changedFields.location = { from: admin.location, to: data.location };
    admin.location = {
      ...admin.location,
      ...data.location,
      coordinates: data.location.coordinates
        ? { ...admin.location?.coordinates, ...data.location.coordinates }
        : admin.location?.coordinates,
    };
  }

  await admin.save();

  if (emailChanged) {
    void sendEmailVerificationEmail({
      to: admin.email,
      fullName: admin.fullName,
      otp: verificationOtp,
    }).catch((err) => {
      logger.warn('Admin profile email verification send failed', { email: admin.email, message: err?.message });
    });
  }

  const auditChanges = Object.keys(changedFields).length > 0 ? changedFields : null;
  await logAudit(adminId, 'admin.update_profile', 'User', adminId, auditChanges);

  return { admin, emailChanged };
};

export const updateAdmin = async (id, data, adminId) => {
  const existing = await User.findOne({ _id: id, deletedAt: null });
  if (!existing) return null;
  if (!['admin', 'superadmin'].includes(existing.role)) return null;

  if (data.email !== undefined) {
    throw new Error('Email changes are not supported via this endpoint. Admins must use the self-service profile flow.');
  }

  if (data.role !== undefined) {
    throw new Error('Role changes are not supported via this endpoint');
  }

  const updateData = {};
  // Role changes and email changes are intentionally not supported through this path.
  // Admins update their own email via PATCH /admin/profile (self-service re-verification).
  const allowedFields = ['fullName', 'location', 'isSuspended'];
  for (const field of allowedFields) {
    if (data[field] !== undefined) updateData[field] = data[field];
  }

  if (data.password) updateData.password = data.password;
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

/**
 * Rotate an admin's adminKey. The previous key is invalidated immediately.
 * Returns the new plaintext key exactly once — it is unrecoverable afterwards.
 */
export const rotateAdminKey = async (id, adminId) => {
  const admin = await User.findOne({ _id: id, deletedAt: null });
  if (!admin) return null;
  if (!['admin', 'superadmin'].includes(admin.role)) return null;

  const plaintextKey = crypto.randomBytes(16).toString('hex');
  const adminKeyHash = await bcrypt.hash(plaintextKey, env.BCRYPT_SALT_ROUNDS || 10);

  admin.adminKey = adminKeyHash;
  admin.passwordChangedAt = new Date();
  await admin.save({ validateBeforeSave: false });

  await logAudit(adminId, 'user.rotate_admin_key', 'User', id);
  return { admin, plaintextKey };
};

/**
 * Emit an audit log entry for a badge configuration update.
 * Thin wrapper so controllers don't call logAudit directly.
 */
export const logBadgeUpdate = async (adminId, badgeId, changes) => {
  await logAudit(adminId, 'admin.update_badge', 'Badge', badgeId, changes);
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
      { upsert: true, returnDocument: 'after' }
    );
  }
};

export const listRolePermissions = async () => {
  return RolePermission.find().sort({ createdAt: 1 });
};

export const getRolePermissionDetails = async (role) => {
  return RolePermission.findOne({ role: role.toLowerCase() });
};

// Permissions catalog — the only permission keys accepted in role permissions.
// Used to validate createRolePermission / updateRolePermissions payloads.
const ALLOWED_PERMISSION_KEYS = [
  'donor_management',
  'hospital_management',
  'admin_management',
  'system_settings',
  'audit_logging',
  'reporting',
];

const validatePermissionsObject = (permissions) => {
  if (permissions === undefined || permissions === null) return null;
  if (typeof permissions !== 'object' || Array.isArray(permissions)) {
    throw new Error('permissions must be an object');
  }
  const allowed = new Set(ALLOWED_PERMISSION_KEYS);
  const provided = Object.keys(permissions);
  const unknown = provided.filter((k) => !allowed.has(k));
  if (unknown.length > 0) {
    throw new Error(`Unknown permission keys: ${unknown.join(', ')}. Allowed: ${ALLOWED_PERMISSION_KEYS.join(', ')}`);
  }
  return permissions;
};

export const createRolePermission = async (data, adminId) => {
  const normalizedRole = String(data.role || '').trim().toLowerCase();
  if (['admin', 'superadmin', 'donor', 'hospital'].includes(normalizedRole)) {
    throw new Error('Cannot modify a system role');
  }
  if (!normalizedRole) {
    throw new Error('role is required');
  }

  const existing = await RolePermission.findOne({ role: normalizedRole });
  if (existing) {
    throw new Error('Role already exists');
  }

  const validatedPermissions = validatePermissionsObject(data.permissions);

  const rolePermission = await RolePermission.create({
    role: normalizedRole,
    displayName: data.displayName,
    description: data.description || '',
    isSystemRole: false,
    permissions: validatedPermissions || {},
    updatedBy: adminId,
  });

  await logAudit(adminId, 'permissions.create_role', 'RolePermission', rolePermission._id);
  return rolePermission;
};

export const updateRolePermissions = async (role, data, adminId) => {
  const normalizedRole = String(role || '').toLowerCase();
  if (['admin', 'superadmin', 'donor', 'hospital'].includes(normalizedRole)) {
    throw new Error('Cannot modify a system role');
  }

  const rolePermission = await RolePermission.findOne({ role: normalizedRole });
  if (!rolePermission) return null;
  if (rolePermission.isSystemRole || ['admin', 'superadmin', 'donor', 'hospital'].includes(rolePermission.role)) {
    throw new Error('Cannot modify a system role');
  }

  const updateData = {};
  const allowedFields = ['displayName', 'description', 'permissions'];
  for (const field of allowedFields) {
    if (data[field] !== undefined) updateData[field] = data[field];
  }
  if (updateData.permissions !== undefined) {
    updateData.permissions = validatePermissionsObject(updateData.permissions);
  }
  updateData.updatedBy = adminId;

  const updated = await RolePermission.findOneAndUpdate(
    { role: normalizedRole },
    { $set: updateData },
    { returnDocument: 'after', runValidators: true }
  );

  await logAudit(adminId, 'permissions.update_role', 'RolePermission', updated._id);
  return updated;
};

export const deleteRolePermission = async (role, adminId) => {
  const normalizedRole = String(role || '').toLowerCase();
  if (['admin', 'superadmin', 'donor', 'hospital'].includes(normalizedRole)) {
    throw new Error('Cannot delete a system role');
  }

  const rolePermission = await RolePermission.findOne({ role: normalizedRole });
  if (!rolePermission) return null;
  if (rolePermission.isSystemRole || ['admin', 'superadmin', 'donor', 'hospital'].includes(rolePermission.role)) {
    throw new Error('Cannot delete a system role');
  }

  const deleted = await RolePermission.findOneAndDelete({ role: normalizedRole });
  
  if (deleted) {
    await logAudit(adminId, 'permissions.delete_role', 'RolePermission', deleted._id);
  }
  
  return deleted;
};

// ──────────────────────────────────────────────
//  Request Management (Phase 3)
// ──────────────────────────────────────────────

/**
 * List all blood requests with filters and pagination.
 */
export const listAllRequests = async (filters = {}, pagination = {}) => {
  const { status, urgency, bloodType, hospitalId, type } = filters;
  const { offset, limit } = parsePagination(pagination, 20);

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
      .skip(offset)
      .limit(limit),
    Request.countDocuments(query),
  ]);

  const requestIds = requests.map((request) => request._id);
  const donationCounts = requestIds.length === 0
    ? []
    : await Donation.aggregate([
        { $match: { requestId: { $in: requestIds } } },
        { $group: { _id: '$requestId', count: { $sum: 1 } } },
      ]);
  const donationCountMap = new Map(donationCounts.map((entry) => [String(entry._id), entry.count]));

  return {
    requests: requests.map((request) => {
      const requestObject = request.toObject();
      const donationCount = donationCountMap.get(String(request._id)) || 0;

      return {
        ...toAdminRequestListItem(requestObject),
        ...buildRequestPayload(requestObject, null, { responseCount: donationCount }),
        donationCount,
        timeline: buildRequestTimeline(requestObject),
      };
    }),
    total,
    page: parseInt(page),
    limit: parseInt(limit),
  };
};

export const toAdminRequestListItem = (request) => {
  if (!request) return request;
  const object = request.toObject ? request.toObject() : { ...request };
  const rawBloodType = object.bloodType;

  return {
    ...object,
    bloodType: extractFirstBloodType(rawBloodType),
    bloodTypes: Array.isArray(rawBloodType) ? rawBloodType : (rawBloodType ? [rawBloodType] : []),
    isFulfilled: object.status === 'completed',
  };
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
      { $unwind: '$bloodType' },
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
    const requestBloodTypes = normalizeBloodTypeList(request.bloodType);
    if (requestBloodTypes.length === 0) continue;
    for (const bloodType of requestBloodTypes) {
      if (!inventory[bloodType]) continue;
      inventory[bloodType].requestedUnits += Number(request.quantity || 1);
    }
  }

  for (const donation of completedDonations) {
    const request = donation.requestId;
    const requestBloodTypes = normalizeBloodTypeList(request?.bloodType);
    if (!request || request.type !== 'blood' || requestBloodTypes.length === 0) continue;
    if (hospitalId && request.hospitalId?.toString?.() !== hospitalId.toString()) continue;
    for (const bloodType of requestBloodTypes) {
      if (!inventory[bloodType]) continue;
      inventory[bloodType].donatedUnits += Number(donation.quantity || 1);
    }
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

  const requestObject = request.toObject();

  return {
    request: {
      ...requestObject,
      ...buildRequestPayload(requestObject, null, { responseCount: donations.length, donations }),
      responseCount: donations.length,
      donationCount: donations.length,
      timeline: buildRequestTimeline(requestObject),
    },
    donations,
  };
};

export const listSupportMessages = async (filters = {}, pagination = {}) => {
  const { status, category, search } = filters;
  const { offset, limit, page } = parsePagination(pagination, 20);

  const query = {};
  if (status) query.status = status;
  if (category) query.category = category;
  if (search) {
    query.$or = [
      { fullName: { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } },
      { subject: { $regex: search, $options: 'i' } },
      { message: { $regex: search, $options: 'i' } },
    ];
  }

  const [tickets, total] = await Promise.all([
    SupportMessage.find(query).sort({ createdAt: -1 }).skip(offset).limit(limit).lean(),
    SupportMessage.countDocuments(query),
  ]);

  return { tickets, total, page, limit };
};

export const getSupportMessageById = async (id) => SupportMessage.findById(id).lean();

export const reviewSupportMessage = async (id, adminId) => {
  const ticket = await SupportMessage.findById(id);
  if (!ticket) return null;

  ticket.status = 'REVIEWED';
  ticket.adminReplyAt = ticket.adminReplyAt || new Date();
  ticket.adminReplyBy = adminId;
  await ticket.save({ validateBeforeSave: false });

  return ticket.toObject();
};

export const replySupportMessage = async (id, reply, adminId) => {
  const ticket = await SupportMessage.findById(id);
  if (!ticket) return null;

  ticket.status = 'REVIEWED';
  ticket.adminReply = reply;
  ticket.adminReplyAt = new Date();
  ticket.adminReplyBy = adminId;
  await ticket.save({ validateBeforeSave: false });

  return ticket.toObject();
};

/**
 * Get paginated donations for a request.
 */
export const getRequestDonations = async (id, pagination = {}) => {
  const { offset, limit, page } = parsePagination(pagination, 20);

  const [donations, total] = await Promise.all([
    Donation.find({ requestId: id })
      .populate('donorId', 'fullName email phoneNumber bloodType location')
      .sort({ createdAt: -1 })
      .skip(offset)
      .limit(limit),
    Donation.countDocuments({ requestId: id }),
  ]);

  return { donations, total, page, limit };
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

  const completedDonation = await Donation.findOne({ requestId: request._id, status: 'completed' });
  if (!completedDonation) {
    throw new Error('Cannot fulfill request without a completed donation');
  }

  validateTransition('request', request.status, 'completed', { isAdminOverride: true });

  request.status = 'completed';
  await request.save({ validateBeforeSave: false });

  await logAudit(adminId, 'request.fulfill', 'Request', id);
  return request;
};

/**
 * Cancel a request.
 */
export const cancelRequest = async (id, reason, adminId) => {
  const session = await mongoose.startSession();
  let request = null;
  const cancelledAt = new Date();
  try {
    await session.withTransaction(async () => {
      request = await Request.findById(id).session(session);
      if (!request) return;

      if (request.status === 'cancelled') {
        throw new Error('Request is already cancelled');
      }

      validateTransition('request', request.status, 'cancelled', { isAdminOverride: true });

      const activeDonations = await Donation.find({ requestId: request._id, status: { $in: ['pending', 'scheduled'] } }).session(session);
      for (const donation of activeDonations) {
        validateTransition('donation', donation.status, 'cancelled');
        donation.status = 'cancelled';
        await donation.save({ session });
      }

      request.status = 'cancelled';
      request.cancelledAt = cancelledAt;
      if (reason) request.notes = (request.notes ? request.notes + '\n' : '') + `[Admin cancelled]: ${reason}`;
      await request.save({ validateBeforeSave: false, session });

      await appointmentService.cancelActiveAppointmentsForRequest(request._id, {
        cancelledAt,
        notes: 'Appointment cancelled because the linked request was cancelled',
        session,
      });
    });
  } finally {
    session.endSession();
  }

  if (!request) return null;

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

  // Fix #7 (MEDIUM): Prevent duplicate broadcasts within a configurable cooldown window.
  // Default: 60 minutes. Override via BROADCAST_COOLDOWN_MS env variable.
  const BROADCAST_COOLDOWN_MS = parseInt(process.env.BROADCAST_COOLDOWN_MS || '', 10) || 60 * 60 * 1000;
  if (request.lastBroadcastAt) {
    const elapsed = Date.now() - new Date(request.lastBroadcastAt).getTime();
    if (elapsed < BROADCAST_COOLDOWN_MS) {
      const nextAllowedAt = new Date(new Date(request.lastBroadcastAt).getTime() + BROADCAST_COOLDOWN_MS);
      const err = new Error('BROADCAST_COOLDOWN_ACTIVE');
      err.code = 'BROADCAST_COOLDOWN_ACTIVE';
      err.nextAllowedAt = nextAllowedAt;
      err.statusCode = 429;
      throw err;
    }
  }

  // Build donor query: available, verified, not suspended, matching blood type
  const donorQuery = {
    role: 'donor',
    isOptedIn: true,
    isEmailVerified: true,
    isSuspended: false,
    deletedAt: null,
  };

  // Match blood type for blood requests
  const requestBloodTypes = normalizeBloodTypeList(request.bloodType);
  if (request.type === 'blood' && requestBloodTypes.length > 0) {
    donorQuery.bloodType = { $in: getCompatibleDonorTypesForRequest(requestBloodTypes) };
  }

  // Match governorate if hospital has location
  const hospitalLocation = request.hospitalId?.location;
  if (hospitalLocation?.governorate) {
    donorQuery['location.governorate'] = hospitalLocation.governorate;
  }

  const donors = await Donor.find(donorQuery).select('_id fullName fcmTokens');

  // Create in-app notifications for all matched donors
  if (donors.length > 0) {
    const notifications = donors.map((donor) => ({
      userId: donor._id,
      type: 'request',
      title: 'Urgent Blood Request',
      message: `${request.hospitalId?.hospitalName || 'A hospital'} needs ${formatBloodTypeLabel(request.bloodType) || request.organType} donors urgently. ${request.urgency} priority.`,
      relatedId: request._id,
      relatedType: 'Request',
      data: {
        requestId: request._id,
        requestType: request.type,
        urgency: request.urgency,
        bloodType: normalizeBloodTypeList(request.bloodType),
        bloodTypeLabel: formatBloodTypeLabel(request.bloodType),
      },
    }));

    await Notification.insertMany(notifications);
  }

  // Collect FCM tokens and send push notifications
  const fcmTokens = donors.flatMap((d) => d.fcmTokens || []).filter(Boolean);

  if (fcmTokens.length > 0) {
    sendToMultiple(
      fcmTokens,
      'Urgent Blood Request',
      `${request.hospitalId?.hospitalName || 'A hospital'} needs ${formatBloodTypeLabel(request.bloodType) || request.organType} donors urgently. ${request.urgency} priority.`,
      {
        type: 'request_broadcast',
        requestId: String(request._id),
        requestType: request.type || 'blood',
        urgency: request.urgency || 'normal',
        bloodType: normalizeBloodTypeList(request.bloodType),
        bloodTypeLabel: formatBloodTypeLabel(request.bloodType) || '',
        governorate: hospitalLocation?.governorate || 'all',
        click_action: 'FLUTTER_NOTIFICATION_CLICK',
      },
      { channelId: 'emergency_requests', priority: 'high', sound: 'default' }
    ).catch((err) => logger.error('FCM broadcast push failed', { message: err.message }));
  }

  // Stamp lastBroadcastAt to enforce cooldown on next call
  await Request.updateOne({ _id: request._id }, { $set: { lastBroadcastAt: new Date() } });

  await logAudit(adminId, 'request.broadcast', 'Request', id);

  return {
    donorsNotified: donors.length,
    pushTokenCount: fcmTokens.length,
    governorate: hospitalLocation?.governorate || 'all',
    bloodType: normalizeBloodTypeList(request.bloodType),
    bloodTypeLabel: formatBloodTypeLabel(request.bloodType) || 'all',
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
    isOptedIn: true,
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

  // Collect FCM tokens and send push notifications
  const fcmTokens = donors.flatMap((d) => d.fcmTokens || []).filter(Boolean);

  if (fcmTokens.length > 0) {
    sendToMultiple(
      fcmTokens,
      title || 'Emergency Blood Request',
      message || 'An emergency blood request has been issued in your area.',
      {
        type: 'emergency_broadcast',
        governorate: governorate || 'all',
        city: city || 'all',
        bloodTypes: bloodTypes ? bloodTypes.join(',') : 'all',
        click_action: 'FLUTTER_NOTIFICATION_CLICK',
      },
      { channelId: 'emergency_requests', priority: 'high', sound: 'default' }
    ).catch((err) => logger.error('FCM emergency broadcast failed', { message: err.message }));
  }

  return {
    donorsNotified: donors.length,
    pushTokenCount: fcmTokens.length,
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
          isOptedIn: true,
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
