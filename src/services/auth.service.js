// Define the auth service
/**
 * fields:
 * - register(data) - Register a new user with role-specific fields
 * - login(email, password) - Login a user
 * - logout(refreshToken) - Logout a user
 * - refreshToken(refreshToken) - Refresh access token
 * - forgotPassword(email) - Request password reset
 * - resetPassword(token, password) - Reset password
 * - getMe(userId) - Get current user
 * - verifyEmail(email) - Request email verification
 * - verifyEmailToken(token) - Verify email token
 */

// Auth is the Business Logic Layer for the auth routes

import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import * as jwt from '../utils/jwt.js';
import {
  sendEmailVerificationConfirmationEmail,
  sendEmailVerificationEmail,
  sendPasswordResetConfirmationEmail,
  sendPasswordResetEmail,
} from '../utils/mailer.js';
import User from '../models/User.model.js';
import Donor from '../models/Donor.model.js';
import Hospital from '../models/Hospital.model.js';
import RefreshTokenBlacklist from '../models/RefreshTokenBlacklist.model.js';
import { validateRegister } from '../validation/auth.validation.js';

const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

/**
 * Register a new user with role-specific discriminator
 * CRITICAL: Must use discriminator models (Donor.create / Hospital.create)
 * not the base User model to properly set the __t field
 * @param {object} data - Registration data including role and role-specific fields
 * @returns {object} - { accessToken, refreshToken, user }
 */
export const register = async (data) => {
    const { role, fullName, email, password, ...roleSpecificData } = data;

    // Validate all required fields based on role
    const validation = validateRegister(data);
    if (!validation.valid) {
        const errorMessage = Object.entries(validation.errors)
            .map(([field, error]) => error)
            .join('; ');
        throw new Error(errorMessage);
    }

    // Check if email already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
        throw new Error('Email is already registered');
    }

    // Create user using appropriate discriminator model
    let user;
    const baseData = {
        fullName,
        email,
      password,
        role,
    };

    try {
        if (role === 'donor') {
            // Use Donor discriminator - includes phoneNumber, dateOfBirth, gender, etc.
            user = await Donor.create({
                ...baseData,
                phoneNumber: roleSpecificData.phoneNumber,
                dateOfBirth: roleSpecificData.dateOfBirth,
                ...(roleSpecificData.gender && { gender: roleSpecificData.gender }),
                ...(roleSpecificData.bloodType && { bloodType: roleSpecificData.bloodType }),
                ...(roleSpecificData.location && { location: roleSpecificData.location }),
            });
        } else if (role === 'hospital') {
            // Use Hospital discriminator - includes hospitalName, hospitalId, licenseNumber, etc.
            user = await Hospital.create({
                ...baseData,
                hospitalName: roleSpecificData.hospitalName,
                hospitalId: roleSpecificData.hospitalId,
                licenseNumber: roleSpecificData.licenseNumber,
                ...(roleSpecificData.address && { address: roleSpecificData.address }),
                ...(roleSpecificData.contactNumber && { contactNumber: roleSpecificData.contactNumber }),
            });
        } else {
            throw new Error('Invalid role');
        }
    } catch (error) {
        if (error.name === 'ValidationError') {
            const messages = Object.values(error.errors)
                .map((err) => err.message)
                .join('; ');
            throw new Error(`Validation failed: ${messages}`);
        }
        throw error;
    }

    // Generate tokens
    const accessToken = jwt.signToken({ userId: user._id.toString(), role: user.role });
    const refreshToken = jwt.signRefreshToken({ userId: user._id.toString(), role: user.role });

    const verificationToken = user.createEmailVerificationToken();
    await user.save({ validateBeforeSave: false });
    await sendEmailVerificationEmail({
      to: user.email,
      fullName: user.fullName,
      token: verificationToken,
    });

    const authPayload = {
        accessToken,
        refreshToken,
        user: {
            _id: user._id,
            fullName: user.fullName,
            email: user.email,
            role: user.role,
        },
    };

    // Development-only token exposure for automated E2E tests.
    if (process.env.NODE_ENV !== 'production') {
      authPayload.verificationToken = verificationToken;
    }

    return authPayload;
};

// Login a user
export const login = async ({ email, password }) => {
  const user = await User.findOne({ email }).select('+password +isEmailVerified');

  if (!user) throw new Error('Invalid credentials');

  if (process.env.NODE_ENV !== 'production') {
    console.log('isVerified:', user.isVerified);
  }

  if (!user.isVerified) {
    throw new Error('Email address is not verified');
  }

  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) throw new Error('Invalid credentials');

  // Generate tokens with userId and role
  const accessToken = jwt.signToken({ userId: user._id.toString(), role: user.role });
  const refreshToken = jwt.signRefreshToken({ userId: user._id.toString(), role: user.role });

  return {
    accessToken,
    refreshToken,
    user: {
      _id: user._id,
      fullName: user.fullName,
      email: user.email,
      role: user.role,
    },
  };
};

