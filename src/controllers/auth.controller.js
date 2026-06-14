import * as authService from '../services/auth.service.js';
import response from '../utils/response.js';
import { ERR } from '../utils/errorCodes.js';
import { logger } from '../utils/logger.js';
import { validateChangePassword } from '../validation/auth.validation.js';
import { buildValidateTokenResponse } from '../utils/auth.dto.js';
import { asyncHandler } from '../middlewares/asyncHandler.js';
import { HttpError } from '../utils/HttpError.js';

// Controller for auth routes

const normalizeRole = (role) => (typeof role === 'string' ? role.trim().toLowerCase() : role);

const normalizePhone = (phone) => {
  if (!phone || typeof phone !== 'string') return phone;
  return phone.replace(/\D/g, '');
};

const normalizeRegisterPayload = (body) => {
  const payload = { ...body };

  if (!payload.fullName && (payload.first_name || payload.last_name)) {
    payload.fullName = `${payload.first_name || ''} ${payload.last_name || ''}`.trim();
  }

  payload.role = normalizeRole(payload.role);

  if (!payload.phoneNumber && payload.phone) {
    payload.phoneNumber = payload.phone;
  }
  payload.phoneNumber = normalizePhone(payload.phoneNumber);

  if (payload.address && typeof payload.address === 'object') {
    payload.address = {
      ...payload.address,
      ...(payload.address.governrate && !payload.address.governorate
        ? { governorate: payload.address.governrate }
        : {}),
    };
    delete payload.address.governrate;
  }

  const rawTopLevelLat = payload.lat ?? payload.latitude;
  const rawTopLevelLng = payload.lng ?? payload.longitude;
  if (rawTopLevelLat !== undefined || rawTopLevelLng !== undefined) {
    payload.location = payload.location && typeof payload.location === 'object' ? { ...payload.location } : {};
    payload.location = {
      ...payload.location,
      lat: payload.location.lat ?? payload.location.latitude ?? rawTopLevelLat,
      lng: payload.location.lng ?? payload.location.longitude ?? rawTopLevelLng,
    };
  }

  if (payload.location && typeof payload.location === 'object') {
    payload.location = {
      ...payload.location,
      ...(payload.location.governrate && !payload.location.governorate
        ? { governorate: payload.location.governrate }
        : {}),
    };
    delete payload.location.governrate;

    const rawLat = payload.location.coordinates?.lat ?? payload.location.latitude ?? payload.location.lat;
    const rawLng = payload.location.coordinates?.lng ?? payload.location.longitude ?? payload.location.lng;
    const lat = rawLat === '' || rawLat === undefined || rawLat === null ? undefined : Number(rawLat);
    const lng = rawLng === '' || rawLng === undefined || rawLng === null ? undefined : Number(rawLng);
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      payload.location.coordinates = { lat, lng };
      payload.location.lastUpdated = new Date();
    }

    delete payload.lat;
    delete payload.lng;
    delete payload.latitude;
    delete payload.longitude;
  }

  // Accept string locations like "City, Governorate" and map to location object
  if (payload.location && typeof payload.location === 'string') {
    const parts = payload.location.split(',').map((p) => p.trim()).filter(Boolean);
    const city = parts[0] || undefined;
    const governorate = parts[1] || undefined;
    payload.location = {
      city,
      governorate,
      lastUpdated: new Date(),
    };
  }

  return payload;
};

const normalizeLoginPayload = (body) => {
  const payload = { ...body };
  if (!payload.email && payload.email_or_phone && String(payload.email_or_phone).includes('@')) {
    payload.email = String(payload.email_or_phone).trim().toLowerCase();
  }
  if (!payload.adminKey) {
    payload.adminKey = payload.admin_key ?? payload.adminCode;
  }
  return payload;
};

const mapAuthError = (error) => {
  // ban check
  if (
    error.code === 'AUTH_ACCOUNT_BANNED' ||
    error.message?.startsWith(ERR.AUTH_ACCOUNT_BANNED)
  ) {
    throw new HttpError(403, error.message, { reason: error.reason || 'Not specified' });
  }
  if (error.message === ERR.AUTH_ACCOUNT_SUSPENDED) {
    throw new HttpError(403, error.message);
  }
  if (
    error.message === ERR.AUTH_INVALID_CREDENTIALS ||
    error.message === ERR.AUTH_EMAIL_NOT_VERIFIED
  ) {
    throw new HttpError(401, error.message);
  }
  if (
    error.message.includes('Invalid hospital license') ||
    error.message.includes('Invalid admin code') ||
    error.message === 'Invalid role for this account'
  ) {
    throw new HttpError(401, error.message);
  }
  throw error;
};

