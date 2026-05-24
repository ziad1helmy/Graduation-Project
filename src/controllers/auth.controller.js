import * as authService from '../services/auth.service.js';
import response from '../utils/response.js';
import { ERR } from '../utils/errorCodes.js';
import { logger } from '../utils/logger.js';
import { validateChangePassword } from '../validation/auth.validation.js';

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
  return payload;
};

/**
 * Register a new user (donor or hospital)
 * Validates role-specific fields and returns tokens
 */
export const register = async (req, res, next) => {
  try {
    const traceId = `signup-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
    logger.info('Signup request received', {
      traceId,
      email: req.body?.email,
      role: req.body?.role,
      path: req.originalUrl,
    });

    const payload = normalizeRegisterPayload(req.body);
    if (payload.role !== 'donor') {
      return response.error(res, 403, 'Public signup is available for donors only');
    }

    const result = await authService.register(payload, { traceId });
    const locationRequired = !(
      result.user?.location?.coordinates &&
      Number.isFinite(result.user.location.coordinates.lat) &&
      Number.isFinite(result.user.location.coordinates.lng)
    );

    response.success(res, 201, 'User registered successfully', {
      user: result.user,
      tokens: {
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
      },
      locationRequired,
      ...(result.verificationEmail ? { verificationEmail: result.verificationEmail } : {}),
    });
  } catch (error) {
    // Treat validation/business errors as 400; unexpected errors go to middleware
    if (error.message?.startsWith('Validation failed') || !error.statusCode) {
      return response.error(res, 400, error.message);
    }
    next(error);
  }
};

/**
 * Login a user with email, password, and role-specific credentials
 * Returns accessToken and refreshToken
 */
export const loginUser = async (req, res, next) => {
  try {
    const { validateLogin } = await import('../validation/auth.validation.js');

    const payload = normalizeLoginPayload(req.body);
    if (payload.role === 'admin') {
      return response.error(res, 400, 'Use /auth/admin/login for admin accounts');
    }

    // Enforce donor-only for this endpoint
    if (payload.role && payload.role !== 'donor') {
      return response.error(res, 403, ERR.AUTH_INVALID_ROLE);
    }

    // Validate login data including role and role-specific fields
    payload.role = 'donor';
    const validation = validateLogin(payload);
    if (!validation.valid) {
      return response.error(res, 400, 'Validation failed', validation.errors);
    }

    if (!payload.email) {
      return response.error(res, 400, 'email is required');
    }

    const result = await authService.loginUser(payload);

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
    // 403 for suspension, 401 for invalid/unverified/unauthorized, 400 for everything else
    if (error.message === ERR.AUTH_ACCOUNT_SUSPENDED) {
      return response.error(res, 403, error.message);
    }
    if (
      error.message === ERR.AUTH_INVALID_CREDENTIALS ||
      error.message === ERR.AUTH_EMAIL_NOT_VERIFIED
    ) {
      return response.error(res, 401, error.message);
    }
    // 401 for role-specific credential failures
    if (
      error.message.includes('Invalid hospital license') ||
      error.message.includes('Invalid admin code') ||
      error.message === 'Invalid role for this account'
    ) {
      return response.error(res, 401, error.message);
    }
    next(error);
  }
};

export const loginAdmin = async (req, res, next) => {
  try {
    const payload = normalizeLoginPayload(req.body);
    payload.role = 'admin';
    if (!payload.email) {
      return response.error(res, 400, 'email is required');
    }
    if (!payload.password) {
      return response.error(res, 400, 'password is required');
    }
    if (!payload.adminKey) {
      return response.error(res, 400, 'adminKey is required');
    }

    const result = await authService.loginAdmin(payload);

    return response.success(res, 200, 'Admin login successful', result);
  } catch (error) {
    if (error.message === ERR.AUTH_ACCOUNT_SUSPENDED) {
      return response.error(res, 403, error.message);
    }
    if (
      error.message === ERR.AUTH_INVALID_CREDENTIALS ||
      error.message === ERR.AUTH_EMAIL_NOT_VERIFIED ||
      error.message === ERR.AUTH_INVALID_ADMIN_KEY
    ) {
      return response.error(res, 401, error.message);
    }
    if (error.message.includes('Invalid hospital license') || error.message === 'Invalid role for this account') {
      return response.error(res, 401, error.message);
    }
    next(error);
  }
};

export const loginHospital = async (req, res, next) => {
  try {
    const payload = normalizeLoginPayload(req.body);

    // Enforce hospital-only for this endpoint
    if (payload.role && payload.role !== 'hospital') {
      return response.error(res, 403, ERR.AUTH_INVALID_ROLE);
    }

    if (!payload.email) {
      return response.error(res, 400, 'email is required');
    }
    if (!payload.password) {
      return response.error(res, 400, 'password is required');
    }

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
    if (error.message === ERR.AUTH_ACCOUNT_SUSPENDED) {
      return response.error(res, 403, error.message);
    }
    if (
      error.message === ERR.AUTH_INVALID_CREDENTIALS ||
      error.message === ERR.AUTH_EMAIL_NOT_VERIFIED
    ) {
      return response.error(res, 401, error.message);
    }
    next(error);
  }
};

export const login = loginUser;

// Logout a user
export const logout = async (req, res, next) => {
  try {
    await authService.logout(
      req.body.refreshToken || req.body.refresh_token,
      req.body.fcmToken || req.body.fcm_token || null,
      req.user?.userId || null
    );
    response.success(res, 200, 'Logged out successfully');
  } catch (error) {
    if (error.message === ERR.AUTH_REFRESH_TOKEN_REQUIRED || error.message === ERR.AUTH_REFRESH_TOKEN_INVALID) {
      return response.error(res, 400, error.message);
    }
    next(error);
  }
};

// Refresh token
export const refreshToken = async (req, res, next) => {
  try {
    const result = await authService.refreshToken(req.body.refreshToken || req.body.refresh_token);
    response.success(res, 200, 'Token refreshed', {
      ...result,
      access_token: result.accessToken,
    });
  } catch (error) {
    return response.error(res, 401, error.message);
  }
};

// Forgot password — always returns 200 to prevent enumeration
export const forgotPassword = async (req, res, next) => {
  try {
    await authService.forgotPassword(req.body.email);
    response.success(res, 200, 'Password reset email sent');
  } catch (error) {
    next(error);
  }
};

// Reset password
export const resetPassword = async (req, res, next) => {
  try {
    await authService.resetPassword({
      email: req.body.email || req.body.email_or_phone,
      otp: req.body.otp || req.body.otp_code,
      password: req.body.password || req.body.new_password
    });
    response.success(res, 200, 'Password reset successful');
  } catch (error) {
    if (!error.statusCode || error.message.includes('Invalid') || error.message.includes('expired')) {
      return response.error(res, 400, error.message);
    }
    next(error);
  }
};

export const changePassword = async (req, res, next) => {
  try {
    const payload = {
      ...(req.body || {}),
      currentPassword: req.body?.currentPassword || req.body?.lastPassword || req.body?.oldPassword,
      newPassword: req.body?.newPassword || req.body?.password,
    };

    const validation = validateChangePassword(payload);
    if (!validation.valid) {
      return response.error(res, 400, 'Validation failed', validation.errors);
    }

    await authService.changePassword(req.user.userId, {
      currentPassword: payload.currentPassword,
      newPassword: payload.newPassword,
    });

    response.success(res, 200, 'Password changed successfully');
  } catch (error) {
    if (error.message === ERR.AUTH_INVALID_PASSWORD) {
      return response.error(res, 401, error.message);
    }
    if (error.message === ERR.AUTH_USER_NOT_FOUND || error.message.includes('required')) {
      return response.error(res, 400, error.message);
    }
    next(error);
  }
};

// Get current user
export const getMe = async (req, res, next) => {
  try {
    const user = await authService.getMe(req.user.userId);
    response.success(res, 200, 'User retrieved', user);
  } catch (error) {
    next(error);
  }
};

const getFcmTokenFromBody = (body) => body.fcmToken || body.fcm_token;

export const registerFcmToken = async (req, res, next) => {
  try {
    const result = await authService.registerFcmToken(req.user.userId, getFcmTokenFromBody(req.body));
    response.success(res, 200, 'FCM token registered successfully', result);
  } catch (error) {
    if (error.message === ERR.FCM_TOKEN_REQUIRED) {
      return response.error(res, 400, error.message);
    }
    next(error);
  }
};

export const replaceFcmToken = async (req, res, next) => {
  try {
    const result = await authService.replaceFcmToken(req.user.userId, getFcmTokenFromBody(req.body));
    response.success(res, 200, 'FCM token updated successfully', result);
  } catch (error) {
    if (error.message === 'fcmToken is required') {
      return response.error(res, 400, error.message);
    }
    next(error);
  }
};

export const removeFcmToken = async (req, res, next) => {
  try {
    const result = await authService.removeFcmToken(req.user.userId, getFcmTokenFromBody(req.body));
    response.success(res, 200, 'FCM token removed successfully', result);
  } catch (error) {
    if (error.message === 'fcmToken is required') {
      return response.error(res, 400, error.message);
    }
    next(error);
  }
};

// Validate the current access token and return session basics for Flutter splash flow.
export const validateToken = async (req, res, next) => {
  try {
    return response.success(res, 200, 'Token is valid', {
      is_valid: true,
      user_role: req.user.role,
      user_id: req.user.userId,
      role: req.user.role,
      userId: req.user.userId,
    });
  } catch (error) {
    next(error);
  }
};



export const verifyOtp = async (req, res, next) => {
  try {
    const result = await authService.verifyOtp({
      email: req.body.email || req.body.email_or_phone,
      otp: req.body.otp || req.body.otp_code,
    });
    response.success(res, 200, 'Password reset OTP verified successfully', result);
  } catch (error) {
    if (!error.statusCode || error.message.includes('Invalid') || error.message.includes('expired') || error.message.includes('exceeded') || error.message.includes('required')) {
      return response.error(res, 400, error.message);
    }
    next(error);
  }
};



// Verify email — send verification link
export const verifyEmail = async (req, res, next) => {
  try {
    const email = req.body.email || req.query.email;
    if (!email) {
      return response.error(res, 400, 'Email is required');
    }
    await authService.verifyEmail(email);
    response.success(res, 200, 'Verification code sent');
  } catch (error) {
    if (error.message === ERR.AUTH_USER_NOT_FOUND) {
      return response.error(res, 404, error.message);
    }
    next(error);
  }
};

// Verify email OTP
export const verifyEmailOtp = async (req, res, next) => {
  try {
    const email = req.body.email || req.query.email;
    const otp = req.body.otp || req.body.code || req.query.otp || req.query.code;
    if (!email) {
      return response.error(res, 400, 'Email is required');
    }
    if (!otp) {
      return response.error(res, 400, 'Verification code is required');
    }
    await authService.verifyEmailOtp({ email, otp });
    response.success(res, 200, 'Email verified successfully');
  } catch (error) {
    if (!error.statusCode || error.message.includes('Invalid') || error.message.includes('expired') || error.message.includes('required')) {
      return response.error(res, 400, error.message);
    }
    next(error);
  }
};

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