// Get user by ID
export const getMe = async (userId) => {
  const user = await User.findById(userId).select('-password');
  if (!user) throw new Error('User not found');
  return user;
};

// Logout
export const logout = async (refreshToken) => {
  if (!refreshToken) throw new Error('Refresh token is required');

  const decoded = jwt.verifyRefreshToken(refreshToken);
  if (!decoded?.exp || !decoded?.userId) {
    throw new Error('Invalid refresh token');
  }

  const tokenHash = hashToken(refreshToken);
  const expiresAt = new Date(decoded.exp * 1000);

  await RefreshTokenBlacklist.updateOne(
    { tokenHash },
    {
      $setOnInsert: {
        tokenHash,
        userId: decoded.userId,
        expiresAt,
      },
    },
    { upsert: true }
  );

  return { success: true };
};

// Refresh token
export const refreshToken = async (refreshTokenValue) => {
  if (!refreshTokenValue) throw new Error('Refresh token is required');

  const tokenHash = hashToken(refreshTokenValue);
  const blacklistedToken = await RefreshTokenBlacklist.findOne({ tokenHash });
  if (blacklistedToken) {
    throw new Error('Refresh token is invalid');
  }
  
  const decoded = jwt.verifyRefreshToken(refreshTokenValue);
  const user = await User.findById(decoded.userId).select('+passwordChangedAt');
  if (!user) throw new Error('User not found');

  if (user.passwordChangedAt && decoded?.iat) {
    const tokenIssuedAtMs = decoded.iat * 1000;
    if (tokenIssuedAtMs < user.passwordChangedAt.getTime()) {
      throw new Error('Refresh token is invalid');
    }
  }
  
  const accessToken = jwt.signToken({ userId: user._id.toString(), role: user.role });
  
  return { accessToken };
};

// Forgot password
export const forgotPassword = async (email) => {
  if (!email) {
    throw new Error('Email is required');
  }

  const user = await User.findOne({ email });

  // Do not reveal whether an account exists for this email.
  if (!user) {
    return { success: true };
  }

  const resetToken = user.createPasswordResetToken();
  await user.save({ validateBeforeSave: false });
  await sendPasswordResetEmail({
    to: user.email,
    fullName: user.fullName,
    token: resetToken,
  });

  return { success: true };
};

// Reset password
export const resetPassword = async (token, password) => {
  if (!token) throw new Error('Reset token is required');
  if (!password) throw new Error('Password is required');

  const hashedToken = hashToken(token);
  const user = await User.findOne({
    resetPasswordToken: hashedToken,
    resetPasswordExpires: { $gt: Date.now() },
  }).select('+resetPasswordToken +resetPasswordExpires +password');

  if (!user) {
    throw new Error('Invalid or expired reset token');
  }

  user.password = password;
  // Invalidate previously issued refresh tokens by shifting credential epoch.
  user.passwordChangedAt = new Date();
  user.resetPasswordToken = undefined;
  user.resetPasswordExpires = undefined;
  await user.save();

  if (process.env.NODE_ENV !== 'production') {
    console.log('All sessions invalidated for user:', user._id.toString());
  }

  await sendPasswordResetConfirmationEmail({
    to: user.email,
    fullName: user.fullName,
  });

  return { success: true, message: 'Password reset successfully' };
};

// Verify email
export const verifyEmail = async (email) => {
  const user = await User.findOne({ email });
  if (!user) throw new Error('User not found');

  const verificationToken = user.createEmailVerificationToken();
  await user.save({ validateBeforeSave: false });
  await sendEmailVerificationEmail({
    to: user.email,
    fullName: user.fullName,
    token: verificationToken,
  });

  return { success: true, verificationToken };
};

// Verify email token
export const verifyEmailToken = async (token) => {
  if (!token) throw new Error('Verification token is required');

  const hashedToken = hashToken(token);
  const user = await User.findOne({
    emailVerificationToken: hashedToken,
    emailVerificationExpires: { $gt: Date.now() },
  }).select('+emailVerificationToken +emailVerificationExpires');

  if (!user) {
    throw new Error('Invalid or expired verification token');
  }

  user.isVerified = true;
  user.emailVerifiedAt = new Date();
  user.emailVerificationToken = undefined;
  user.emailVerificationExpires = undefined;
  await user.save();

  await sendEmailVerificationConfirmationEmail({
    to: user.email,
    fullName: user.fullName,
  });

  return { success: true };
};