import rateLimit from 'express-rate-limit';
import { securityLogger } from '../utils/logger.js';

const isDev = process.env.NODE_ENV !== 'production';

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
  const ip = req.ip || req.socket?.remoteAddress;
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
function createLimiter({ windowMs, max } = {}) {
  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    skip: shouldBypassForE2E,
    handler: handleRateLimitError,
  });
}

// ─── 1. STRICT AUTH LIMITERS ──────────────────────────────────────────────────
const authLimiter = createLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: isDev ? 150 : 20,
});



// ─── 2. EXPENSIVE GET LIMITER (Matching, Geolocation, Analytics) ─────────────
const expensiveGetLimiter = createLimiter({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: isDev ? 100 : 30, // 30 requests per 5 minutes (6 req/min)
});

// ─── 3. RELAXED GET LIMITERS (Search, Filter, Dashboard Lists) ───────────────
const searchFilterLimiter = createLimiter({
  windowMs: 60 * 1000, // 1 minute
  max: isDev ? 200 : 100, // 100 req/min
});

const dashboardLimiter = createLimiter({
  windowMs: 60 * 1000, // 1 minute
  max: isDev ? 200 : 100, // 100 req/min
});

// ─── 4. ROUTE-SPECIFIC GENERAL LIMITERS ────────────────────────────────────────
const adminLimiter = createLimiter({ windowMs: 15 * 60 * 1000, max: isDev ? 300 : 100 });
const donorLimiter = createLimiter({ windowMs: 15 * 60 * 1000, max: isDev ? 300 : 100 });
const hospitalLimiter = createLimiter({ windowMs: 15 * 60 * 1000, max: isDev ? 300 : 100 });
const rewardLimiter = createLimiter({ windowMs: 15 * 60 * 1000, max: isDev ? 300 : 100 });
const requestLimiter = createLimiter({ windowMs: 15 * 60 * 1000, max: isDev ? 300 : 100 });
const appointmentLimiter = createLimiter({ windowMs: 15 * 60 * 1000, max: isDev ? 300 : 100 });
const donationLimiter = createLimiter({ windowMs: 15 * 60 * 1000, max: isDev ? 300 : 100 });
const notificationLimiter = createLimiter({ windowMs: 15 * 60 * 1000, max: isDev ? 300 : 100 });
const discoveryLimiter = createLimiter({ windowMs: 15 * 60 * 1000, max: isDev ? 300 : 100 });
const analyticsLimiter = createLimiter({ windowMs: 15 * 60 * 1000, max: isDev ? 300 : 100 });
const supportLimiter = createLimiter({ windowMs: 15 * 60 * 1000, max: isDev ? 300 : 100 });
const defaultLimiter = createLimiter({ windowMs: 15 * 60 * 1000, max: isDev ? 200 : 60 });

// ─── DYNAMIC SELECTOR MIDDLEWARE ──────────────────────────────────────────────
function limiter(req, res, next) {
  const isGet = req.method === 'GET';
  const path = req.path || '';
  const query = req.query || {};

  // Identify expensive GET requests (e.g. matching, geolocation, analytics aggregations)
  const isExpensiveGet =
    path.includes('/matches') ||
    path.includes('/nearby') ||
    path.includes('/map') ||
    path.includes('/find-donors') ||
    path.includes('/analytics') ||
    path.includes('/reports') ||
    path.includes('/statistics') ||
    path.includes('/my-stats') ||
    path.includes('/leaderboard');

  // Identify standard search/filter GET requests
  const isSearchOrFilter =
    path.includes('/search') ||
    path.includes('/filter') ||
    path.includes('/eligibility') ||
    path.includes('/available-slots');

  // Identify standard dashboard list / timeline GET requests
  const isDashboardOrList =
    path.includes('/dashboard') ||
    path.includes('/recent-activity') ||
    path.includes('/history') ||
    path.includes('/donations') ||
    path.includes('/rewards') ||
    path.includes('/requests') ||
    path.includes('/badges') ||
    path.includes('/redemptions') ||
    path.includes('/notifications') ||
    path.includes('/stats') ||
    path.includes('/activity') ||
    path.includes('/timeline') ||
    path.includes('/catalog') ||
    path.includes('/faq') ||
    path.includes('/documents') ||
    path.includes('/audit-logs') ||
    path.includes('/inbound-emails') ||
    path.includes('/donors') ||
    path.includes('/hospitals') ||
    path.includes('/users') ||
    path.includes('/alerts') ||
    path.includes('/blood-inventory') ||
    path.includes('/blood-bank-settings') ||
    path.includes('/notification-preferences');

  const isPagination = query.page !== undefined || query.limit !== undefined || query.offset !== undefined;

  if (isGet) {
    if (isExpensiveGet) {
      return expensiveGetLimiter(req, res, next);
    }
    if (isSearchOrFilter) {
      return searchFilterLimiter(req, res, next);
    }
    if (isDashboardOrList || isPagination) {
      return dashboardLimiter(req, res, next);
    }
  }

  // Route-specific delegation for non-relaxed endpoints
  const baseUrl = req.baseUrl || '';
  if (baseUrl.startsWith('/admin')) {
    return adminLimiter(req, res, next);
  } else if (baseUrl.startsWith('/donor')) {
    return donorLimiter(req, res, next);
  } else if (baseUrl.startsWith('/hospital')) {
    return hospitalLimiter(req, res, next);
  } else if (baseUrl.startsWith('/rewards')) {
    return rewardLimiter(req, res, next);
  } else if (baseUrl.startsWith('/requests')) {
    return requestLimiter(req, res, next);
  } else if (baseUrl.startsWith('/appointments') || baseUrl.startsWith('/donations/book-appointment')) {
    return appointmentLimiter(req, res, next);
  } else if (baseUrl.startsWith('/donations')) {
    return donationLimiter(req, res, next);
  } else if (baseUrl.startsWith('/notifications')) {
    return notificationLimiter(req, res, next);
  } else if (baseUrl.startsWith('/hospitals')) {
    return discoveryLimiter(req, res, next);
  } else if (baseUrl.startsWith('/analytics')) {
    return analyticsLimiter(req, res, next);
  } else if (baseUrl.startsWith('/support')) {
    return supportLimiter(req, res, next);
  }

  return defaultLimiter(req, res, next);
}

export {
  limiter,
  authLimiter,
  expensiveGetLimiter,
  searchFilterLimiter,
  dashboardLimiter,
  adminLimiter,
  donorLimiter,
  hospitalLimiter,
  rewardLimiter,
  requestLimiter,
  appointmentLimiter,
  donationLimiter,
  notificationLimiter,
  discoveryLimiter,
  analyticsLimiter,
  supportLimiter,
  defaultLimiter,
};
export default limiter;

