import rateLimit from 'express-rate-limit';
import { securityLogger } from '../utils/logger.js';

const isDev = process.env.NODE_ENV !== 'production';

/**
 * Development: More lenient for testing
 * Production: Strict to prevent abuse
 */
const devConfig = {
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200,
};

const prodConfig = {
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 60,
};

const rateLimitConfig = isDev ? devConfig : prodConfig;

/**
 * Should bypass rate limiting for test requests
 * Development-only to keep production protection intact
 */
function shouldBypassForE2E(req) {
  return isDev && req.get('x-test-mode') === 'true';
}

/**
 * Custom handler for rate limit exceeded
 * Returns standardized error response with HTTP 429
 */
function handleRateLimitError(req, res, options) {
  const ip = req.ip || req.connection.remoteAddress;
  const endpoint = req.path;

  // Log security event
  securityLogger.rateLimitExceeded(ip, endpoint);

  // Return standardized error response
  res.status(429).json({
    success: false,
    code: 'TOO_MANY_REQUESTS',
    message: 'Too many requests, please try again later',
  });
}

/**
 * Factory function to create rate limiters with custom config
 */
function createLimiter({ windowMs = rateLimitConfig.windowMs, max = rateLimitConfig.max } = {}) {
  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    skip: shouldBypassForE2E,
    handler: handleRateLimitError,
  });
}

/**
 * General rate limiter for all routes
 * Config: 15 minutes, max 100 requests (dev) / 10 (prod)
 */
const limiter = createLimiter();

/**
 * Auth-specific rate limiter
 * Stricter limits for authentication endpoints (login, signup)
 * Config: 15 minutes, higher ceiling than the general limiter to reduce lockouts
 */
const authLimiter = createLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: isDev ? 150 : 20,
});

/**
 * Strict 2FA Rate Limiter
 * Specifically designed to mitigate brute-forcing against 2FA endpoints.
 * Config: 15 minutes, strict max limit.
 */
const strict2FALimiter = createLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: isDev ? 50 : 10,
});

export { limiter, authLimiter, strict2FALimiter };
export default limiter;
