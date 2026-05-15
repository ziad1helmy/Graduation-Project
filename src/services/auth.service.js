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
 * - verifyEmailOtp(email, otp) - Verify email OTP
 */

// Auth is the Business Logic Layer for the auth routes

import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import * as jwt from '../utils/jwt.js';
import { logger } from '../utils/logger.js';
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
import { ERR } from '../utils/errorCodes.js';
import * as adminService from './admin.service.js';

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

const createServiceError = (message, statusCode = 400) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const hrtimeMs = (start) => Number(process.hrtime.bigint() - start) / 1e6;

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

const loadLoginUser = async ({ email, password, role, hospitalId }) => {
  if (!email) throw new Error('Email is required');
  if (!password) throw new Error('Password is required');
  if (!role) throw new Error('Role is required');

  const normalizedEmail = String(email).trim().toLowerCase();
  const user = await User.findOne({ email: normalizedEmail })
    .select('+password +passwordChangedAt +deletedAt +isSuspended +isEmailVerified +hospitalId')
    .lean();

  if (!user) {
    throw new Error('Invalid credentials');
  }

  if (user.deletedAt) {
    throw new Error('Invalid credentials');
  }

  if (user.isSuspended) {
    throw new Error('Account is suspended. Contact support.');
  }

  if (!user.isEmailVerified) {
    throw new Error('Email address is not verified');
  }

  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) throw new Error('Invalid credentials');

  if (user.role !== role) {
    throw new Error('Invalid role for this account');
  }

  if (role === 'hospital') {
    if (!hospitalId || user.hospitalId !== hospitalId) {
      throw new Error('Invalid hospital ID');
    }
  }

  const tf = await TwoFactor.findOne({ userId: user._id }).select('enabled secret').lean();
  return { user, twoFactorEnabled: Boolean(tf?.enabled && tf.secret) };
};

const toLoginUserResponse = (user, { requires2FA = false, tempToken = null, hospitalId = null } = {}) => {
  if (requires2FA) {
    const response = {
      requires2FA: true,
      tempToken,
      message: '2FA verification required',
      user: {
        _id: user._id,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
      },
    };
    if (hospitalId) {
      response.hospitalId = hospitalId;
    }
    return response;
  }

  const authPayload = buildAuthPayload(user);
  if (hospitalId) {
    authPayload.hospitalId = hospitalId;
  }
  return authPayload;
};

