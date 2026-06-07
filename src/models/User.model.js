/**
 * User model — base schema for all roles via Mongoose discriminators.
 *
 * Fields:
 *  - fullName            : string, required, trimmed
 *  - email               : string, required, unique, lowercase
 *  - password            : string, required, hashed on save, select: false
 *  - role                : enum ['donor', 'hospital', 'admin', 'superadmin']
 *  - isEmailVerified     : boolean (alias: isVerified)
 *  - isSuspended         : boolean; suspendedAt, suspendedReason
 *  - deletedAt           : Date (soft-delete; null = active)
 *  - location            : { city, governorate, coordinates: {lat, lng}, lastUpdated }
 *  - fcmTokens           : string[] — FCM device tokens for push notifications
 *  - passwordChangedAt   : Date, select: false — invalidates older JWTs
 *  - Email verification  : OTP code + expiry fields, select: false
 *  - Password reset      : token + expiry fields, select: false
 *  - timestamps          : createdAt, updatedAt (auto)
 *
 * Indexes:
 *  - location.coordinates: 2dsphere  (future geo-radius queries)
 */

import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import mongoose, { Schema } from "mongoose";
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';
import { normalizeArabic } from '../utils/textNormalization.js';

const userSchema = new Schema(
  {
    // Full display name — required for both donors and hospitals.
    // Do NOT add an alphanumeric-only validator: Arabic names must be supported.
    fullName: {
      type: String,
      required: [true, 'Full name is required'],
      trim: true,
      minlength: [3, 'Full name must be at least 3 characters long'],
      maxlength: [100, 'Full name must be less than 100 characters long'],
    },
    // Normalized version of fullName for consistent searching
    // Normalizes Arabic variants and converts to lowercase for fuzzy matching
    fullNameNormalized: {
      type: String,
      lowercase: true,
      trim: true,
      index: true,
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      validate: {
        validator: function (v) {
          return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
        },
        message: 'Invalid email address',
      },
    },
    password: {
      type: String, 
      required: [true, 'Password is required'], 
      minlength: [8, 'Minimum length of the password should be 8'], 
      select: false,
    },
    passwordChangedAt: {
      type: Date,
      default: null,
      select: false,
    },
    emailVerificationOtp: {
      type: String,
      select: false,
    },
    emailVerificationOtpExpires: {
      type: Date,
      select: false,
    },
    isEmailVerified: {
      type: Boolean,
      default: false,
      alias: 'isVerified',
    },
    emailVerifiedAt: {
      type: Date,
      default: null,
    },
    resetPasswordToken: {
      type: String,
      select: false,
    },
    resetPasswordExpires: {
      type: Date,
      select: false,
    },
    role: {
      type: String,
      enum: ["admin", "donor", "hospital", "superadmin"],
      default: "donor",
    },

    // --- Suspension & Soft Delete ---
    isSuspended: {
      type: Boolean,
      default: false,
    },
    suspendedAt: {
      type: Date,
      default: null,
    },
    suspendedReason: {
      type: String,
      default: null,
    },
    deletedAt: {
      type: Date,
      default: null,
    },

    // --- Location (shared across all roles) ---
    location: {
      city: { type: String },
      governorate: { type: String },
      coordinates: {
        lat: { type: Number },
        lng: { type: Number },
      },
      lastUpdated: { type: Date },
    },

    // --- FCM Push Notification Tokens ---
    fcmTokens: [{ type: String }],

    // Admin-specific fields (used only for admin / superadmin accounts).
    phone: {
      type: String,
      trim: true,
      default: null,
    },
    address: {
      type: String,
      trim: true,
      default: null,
    },
    adminKey: {
      type: String,
      trim: true,
      unique: true,
      sparse: true,
      select: false,
    },
  },
  { 
    timestamps: true,
    strict: 'throw', // Reject any fields not defined in schema to prevent pollution
  },
);

// Indexes for efficient queries
userSchema.index({ role: 1 });
userSchema.index({ deletedAt: 1 });
if (process.env.ENABLE_GEOSPATIAL_INDEX === 'true') {
  userSchema.index({ 'location.coordinates': '2dsphere' }, { sparse: true });
} else {
  userSchema.index({ 'location.coordinates.lat': 1, 'location.coordinates.lng': 1 });
}

userSchema.pre('save', async function () {
  const hookStartedAt = process.hrtime.bigint();

  // Normalize fullName if modified
  if (this.isModified('fullName')) {
    const normalizeStartedAt = process.hrtime.bigint();
    this.fullNameNormalized = normalizeArabic(this.fullName);
    logger.debug('User pre-save fullName normalization finished', {
      userId: this._id?.toString?.(),
      durationMs: Number(process.hrtime.bigint() - normalizeStartedAt) / 1e6,
    });
  }

  if (!this.isModified('password')) {
    logger.debug('User pre-save skipped password hashing', {
      userId: this._id?.toString?.(),
      durationMs: Number(process.hrtime.bigint() - hookStartedAt) / 1e6,
    });
    return;
  }

  const saltRounds = env.BCRYPT_SALT_ROUNDS || 10;
  const hashStartedAt = process.hrtime.bigint();
  this.password = await bcrypt.hash(this.password, saltRounds);
  logger.debug('User pre-save password hashing finished', {
    userId: this._id?.toString?.(),
    saltRounds,
    durationMs: Number(process.hrtime.bigint() - hashStartedAt) / 1e6,
    totalHookMs: Number(process.hrtime.bigint() - hookStartedAt) / 1e6,
  });
});

