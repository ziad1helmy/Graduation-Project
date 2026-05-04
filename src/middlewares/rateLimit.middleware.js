import rateLimit from 'express-rate-limit';
import { securityLogger } from '../utils/logger.js';

const isDev = process.env.NODE_ENV !== 'production';

/**
 * Development: More lenient for testing
 * Production: Strict to prevent abuse
 */
const devConfig = {
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
};

const prodConfig = {
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
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
 * Config: 15 minutes, max 10 requests per requirement
 */
const authLimiter = createLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: isDev ? 100 : 10, // 10 requests max in production
});

export { limiter, authLimiter };
export default limiter;
