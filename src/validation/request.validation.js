/**
 * Request Validation - Input validation for request detail and QR endpoints
 */

import { parseLatLng } from '../utils/geo.js';

const isValidNumber = (value) => Number.isFinite(Number(value));

export const validateNearbyRequestsQuery = (query = {}) => {
  const errors = [];

  const { lat, lng, hasCoordinates } = parseLatLng(query);

  if (query.lat !== undefined || query.latitude !== undefined) {
    if (!hasCoordinates) {
      errors.push('lat must be a valid number');
    } else if (lat < -90 || lat > 90) {
      errors.push('lat must be between -90 and 90');
    }
  }

  if (query.lng !== undefined || query.long !== undefined || query.longitude !== undefined) {
    if (!hasCoordinates) {
      errors.push('lng must be a valid number');
    } else if (lng < -180 || lng > 180) {
      errors.push('lng must be between -180 and 180');
    }
  }

  const latProvided = query.lat !== undefined || query.latitude !== undefined;
  const lngProvided = query.lng !== undefined || query.long !== undefined || query.longitude !== undefined;
  if (latProvided !== lngProvided) {
    errors.push('lat and lng must be provided together');
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
