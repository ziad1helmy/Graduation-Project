import response from '../utils/response.js';
import { TokenExpiredError, JsonWebTokenError } from '../utils/jwt.js';
import { logger } from '../utils/logger.js';
import { HttpError } from '../utils/HttpError.js';

const isDev = process.env.NODE_ENV !== 'production';

export default function errorMiddleware(err, req, res, next) {
  if (res.headersSent) {
    return next(err);
  }

  // HttpError carries its own status code; treat it as an expected client error
  if (err instanceof HttpError) {
    if (err.statusCode >= 500) {
      logger.error('HttpError (5xx)', {
        message: err.message,
        statusCode: err.statusCode,
        method: req.method,
        path: req.path,
        stack: isDev ? err.stack : undefined,
      });
    } else {
      logger.warn('HttpError', {
        message: err.message,
        statusCode: err.statusCode,
        method: req.method,
        path: req.path,
      });
    }
    return response.error(res, err.statusCode, err.message, err.details);
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
    return response.error(res, 401, 'auth.error_token_expired');
  }

  if (err instanceof JsonWebTokenError) {
    logger.warn('auth.error_invalid_token_generic', {
      ip: req.ip,
      userAgent: req.get('user-agent'),
    });
    return response.error(res, 401, 'auth.error_invalid_token_generic');
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
    return response.error(res, 400, 'error.invalid_resource_identifier');
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
