import * as authService from '../services/auth.service.js';
import { renderVerificationFailurePage, renderVerificationSuccessPage } from '../utils/verificationPages.js';
import response from '../utils/response.js';

// Controller for auth routes

const normalizeRole = (role) => (typeof role === 'string' ? role.trim().toLowerCase() : role);

const normalizePhone = (phone) => {
  if (!phone || typeof phone !== 'string') return phone;
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('0')) return digits.slice(1);
  return digits;
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

const prefersHtml = (req) => {
  const accept = String(req.headers.accept || '').toLowerCase();
  return accept.includes('text/html') && !accept.includes('application/json');
};

/**
 * Register a new user (donor or hospital)
 * Validates role-specific fields and returns tokens
 */
export const register = async (req, res, next) => {
  try {
    const result = await authService.register(normalizeRegisterPayload(req.body));
    const user = result.user || {};
    response.success(res, 201, 'User registered successfully', {
      ...result,
      access_token: result.accessToken,
      refresh_token: result.refreshToken,
      user_id: user._id,
      user_role: user.role,
      user_name: user.fullName,
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
 * Login a user with email and password
 * Returns accessToken and refreshToken
 */
export const login = async (req, res, next) => {
  try {
    const payload = normalizeLoginPayload(req.body);
    if (!payload.email) {
      return response.error(res, 400, 'email is required');
    }
    const result = await authService.login(payload);
    if (result.requires2FA) {
      return response.success(res, 200, '2FA verification required', result);
    }

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
    // 403 for suspension, 401 for invalid/unverified, 400 for everything else
    if (error.message === 'Account is suspended. Contact support.') {
      return response.error(res, 403, error.message);
    }
    if (
      error.message === 'Invalid credentials' ||
      error.message === 'Email address is not verified'
    ) {
      return response.error(res, 401, error.message);
    }
    next(error);
  }
};

// Logout a user
export const logout = async (req, res, next) => {
  try {
    await authService.logout(req.body.refreshToken || req.body.refresh_token);
    response.success(res, 200, 'Logged out successfully');
  } catch (error) {
    if (error.message === 'Refresh token is required' || error.message === 'Invalid refresh token') {
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
    await authService.resetPassword(req.body.token || req.body.reset_token, req.body.password || req.body.new_password);
    response.success(res, 200, 'Password reset successful');
  } catch (error) {
    if (error.message === 'Invalid or expired reset token') {
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
    if (error.message === 'fcmToken is required') {
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

export const sendOtp = async (req, res, next) => {
  try {
    const result = await authService.sendOtp({
      email: req.body.email || req.body.email_or_phone,
    });
    response.success(res, 200, 'Password reset OTP sent successfully', result);
  } catch (error) {
    if (error.message === 'Account not found') {
      return response.error(res, 404, error.message);
    }
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
    if (error.message === 'Invalid or expired OTP' || error.message === 'Invalid OTP' || error.message === 'OTP attempts exceeded') {
      return response.error(res, 400, error.message);
    }
    next(error);
  }
};

export const setup2FA = async (req, res, next) => {
  try {
    const result = await authService.setup2FA(req.user.userId);
    response.success(res, 200, '2FA setup initialized', result);
  } catch (error) {
    next(error);
  }
};

export const confirm2FASetup = async (req, res, next) => {
  try {
    const result = await authService.verify2FA(req.user.userId, req.body.code || req.body.otp || req.body.otp_code);
    response.success(res, 200, '2FA setup verified successfully', result);
  } catch (error) {
    if (error.message === '2FA setup not found' || error.message === 'Invalid 2FA code') {
      return response.error(res, 400, error.message);
    }
    next(error);
  }
};

export const verify2FA = async (req, res, next) => {
  try {
    const result = await authService.verify2FALogin(
      req.body.tempToken || req.body.temp_token,
      req.body.code || req.body.otp || req.body.otp_code
    );
    const user = result.user || {};
    response.success(res, 200, '2FA verified successfully', {
      ...result,
      access_token: result.accessToken,
      refresh_token: result.refreshToken,
      user_id: user._id,
      user_role: user.role,
      user_name: user.fullName,
    });
  } catch (error) {
    if (
      error.message === 'Invalid 2FA code' ||
      error.message === '2FA is not enabled' ||
      error.message === 'tempToken is required' ||
      error.message === '2FA code is required' ||
      error.message === 'Invalid or expired token' ||
      error.name === 'TokenExpiredError' ||
      error.name === 'JsonWebTokenError'
    ) {
      return response.error(res, 400, error.message || 'Invalid or expired token');
    }
    next(error);
  }
};

export const disable2FA = async (req, res, next) => {
  try {
    const result = await authService.disable2FA(req.user.userId, req.body.password);
    response.success(res, 200, '2FA disabled successfully', result);
  } catch (error) {
    if (error.message === 'Invalid password') {
      return response.error(res, 401, error.message);
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
    response.success(res, 200, 'Verification email sent');
  } catch (error) {
    if (error.message === 'User not found') {
      return response.error(res, 404, error.message);
    }
    next(error);
  }
};

// Verify email token
export const verifyEmailToken = async (req, res, next) => {
  try {
    const token = req.body.token || req.query.token;
    if (!token) {
      if (prefersHtml(req)) {
        return res.status(400).type('html').send(renderVerificationFailurePage());
      }
      return response.error(res, 400, 'Verification token is required');
    }
    await authService.verifyEmailToken(token);
    if (prefersHtml(req)) {
      return res.status(200).type('html').send(renderVerificationSuccessPage());
    }
    response.success(res, 200, 'Email verified successfully');
  } catch (error) {
    if (error.message === 'Invalid or expired verification token') {
      if (prefersHtml(req)) {
        return res.status(400).type('html').send(renderVerificationFailurePage());
      }
      return response.error(res, 400, error.message);
    }
    next(error);
  }
};

export default {
  register,
  login,
  logout,
  refreshToken,
  forgotPassword,
  resetPassword,
  getMe,
  validateToken,
  sendOtp,
  verifyOtp,
  setup2FA,
  confirm2FASetup,
  verify2FA,
  disable2FA,
  verifyEmail,
  verifyEmailToken,
  registerFcmToken,
  removeFcmToken,
  replaceFcmToken,
};