const toLoginAdminResponse = (user) => ({
  admin: {
    _id: user._id,
    fullName: user.fullName,
    email: user.email,
    role: user.role,
  },
  tokens: {
    accessToken: jwt.signToken({ userId: user._id.toString(), role: user.role }),
    refreshToken: jwt.signRefreshToken({ userId: user._id.toString(), role: user.role }),
  },
});

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
    logger.info('OTP generated', {
      purpose: PASSWORD_RESET_OTP_PURPOSE,
      email: normalizedEmail,
    });
  }

  // Send OTP asynchronously (fire-and-forget) to avoid blocking endpoint response.
  void sendPasswordResetOtpEmail({
    to: user.email,
    fullName: user.fullName,
    otp,
    expiresInMinutes: 10,
  }).catch((err) => {
    logger.warn('Background OTP send failed', { email: user.email, message: err?.message });
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
    resetTokenUsedAt: null,
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
  await record.save();
  return {
    verified: true,
  };
};

export const setup2FA = async (userId) => {
  const user = await User.findById(userId).select('email').lean();
  if (!user) throw createServiceError(ERR.AUTH_USER_NOT_FOUND, 404);

  const secret = generateSecret();
  const backupCodes = generateBackupCodes();

  // Upsert pending secret/backup codes in a single operation to avoid extra roundtrips
  await TwoFactor.findOneAndUpdate(
    { userId },
    {
      $set: { pendingSecret: secret, pendingBackupCodes: backupCodes },
    },
    { upsert: true, returnDocument: 'after' }
  );

  return {
    secret,
    backup_codes: backupCodes,
    qr_code: `otpauth://totp/LifeLink:${encodeURIComponent(user.email)}?secret=${secret}&issuer=LifeLink`,
  };
};

export const verify2FA = async (userId, otp) => {
  if (!otp) throw createServiceError(ERR.TWO_FA_CODE_REQUIRED, 400);

  // Read pending secret and backup codes as a plain object for fast verification
  const tf = await TwoFactor.findOne({ userId }).select('pendingSecret pendingBackupCodes').lean();
  if (!tf || !tf.pendingSecret) throw createServiceError(ERR.TWO_FA_SETUP_NOT_FOUND, 400);

  const expected = generateTotp(tf.pendingSecret);
  const backupIndex = (tf.pendingBackupCodes || []).indexOf(String(otp).trim().toUpperCase());

  if (otp !== expected && backupIndex === -1) {
    throw createServiceError(ERR.TWO_FA_CODE_INVALID, 400);
  }

  // Atomically enable 2FA and persist secret/backup codes, clearing pending fields
  await TwoFactor.findOneAndUpdate(
    { userId },
    {
      $set: {
        enabled: true,
        secret: tf.pendingSecret,
        backupCodes: tf.pendingBackupCodes || [],
        verifiedAt: new Date(),
      },
      $unset: { pendingSecret: '', pendingBackupCodes: '' },
    },
    { returnDocument: 'after' }
  );

  return { success: true };
};

export const disable2FA = async (userId, password) => {
  if (!password) throw createServiceError('Password is required', 400);

  const user = await User.findById(userId).select('+password').lean();
  if (!user) throw createServiceError(ERR.AUTH_USER_NOT_FOUND, 404);

  const match = await bcrypt.compare(password, user.password);
  if (!match) throw createServiceError(ERR.AUTH_INVALID_PASSWORD, 401);

  // Atomically disable 2FA and clear secrets
  await TwoFactor.findOneAndUpdate(
    { userId },
    {
      $set: {
        enabled: false,
        secret: null,
        backupCodes: [],
        pendingSecret: null,
        pendingBackupCodes: [],
        disabledAt: new Date(),
      },
    },
    { returnDocument: 'after' }
  );

  return { success: true };
};

/**
 * Register a new user with role-specific discriminator
 * CRITICAL: Must use discriminator models (Donor.create / Hospital.create)
 * not the base User model to properly set the __t field
 * @param {object} data - Registration data including role and role-specific fields
 * @returns {object} - { accessToken, refreshToken, user }
 */
export const register = async (data, trace = {}) => {
    const traceId = trace.traceId || `signup-${Date.now()}`;
    const requestStartedAt = process.hrtime.bigint();
    const { role, fullName, email, password, location, ...roleSpecificData } = data;

    if (role !== 'donor') {
      throw createServiceError('Public signup is available for donors only', 403);
    }

    logger.info('Signup validation starting', {
      traceId,
      email,
      role,
    });

    // Validate all required fields based on role
    const validationStartedAt = process.hrtime.bigint();
    const validation = validateRegister(data);
    logger.info('Signup validation finished', {
      traceId,
      email,
      role,
      validationMs: Number(hrtimeMs(validationStartedAt).toFixed(3)),
      valid: validation.valid,
    });
    if (!validation.valid) {
        const errorMessage = Object.entries(validation.errors)
            .map(([field, error]) => error)
            .join('; ');
        throw new Error(errorMessage);
    }

    logger.info('Signup duplicate email lookup starting', {
      traceId,
      email,
      role,
    });

    // Check if email already exists
    const duplicateLookupStartedAt = process.hrtime.bigint();
    const existingUser = await User.findOne({ email });
    logger.info('Signup duplicate email lookup finished', {
      traceId,
      email,
      role,
      lookupMs: Number(hrtimeMs(duplicateLookupStartedAt).toFixed(3)),
      found: Boolean(existingUser),
    });
    if (existingUser) {
        throw new Error('Email is already registered');
    }

    let normalizedLocation = location;
    if (location && typeof location === 'object' && !Array.isArray(location)) {
      const rawLat = location.coordinates?.lat ?? location.lat ?? location.latitude;
      const rawLng = location.coordinates?.lng ?? location.lng ?? location.longitude;
      const lat = rawLat === '' || rawLat === undefined || rawLat === null ? undefined : Number(rawLat);
      const lng = rawLng === '' || rawLng === undefined || rawLng === null ? undefined : Number(rawLng);
      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        normalizedLocation = {
          ...location,
          coordinates: { lat, lng },
        };
        delete normalizedLocation.lat;
        delete normalizedLocation.lng;
        delete normalizedLocation.latitude;
        delete normalizedLocation.longitude;
      }
    }

    // Base user data (shared across all roles)
    const baseData = {
        fullName,
        email,
        password,
        role,
        ...(normalizedLocation && { location: normalizedLocation }),
    };

    let user;
    try {
        logger.info('Signup database write starting', {
          traceId,
          email,
          role,
        });

        const writeStartedAt = process.hrtime.bigint();
        if (role === 'donor') {
            // Use Donor discriminator with donor-specific fields only
            user = await Donor.create({
                ...baseData,
                phoneNumber: roleSpecificData.phoneNumber,
                dateOfBirth: roleSpecificData.dateOfBirth,
                bloodType: roleSpecificData.bloodType,
                ...(roleSpecificData.gender && { gender: roleSpecificData.gender }),
            });
        } else {
            throw new Error('Invalid role');
        }

        logger.info('Signup database write finished', {
          traceId,
          email,
          role,
          writeMs: Number(hrtimeMs(writeStartedAt).toFixed(3)),
          userId: user?._id?.toString(),
        });
    } catch (error) {
        if (error.name === 'ValidationError') {
            const messages = Object.values(error.errors)
                .map((err) => err.message)
                .join('; ');
            throw new Error(`Validation failed: ${messages}`);
        }
        throw error;
    }

    const verificationOtp = user.createEmailVerificationOtp();
    logger.info('Signup verification-code save starting', {
      traceId,
      email,
      role,
    });
    const tokenSaveStartedAt = process.hrtime.bigint();
    await user.save({ validateBeforeSave: false });
    logger.info('Signup verification-code save finished', {
      traceId,
      email,
      role,
      saveMs: Number(hrtimeMs(tokenSaveStartedAt).toFixed(3)),
    });

    // Attempt to send verification email with a short timeout to prevent blocking signup
    let verificationEmail = null;
    const emailPromise = sendEmailVerificationEmail({
      to: user.email,
      fullName: user.fullName,
      otp: verificationOtp,
    });

    try {
      verificationEmail = await Promise.race([
        emailPromise,
        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 2000))
      ]);
    } catch (err) {
      if (err.message === 'timeout') {
        verificationEmail = { pending: true };
        // Continue in the background
        emailPromise.catch((backgroundErr) => {
          logger.warn('Background verification-email send failed', {
            traceId,
            email: user.email,
            message: backgroundErr?.message,
          });
        });
      } else {
        verificationEmail = { sent: false, error: err?.message || 'Failed to send verification email' };
        logger.warn('Verification-email send failed', {
          traceId,
          email: user.email,
          message: err?.message,
        });
      }
    }

    if (verificationEmail?.skipped) {
      logger.warn('Verification-email skipped', {
        traceId,
        email: user.email,
        reason: verificationEmail.reason,
      });
    }

    logger.info('Signup completed', {
      traceId,
      email,
      role,
      totalMs: Number(hrtimeMs(requestStartedAt).toFixed(3)),
    });

    // Return created user and tokens.
    const authPayload = buildAuthPayload(user);
    return {
      user,
      accessToken: authPayload.accessToken,
      refreshToken: authPayload.refreshToken,
      verificationEmail,
    };
};

