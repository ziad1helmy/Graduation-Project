import rateLimit from 'express-rate-limit';

const isDev = process.env.NODE_ENV !== 'production';

const rateLimitConfig = isDev
  ? {
      windowMs: 10 * 1000,
      max: 100,
      message: 'Too many requests from this IP, please try again shortly',
    }
  : {
      windowMs: 60 * 1000,
      max: 5,
      message: 'Too many requests from this IP, please try again in 1 minute',
    };

function shouldBypassForE2E(req) {
  // Bypass is development-only to keep production protection intact.
  return isDev && req.get('x-test-mode') === 'true';
}

function createLimiter({ max = rateLimitConfig.max } = {}) {
  return rateLimit({
    windowMs: rateLimitConfig.windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    skip: shouldBypassForE2E,
    message: {
      success: false,
      message: rateLimitConfig.message,
    },
  });
}

const limiter = createLimiter();
const authLimiter = createLimiter({
  max: isDev ? 100 : 5,
});

export { limiter, authLimiter };
export default limiter;
