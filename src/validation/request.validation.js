/**
 * Request Validation - Input validation for request detail and QR endpoints
 */

const isValidNumber = (value) => Number.isFinite(Number(value));

export const validateNearbyRequestsQuery = (query = {}) => {
  const errors = [];

  if (query.lat !== undefined && !isValidNumber(query.lat)) {
    errors.push('lat must be a valid number');
  }
  if (query.lng !== undefined && !isValidNumber(query.lng)) {
    errors.push('lng must be a valid number');
  }
  if (query.radius !== undefined && (!isValidNumber(query.radius) || Number(query.radius) <= 0)) {
    errors.push('radius must be a positive number');
  }
  if (query.limit !== undefined && (!Number.isInteger(Number(query.limit)) || Number(query.limit) < 1 || Number(query.limit) > 100)) {
    errors.push('limit must be an integer between 1 and 100');
  }
  if (query.page !== undefined && (!Number.isInteger(Number(query.page)) || Number(query.page) < 1)) {
    errors.push('page must be a positive integer');
  }

  return { valid: errors.length === 0, errors };
};

export const validateRequestIdParam = (params = {}) => {
  const errors = [];
  if (!params.id) {
    errors.push('id is required');
  }
  return { valid: errors.length === 0, errors };
};

export const validateQrBody = (body = {}) => {
  const errors = [];
  if (!body.qrToken || typeof body.qrToken !== 'string') {
    errors.push('qrToken is required');
  }
  return { valid: errors.length === 0, errors };
};
