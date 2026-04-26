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
  sendPasswordResetOtpEmail,
  sendPasswordResetConfirmationEmail,
  sendPasswordResetEmail,
} from '../utils/mailer.js';
import User from '../models/User.model.js';
import Donor from '../models/Donor.model.js';
import Hospital from '../models/Hospital.model.js';
import RefreshTokenBlacklist from '../models/RefreshTokenBlacklist.model.js';
import { validateRegister } from '../validation/auth.validation.js';
import OneTimeOtp from '../models/OneTimeOtp.model.js';
import TwoFactor from '../models/TwoFactor.model.js';

const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');
const hashOtp = (otp) => crypto.createHash('sha256').update(String(otp)).digest('hex');
const generateOtp = () => String(Math.floor(100000 + Math.random() * 900000));
const generateSecret = () => crypto.randomBytes(20).toString('hex');
const generateBackupCodes = () => Array.from({ length: 6 }, () => crypto.randomBytes(4).toString('hex').toUpperCase());
const totpCounter = (timestamp = Date.now()) => Math.floor(timestamp / 30000);
const generateTotp = (secret, counter = totpCounter()) => {
  const hmac = crypto.createHmac('sha1', secret).update(String(counter)).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const code = ((hmac[offset] & 0x7f) << 24)
    | ((hmac[offset + 1] & 0xff) << 16)
    | ((hmac[offset + 2] & 0xff) << 8)
    | (hmac[offset + 3] & 0xff);
  return String(code % 1000000).padStart(6, '0');
};
const PASSWORD_RESET_OTP_PURPOSE = 'password_reset';
const RESET_TOKEN_TTL_MS = 10 * 60 * 1000;
const TWO_FACTOR_TEMP_TOKEN_TTL = '10m';

const createScopedToken = (payload, purpose, expiresIn) => (
  jwt.signToken({ ...payload, purpose }, { expiresIn })
);

const normalizeFcmToken = (token) => (typeof token === 'string' ? token.trim() : '');

const uniqueCleanTokens = (tokens = []) => [...new Set(
  tokens
    .filter((token) => typeof token === 'string')
    .map((token) => token.trim())
    .filter(Boolean)
)];

const verifyScopedToken = (token, expectedPurpose) => {
  const decoded = jwt.verifyToken(token);
  if (decoded?.purpose !== expectedPurpose) {
    throw new Error('Invalid or expired token');
  }
  return decoded;
};

const buildAuthPayload = (user) => {
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

export const sendOtp = async ({ email }) => {
  if (!email) throw new Error('Email is required');

  const normalizedEmail = String(email).trim().toLowerCase();
  const user = await User.findOne({ email: normalizedEmail });
  if (!user) {
    throw new Error('Account not found');
  }

  const otp = generateOtp();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
  await OneTimeOtp.updateMany(
    {
      email: normalizedEmail,
      purpose: PASSWORD_RESET_OTP_PURPOSE,
      resetTokenUsedAt: null,
    },
    {
      $set: {
        expiresAt: new Date(),
        resetTokenExpiresAt: new Date(),
      },
      $unset: {
        resetTokenHash: 1,
      },
    }
  );

  await OneTimeOtp.create({
    userId: user._id,
    email: normalizedEmail,
    purpose: PASSWORD_RESET_OTP_PURPOSE,
    otpHash: hashOtp(otp),
    expiresAt,
    lastSentAt: new Date(),
  });

  if (process.env.NODE_ENV !== 'production') {
    console.log(`[OTP] ${PASSWORD_RESET_OTP_PURPOSE} for ${normalizedEmail}: ${otp}`);
  }

  await sendPasswordResetOtpEmail({
    to: user.email,
    fullName: user.fullName,
    otp,
    expiresInMinutes: 10,
  });

  return {
    success: true,
    purpose: PASSWORD_RESET_OTP_PURPOSE,
    expires_in_seconds: 600,
    ...(process.env.NODE_ENV !== 'production' ? { otp } : {}),
  };
};

export const verifyOtp = async ({ email, otp }) => {
  if (!email) throw new Error('Email is required');
  if (!otp) throw new Error('OTP is required');

  const normalizedEmail = String(email).trim().toLowerCase();
  const record = await OneTimeOtp.findOne({
    email: normalizedEmail,
    purpose: PASSWORD_RESET_OTP_PURPOSE,
    verifiedAt: null,
    expiresAt: { $gt: new Date() },
  }).sort({ createdAt: -1 });

  if (!record) throw new Error('Invalid or expired OTP');
  if (record.attempts >= 5) throw new Error('OTP attempts exceeded');

  record.attempts += 1;
  if (record.otpHash !== hashOtp(otp)) {
    await record.save();
    throw new Error('Invalid OTP');
  }

  record.verifiedAt = new Date();
  const resetToken = crypto.randomBytes(32).toString('hex');
  record.resetTokenHash = hashToken(resetToken);
  record.resetTokenExpiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MS);
  record.resetTokenUsedAt = null;
  await record.save();
  return {
    verified: true,
    resetToken,
  };
};

