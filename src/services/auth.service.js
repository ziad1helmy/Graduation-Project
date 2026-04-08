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
import * as jwt from '../utils/jwt.js';
import { env } from '../config/env.js';
import User from '../models/User.model.js';
import Donor from '../models/Donor.model.js';
import Hospital from '../models/Hospital.model.js';
import { validateRegister } from '../validation/auth.validation.js';

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

    // Hash password
    const saltRounds = Number(env.BCRYPT_SALT_ROUNDS) || 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Create user using appropriate discriminator model
    let user;
    const baseData = {
        fullName,
        email,
        password: hashedPassword,
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

// Login a user
export const login = async ({ email, password }) => {
  const user = await User.findOne({ email }).select('+password');

  if (!user) throw new Error('Invalid credentials');

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

// Logout (stub)
export const logout = async (refreshToken) => {
  // Implement blacklisting logic if needed
  return { success: true };
};

// Refresh token
export const refreshToken = async (refreshTokenValue) => {
  if (!refreshTokenValue) throw new Error('Refresh token is required');
  
  const decoded = jwt.verifyToken(refreshTokenValue);
  const user = await User.findById(decoded.userId);
  if (!user) throw new Error('User not found');
  
  const accessToken = jwt.signToken({ userId: user._id.toString(), role: user.role });
  
  return { accessToken };
};

// Forgot password (stub)
export const forgotPassword = async (email) => {
  const user = await User.findOne({ email });
  if (!user) throw new Error('User not found');
  // Implement email sending logic here
  return { success: true };
};

// Reset password (stub)
export const resetPassword = async (token, password) => {
  // Implement token verification and password reset
  return { success: true };
};

// Verify email (stub)
export const verifyEmail = async (email) => {
  // Implement email verification logic
  return { success: true };
};

// Verify email token (stub)
export const verifyEmailToken = async (token) => {
  // Implement token verification logic
  return { success: true };
};