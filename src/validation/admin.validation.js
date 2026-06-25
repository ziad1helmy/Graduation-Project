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
 * Validate ban donor body.
 */
export const validateBanDonorBody = (body) => {
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
 * Accepts both legacy field names and Flutter field names via aliases.
 */
export const validateCreateHospitalBody = (body) => {
  const errors = [];

  const name = body.fullName || body.name || body.hospitalName;
  if (!name || typeof name !== 'string') {
    errors.push('name (or fullName/hospitalName) is required');
  }

  if (!body.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email)) {
    errors.push('Valid email is required');
  }

  if (body.password !== undefined && (typeof body.password !== 'string' || body.password.length < 8)) {
    errors.push('Password must be at least 8 characters');
  }

  const phone = body.phone || body.adminContactPhone || body.emergencyContactNumber || body.contactNumber;
  if (!phone || typeof phone !== 'string' || !phone.trim()) {
    errors.push('phone (or adminContactPhone/emergencyContactNumber) is required');
  }

  const hospitalId = body.hospitalId || body.hospitalCode;
  if (hospitalId !== undefined && typeof hospitalId !== 'string') {
    errors.push('hospitalId (or hospitalCode) must be a string');
  }

  const lat = body.lat ?? body.latitude;
  const lng = body.long ?? body.longitude;
  if (lat !== undefined && lat !== null && (typeof lat !== 'number' || lat < -90 || lat > 90)) {
    errors.push('Valid latitude (or lat) must be between -90 and 90');
  }
  if (lng !== undefined && lng !== null && (typeof lng !== 'number' || lng < -180 || lng > 180)) {
    errors.push('Valid longitude (or long/lng) must be between -180 and 180');
  }

  if (body.type && typeof body.type !== 'string') {
    errors.push('type must be a string');
  }

  return { valid: errors.length === 0, errors };
};

/**
 * Validate admin creation payload.
 * Accepts `accessLevel` (Full Access → superadmin, anything else → admin)
 * or legacy `role` field.
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

  if (body.phone !== undefined && typeof body.phone !== 'string') {
    errors.push('phone must be a string');
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

  const hospitalId = body.hospitalId || body.hospitalCode;
  if (hospitalId !== undefined && typeof hospitalId !== 'string') {
    errors.push('hospitalId (or hospitalCode) must be a string');
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
export const validateCancelRequestBody = () => ({ valid: true, errors: [] });

/**
 * Validate system settings update body.
 * At least one known key must be present.
 * @param {object} body
 * @returns {{ valid: boolean, errors: string[] }}
 */
export const validateUpdateSystemSettingsBody = (body) => {
  const errors = [];
  const booleanKeys = ['maintenanceModeEnabled', 'donorRegistrationEnabled', 'notificationsEnabled'];
  const numberKeys = ['maxMissedDonationsBeforeBan'];
  const allKeys = [...booleanKeys, ...numberKeys];
  const provided = allKeys.filter((k) => body[k] !== undefined);

  if (provided.length === 0) {
    errors.push(`at least one of ${allKeys.join(', ')} is required`);
  }

  for (const k of provided) {
    if (booleanKeys.includes(k) && typeof body[k] !== 'boolean') {
      errors.push(`${k} must be a boolean`);
    }
    if (numberKeys.includes(k)) {
      const val = body[k];
      if (typeof val !== 'number' || !Number.isInteger(val) || val < 1) {
        errors.push(`${k} must be a positive integer (>= 1)`);
      }
    }
  }

  return { valid: errors.length === 0, errors };
};

/**
 * Validate admin profile update body.
 */
export const validateUpdateAdminProfileBody = (body) => {
  const errors = [];

  if (body.fullName !== undefined && typeof body.fullName !== 'string') {
    errors.push('fullName must be a string');
  }

  if (body.email !== undefined && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email)) {
    errors.push('Valid email is required');
  }

  if (body.phone !== undefined && typeof body.phone !== 'string') {
    errors.push('phone must be a string');
  }

  return { valid: errors.length === 0, errors };
};