export const setup2FA = async (userId) => {
  const user = await User.findById(userId);
  if (!user) throw new Error('User not found');

  let tf = await TwoFactor.findOne({ userId });
  if (!tf) tf = await TwoFactor.create({ userId });

  const secret = generateSecret();
  const backupCodes = generateBackupCodes();
  tf.pendingSecret = secret;
  tf.pendingBackupCodes = backupCodes;
  await tf.save();

  return {
    secret,
    backup_codes: backupCodes,
    qr_code: `otpauth://totp/LifeLink:${encodeURIComponent(user.email)}?secret=${secret}&issuer=LifeLink`,
  };
};

export const verify2FA = async (userId, otp) => {
  if (!otp) throw new Error('OTP is required');

  const tf = await TwoFactor.findOne({ userId });
  if (!tf || !tf.pendingSecret) throw new Error('2FA setup not found');

  const expected = generateTotp(tf.pendingSecret);
  const backupIndex = tf.pendingBackupCodes.indexOf(String(otp).trim().toUpperCase());

  if (otp !== expected && backupIndex === -1) {
    throw new Error('Invalid 2FA code');
  }

  tf.enabled = true;
  tf.secret = tf.pendingSecret;
  tf.backupCodes = tf.pendingBackupCodes;
  tf.pendingSecret = null;
  tf.pendingBackupCodes = [];
  tf.verifiedAt = new Date();
  await tf.save();

  return { success: true };
};

export const disable2FA = async (userId, password) => {
  if (!password) throw new Error('Password is required');

  const user = await User.findById(userId).select('+password');
  if (!user) throw new Error('User not found');

  const match = await bcrypt.compare(password, user.password);
  if (!match) throw new Error('Invalid password');

  const tf = await TwoFactor.findOne({ userId });
  if (!tf) return { success: true };

  tf.enabled = false;
  tf.secret = null;
  tf.backupCodes = [];
  tf.pendingSecret = null;
  tf.pendingBackupCodes = [];
  tf.disabledAt = new Date();
  await tf.save();

  return { success: true };
};

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
                ...(roleSpecificData.location && { location: roleSpecificData.location }),
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

    const verificationToken = user.createEmailVerificationToken();
    await user.save({ validateBeforeSave: false });
    await sendEmailVerificationEmail({
      to: user.email,
      fullName: user.fullName,
      token: verificationToken,
    });

    const authPayload = buildAuthPayload(user);

    // Development-only token exposure for automated E2E tests.
    if (process.env.NODE_ENV !== 'production') {
      authPayload.verificationToken = verificationToken;
    }

    return authPayload;
};

// Login a user
export const login = async ({ email, password }) => {
  const user = await User.findOne({ email }).select('fullName email role isEmailVerified isSuspended deletedAt +password');

  if (!user) throw new Error('Invalid credentials');


  // Block soft-deleted accounts — same message as invalid credentials to avoid enumeration
  if (user.deletedAt) {
    throw new Error('Invalid credentials');
  }

  // Block suspended accounts with a clear message
  if (user.isSuspended) {
    throw new Error('Account is suspended. Contact support.');
  }

  if (!user.isEmailVerified) {
    throw new Error('Email address is not verified');
  }

  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) throw new Error('Invalid credentials');

  const tf = await TwoFactor.findOne({ userId: user._id }).select('enabled secret');
  if (tf?.enabled && tf.secret) {
    const tempToken = createScopedToken(
      { userId: user._id.toString(), role: user.role, twoFactor: true },
      'two_factor_auth',
      TWO_FACTOR_TEMP_TOKEN_TTL
    );

    return {
      requires2FA: true,
      tempToken,
      message: '2FA verification required',
    };
  }

  return buildAuthPayload(user);
};

// Get user by ID
export const getMe = async (userId) => {
  const user = await User.findById(userId).select('-password');
  if (!user) throw new Error('User not found');
  return user;
};

