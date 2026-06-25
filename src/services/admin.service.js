import mongoose from 'mongoose';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import * as jwt from '../utils/jwt.js';
import { logger } from '../utils/logger.js';
import { sendEmailVerificationEmail, sendSupportReplyEmail } from '../utils/mailer.js';
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
import SupportMessage from '../models/SupportMessage.model.js';
import RolePermission from '../models/RolePermission.model.js';
import * as hospitalService from './hospital.service.js';
import * as appointmentService from './appointment.service.js';
import * as matchingService from './matching.service.js';
import { sendToMultiple } from '../utils/fcm.js';
import { ERR } from '../utils/errorCodes.js';
import { HttpError } from '../utils/HttpError.js';
import { env } from '../config/env.js';
import { URGENCY_TIMEOUTS } from '../constants/request-timeout.constants.js';
import { invalidateMaintenanceCache } from '../middlewares/maintenance.middleware.js';
import { buildRequestPayload } from '../controllers/request.controller.js';
import { validateTransition } from '../utils/state-machine.js';
import {
  extractFirstBloodType,
  normalizeBloodTypeList,
  getCompatibleDonorTypesForRequest,
} from '../utils/blood-type.js';
import { parsePagination, paginationMeta } from '../utils/pagination.js';
import { encryptAdminKey, decryptAdminKey, isEncryptedKey } from '../utils/admin-key-crypto.js';
import { computeGrowth, safeEngine } from '../utils/insight-utils.js';

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

  const [pointsAccounts, donationCounts] = await Promise.all([
    DonorPoints.find({ donorId: { $in: donorIds } }).lean(),
    Donation.aggregate([
      { $match: { donorId: { $in: donorIds }, status: 'completed' } },
      { $group: { _id: '$donorId', count: { $sum: 1 } } },
    ]),
  ]);

  const pointsMap = new Map(pointsAccounts.map((account) => [String(account.donorId), account]));
  const donationMap = new Map(donationCounts.map((d) => [String(d._id), d.count]));

  const enrichedDonors = await Promise.all(donorUsers.map(async (donor) => {
    const donorId = String(donor._id);
    const pointsAccount = pointsMap.get(donorId);
    const donorObject = toPlain(donor);
    const donationCount = donationMap.get(donorId) || 0;

    return {
      ...donorObject,
      totalDonations: donationCount,
      completedDonations: donationCount,
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
  const memUsage = process.memoryUsage();
  const heapUsedMB = Math.round(memUsage.heapUsed / 1024 / 1024);
  const heapTotalMB = Math.round(memUsage.heapTotal / 1024 / 1024);
  const uptimeSeconds = Math.floor(process.uptime());
  const days = Math.floor(uptimeSeconds / 86400);
  const hours = Math.floor((uptimeSeconds % 86400) / 3600);
  const minutes = Math.floor((uptimeSeconds % 3600) / 60);

  return {
    status: dbState === 1 ? 'healthy' : 'degraded',
    uptime: `${days}d ${hours}h ${minutes}m`,
    lastChecked: new Date().toISOString(),
    services: {
      database: dbState === 1 ? 'online' : 'offline',
    },
    memory: `${heapUsedMB}MB / ${heapTotalMB}MB`,
    nodeVersion: process.version,
    platform: process.platform,
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

/**
 * Get all system settings as an object.
 */
export const getSystemSettingsObj = async () => {
  const [maintenance, donorReg, notif, maxMissed] = await Promise.all([
    SystemSettings.findOne({ key: 'maintenance_mode' }),
    SystemSettings.findOne({ key: 'donor_registration_enabled' }),
    SystemSettings.findOne({ key: 'notifications_enabled' }),
    SystemSettings.findOne({ key: 'max_missed_donations_before_ban' }),
  ]);
  return {
    maintenanceModeEnabled: maintenance ? Boolean(maintenance.value) : false,
    donorRegistrationEnabled: donorReg ? Boolean(donorReg.value) : true,
    notificationsEnabled: notif ? Boolean(notif.value) : true,
    maxMissedDonationsBeforeBan: maxMissed ? Number(maxMissed.value) : 3,
  };
};

/**
 * Update system settings keys.
 */
export const updateSystemSettings = async (settingsData, adminId) => {
  const operations = [];
  if (settingsData.maintenanceModeEnabled !== undefined) {
    operations.push(SystemSettings.findOneAndUpdate(
      { key: 'maintenance_mode' },
      { value: Boolean(settingsData.maintenanceModeEnabled), updatedBy: adminId },
      { upsert: true, returnDocument: 'after' }
    ));
    invalidateMaintenanceCache();
  }
  if (settingsData.donorRegistrationEnabled !== undefined) {
    operations.push(SystemSettings.findOneAndUpdate(
      { key: 'donor_registration_enabled' },
      { value: Boolean(settingsData.donorRegistrationEnabled), updatedBy: adminId },
      { upsert: true, returnDocument: 'after' }
    ));
  }
  if (settingsData.notificationsEnabled !== undefined) {
    operations.push(SystemSettings.findOneAndUpdate(
      { key: 'notifications_enabled' },
      { value: Boolean(settingsData.notificationsEnabled), updatedBy: adminId },
      { upsert: true, returnDocument: 'after' }
    ));
  }
  if (settingsData.maxMissedDonationsBeforeBan !== undefined) {
    const parsed = Math.max(1, settingsData.maxMissedDonationsBeforeBan);
    operations.push(SystemSettings.findOneAndUpdate(
      { key: 'max_missed_donations_before_ban' },
      { value: parsed, updatedBy: adminId },
      { upsert: true, returnDocument: 'after' }
    ));
  }
  await Promise.all(operations);
  return getSystemSettingsObj();
};

// ──────────────────────────────────────────────
//  Settings Seed
// ──────────────────────────────────────────────

const DEFAULT_SETTINGS = [
  { key: 'maintenance_mode', value: false },
  { key: 'maintenance_message', value: '' },
  { key: 'donor_registration_enabled', value: true },
  { key: 'notifications_enabled', value: true },
  { key: 'max_missed_donations_before_ban', value: 3 },
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

  const [users, total, stats] = await Promise.all([
    User.find(query)
      .select('-password -emailVerificationOtp -emailVerificationOtpExpires -resetPasswordToken -resetPasswordExpires -passwordChangedAt')
      .sort({ createdAt: -1 })
      .skip(offset)
      .limit(limit),
    User.countDocuments(query),
    computeUserStats(),
  ]);

  const { aiInsights, ...statsWithoutInsights } = stats;

  return {
    users: (await enrichDonorUsers(users)).map(toAdminUserListItem),
    pagination: paginationMeta(total, page, limit),
    stats: statsWithoutInsights,
  };
};

export const toAdminUserListItem = (user) => {
  if (!user) return user;
  const object = user.toObject ? user.toObject() : { ...user };
  const isSuspended = Boolean(object.isSuspended);
  const isVerified = Boolean(object.isEmailVerified);
  const joinedAt = object.createdAt || null;

  const resolvedPhone = object.phoneNumber ?? object.phone ?? null;

  return {
    ...object,
    id: String(object._id),
    name: object.fullName ?? null,
    phone: resolvedPhone,
    phoneNumber: resolvedPhone,
    bloodType: object.bloodType ?? null,
    isActive: !isSuspended,
    isSuspended,
    isVerified,
    isEmailVerified: isVerified,
    joinedAt,
    createdAt: joinedAt,
    totalDonations: object.totalDonations ?? 0,
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
export const getUserById = async (id, callerRole = null, expectedRole = null, callerId = null) => {
  const user = await User.findOne({ _id: id, deletedAt: null })
    .select('-password -emailVerificationOtp -emailVerificationOtpExpires -resetPasswordToken -resetPasswordExpires -passwordChangedAt +adminKey');

  if (!user) return null;

  if (
    callerRole &&
    callerRole !== 'superadmin' &&
    (user.role === 'admin' || user.role === 'superadmin') &&
    (!callerId || id.toString() !== callerId.toString())
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
      phone: user.phoneNumber ?? null,
      bloodType: user.bloodType ?? null,
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
    return {
      ...user.toObject(),
      totalRequests: requestCount,
    };
  }

  // For admin/superadmin, attach decrypted admin key only if caller is superadmin or the user themselves
  if (user.role === 'admin' || user.role === 'superadmin') {
    if (callerRole === 'superadmin' || (callerRole && id.toString() === callerId)) {
      return attachAdminKey(user);
    }
    return user;
  }

  return user;
};

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Compute global user statistics with growth percentages and AI insights.
 */
export const computeUserStats = async () => {
  const now = new Date();
  const thirtyDaysAgo = new Date(now - THIRTY_DAYS_MS);
  const sixtyDaysAgo = new Date(now - 2 * THIRTY_DAYS_MS);

  const baseMatch = { deletedAt: null };

  const [
    totalUsers, newUsersCurrent, newUsersPrev,
    totalDonors, newDonorsCurrent, newDonorsPrev,
    totalHospitals, newHospitalsCurrent, newHospitalsPrev,
    totalAdmins,
    verifiedUsers, newVerifiedCurrent, newVerifiedPrev,
    suspendedUsers, newSuspendedCurrent, newSuspendedPrev,
    aiInsights,
  ] = await Promise.all([
    User.countDocuments(baseMatch),
    User.countDocuments({ ...baseMatch, createdAt: { $gte: thirtyDaysAgo } }),
    User.countDocuments({ ...baseMatch, createdAt: { $gte: sixtyDaysAgo, $lt: thirtyDaysAgo } }),
    User.countDocuments({ ...baseMatch, role: 'donor' }),
    User.countDocuments({ ...baseMatch, role: 'donor', createdAt: { $gte: thirtyDaysAgo } }),
    User.countDocuments({ ...baseMatch, role: 'donor', createdAt: { $gte: sixtyDaysAgo, $lt: thirtyDaysAgo } }),
    User.countDocuments({ ...baseMatch, role: 'hospital' }),
    User.countDocuments({ ...baseMatch, role: 'hospital', createdAt: { $gte: thirtyDaysAgo } }),
    User.countDocuments({ ...baseMatch, role: 'hospital', createdAt: { $gte: sixtyDaysAgo, $lt: thirtyDaysAgo } }),
    User.countDocuments({ ...baseMatch, role: { $in: ['admin', 'superadmin'] } }),
    User.countDocuments({ ...baseMatch, isEmailVerified: true }),
    User.countDocuments({ ...baseMatch, isEmailVerified: true, emailVerifiedAt: { $gte: thirtyDaysAgo } }),
    User.countDocuments({ ...baseMatch, isEmailVerified: true, emailVerifiedAt: { $gte: sixtyDaysAgo, $lt: thirtyDaysAgo } }),
    User.countDocuments({ ...baseMatch, isSuspended: true }),
    User.countDocuments({ ...baseMatch, isSuspended: true, suspendedAt: { $gte: thirtyDaysAgo } }),
    User.countDocuments({ ...baseMatch, isSuspended: true, suspendedAt: { $gte: sixtyDaysAgo, $lt: thirtyDaysAgo } }),
    generateUserAIInsights(),
  ]);

  return {
    totalUsers,
    totalDonors,
    totalHospitals,
    totalAdmins,
    verifiedUsers,
    unverifiedUsers: totalUsers - verifiedUsers,
    suspendedUsers,
    totalUsersGrowth: computeGrowth(newUsersCurrent, newUsersPrev),
    totalDonorsGrowth: computeGrowth(newDonorsCurrent, newDonorsPrev),
    totalHospitalsGrowth: computeGrowth(newHospitalsCurrent, newHospitalsPrev),
    verifiedUsersGrowth: computeGrowth(newVerifiedCurrent, newVerifiedPrev),
    suspendedUsersGrowth: computeGrowth(newSuspendedCurrent, newSuspendedPrev),
    aiInsights,
  };
};

/**
 * Generate AI insights about user patterns.
 */
const generateUserAIInsights = async () => {
  const insights = await Promise.all([
    safeEngine(registrationTrendEngine, 'registrationTrend'),
    safeEngine(verificationGapEngine, 'verificationGap'),
    safeEngine(hospitalEngagementEngine, 'hospitalEngagement'),
    safeEngine(donorRetentionEngine, 'donorRetention'),
    safeEngine(suspensionAlertEngine, 'suspensionAlert'),
  ]);
  return insights.filter(Boolean).sort((a, b) => b.confidence - a.confidence).slice(0, 5);
};

const registrationTrendEngine = async () => {
  const now = new Date();
  const thisWeek = new Date(now - 7 * 24 * 60 * 60 * 1000);
  const lastWeek = new Date(now - 14 * 24 * 60 * 60 * 1000);

  const [currentWeek, previousWeek] = await Promise.all([
    User.countDocuments({ deletedAt: null, role: 'donor', createdAt: { $gte: thisWeek } }),
    User.countDocuments({ deletedAt: null, role: 'donor', createdAt: { $gte: lastWeek, $lt: thisWeek } }),
  ]);

  const growth = computeGrowth(currentWeek, previousWeek);
  const direction = growth.startsWith('+') ? 'up' : 'down';
  const magnitude = Math.abs(parseInt(growth));

  if (magnitude < 5) return null;

  return {
    title: direction === 'up' ? 'Donor Registrations Rising' : 'Donor Registrations Declining',
    description: `Donor signups are ${growth} this week compared to last week. ${direction === 'up' ? 'New donors are joining at an accelerating rate.' : 'Consider increasing outreach efforts.'}`,
    confidence: Math.min(0.5 + magnitude / 100, 0.95),
  };
};

const verificationGapEngine = async () => {
  const totalUsers = await User.countDocuments({ deletedAt: null });
  const verifiedUsers = await User.countDocuments({ deletedAt: null, isEmailVerified: true });
  const unverifiedRatio = totalUsers > 0 ? (totalUsers - verifiedUsers) / totalUsers : 0;

  if (unverifiedRatio < 0.15) return null;

  const unverifiedCount = totalUsers - verifiedUsers;
  return {
    title: 'Verification Gap Detected',
    description: `${Math.round(unverifiedRatio * 100)}% of users (${unverifiedCount}) are unverified. Consider sending a reminder email campaign to improve engagement.`,
    confidence: Math.min(0.6 + unverifiedRatio, 0.9),
  };
};

const hospitalEngagementEngine = async () => {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const hospitals = await User.find({ deletedAt: null, role: 'hospital' }).select('_id').lean();
  const hospitalIds = hospitals.map((h) => h._id);

  if (hospitalIds.length === 0) return null;

  const hospitalsWithRequests = await Request.distinct('hospitalId', {
    hospitalId: { $in: hospitalIds },
    createdAt: { $gte: thirtyDaysAgo },
  });

  const inactiveCount = hospitalIds.length - hospitalsWithRequests.length;
  if (inactiveCount === 0) return null;

  return {
    title: 'Inactive Hospitals',
    description: `${inactiveCount} out of ${hospitalIds.length} hospitals haven't posted a request in the last 30 days. Follow up to ensure they're operational.`,
    confidence: Math.min(0.5 + inactiveCount / hospitalIds.length, 0.85),
  };
};

const donorRetentionEngine = async () => {
  const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);

  const donors = await User.find({
    deletedAt: null,
    role: 'donor',
    createdAt: { $lte: sixtyDaysAgo },
  }).select('_id').lean();

  if (donors.length === 0) return null;

  const donorIds = donors.map((d) => d._id);
  const returningDonors = await Donation.distinct('donorId', {
    donorId: { $in: donorIds },
    status: 'completed',
    createdAt: { $gte: sixtyDaysAgo },
  });

  const retentionRate = Math.round((returningDonors.length / donors.length) * 100);
  if (retentionRate > 40) return null;

  return {
    title: 'Donor Retention Alert',
    description: `Only ${retentionRate}% of donors return for a second donation. Consider implementing a follow-up campaign and appointment reminders.`,
    confidence: Math.min(0.6 + (40 - retentionRate) / 40, 0.85),
  };
};

const suspensionAlertEngine = async () => {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);

  const [current, previous] = await Promise.all([
    User.countDocuments({ deletedAt: null, isSuspended: true, suspendedAt: { $gte: thirtyDaysAgo } }),
    User.countDocuments({ deletedAt: null, isSuspended: true, suspendedAt: { $gte: sixtyDaysAgo, $lt: thirtyDaysAgo } }),
  ]);

  if (current === 0 && previous === 0) return null;
  if (current <= previous) return null;

  const growth = computeGrowth(current, previous);
  const magnitude = Math.abs(parseInt(growth));

  return {
    title: 'Suspension Spike Detected',
    description: `Account suspensions ${growth} (${current} this month vs ${previous} last month). Review moderation patterns to ensure fair enforcement.`,
    confidence: Math.min(0.5 + magnitude / 100, 0.9),
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

  const atIndex = user.email.indexOf('@');
  user.email = user.email.slice(0, atIndex) + `:deleted:${Date.now()}` + user.email.slice(atIndex);
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
  const phone = data.phone || data.adminContactPhone || data.emergencyContactNumber || data.contactNumber;
  const result = await hospitalService.createHospitalByAdmin(
    {
      name: data.fullName || data.name || data.hospitalName,
      type: data.type || 'hospital',
      email: data.email,
      phone,
      contactNumber: data.contactNumber || phone,
      address: data.address || null,
      city: data.city,
      state: data.state,
      zipCode: data.zipCode,

      hospitalId: data.hospitalId || data.hospitalCode,
      adminContactName: data.adminContactName,
      adminContactPhone: data.adminContactPhone,
      emergencyContact: data.emergencyContact || data.emergencyContactNumber,
      bloodBanksAvailable: data.bloodBanksAvailable,
      capacity: data.capacity,
      lat: data.lat ?? data.latitude,
      long: data.long ?? data.longitude,
      licenseNumber: data.licenseNumber,
      password: data.password,
    },
    adminId
  );

  const hospitalDoc = result.hospital.toObject ? result.hospital.toObject() : result.hospital;
  return hospitalDoc;
};

export const updateDonor = async (id, data, adminId) => {
  const user = await User.findOne({ _id: id, deletedAt: null, role: 'donor' });
  if (!user) return null;

  if (data.email !== undefined) {
    throw new Error('Email cannot be changed via the admin endpoint. Users must use the self-service profile flow.');
  }
  const allowedFields = ['fullName', 'phoneNumber', 'bloodType'];
  for (const field of allowedFields) {
    if (data[field] !== undefined) user[field] = data[field];
  }
  await user.save();
  await logAudit(adminId, 'user.update_donor', 'User', id);
  return user;
};

export const updateHospital = async (id, data, adminId) => {
  const user = await User.findOne({ _id: id, deletedAt: null, role: 'hospital' });
  if (!user) return null;

  if (data.email !== undefined) {
    throw new Error('Email cannot be changed via the admin endpoint. Users must use the self-service profile flow.');
  }
  const allowedFields = ['fullName', 'hospitalName', 'bloodBanksAvailable', 'capacity'];
  for (const field of allowedFields) {
    if (data[field] !== undefined) user[field] = data[field];
  }
  if (data.phone !== undefined || data.contactNumber !== undefined) {
    user.contactNumber = data.contactNumber !== undefined ? data.contactNumber : data.phone;
  }
  await user.save();
  await logAudit(adminId, 'user.update_hospital', 'User', id);
  return user;
};

export const updateAdmin = async (id, data, adminId, callerRole) => {
  if (callerRole !== 'superadmin') {
    return null;
  }

  const user = await User.findOne({ _id: id, deletedAt: null, role: { $in: ['admin', 'superadmin'] } });
  if (!user) return null;

  if (data.email !== undefined) {
    throw new Error('Email cannot be changed via the admin endpoint. Users must use the self-service profile flow.');
  }
  if (data.role !== undefined) {
    throw new Error('Role changes are not supported. The role field cannot be updated.');
  }
  const allowedFields = ['fullName', 'isSuspended'];
  for (const field of allowedFields) {
    if (data[field] !== undefined) user[field] = data[field];
  }
  if (data.password) user.password = data.password;
  if (data.isSuspended !== undefined && !data.isSuspended) {
    user.suspendedAt = null;
    user.suspendedReason = null;
  }
  await user.save();
  await logAudit(adminId, 'user.update_admin', 'User', id);
  return user;
};

export const banUser = async (targetId, reason, adminId, callerRole) => {
  const user = await User.findOne({ _id: targetId, deletedAt: null });
  if (!user) return null;
  if (user.isSuspended) throw new Error('User is already banned');

  if ((user.role === 'admin' || user.role === 'superadmin') && callerRole !== 'superadmin') {
    throw new Error('Only superadmin can ban admin accounts');
  }

  user.isSuspended = true;
  user.suspendedAt = new Date();
  user.suspendedReason = reason;
  await user.save({ validateBeforeSave: false });

  await logAudit(adminId, 'user.ban', 'User', targetId);
  return user;
};

export const unbanUser = async (targetId, adminId, callerRole) => {
  const user = await User.findOne({ _id: targetId, deletedAt: null });
  if (!user) return null;
  if (!user.isSuspended) throw new Error('User is not banned');

  if ((user.role === 'admin' || user.role === 'superadmin') && callerRole !== 'superadmin') {
    throw new Error('Only superadmin can unban admin accounts');
  }

  user.isSuspended = false;
  user.suspendedAt = null;
  user.suspendedReason = null;
  await user.save({ validateBeforeSave: false });

  await logAudit(adminId, 'user.unban', 'User', targetId);
  return user;
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

  const role = (() => {
    if (!data.accessLevel) return (data.role || 'admin').toLowerCase();

    const normalized = String(data.accessLevel).toLowerCase().trim();
    if (normalized === 'full access' || normalized === 'fullaccess') return 'superadmin';
    return 'admin';
  })();
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

  const plaintextKey = 'ADM' + Array.from(crypto.randomBytes(3))
    .map((b) => 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'[b % 36])
    .join('');

  const admin = await User.create({
    fullName: data.fullName,
    email: data.email,
    password: data.password,
    role,
    isEmailVerified: true,
    emailVerifiedAt: new Date(),
    phone: data.phone || null,
    adminKey: 'pending',
  });

  admin.adminKey = encryptAdminKey(plaintextKey, admin._id.toString());
  await admin.save({ validateBeforeSave: false });

  await logAudit(adminId, 'user.create_admin', 'User', admin._id);
  return { ...admin.toObject(), adminKey: plaintextKey };
};

export const loginAdmin = async (email, password, adminKey) => {
  if (!email) throw new Error('Email is required');
  if (!password) throw new Error('Password is required');
  if (!adminKey) throw new Error('adminKey is required');

  const normalizedEmail = String(email).trim().toLowerCase();
  const user = await User.findOne({ email: normalizedEmail, role: { $in: ['admin', 'superadmin'] } })
    .select('+password +adminKey +passwordChangedAt +deletedAt +isSuspended +isEmailVerified +phone')
    .lean();

  if (!user) throw new Error('Invalid credentials');
  if (user.deletedAt) throw new Error('Invalid credentials');
  if (user.isSuspended) throw new Error('Account is suspended. Contact support.');
  if (!user.isEmailVerified) throw new Error('Email address is not verified');

  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) throw new Error('Invalid credentials');

  const providedKey = String(adminKey).trim();
  const storedKey = String(user.adminKey || '').trim();
  let isAdminKeyValid;

  if (isEncryptedKey(storedKey)) {
    const decrypted = decryptAdminKey(storedKey, String(user._id));
    isAdminKeyValid = decrypted === providedKey;
  } else {
    // Legacy bcrypt hash format — keep working during migration
    isAdminKeyValid = await bcrypt.compare(providedKey, storedKey);
  }
  if (!isAdminKeyValid) {
    throw new Error(ERR.AUTH_INVALID_ADMIN_KEY);
  }

  const admin = {
    _id: user._id,
    fullName: user.fullName,
    email: user.email,
    role: user.role,
    phone: user.phone || null,
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

const attachAdminKey = (admin) => {
  const obj = admin.toObject ? admin.toObject() : { ...admin };
  if (isEncryptedKey(String(obj.adminKey || ''))) {
    obj.adminKey = decryptAdminKey(obj.adminKey, String(obj._id));
  } else {
    delete obj.adminKey;
  }
  return obj;
};

export const getAllAdmins = async (pagination = {}, callerRole = null) => {
  const { offset, limit, page } = parsePagination(pagination, 20);

  const query = { deletedAt: null, role: { $in: ['admin', 'superadmin'] } };

  const [admins, total] = await Promise.all([
    User.find(query)
      .select('+adminKey fullName email role phone isEmailVerified isSuspended createdAt updatedAt')
      .sort({ createdAt: -1 })
      .skip(offset)
      .limit(limit),
    User.countDocuments(query),
  ]);

  return {
    admins: admins.map((a) => (callerRole === 'superadmin' ? attachAdminKey(a) : a)),
    total,
    page,
    limit,
  };
};

export const getAdminProfile = async (adminId) => {
  const admin = await User.findOne({ _id: adminId, deletedAt: null, role: { $in: ['admin', 'superadmin'] } })
    .select('+adminKey fullName email role phone isEmailVerified isSuspended createdAt updatedAt');

  if (!admin) {
    return null;
  }

  return attachAdminKey(admin);
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

  const changedFields = buildFieldDiff(admin, data, ['fullName', 'email', 'phone']);
  for (const field of Object.keys(changedFields)) {
    admin[field] = data[field];
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

  const plaintextKey = 'ADM' + Array.from(crypto.randomBytes(3))
    .map((b) => 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'[b % 36])
    .join('');

  admin.adminKey = encryptAdminKey(plaintextKey, id.toString());
  admin.passwordChangedAt = new Date();
  await admin.save({ validateBeforeSave: false });

  await logAudit(adminId, 'user.rotate_admin_key', 'User', id);
  return { admin: attachAdminKey(admin), plaintextKey };
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
  const { offset, limit, page } = parsePagination(pagination, 20);

  const query = {};
  if (status) query.status = status;
  if (urgency) query.urgency = urgency;
  if (bloodType) query.bloodType = bloodType;
  if (hospitalId) query.hospitalId = hospitalId;
  if (type) query.type = type;

  const [requests, total, stats] = await Promise.all([
    Request.find(query)
      .populate('hospitalId', 'fullName email hospitalName address phone contactNumber location')
      .sort({ createdAt: -1 })
      .skip(offset)
      .limit(limit),
    Request.countDocuments(query),
    getRequestStats(hospitalId || null),
  ]);

  const requestIds = requests.map((request) => request._id);
  const [donationCounts, confirmedCounts, contactedCounts] = await Promise.all([
    requestIds.length === 0
      ? []
      : Donation.aggregate([
          { $match: { requestId: { $in: requestIds } } },
          { $group: { _id: '$requestId', count: { $sum: 1 } } },
        ]),
    requestIds.length === 0
      ? []
      : Donation.aggregate([
          { $match: { requestId: { $in: requestIds }, status: { $in: ['scheduled', 'completed'] } } },
          { $group: { _id: '$requestId', count: { $sum: 1 } } },
        ]),
    requestIds.length === 0
      ? []
      : Notification.aggregate([
          {
            $match: {
              relatedId: { $in: requestIds },
              type: { $in: ['request', 'emergency', 'request_broadcast', 'emergency_broadcast'] },
            },
          },
          { $group: { _id: '$relatedId', count: { $sum: 1 } } },
        ]),
  ]);

  const donationCountMap = new Map(donationCounts.map((entry) => [String(entry._id), entry.count]));
  const confirmedCountMap = new Map(confirmedCounts.map((entry) => [String(entry._id), entry.count]));
  const contactedCountMap = new Map(contactedCounts.map((entry) => [String(entry._id), entry.count]));

  return {
    requests: requests.map((request) => {
      const requestObject = request.toObject();
      const donationCount = donationCountMap.get(String(request._id)) || 0;
      const donorsConfirmed = confirmedCountMap.get(String(request._id)) || 0;
      const donorsContacted = contactedCountMap.get(String(request._id)) || 0;

      const listItem = toAdminRequestListItem(requestObject);
      const payload = {
        ...listItem,
        ...buildRequestPayload(requestObject, null, { responseCount: donationCount }),
        donationCount,
        donorsConfirmed,
        donorsContacted,
        timeline: buildRequestTimeline(requestObject),
      };

      // Ensure location remains a String representation as required by admin list views
      payload.location = listItem.location;
      return payload;
    }),
    total,
    page: parseInt(page),
    limit: parseInt(limit),
    stats,
  };
};

export const toAdminRequestListItem = (request) => {
  if (!request) return request;
  const object = request.toObject ? request.toObject() : { ...request };
  const rawBloodType = object.bloodType;

  const hospitalName = object.hospitalName
    || object.hospitalId?.hospitalName
    || object.hospitalId?.fullName
    || null;

  const hospitalContact = object.hospitalContact
    || object.contactNumber
    || object.hospitalId?.contactNumber
    || null;

  const location = object.hospitalId?.address
    ? `${object.hospitalId.address.city || ''}, ${object.hospitalId.address.governorate || ''}`.trim().replace(/^,|,$/g, '').trim()
    : object.hospitalId?.location?.city || object.location?.city || 'Cairo';

  return {
    ...object,
    bloodType: extractFirstBloodType(rawBloodType),
    bloodTypes: Array.isArray(rawBloodType) ? rawBloodType : (rawBloodType ? [rawBloodType] : []),
    isFulfilled: object.status === 'completed',
    hospitalName,
    hospitalContact,
    location,
    urgencyLevel: object.urgency,
    unitsRequested: object.unitsNeeded ?? 1,
    completionTimeInHours: object.requiredBy
      ? Math.max(0, Math.ceil((new Date(object.requiredBy).getTime() - Date.now()) / (1000 * 60 * 60)))
      : 0,
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



/**
 * Get full request details with associated donations.
 */
export const getRequestDetails = async (id) => {
  const request = await Request.findById(id)
    .populate('hospitalId', 'fullName email hospitalName address phone contactNumber');

  if (!request) return null;

  const donations = await Donation.find({ requestId: id })
    .populate('donorId', 'fullName email phoneNumber bloodType location')
    .sort({ createdAt: -1 });

  const requestObject = request.toObject();

  return {
    request: {
      ...requestObject,
      ...buildRequestPayload(requestObject, null, { responseCount: donations.length, donations }),
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

/**
 * Reply to a support message, mark it reviewed, and notify the user via
 * push notification + email so the reply actually reaches them.
 * @param {string} id - SupportMessage ID
 * @param {string} reply - Admin reply text
 * @param {string} adminId - Replying admin's user ID
 * @returns {Object|null} Updated ticket plain object, or null if not found
 */
export const replySupportMessage = async (id, reply, adminId) => {
  const ticket = await SupportMessage.findById(id);
  if (!ticket) return null;

  ticket.status = 'REVIEWED';
  ticket.adminReply = reply;
  ticket.adminReplyAt = new Date();
  ticket.adminReplyBy = adminId;
  await ticket.save({ validateBeforeSave: false });

  const ticketObj = ticket.toObject();

  // Fetch user for push token + email delivery (fire-and-forget — never fail the reply)
  setImmediate(async () => {
    try {
      const user = await User.findById(ticket.userId).select('fcmTokens fullName email').lean();
      if (!user) return;

      const notifTitle = 'Support Reply Received';
      const notifMessage = `Your support request "${ticket.subject}" has been answered.`;

      // In-app push notification
      if (Array.isArray(user.fcmTokens) && user.fcmTokens.length > 0) {
        try {
          await sendToMultiple(
            user.fcmTokens,
            notifTitle,
            notifMessage,
            {
              type: 'admin',
              ticketId: String(ticket._id),
              click_action: 'FLUTTER_NOTIFICATION_CLICK',
            },
            { channelId: 'support_replies' }
          );
        } catch (fcmErr) {
          logger.warn('Support reply FCM delivery failed', {
            userId: String(ticket.userId),
            ticketId: String(ticket._id),
            message: fcmErr.message,
          });
        }
      }

      // Persist in-app notification record
      try {
        await Notification.create({
          userId: ticket.userId,
          type: 'admin',
          title: notifTitle,
          message: notifMessage,
          relatedId: ticket._id,
          relatedType: null,
          data: { ticketId: String(ticket._id) },
        });
      } catch (notifErr) {
        logger.warn('Support reply in-app notification create failed', {
          userId: String(ticket.userId),
          ticketId: String(ticket._id),
          message: notifErr.message,
        });
      }

      // Email delivery
      if (user.email) {
        try {
          await sendSupportReplyEmail({
            to: user.email,
            fullName: user.fullName,
            subject: ticket.subject,
            originalMessage: ticket.message,
            reply,
          });
        } catch (mailErr) {
          logger.warn('Support reply email delivery failed', {
            userId: String(ticket.userId),
            ticketId: String(ticket._id),
            message: mailErr.message,
          });
        }
      }
    } catch (err) {
      logger.error('Support reply notification dispatch error', {
        ticketId: String(ticket._id),
        message: err.message,
      });
    }
  });

  return ticketObj;
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
  let activeDonations = [];
  try {
    await session.withTransaction(async () => {
      request = await Request.findById(id).session(session);
      if (!request) return;

      if (request.status === 'cancelled') {
        throw new Error('Request is already cancelled');
      }

      validateTransition('request', request.status, 'cancelled', { isAdminOverride: true });

      activeDonations = await Donation.find({ requestId: request._id, status: { $in: ['pending', 'scheduled'] } }).session(session);
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

  setImmediate(async () => {
    try {
      const affectedDonorIds = activeDonations.map((d) => d.donorId.toString());
      if (affectedDonorIds.length > 0) {
        await Notification.create(
          affectedDonorIds.map((userId) => ({
            userId,
            type: 'request',
            title: 'Request cancelled',
            message: `Your accepted donation for ${request.hospitalName || 'the hospital'} has been cancelled.`,
            relatedId: request._id,
            relatedType: 'Request',
            data: { requestId: request._id.toString(), status: 'cancelled' },
          })),
        );
      }
    } catch (_) { /* non-critical */ }
  });

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

  if (!['pending', 'in-progress'].includes(request.status)) {
    throw new HttpError(400, `cannot broadcast a request with status: ${request.status}`);
  }

  const urgencyKey = request.urgency || 'medium';
  const cooldownMs = URGENCY_TIMEOUTS[urgencyKey]?.reBroadcastIntervalMs ?? 15 * 60 * 1000;
  if (request.lastBroadcastAt) {
    const msSinceLast = Date.now() - new Date(request.lastBroadcastAt).getTime();
    if (msSinceLast < cooldownMs) {
      const minutesLeft = Math.ceil((cooldownMs - msSinceLast) / 60000);
      throw new HttpError(429, `broadcast cooldown active — try again in ${minutesLeft} minute(s)`);
    }
  }

  const bloodTypes = request.bloodType ?? request._doc?.bloodType ?? [];
  const requestBloodTypes = normalizeBloodTypeList(bloodTypes);
  const bloodTypeLabel = requestBloodTypes.length > 0 ? requestBloodTypes.join(', ') : '';
  const hospitalLocation = request.hospitalId?.location;

  const compatibleDonors = await matchingService.findCompatibleDonors(id);

  if (compatibleDonors.length > 0) {
    const notifications = compatibleDonors.map(({ donor }) => ({
      userId: donor._id,
      type: 'request',
      title: 'Urgent Blood Request',
      message: `${request.hospitalId?.hospitalName || 'A hospital'} needs ${bloodTypeLabel || request.organType} donors urgently. ${request.urgency} priority.`,
      relatedId: request._id,
      relatedType: 'Request',
      data: {
        requestId: request._id,
        requestType: request.type,
        urgency: request.urgency,
        bloodType: requestBloodTypes,
        bloodTypeLabel,
      },
    }));

    await Notification.insertMany(notifications);
  }

  const fcmTokens = compatibleDonors
    .flatMap(({ donor }) => donor.fcmTokens || [])
    .filter(Boolean);

  if (fcmTokens.length > 0) {
    sendToMultiple(
      fcmTokens,
      'Urgent Blood Request',
      `${request.hospitalId?.hospitalName || 'A hospital'} needs ${bloodTypeLabel || request.organType} donors urgently. ${request.urgency} priority.`,
      {
        type: 'request_broadcast',
        requestId: String(request._id),
        requestType: request.type || 'blood',
        urgency: request.urgency || 'normal',
        bloodType: requestBloodTypes,
        bloodTypeLabel: bloodTypeLabel || '',
        governorate: hospitalLocation?.governorate || 'all',
        click_action: 'FLUTTER_NOTIFICATION_CLICK',
      },
      { channelId: 'emergency_requests', priority: 'high', sound: 'default' }
    ).catch((err) => logger.error('FCM broadcast push failed', { message: err.message }));
  }

  await logAudit(adminId, 'request.broadcast', 'Request', id);

  await Request.findByIdAndUpdate(id, {
    $set: { lastBroadcastAt: new Date() },
  });

  const radiusKm = ['high', 'critical'].includes(request.urgency) ? 60 : 30;

  return {
    donorsNotified: compatibleDonors.length,
    pushTokenCount: fcmTokens.length,
    governorate: hospitalLocation?.governorate || 'all',
    bloodType: requestBloodTypes,
    bloodTypeLabel: bloodTypeLabel || 'all',
    radiusKm,
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
    .populate('hospitalId', 'fullName hospitalName location phone contactNumber')
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
