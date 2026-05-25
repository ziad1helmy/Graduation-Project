/**
 * Response utility module.
 * Enforces a consistent API response shape for success and error responses.
 * Frontend-friendly and predictable; avoids ad-hoc res.json() in controllers.
 */



const inferErrorCode = (statusCode, message) => {
  const normalizedMessage = String(message || '').toLowerCase();

  if (normalizedMessage.includes('already registered') || normalizedMessage.includes('already exists')) {
    return 'EMAIL_ALREADY_EXISTS';
  }
  if (normalizedMessage.includes('must match password') || normalizedMessage.includes('password mismatch')) {
    return 'PASSWORD_MISMATCH';
  }
  if (normalizedMessage.includes('at least 17') || normalizedMessage.includes('underage')) {
    return 'UNDERAGE_DONOR';
  }
  if (normalizedMessage.includes('not eligible')) {
    return 'DONOR_NOT_ELIGIBLE';
  }
  if (
    normalizedMessage.includes('validation') ||
    normalizedMessage.includes('required') ||
    normalizedMessage.includes('must be') ||
    normalizedMessage.includes('format')
  ) {
    return 'VALIDATION_ERROR';
  }

  switch (statusCode) {
    case 400:
      return 'BAD_REQUEST';
    case 401:
      return 'UNAUTHORIZED';
    case 403:
      return 'FORBIDDEN';
    case 404:
      return 'NOT_FOUND';
    case 409:
      return 'CONFLICT';
    default:
      return 'INTERNAL_SERVER_ERROR';
  }
};

/**
 * Sends a success JSON response with a consistent shape.
 *
 * @param {import('express').Response} res - Express response object.
 * @param {number} statusCode - HTTP status (e.g. 200, 201).
 * @param {string} message - Human-readable message.
 * @param {object|array|null} [data] - Optional payload (omitted when undefined).
 * @returns {import('express').Response} The same res for optional chaining.
 */
export function successResponse(res, statusCode, message, data = undefined) {
  const body = {
    success: true,
    message: message || undefined,
    data: data !== undefined ? data : message ?? null,
  };
  return res.status(statusCode).json(body);
}

/**
 * Sends an error JSON response with a consistent shape.
 *
 * @param {import('express').Response} res - Express response object.
 * @param {number} statusCode - HTTP status (e.g. 400, 401, 404, 500).
 * @param {string} message - Human-readable error message.
 * @returns {import('express').Response} The same res for optional chaining.
 */
export function errorResponse(res, statusCode, message, details = undefined) {
  return res.status(statusCode).json({
    success: false,
    code: inferErrorCode(statusCode, message),
    message,
    ...(details !== undefined ? { details } : {}),
  });
}


export default {
  success: successResponse,
  error: errorResponse,
};