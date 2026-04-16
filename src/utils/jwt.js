/**
 * JWT utility module.
 * Centralizes all JWT operations: signing and verification.
 * Uses env.JWT_SECRET for access tokens and env.JWT_REFRESH_SECRET for refresh tokens.
 * Throws meaningful errors; does not swallow failures.
 */

import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

// Re-export JWT error types so middleware can distinguish expired vs invalid tokens.
export const TokenExpiredError = jwt.TokenExpiredError;
export const JsonWebTokenError = jwt.JsonWebTokenError;

/**
 * Signs a payload and returns a JWT string.
 *
 * @param {object} payload - Claims to encode (e.g. { userId, role }). Must be JSON-serializable.
 * @param {object} [options] - Optional overrides.
 * @param {string} [options.expiresIn] - Override default expiry (default: env.JWT_EXPIRES_IN).
 * @returns {string} Signed JWT.
 * @throws {Error} If JWT_SECRET is not set.
 */
export function signToken(payload, options = {}) {
  if (!env.JWT_SECRET) {
    throw new Error('JWT_SECRET is not configured. Cannot sign tokens.');
  }
  const expiresIn = options.expiresIn ?? env.JWT_EXPIRES_IN;
  return jwt.sign(payload, env.JWT_SECRET, { expiresIn });
}

/**
 * Signs a refresh token with longer expiry (env.JWT_REFRESH_EXPIRES_IN).
 * Use for refresh flows; keep access tokens short-lived.
 *
 * @param {object} payload - Claims to encode (e.g. { userId }).
 * @returns {string} Signed refresh JWT.
 * @throws {Error} If JWT_SECRET is not set.
 */
export function signRefreshToken(payload) {
  const refreshSecret = env.JWT_REFRESH_SECRET || env.JWT_SECRET;
  if (!refreshSecret) {
    throw new Error('JWT_REFRESH_SECRET is not configured. Cannot sign refresh tokens.');
  }
  const expiresIn = env.JWT_REFRESH_EXPIRES_IN ?? '30d';
  return jwt.sign(payload, refreshSecret, { expiresIn });
}

/**
 * Verifies a refresh JWT and returns the decoded payload.
 *
 * @param {string} token - Refresh JWT string.
 * @returns {object} Decoded payload.
 */
export function verifyRefreshToken(token) {
  if (token == null || typeof token !== 'string') {
    throw new Error('Token is required and must be a non-empty string.');
  }
  const trimmed = token.trim();
  if (!trimmed) {
    throw new Error('Token is required and must be a non-empty string.');
  }

  const refreshSecret = env.JWT_REFRESH_SECRET || env.JWT_SECRET;
  if (!refreshSecret) {
    throw new Error('JWT_REFRESH_SECRET is not configured. Cannot verify refresh tokens.');
  }

  return jwt.verify(trimmed, refreshSecret);
}

/**
 * Verifies a JWT and returns the decoded payload.
 *
 * @param {string} token - The JWT string (e.g. from Authorization header).
 * @returns {object} Decoded payload (e.g. { userId, role, iat, exp }).
 * @throws {Error} If token is missing or not a string.
 * @throws {jwt.TokenExpiredError} If the token has expired.
 * @throws {jwt.JsonWebTokenError} If the token is invalid or malformed.
 */
export function verifyToken(token) {  
  if (token == null || typeof token !== 'string') {
    throw new Error('Token is required and must be a non-empty string.');
  }
  const trimmed = token.trim();
  if (!trimmed) {
    throw new Error('Token is required and must be a non-empty string.');
  }
  if (!env.JWT_SECRET) {
    throw new Error('JWT_SECRET is not configured. Cannot verify tokens.');
  }
  return jwt.verify(trimmed, env.JWT_SECRET);
}