export const loginUser = async (data) => {
  const { user, twoFactorEnabled } = await loadLoginUser({ ...data });

  if (twoFactorEnabled) {
    const tempToken = createScopedToken(
      { userId: user._id.toString(), role: user.role, twoFactor: true },
      'two_factor_auth',
      TWO_FACTOR_TEMP_TOKEN_TTL
    );

    return toLoginUserResponse(user, { requires2FA: true, tempToken });
  }

  return toLoginUserResponse(user);
};

// Dedicated donor login helper (explicit method)
export const loginDonor = async (data) => {
  // delegate to existing loginUser logic but enforce donor role
  return loginUser({ ...data, role: 'donor' });
};

// Dedicated hospital login - does not require hospitalId here (simple email+password)
export const loginHospital = async (data) => {
  const { email, password } = data || {};
  if (!email) throw new Error('Email is required');
  if (!password) throw new Error('Password is required');

  const normalizedEmail = String(email).trim().toLowerCase();
  const user = await User.findOne({ email: normalizedEmail, role: 'hospital' })
    .select('+password +passwordChangedAt +deletedAt +isSuspended +isEmailVerified +hospitalId')
    .lean();

  if (!user) throw new Error('Invalid credentials');
  if (user.deletedAt) throw new Error('Invalid credentials');
  if (user.isSuspended) throw new Error('Account is suspended. Contact support.');
  if (!user.isEmailVerified) throw new Error('Email address is not verified');

  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) throw new Error('Invalid credentials');

  // Check two-factor
  const tf = await TwoFactor.findOne({ userId: user._id }).select('enabled secret').lean();
  if (tf?.enabled && tf.secret) {
    const tempToken = createScopedToken(
      { userId: user._id.toString(), role: user.role, twoFactor: true },
      'two_factor_auth',
      TWO_FACTOR_TEMP_TOKEN_TTL
    );
    return toLoginUserResponse(user, { requires2FA: true, tempToken, hospitalId: user.hospitalId });
  }

  return toLoginUserResponse(user, { hospitalId: user.hospitalId });
};

