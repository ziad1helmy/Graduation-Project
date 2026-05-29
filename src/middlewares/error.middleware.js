import response from '../utils/response.js';
import { TokenExpiredError, JsonWebTokenError } from '../utils/jwt.js';
import { logger } from '../utils/logger.js';

const isDev = process.env.NODE_ENV !== 'production';

export default function errorMiddleware(err, req, res, next) {
  if (res.headersSent) {
    return next(err);
  }

  // Log the error with full details (stack only in development)
  logger.error('Unhandled error', {
    message: err?.message,
    statusCode: err?.statusCode || err?.status || 500,
    method: req.method,
    path: req.path,
    ip: req.ip,
    userId: req.user?._id,
    stack: isDev ? err?.stack : undefined,
  });

  if (err instanceof TokenExpiredError) {
    logger.warn('Token expired', {
      userId: req.user?._id,
      ip: req.ip,
    });
    return response.error(res, 401, 'Token has expired');
  }

  if (err instanceof JsonWebTokenError) {
    logger.warn('Invalid token', {
      ip: req.ip,
      userAgent: req.get('user-agent'),
    });
    return response.error(res, 401, 'Invalid token');
  }

  if (err?.name === 'ValidationError') {
    const details = Object.values(err.errors || {}).map((item) => item.message);
    logger.warn('Validation error', {
      path: req.path,
      detailCount: details.length,
    });
    return response.error(res, 400, 'error.validation_failed', details);
  }

  if (err?.name === 'CastError') {
    logger.warn('Invalid ID format', {
      path: err.path,
      value: err.value,
    });
    return response.error(res, 400, `Invalid ${err.path}`);
  }

  if (err?.code === 11000) {
    const field = Object.keys(err.keyPattern)[0];
    logger.warn('Duplicate key error', {
      field,
      value: err.keyValue[field],
    });
    return response.error(res, 409, `Duplicate ${field}`);
  }

  const statusCode = err?.statusCode || err?.status || 500;
  const message = statusCode >= 500 ? 'Internal server error' : (err?.message || 'Request failed');
  
  return response.error(res, statusCode, message);
}