export const registerFcmToken = async (userId, fcmToken) => {
  const normalizedToken = normalizeFcmToken(fcmToken);

  if (!normalizedToken) {
    throw new Error('fcmToken is required');
  }

  const user = await User.findById(userId);
  if (!user) {
    throw new Error('User not found');
  }

  const currentTokens = user.fcmTokens || [];
  const cleanedTokens = uniqueCleanTokens([...currentTokens, normalizedToken]);

  user.fcmTokens = cleanedTokens;
  await user.save({ validateBeforeSave: false });

  return {
    fcmToken: normalizedToken,
    tokenCount: cleanedTokens.length,
  };
};

export const replaceFcmToken = async (userId, fcmToken) => {
  const normalizedToken = normalizeFcmToken(fcmToken);

  if (!normalizedToken) {
    throw new Error('fcmToken is required');
  }

  const result = await User.updateOne(
    { _id: userId },
    {
      $set: { fcmTokens: [normalizedToken] },
    }
  );

  if (result.matchedCount === 0) {
    throw new Error('User not found');
  }

  return {
    fcmToken: normalizedToken,
    tokenCount: 1,
  };
};

export const removeFcmToken = async (userId, fcmToken) => {
  const normalizedToken = normalizeFcmToken(fcmToken);

  if (!normalizedToken) {
    throw new Error('fcmToken is required');
  }

  const result = await User.updateOne(
    { _id: userId },
    {
      $pull: {
        fcmTokens: { $in: [normalizedToken, null, ''] },
      },
    }
  );

  if (result.matchedCount === 0) {
    throw new Error('User not found');
  }

  return {
    fcmToken: normalizedToken,
  };
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
  let user = await User.findOne({
    resetPasswordToken: hashedToken,
    resetPasswordExpires: { $gt: Date.now() },
  }).select('+resetPasswordToken +resetPasswordExpires +password');

  let otpRecord = null;
  if (!user) {
    otpRecord = await OneTimeOtp.findOne({
      resetTokenHash: hashedToken,
      resetTokenExpiresAt: { $gt: new Date() },
      resetTokenUsedAt: null,
      purpose: PASSWORD_RESET_OTP_PURPOSE,
      verifiedAt: { $ne: null },
    }).sort({ createdAt: -1 });

    if (!otpRecord) {
      throw new Error('Invalid or expired reset token');
    }

    user = await User.findById(otpRecord.userId).select('+password');
    if (!user) {
      throw new Error('Invalid or expired reset token');
    }
  }

  user.password = password;
  // Invalidate previously issued refresh tokens by shifting credential epoch.
  user.passwordChangedAt = new Date();
  user.resetPasswordToken = undefined;
  user.resetPasswordExpires = undefined;
  await user.save();

  if (otpRecord) {
    otpRecord.resetTokenUsedAt = new Date();
    await otpRecord.save();
  }

  if (process.env.NODE_ENV !== 'production') {
    console.log('All sessions invalidated for user:', user._id.toString());
  }

  await sendPasswordResetConfirmationEmail({
    to: user.email,
    fullName: user.fullName,
  });

  return { success: true, message: 'Password reset successfully' };
};

export const verify2FALogin = async (tempToken, code) => {
  if (!tempToken) throw new Error('tempToken is required');
  if (!code) throw new Error('2FA code is required');

  const decoded = verifyScopedToken(tempToken, 'two_factor_auth');
  const tf = await TwoFactor.findOne({ userId: decoded.userId });
  if (!tf?.enabled || !tf.secret) {
    throw new Error('2FA is not enabled');
  }

  const normalizedCode = String(code).trim();
  const expectedCodes = [
    generateTotp(tf.secret, totpCounter(Date.now() - 30000)),
    generateTotp(tf.secret, totpCounter()),
    generateTotp(tf.secret, totpCounter(Date.now() + 30000)),
  ];
  const backupIndex = tf.backupCodes.indexOf(normalizedCode.toUpperCase());

  if (!expectedCodes.includes(normalizedCode) && backupIndex === -1) {
    throw new Error('Invalid 2FA code');
  }

  if (backupIndex !== -1) {
    tf.backupCodes.splice(backupIndex, 1);
    await tf.save();
  }

  const user = await User.findById(decoded.userId);
  if (!user) throw new Error('User not found');
  if (user.deletedAt) throw new Error('Invalid credentials');
  if (user.isSuspended) throw new Error('Account is suspended. Contact support.');
  if (!user.isEmailVerified) throw new Error('Email address is not verified');

  return buildAuthPayload(user);
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

  user.isEmailVerified = true;
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
