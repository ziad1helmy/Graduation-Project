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
import { env } from '../config/env.js';

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
export const getRequestStats = async () => {
  const [byStatus, byUrgency, byBloodType, total] = await Promise.all([
    Request.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]),
    Request.aggregate([
      { $match: { status: { $in: ['pending', 'in-progress'] } } },
      { $group: { _id: '$urgency', count: { $sum: 1 } } },
    ]),
    Request.aggregate([
      { $match: { type: 'blood', status: { $in: ['pending', 'in-progress'] } } },
      { $group: { _id: '$bloodType', count: { $sum: 1 } } },
    ]),
    Request.countDocuments(),
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
export const getShortageAlerts = async () => {
  const bloodTypes = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

  const alerts = await Promise.all(
    bloodTypes.map(async (bt) => {
      const [demand, supply] = await Promise.all([
        Request.countDocuments({
          type: 'blood',
          bloodType: bt,
          status: { $in: ['pending', 'in-progress'] },
        }),
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