/**
 * Register a new user (donor or hospital)
 * Validates role-specific fields and returns tokens
 */
export const register = asyncHandler(async (req, res) => {
  const traceId = `signup-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
  logger.info('Signup request received', {
    traceId,
    email: req.body?.email,
    role: req.body?.role,
    path: req.originalUrl,
  });

  const payload = normalizeRegisterPayload(req.body);
  if (payload.role !== 'donor') {
    throw new HttpError(403, 'Public signup is available for donors only');
  }

  try {
    const result = await authService.register(payload, { traceId });
    const locationRequired = !(
      result.user?.location?.coordinates &&
      Number.isFinite(result.user.location.coordinates.lat) &&
      Number.isFinite(result.user.location.coordinates.lng)
    );

    // Build a safe user object without internal/sensitive fields.
    const rawUser = result.user.toObject ? result.user.toObject() : { ...result.user };
    const {
      password: _pw, __v, createdAt, updatedAt, fullNameNormalized, deletedAt,
      emailVerifiedAt, isSuspended, suspendedAt, suspendedReason, fcmTokens,
      phone, address, __t, hemoglobinLevel, temporaryDeferralUntil,
      lastDeferralReason, travelHistory, isOptedIn, isBanned, isVerified, ...safeUser
    } = rawUser;
    // Strip location.lastUpdated if present
    if (safeUser.location) { delete safeUser.location.lastUpdated; }

    const responseData = {
      user: safeUser,
      tokens: {
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
      },
      locationRequired,
    };

    if (process.env.NODE_ENV !== 'production') {
      responseData.verificationToken = result.verificationOtp;
    }

    response.success(res, 201, 'User registered successfully', responseData);
  } catch (error) {
    // Treat validation/business errors as 400; unexpected errors go to middleware
    if (error.message?.startsWith('Validation failed') || !error.statusCode) {
      throw new HttpError(400, error.message);
    }
    const details = error.reason ? { reason: error.reason } : error.details;
    throw new HttpError(error.statusCode, error.message, details);
  }
});

/**
 * Login a user with email, password, and role-specific credentials
 * Returns accessToken and refreshToken
 */
export const loginUser = asyncHandler(async (req, res) => {
  const { validateLogin } = await import('../validation/auth.validation.js');

  const payload = normalizeLoginPayload(req.body);
  if (payload.role === 'admin') {
    throw new HttpError(400, 'Use /auth/admin/login for admin accounts');
  }

  // Enforce donor-only for this endpoint
  if (payload.role && payload.role !== 'donor') {
    throw new HttpError(403, ERR.AUTH_INVALID_ROLE);
  }

  // Validate login data including role and role-specific fields
  payload.role = 'donor';
  const validation = validateLogin(payload);
  if (!validation.valid) {
    throw new HttpError(400, 'Validation failed', validation.errors);
  }

  if (!payload.email) {
    throw new HttpError(400, 'email is required');
  }

  try {
    const result = await authService.loginUser(payload);
    const { verified, ...cleanResult } = result;
    // Add compatibility aliases expected by Flutter while keeping existing fields.
    const aliases = {};
    if (result.user) {
      const u = result.user;
      aliases.userId = u._id || u.id || null;
      aliases.user_id = aliases.userId;
      aliases.userRole = u.role || null;
      aliases.user_role = aliases.userRole;
      aliases.userName = u.fullName || u.full_name || null;
      aliases.user_name = aliases.userName;
    }

    return response.success(res, 200, 'Login successful', {
      ...cleanResult,
      ...aliases,
      access_token: result.accessToken,
      refresh_token: result.refreshToken,
    });
  } catch (error) {
    mapAuthError(error);
  }
});

export const loginAdmin = asyncHandler(async (req, res) => {
  const payload = normalizeLoginPayload(req.body);
  payload.role = 'admin';
  if (!payload.email) {
    throw new HttpError(400, 'email is required');
  }
  if (!payload.password) {
    throw new HttpError(400, 'password is required');
  }
  if (!payload.adminKey) {
    throw new HttpError(400, 'adminKey is required');
  }

  try {
    const result = await authService.loginAdmin(payload);
    const { verified, ...cleanResult } = result;
    // Keep `admin` for backward compatibility and also expose `user` alias for Flutter
    const adminObj = result.admin || null;
    return response.success(res, 200, 'Admin login successful', {
      ...cleanResult,
      access_token: result.accessToken,
      refresh_token: result.refreshToken,
      user: adminObj,
    });
  } catch (error) {
    if (error.message === ERR.AUTH_INVALID_ADMIN_KEY) {
      throw new HttpError(401, error.message);
    }
    mapAuthError(error);
  }
});

export const loginHospital = asyncHandler(async (req, res) => {
  const payload = normalizeLoginPayload(req.body);

  // Enforce hospital-only for this endpoint
  if (payload.role && payload.role !== 'hospital') {
    throw new HttpError(403, ERR.AUTH_INVALID_ROLE);
  }

  if (!payload.email) {
    throw new HttpError(400, 'email is required');
  }
  if (!payload.password) {
    throw new HttpError(400, 'password is required');
  }

  // Validate payload with role-specific rules (ensures hospitalId presence/format)
  payload.role = 'hospital';
  const { validateLogin } = await import('../validation/auth.validation.js');
  const validation = validateLogin(payload);
  if (!validation.valid) {
    throw new HttpError(400, 'Validation failed', validation.errors);
  }

  try {
    const result = await authService.loginHospital(payload);

    const user = result.user || {};
    return response.success(res, 200, 'Login successful', {
      ...result,
      access_token: result.accessToken,
      refresh_token: result.refreshToken,
      user_id: user._id,
      user_role: user.role,
      user_name: user.fullName,
    });
  } catch (error) {
    if (error.statusCode) {
      throw new HttpError(error.statusCode, error.message);
    }
    mapAuthError(error);
  }
});

export const login = loginUser;

// Logout a user
export const logout = asyncHandler(async (req, res) => {
  try {
    await authService.logout(
      req.body.refreshToken || req.body.refresh_token,
      req.body.fcmToken || req.body.fcm_token || null,
      req.user?.userId || null
    );
  } catch (error) {
    if (error.message === ERR.AUTH_REFRESH_TOKEN_REQUIRED || error.message === ERR.AUTH_REFRESH_TOKEN_INVALID) {
      throw new HttpError(400, error.message);
    }
    throw error;
  }
  response.success(res, 200, 'Logged out successfully');
});

// Refresh token
export const refreshToken = asyncHandler(async (req, res) => {
  try {
    const result = await authService.refreshToken(req.body.refreshToken || req.body.refresh_token);
    // Return standard envelope with nested `data`, and also expose top-level aliases for Flutter compatibility
    const body = {
      success: true,
      message: 'Token refreshed',
      data: result,
    };
    if (result?.accessToken) body.accessToken = result.accessToken;
    if (result?.refreshToken) body.refreshToken = result.refreshToken;

    return res.status(200).json(body);
  } catch (error) {
    throw new HttpError(401, error.message);
  }
});

// Forgot password — always returns 200 to prevent enumeration
export const forgotPassword = asyncHandler(async (req, res) => {
  await authService.forgotPassword(req.body.email);
  response.success(res, 200, 'Password reset email sent');
});

// Reset password
export const resetPassword = asyncHandler(async (req, res) => {
  try {
    await authService.resetPassword({
      email: req.body.email || req.body.email_or_phone,
      otp: req.body.otp || req.body.otp_code,
      password: req.body.password || req.body.new_password
    });
  } catch (error) {
    if (!error.statusCode || error.message.includes('Invalid') || error.message.includes('expired')) {
      throw new HttpError(400, error.message);
    }
    throw error;
  }
  response.success(res, 200, 'Password reset successful');
});

export const changePassword = asyncHandler(async (req, res) => {
  const payload = {
    ...(req.body || {}),
    currentPassword: req.body?.currentPassword || req.body?.lastPassword || req.body?.oldPassword,
    newPassword: req.body?.newPassword || req.body?.password,
  };

  const validation = validateChangePassword(payload);
  if (!validation.valid) {
    throw new HttpError(400, 'Validation failed', validation.errors);
  }

  try {
    await authService.changePassword(req.user.userId, {
      currentPassword: payload.currentPassword,
      newPassword: payload.newPassword,
    });
  } catch (error) {
    if (error.message === ERR.AUTH_CURRENT_PASSWORD_INCORRECT) {
      throw new HttpError(400, error.message);
    }
    if (
      error.message === ERR.AUTH_USER_NOT_FOUND ||
      error.message.includes('required') ||
      error.message.includes('must be different')
    ) {
      throw new HttpError(400, error.message);
    }
    throw error;
  }

  response.success(res, 200, 'Password changed successfully');
});

export const getMe = asyncHandler(async (req, res) => {
  const projection = req.user?.role === 'donor'
    ? '-password -__v -createdAt -updatedAt -fullNameNormalized -deletedAt ' +
      '-emailVerifiedAt -isSuspended -suspendedAt -suspendedReason -fcmTokens ' +
      '-phone -address -__t -hemoglobinLevel -temporaryDeferralUntil ' +
      '-lastDeferralReason -travelHistory -isOptedIn -isBanned -isVerified'
    : '-password';
  const user = await authService.getMe(req.user.userId, projection);
  const userObj = user.toObject ? user.toObject() : { ...user };
  if (req.user?.role === 'donor' && userObj.location) { delete userObj.location.lastUpdated; }
  response.success(res, 200, 'User retrieved', userObj);
});

const getFcmTokenFromBody = (body) => body.fcmToken || body.fcm_token;

export const registerFcmToken = asyncHandler(async (req, res) => {
  try {
    const result = await authService.registerFcmToken(req.user.userId, getFcmTokenFromBody(req.body));
    response.success(res, 200, 'FCM token registered successfully', result);
  } catch (error) {
    if (error.message === ERR.FCM_TOKEN_REQUIRED) {
      throw new HttpError(400, error.message);
    }
    throw error;
  }
});

export const replaceFcmToken = asyncHandler(async (req, res) => {
  try {
    const result = await authService.replaceFcmToken(req.user.userId, getFcmTokenFromBody(req.body));
    response.success(res, 200, 'FCM token updated successfully', result);
  } catch (error) {
    if (error.message === 'fcmToken is required') {
      throw new HttpError(400, error.message);
    }
    throw error;
  }
});

export const removeFcmToken = asyncHandler(async (req, res) => {
  try {
    const result = await authService.removeFcmToken(req.user.userId, getFcmTokenFromBody(req.body));
    response.success(res, 200, 'FCM token removed successfully', result);
  } catch (error) {
    if (error.message === 'fcmToken is required') {
      throw new HttpError(400, error.message);
    }
    throw error;
  }
});

// Validate the current access token and return session basics for Flutter splash flow.
export const validateToken = asyncHandler(async (req, res) => {
  return response.success(res, 200, 'Token is valid', buildValidateTokenResponse(req.user));
});



export const verifyOtp = asyncHandler(async (req, res) => {
  try {
    const result = await authService.verifyOtp({
      email: req.body.email || req.body.email_or_phone,
      otp: req.body.otp || req.body.otp_code,
    });
    response.success(res, 200, 'Password reset OTP verified successfully', result);
  } catch (error) {
    if (!error.statusCode || error.message.includes('Invalid') || error.message.includes('expired') || error.message.includes('exceeded') || error.message.includes('required')) {
      throw new HttpError(400, error.message);
    }
    throw error;
  }
});



// Verify email — send verification link
export const verifyEmail = asyncHandler(async (req, res) => {
  const email = req.body.email || req.query.email;
  if (!email) {
    throw new HttpError(400, 'Email is required');
  }
  try {
    await authService.verifyEmail(email);
  } catch (error) {
    if (error.message === ERR.AUTH_USER_NOT_FOUND) {
      throw new HttpError(404, error.message);
    }
    throw error;
  }
  response.success(res, 200, 'Verification code sent');
});

// Verify email OTP
export const verifyEmailOtp = asyncHandler(async (req, res) => {
  const email = req.body.email || req.query.email;
  const otp = req.body.otp || req.body.code || req.query.otp || req.query.code;
  if (!email) {
    throw new HttpError(400, 'Email is required');
  }
  if (!otp) {
    throw new HttpError(400, 'Verification code is required');
  }
  try {
    await authService.verifyEmailOtp({ email, otp });
  } catch (error) {
    if (!error.statusCode || error.message.includes('Invalid') || error.message.includes('expired') || error.message.includes('required')) {
      throw new HttpError(400, error.message);
    }
    throw error;
  }
  response.success(res, 200, 'Email verified successfully');
});

export default {
  register,
  login,
  loginUser,
  loginAdmin,
  loginHospital,
  logout,
  refreshToken,
  forgotPassword,
  resetPassword,
  changePassword,
  getMe,
  validateToken,
  verifyOtp,

  verifyEmail,
  verifyEmailOtp,
  registerFcmToken,
  removeFcmToken,
  replaceFcmToken,
};
