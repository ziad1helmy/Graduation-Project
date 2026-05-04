/**
 * Structured Logger Utility
 *
 * Provides consistent, structured logging across the application.
 * Supports:
 * - Info, warning, error, debug levels
 * - Structured metadata (context, user info, request info)
 * - Colored output in development
 * - ISO timestamps
 * - Error stack traces
 *
 * Usage:
 *   logger.info('Login attempt', { email, ip: req.ip })
 *   logger.error('Auth failed', { email, reason })
 *   logger.warn('Rate limit exceeded', { ip })
 */

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  gray: '\x1b[90m',
};

const isDevelopment = process.env.NODE_ENV !== 'production';

/**
 * Format a log message with timestamp and level
 * @private
 */
const formatMessage = (level, message, data = {}) => {
  const timestamp = new Date().toISOString();
  const levelTag = level.toUpperCase().padEnd(5);

  if (isDevelopment) {
    let levelColor = colors.blue;
    if (level === 'error') levelColor = colors.red;
    if (level === 'warn') levelColor = colors.yellow;
    if (level === 'info') levelColor = colors.green;
    if (level === 'debug') levelColor = colors.cyan;

    const coloredLevel = `${levelColor}${levelTag}${colors.reset}`;
    const dataStr = Object.keys(data).length > 0 ? ` ${JSON.stringify(data)}` : '';

    return `${colors.dim}${timestamp}${colors.reset} ${coloredLevel} ${message}${dataStr}`;
  }

  // Production: JSON format for log aggregation
  return JSON.stringify({
  timestamp,
  level,
  message,
  meta: data,
    });
};

/**
 * Logger utility for structured logging
 */
export const logger = {
  /**
   * Log information message
   * @param {string} message - Log message
   * @param {object} data - Additional context data
   */
  info: (message, data = {}) => {
    const formatted = formatMessage('info', message, data);
    console.log(formatted);
  },

  /**
   * Log warning message
   * @param {string} message - Log message
   * @param {object} data - Additional context data
   */
  warn: (message, data = {}) => {
    const formatted = formatMessage('warn', message, data);
    console.warn(formatted);
  },

  /**
   * Log error message with optional error object
   * @param {string} message - Log message
   * @param {object} data - Additional context data or Error object
   */
  error: (message, data = {}) => {
    // If data is an Error, extract message and stack
    let errorData = data;
    if (data instanceof Error) {
      errorData = {
        error: data.message,
        stack: isDevelopment ? data.stack : undefined,
        code: data.code,
      };
    }

    const formatted = formatMessage('error', message, errorData);
    console.error(formatted);
  },

  /**
   * Log debug message (only in development)
   * @param {string} message - Log message
   * @param {object} data - Additional context data
   */
  debug: (message, data = {}) => {
    if (!isDevelopment) return;
    const formatted = formatMessage('debug', message, data);
    console.log(formatted);
  },
};

/**
 * Request logger middleware
 * Logs incoming requests with method, path, and response time
 */
export const requestLogger = (req, res, next) => {
  const startTime = Date.now();
  const originalSend = res.send;

  res.send = function (data) {
    const duration = Date.now() - startTime;
    const statusCode = res.statusCode;

    // Determine log level based on status code
    let logLevel = 'info';
    if (statusCode >= 500) logLevel = 'error';
    if (statusCode >= 400 && statusCode < 500) logLevel = 'warn';

    const logData = {
      method: req.method,
      path: req.path,
      statusCode,
      duration: `${duration}ms`,
      ip: req.ip,
      userAgent: req.get('user-agent'),
    };

    // Add user info if available
    if (req.user) {
      logData.userId = req.user._id;
      logData.userRole = req.user.role;
    }

    logger[logLevel](`${req.method} ${req.path}`, logData);

    return originalSend.call(this, data);
  };

  next();
};

/**
 * Security event logger
 * Logs authentication and security-related events
 */
export const securityLogger = {
  /**
   * Log successful login
   */
  loginSuccess: (email, role, ip) => {
    logger.info('Login successful', {
      event: 'LOGIN_SUCCESS',
      email,
      role,
      ip,
    });
  },

  /**
   * Log failed login attempt
   */
  loginFailure: (email, reason, ip) => {
    logger.warn('Login failed', {
      event: 'LOGIN_FAILURE',
      email,
      reason,
      ip,
    });
  },

  /**
   * Log rate limit exceeded
   */
  rateLimitExceeded: (ip, endpoint) => {
    logger.warn('Rate limit exceeded', {
      event: 'RATE_LIMIT_EXCEEDED',
      ip,
      endpoint,
    });
  },

  /**
   * Log suspicious activity
   */
  suspiciousActivity: (message, ip, data = {}) => {
    logger.warn(message, {
      event: 'SUSPICIOUS_ACTIVITY',
      ip,
      ...data,
    });
  },

  /**
   * Log NoSQL injection attempt
   */
  injectionAttempt: (ip, key) => {
    logger.error('NoSQL injection attempt detected', {
      event: 'INJECTION_ATTEMPT',
      ip,
      key,
    });
  },

  /**
   * Log eligibility check
   */
  eligibilityCheck: (donorId, eligible, reason) => {
    logger.info('Eligibility check completed', {
      event: 'ELIGIBILITY_CHECK',
      donorId,
      eligible,
      reason,
    });
  },

  /**
   * Log authentication error
   */
  authError: (message, email, error) => {
    logger.error(message, {
      event: 'AUTH_ERROR',
      email,
      error: error instanceof Error ? error.message : error,
    });
  },
};

export default logger;
