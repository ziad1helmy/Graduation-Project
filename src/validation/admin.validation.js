/**
 * Admin Validation - Request body/query validation for admin endpoints
 *
 * Each validator returns { valid: boolean, errors: string[] }
 */

/**
 * Validate maintenance mode toggle body.
 */
export const validateMaintenanceBody = (body) => {
  const errors = [];

  if (body.enabled === undefined || typeof body.enabled !== 'boolean') {
    errors.push('enabled (boolean) is required');
  }

  if (body.message !== undefined && typeof body.message !== 'string') {
    errors.push('message must be a string');
  }

  return { valid: errors.length === 0, errors };
};

/**
 * Validate user list query params.
 */
export const validateListUsersQuery = (query) => {
  const errors = [];
  const validRoles = ['donor', 'hospital', 'admin', 'superadmin'];

  if (query.role && !validRoles.includes(query.role)) {
    errors.push(`role must be one of: ${validRoles.join(', ')}`);
  }

  if (query.page && (isNaN(query.page) || parseInt(query.page) < 1)) {
    errors.push('page must be a positive integer');
  }

  if (query.limit && (isNaN(query.limit) || parseInt(query.limit) < 1 || parseInt(query.limit) > 100)) {
    errors.push('limit must be between 1 and 100');
  }

  return { valid: errors.length === 0, errors };
};

/**
 * Validate suspend user body.
 */
export const validateSuspendBody = (body) => {
  const errors = [];

  if (!body.reason || typeof body.reason !== 'string' || body.reason.trim().length === 0) {
    errors.push('reason (string) is required');
  }

  if (body.reason && body.reason.length > 500) {
    errors.push('reason must be less than 500 characters');
  }

  return { valid: errors.length === 0, errors };
};

/**
 * Validate create hospital body.
 */
export const validateCreateHospitalBody = (body) => {
  const errors = [];

  if (!body.fullName || typeof body.fullName !== 'string') {
    errors.push('fullName is required');
  }

  if (!body.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email)) {
    errors.push('Valid email is required');
  }

  if (!body.password || body.password.length < 8) {
    errors.push('Password must be at least 8 characters');
  }

  if (!body.hospitalName || typeof body.hospitalName !== 'string') {
    errors.push('hospitalName is required');
  }

  if (body.hospitalId === undefined || body.hospitalId === null) {
    errors.push('hospitalId is required');
  }

  if (body.lat === undefined || body.lat === null || typeof body.lat !== 'number') {
    errors.push('lat (number) is required');
  } else if (body.lat < -90 || body.lat > 90) {
    errors.push('lat must be between -90 and 90');
  }

  if (body.long === undefined || body.long === null || typeof body.long !== 'number') {
    errors.push('long (number) is required');
  } else if (body.long < -180 || body.long > 180) {
    errors.push('long must be between -180 and 180');
  }

  return { valid: errors.length === 0, errors };
};

/**
 * Validate admin creation payload.
 */
export const validateCreateAdminBody = (body) => {
  const errors = [];
  const validRoles = ['admin', 'superadmin'];

  if (!body.fullName || typeof body.fullName !== 'string') {
    errors.push('fullName is required');
  }

  if (!body.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email)) {
    errors.push('Valid email is required');
  }

  if (!body.password || typeof body.password !== 'string' || body.password.length < 8) {
    errors.push('Password must be at least 8 characters');
  }

  if (body.role && !validRoles.includes(body.role)) {
    errors.push(`role must be one of: ${validRoles.join(', ')}`);
  }

  return { valid: errors.length === 0, errors };
};

/**
 * Validate admin-created hospital payload for the new hospital form.
 */
export const validateCreateHospitalByAdminBody = (body) => {
  const errors = [];
  const validBloodTypes = ['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-'];

  if (!body.name || typeof body.name !== 'string') {
    errors.push('name is required');
  }

  if (!body.type || typeof body.type !== 'string') {
    errors.push('type is required');
  }

  if (!body.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email)) {
    errors.push('Valid email is required');
  }

  if (!body.phone || typeof body.phone !== 'string') {
    errors.push('phone is required');
  }

  if (!body.hospitalId || typeof body.hospitalId !== 'string') {
    errors.push('hospitalId is required');
  }

  if (body.bloodBanksAvailable !== undefined) {
    if (!Array.isArray(body.bloodBanksAvailable)) {
      errors.push('bloodBanksAvailable must be an array');
    } else {
      for (const bloodType of body.bloodBanksAvailable) {
        if (!validBloodTypes.includes(bloodType)) {
          errors.push(`Invalid blood type: ${bloodType}`);
        }
      }
    }
  }

  if (body.capacity !== undefined && body.capacity !== null && body.capacity !== '' && Number.isNaN(Number(body.capacity))) {
    errors.push('capacity must be a number');
  }

  return { valid: errors.length === 0, errors };
};

/**
 * Validate request list query params.
 */
export const validateListRequestsQuery = (query) => {
  const errors = [];
  const validStatuses = ['pending', 'accepted', 'in-progress', 'completed', 'cancelled', 'expired'];
  const validUrgencies = ['low', 'medium', 'high', 'critical'];
  const validBloodTypes = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

  if (query.status && !validStatuses.includes(query.status)) {
    errors.push(`status must be one of: ${validStatuses.join(', ')}`);
  }

  if (query.urgency && !validUrgencies.includes(query.urgency)) {
    errors.push(`urgency must be one of: ${validUrgencies.join(', ')}`);
  }

  if (query.bloodType && !validBloodTypes.includes(query.bloodType)) {
    errors.push(`bloodType must be one of: ${validBloodTypes.join(', ')}`);
  }

  return { valid: errors.length === 0, errors };
};

/**
 * Validate cancel request body.
 */
export const validateCancelRequestBody = (body) => {
  const errors = [];

  if (!body.reason || typeof body.reason !== 'string' || body.reason.trim().length === 0) {
    errors.push('reason (string) is required');
  }

  return { valid: errors.length === 0, errors };
};

/**
 * Validate emergency broadcast body.
 */
export const validateEmergencyBroadcastBody = (body) => {
  const errors = [];
  const validBloodTypes = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

  if (!body.title || typeof body.title !== 'string') {
    errors.push('title is required');
  }

  if (!body.message || typeof body.message !== 'string') {
    errors.push('message is required');
  }

  if (body.bloodTypes && Array.isArray(body.bloodTypes)) {
    for (const bt of body.bloodTypes) {
      if (!validBloodTypes.includes(bt)) {
        errors.push(`Invalid blood type: ${bt}`);
      }
    }
  }

  return { valid: errors.length === 0, errors };
};