export const loginAdmin = async (data) => {
  return adminService.loginAdmin(data.email, data.password, data.adminKey);
};

export const login = loginUser;

// Get user by ID
export const getMe = async (userId) => {
  const user = await User.findById(userId).select('-password');
  if (!user) throw new Error('User not found');
  return user;
};

/**
 * Maximum number of FCM tokens allowed per user (prevents abuse).
 */
const MAX_TOKENS_PER_USER = 10;

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
  let cleanedTokens = uniqueCleanTokens([...currentTokens, normalizedToken]);

  // Enforce per-user token cap — keep most recently added tokens
  if (cleanedTokens.length > MAX_TOKENS_PER_USER) {
    cleanedTokens = cleanedTokens.slice(-MAX_TOKENS_PER_USER);
  }

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
export const logout = async (refreshToken, fcmToken = null, userId = null) => {
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

  // Remove the FCM token for this device so push notifications stop after logout
  const resolvedUserId = userId || decoded.userId;
  const normalizedFcmToken = fcmToken ? normalizeFcmToken(fcmToken) : null;
  if (normalizedFcmToken && resolvedUserId) {
    User.updateOne(
      { _id: resolvedUserId },
      { $pull: { fcmTokens: normalizedFcmToken } }
    ).catch(() => {}); // fire-and-forget — never block logout
  }

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

export const forgotPassword = async (email) => {
  if (!email) {
    throw new Error('Email is required');
  }

  try {
    await sendOtp({ email });
  } catch (error) {
    if (error.message !== 'Account not found') {
      throw error;
    }
  }

  return { success: true };
};

// Reset password
export const resetPassword = async ({ email, otp, password }) => {
  if (!email) throw new Error('Email is required');
  if (!otp) throw new Error('OTP is required');
  if (!password) throw new Error('Password is required');

  const normalizedEmail = String(email).trim().toLowerCase();
  const record = await OneTimeOtp.findOne({
    email: normalizedEmail,
    purpose: PASSWORD_RESET_OTP_PURPOSE,
    resetTokenUsedAt: null,
  }).sort({ createdAt: -1 });

  if (!record) throw new Error('Invalid or expired OTP');

  if (record.otpHash !== hashOtp(otp)) {
    record.attempts += 1;
    await record.save();
    throw new Error('Invalid OTP');
  }

  if (!record.verifiedAt && record.expiresAt < new Date()) {
    throw new Error('Invalid or expired OTP');
  }

  const user = await User.findById(record.userId).select('+password');
  if (!user) {
    throw new Error('Invalid or expired OTP');
  }

  user.password = password;
  // Invalidate previously issued refresh tokens by shifting credential epoch.
  user.passwordChangedAt = new Date();
  user.resetPasswordToken = undefined;
  user.resetPasswordExpires = undefined;
  await user.save();

  record.verifiedAt = record.verifiedAt || new Date();
  record.resetTokenUsedAt = new Date();
  await record.save();

  if (process.env.NODE_ENV !== 'production') {
    logger.info('All sessions invalidated for user', {
      userId: user._id.toString(),
    });
  }

  // Fire-and-forget confirmation email
  void sendPasswordResetConfirmationEmail({
    to: user.email,
    fullName: user.fullName,
  }).catch((err) => {
    logger.warn('Background password-reset confirmation email failed', { email: user.email, message: err?.message });
  });

  return { success: true, message: 'Password reset successfully' };
};

export const changePassword = async (userId, { currentPassword, newPassword }) => {
  if (!userId) throw createServiceError(ERR.AUTH_USER_NOT_FOUND, 404);
  if (!currentPassword) throw createServiceError('Current password is required', 400);
  if (!newPassword) throw createServiceError('New password is required', 400);

  const user = await User.findById(userId).select('+password +passwordChangedAt');
  if (!user) throw createServiceError(ERR.AUTH_USER_NOT_FOUND, 404);

  const isMatch = await bcrypt.compare(currentPassword, user.password);
  if (!isMatch) throw createServiceError(ERR.AUTH_INVALID_PASSWORD, 401);

  user.password = newPassword;
  user.passwordChangedAt = new Date();
  await user.save();

  void sendPasswordResetConfirmationEmail({
    to: user.email,
    fullName: user.fullName,
  }).catch((err) => {
    logger.warn('Background password-change confirmation email failed', {
      email: user.email,
      message: err?.message,
    });
  });

  return { success: true };
};

export const verify2FALogin = async (tempToken, code) => {
  if (!tempToken) throw createServiceError(ERR.TWO_FA_TEMP_TOKEN_REQUIRED, 400);
  if (!code) throw createServiceError(ERR.TWO_FA_CODE_REQUIRED, 400);

  const decoded = verifyScopedToken(tempToken, 'two_factor_auth');

  // Read TF doc with lean for fast verification
  const tf = await TwoFactor.findOne({ userId: decoded.userId }).select('enabled secret backupCodes failedAttempts lockedUntil').lean();
  if (!tf?.enabled || !tf.secret) {
    throw createServiceError(ERR.TWO_FA_NOT_ENABLED, 400);
  }

  if (tf.lockedUntil && new Date(tf.lockedUntil) > new Date()) {
    throw createServiceError('Account temporarily locked due to too many failed 2FA attempts', 429);
  }

  const normalizedCode = String(code).trim();
  const expectedCodes = [
    generateTotp(tf.secret, totpCounter(Date.now() - 30000)),
    generateTotp(tf.secret, totpCounter()),
    generateTotp(tf.secret, totpCounter(Date.now() + 30000)),
  ];
  const backupExists = (tf.backupCodes || []).includes(normalizedCode.toUpperCase());

  if (!expectedCodes.includes(normalizedCode) && !backupExists) {
    const failedAttempts = (tf.failedAttempts || 0) + 1;
    const lockedUntil = failedAttempts >= 5 ? new Date(Date.now() + 15 * 60000) : null;
    await TwoFactor.updateOne({ userId: decoded.userId }, { $set: { failedAttempts, lockedUntil } });
    throw createServiceError(ERR.TWO_FA_CODE_INVALID, 400);
  }

  // If code is correct, reset failures and remove backup code if used
  const updatePayload = { $set: { failedAttempts: 0, lockedUntil: null } };
  if (backupExists) {
    updatePayload.$pull = { backupCodes: normalizedCode.toUpperCase() };
  }
  await TwoFactor.updateOne({ userId: decoded.userId }, updatePayload);

  const user = await User.findById(decoded.userId).select('-password').lean();
  if (!user) throw createServiceError(ERR.AUTH_USER_NOT_FOUND, 404);
  if (user.deletedAt) throw createServiceError(ERR.AUTH_INVALID_CREDENTIALS, 401);
  if (user.isSuspended) throw createServiceError(ERR.AUTH_ACCOUNT_SUSPENDED, 403);
  if (!user.isEmailVerified) throw createServiceError(ERR.AUTH_EMAIL_NOT_VERIFIED, 403);

  return buildAuthPayload(user);
};

// Verify email
export const verifyEmail = async (email) => {
  const normalizedEmail = String(email).trim().toLowerCase();
  const user = await User.findOne({ email: normalizedEmail });
  if (!user) throw new Error('User not found');

  const verificationOtp = user.createEmailVerificationOtp();
  await user.save({ validateBeforeSave: false });
  void sendEmailVerificationEmail({
    to: user.email,
    fullName: user.fullName,
    otp: verificationOtp,
  }).catch((err) => {
    logger.warn('Background verification-email send failed', { email: user.email, message: err?.message });
  });

  return { success: true };
};

// Verify email OTP
export const verifyEmailOtp = async ({ email, otp }) => {
  if (!email) throw new Error('Email is required');
  if (!otp) throw new Error('Verification code is required');

  const normalizedEmail = String(email).trim().toLowerCase();
  const hashedOtp = hashOtp(otp);
  const user = await User.findOne({
    email: normalizedEmail,
    emailVerificationOtp: hashedOtp,
    emailVerificationOtpExpires: { $gt: Date.now() },
  }).select('+emailVerificationOtp +emailVerificationOtpExpires');

  if (!user) {
    throw new Error('Invalid or expired verification code');
  }

  user.isEmailVerified = true;
  user.emailVerifiedAt = new Date();
  user.emailVerificationOtp = undefined;
  user.emailVerificationOtpExpires = undefined;
  await user.save();

  void sendEmailVerificationConfirmationEmail({
    to: user.email,
    fullName: user.fullName,
  }).catch((err) => {
    logger.warn('Background verification-confirmation email failed', { email: user.email, message: err?.message });
  });

  return { success: true };
};
