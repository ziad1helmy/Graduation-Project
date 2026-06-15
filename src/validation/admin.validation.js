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

  if (!body.password || body.password.length < 8) {
    errors.push('Password must be at least 8 characters');
  }

  const hospitalId = body.hospitalId || body.hospitalCode;
  if (!hospitalId || typeof hospitalId !== 'string') {
    errors.push('hospitalId (or hospitalCode) is required');
  }

  const lat = body.lat ?? body.latitude;
  const lng = body.long ?? body.longitude;
  if (lat === undefined || lat === null || typeof lat !== 'number' || lat < -90 || lat > 90) {
    errors.push('Valid latitude (or lat) is required (-90 to 90)');
  }
  if (lng === undefined || lng === null || typeof lng !== 'number' || lng < -180 || lng > 180) {
    errors.push('Valid longitude (or long/lng) is required (-180 to 180)');
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

const validateLocationField = (location, errors) => {
  if (typeof location !== 'object' || location === null) {
    errors.push('location must be an object');
    return;
  }
  
  if (location.city !== undefined && typeof location.city !== 'string') {
    errors.push('location.city must be a string');
  }
  
  if (location.governorate !== undefined && typeof location.governorate !== 'string') {
    errors.push('location.governorate must be a string');
  }
  
  if (location.coordinates !== undefined) {
    if (typeof location.coordinates !== 'object' || location.coordinates === null) {
      errors.push('location.coordinates must be an object');
      return;
    }
    
    const { lat, lng } = location.coordinates;
    if (lat !== undefined && (typeof lat !== 'number' || lat < -90 || lat > 90)) {
      errors.push('Valid latitude (lat) is required (-90 to 90)');
    }
    if (lng !== undefined && (typeof lng !== 'number' || lng < -180 || lng > 180)) {
      errors.push('Valid longitude (lng) is required (-180 to 180)');
    }
  }
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

  if (body.address !== undefined && typeof body.address !== 'string') {
    errors.push('address must be a string');
  }

  if (body.location !== undefined) {
    validateLocationField(body.location, errors);
  }

  return { valid: errors.length === 0, errors };
};
