import * as authService from '../services/auth.service.js';
import { env } from '../config/env.js';
import response from '../utils/response.js';

// Controller for auth routes

/**
 * Register a new user (donor or hospital)
 * Validates role-specific fields and returns tokens
 */
export const register = async (req, res) => {
    try {
        const result = await authService.register(req.body);
        response.success(res, 201, 'User registered successfully', result);
    } catch (error) {
        response.error(res, 400, error.message);
    }
};

/**
 * Login a user with email and password
 * Returns accessToken and refreshToken
 */
export const login = async (req, res) => {
    try {
        const result = await authService.login(req.body);
        response.success(res, 200, 'Login successful', result);
    } catch (error) {
        response.error(res, 400, error.message);
    }
};

// Logout a user
export const logout = async (req, res) => {
    try {
        await authService.logout(req.body.refreshToken);
        response.success(res, 200, 'Logged out successfully');
    } catch (error) {
        response.error(res, 400, error.message);
    }
};

// Refresh token
export const refreshToken = async (req, res) => {
    try {
        const result = await authService.refreshToken(req.body.refreshToken);
        response.success(res, 200, 'Token refreshed', result);
    } catch (error) {
        response.error(res, 400, error.message);
    }
};

// Forgot password
export const forgotPassword = async (req, res) => {
    try {
        await authService.forgotPassword(req.body.email);
        response.success(res, 200, 'Password reset email sent');
    } catch (error) {
        response.error(res, 400, error.message);
    }
};

// Reset password
export const resetPassword = async (req, res) => {
    try {
        await authService.resetPassword(req.body.token, req.body.password);
        response.success(res, 200, 'Password reset successful');
    } catch (error) {
        response.error(res, 400, error.message);
    }
};

// Get current user
export const getMe = async (req, res) => {
    try {
        const user = await authService.getMe(req.user.userId);
        response.success(res, 200, 'User retrieved', user);
    } catch (error) {
        response.error(res, 400, error.message);
    }
};

// Verify email
export const verifyEmail = async (req, res) => {
    try {
        await authService.verifyEmail(req.body.email);
        response.success(res, 200, 'Verification email sent');
    } catch (error) {
        response.error(res, 400, error.message);
    }
};

// Verify email token
export const verifyEmailToken = async (req, res) => {
    try {
        await authService.verifyEmailToken(req.body.token);
        response.success(res, 200, 'Email verified successfully');
    } catch (error) {
        response.error(res, 400, error.message);
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
    verifyEmail,
    verifyEmailToken,
};