/**
 * CASCADE INTEGRITY HOOK - Handle soft-deletion cascades
 *
 * When User.deletedAt is set:
 * - Donor deletion: Cancel pending/scheduled donations; cancel related appointments
 * - Hospital deletion: Cancel pending/in-progress requests; cancel related appointments
 * - Prevent orphaned records and broken referential integrity
 */
userSchema.post('findByIdAndUpdate', async function () {
  try {
    const user = this.getUpdate?.()?.['$set'] || this.getUpdate?.();
    const isDeleted = user?.deletedAt !== undefined || user?.deletedAt !== null;

    if (!isDeleted) return;

    const userId = this.getFilter?.()?.['_id'] || this._conditions?._id;
    if (!userId) return;

    // Dynamic import to avoid circular dependencies
    const { default: Donation } = await import('./Donation.model.js');
    const { default: Appointment } = await import('./Appointment.model.js');
    const { default: Request } = await import('./Request.model.js');
    const { default: UserBadge } = await import('./UserBadge.model.js');
    const { default: Notification } = await import('./Notification.model.js');

    const session = this.session || (await mongoose.startSession());

    try {
      // Get user details to determine role
      const fullUser = await User.findById(userId).session(session);
      if (!fullUser) return;

      if (fullUser.role === 'donor') {
        // Cancel all pending/scheduled donations from this donor
        await Donation.updateMany(
          {
            donorId: userId,
            status: { $in: ['pending', 'scheduled'] },
          },
          {
            $set: { status: 'cancelled', cancelledAt: new Date() },
          },
          { session }
        );

        // Cancel all pending/confirmed appointments for this donor
        await Appointment.updateMany(
          {
            donorId: userId,
            status: { $in: ['pending', 'confirmed'] },
          },
          {
            $set: { status: 'cancelled', cancelledAt: new Date() },
          },
          { session }
        );

        // Clean up user badges (orphaned progress records)
        await UserBadge.deleteMany(
          { donorId: userId },
          { session }
        );
      } else if (fullUser.role === 'hospital') {
        // Cancel all pending/in-progress requests from this hospital
        await Request.updateMany(
          {
            hospitalId: userId,
            status: { $in: ['pending', 'in-progress', 'accepted'] },
          },
          {
            $set: { status: 'cancelled', cancelledAt: new Date() },
          },
          { session }
        );

        // Cancel all pending/confirmed appointments for this hospital
        await Appointment.updateMany(
          {
            hospitalId: userId,
            status: { $in: ['pending', 'confirmed'] },
          },
          {
            $set: { status: 'cancelled', cancelledAt: new Date() },
          },
          { session }
        );

        // Cancel all donations for appointments belonging to this hospital
        const hospitalAppointments = await Appointment.find(
          { hospitalId: userId },
          { _id: 1 },
          { session }
        );
        const appointmentIds = hospitalAppointments.map((a) => a._id);
        if (appointmentIds.length > 0) {
          await Donation.updateMany(
            { appointmentId: { $in: appointmentIds } },
            {
              $set: { status: 'cancelled', cancelledAt: new Date() },
            },
            { session }
          );
        }
      }

      // Clean up orphaned notifications for any deleted user
      await Notification.deleteMany(
        { userId },
        { session }
      );

      logger.info('User cascade deletion completed', {
        userId,
        role: fullUser.role,
      });

      if (!this.session) await session.commitTransaction();
    } catch (error) {
      if (!this.session) await session.abortTransaction();
      logger.error('User cascade deletion failed', {
        userId,
        error: error.message,
      });
      throw error;
    } finally {
      if (!this.session) await session.endSession();
    }
  } catch (error) {
    logger.error('User cascade hook error', {
      error: error.message,
    });
    // Don't throw - let the delete succeed but log the error
  }
});

userSchema.methods.createPasswordResetToken = function () {
  const resetToken = crypto.randomBytes(32).toString('hex');

  this.resetPasswordToken = crypto
    .createHash('sha256')
    .update(resetToken)
    .digest('hex');
  this.resetPasswordExpires = Date.now() + 10 * 60 * 1000;

  return resetToken;
};

userSchema.methods.createEmailVerificationOtp = function () {
  const verificationOtp = String(Math.floor(100000 + Math.random() * 900000));

  this.emailVerificationOtp = crypto
    .createHash('sha256')
    .update(verificationOtp)
    .digest('hex');
  this.emailVerificationOtpExpires = Date.now() + 10 * 60 * 1000;

  return verificationOtp;
};

const User = mongoose.model('User', userSchema);

export default User;
