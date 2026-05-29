/**
 * Hospital Validation - Input validation for hospital endpoints
 *
 * Each validator returns { valid: boolean, errors: string[] }
 */

import { DONATION_TYPE_OPTIONS } from '../constants/donation.constants.js';
import {
  BLOOD_TYPE_VALUES,
  normalizeBloodTypeList,
} from '../utils/blood-type.js';

const isValidNumber = (value) => Number.isFinite(Number(value));

/**
 * Validate find compatible donors query parameters.
 */
export const validateFindDonorsQuery = (query = {}, lat, lng, radiusKm, participation) => {
  const errors = [];
  const validBloodTypes = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

  const bloodType = typeof query.bloodType === 'string' && query.bloodType.trim()
    ? query.bloodType.replace(/\s+/g, '+').trim().toUpperCase()
    : null;

  if (bloodType && !validBloodTypes.includes(bloodType)) {
    errors.push('Invalid bloodType');
  }

  if (radiusKm !== null && (!isValidNumber(radiusKm) || radiusKm <= 0)) {
    errors.push('radiusKm must be a positive number');
  }

  if (lat !== null && (lat < -90 || lat > 90)) {
    errors.push('lat must be between -90 and 90');
  }

  if (lng !== null && (lng < -180 || lng > 180)) {
    errors.push('lng must be between -180 and 180');
  }

  if ((lat === null) !== (lng === null)) {
    errors.push('lat and lng must be provided together');
  }

  if (participation === null) {
    errors.push('participation must be a boolean value');
  }

  return { valid: errors.length === 0, errors };
};

/**
 * Validate book donor appointment payload.
 */
export const validateBookAppointmentBody = (body = {}, appointmentDateObj) => {
  const errors = [];

  if (!appointmentDateObj || Number.isNaN(appointmentDateObj.getTime())) {
    errors.push('appointmentDate is required');
  }

  const donationType = body.donationType || 'Whole Blood';
  if (!DONATION_TYPE_OPTIONS.includes(donationType)) {
    errors.push('Invalid donation type');
  }

  return { valid: errors.length === 0, errors };
};

/**
 * Validate create request body.
 */
export const validateCreateRequestBody = (body = {}) => {
  const errors = [];
  const validUrgencies = ['low', 'medium', 'high', 'critical'];

  const { type, urgency, requiredBy, isEmergency } = body;
  const bloodTypeInput = body.bloodTypes !== undefined ? body.bloodTypes : body.bloodType;
  const normalizedBloodTypes = normalizeBloodTypeList(bloodTypeInput);

  if (!type || (!urgency && isEmergency !== true) || !requiredBy) {
    errors.push('Type, urgency or emergency flag, and requiredBy are required');
    return { valid: false, errors };
  }

  if (!['blood', 'plasma', 'platelets', 'double_red_cells'].includes(type)) {
    errors.push('Type must be blood, plasma, platelets, or double_red_cells');
  }

  if (urgency && !validUrgencies.includes(urgency)) {
    errors.push('Urgency must be low, medium, high, or critical');
  }

  if (['blood', 'double_red_cells'].includes(type) && normalizedBloodTypes.length === 0) {
    errors.push('Blood type is required for blood or double red cells donation requests');
  }

  if (bloodTypeInput !== undefined && bloodTypeInput !== null) {
    if (Array.isArray(bloodTypeInput) && bloodTypeInput.length === 0) {
      errors.push('Blood type must include at least one valid blood type');
    }

    const invalidBloodTypes = Array.isArray(bloodTypeInput)
      ? bloodTypeInput.filter((item) => !BLOOD_TYPE_VALUES.includes(String(item).trim().toUpperCase().replace(/\s+/g, '+')))
      : normalizedBloodTypes.length === 0 && bloodTypeInput
        ? [bloodTypeInput]
        : [];

    if (invalidBloodTypes.length > 0) {
      errors.push(`Invalid blood type${invalidBloodTypes.length > 1 ? 's' : ''}: ${invalidBloodTypes.join(', ')}`);
    }
  }

  const requiredByDate = new Date(requiredBy);
  if (Number.isNaN(requiredByDate.getTime())) {
    errors.push('Required date must be a valid date');
  } else if (requiredByDate <= new Date()) {
    errors.push('Required date must be in the future');
  }

  return { valid: errors.length === 0, errors, bloodTypes: normalizedBloodTypes };
};
