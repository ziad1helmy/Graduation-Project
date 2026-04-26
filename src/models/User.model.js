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
 *  - Email verification  : token + expiry fields, select: false
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
    emailVerificationToken: {
      type: String,
      select: false,
    },
    emailVerificationExpires: {
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
  },
  { timestamps: true },
);

// 2dsphere index for future geo-based queries (e.g. nearby donors)
userSchema.index({ 'location.coordinates': '2dsphere' });

userSchema.pre('save', async function () {
  if (!this.isModified('password')) {
    return;
  }

  const saltRounds = env.BCRYPT_SALT_ROUNDS || 10;
  this.password = await bcrypt.hash(this.password, saltRounds);
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

userSchema.methods.createEmailVerificationToken = function () {
  const verificationToken = crypto.randomBytes(32).toString('hex');

  this.emailVerificationToken = crypto
    .createHash('sha256')
    .update(verificationToken)
    .digest('hex');
  this.emailVerificationExpires = Date.now() + 24 * 60 * 60 * 1000;

  return verificationToken;
};

const User = mongoose.model('User', userSchema);

export default User;
