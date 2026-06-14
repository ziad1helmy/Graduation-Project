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

export const buildRequiredByDate = ({ requiredBy, date, time }) => {
  if (requiredBy) return new Date(requiredBy);
  if (!date) return null;

  const scheduledDate = new Date(date);
  if (Number.isNaN(scheduledDate.getTime())) return null;

  if (time) {
    const timeStr = String(time).trim();
    let match = timeStr.match(/^(\d{1,2}):(\d{2})$/);
    if (match) {
      const hour = Number(match[1]);
      const minute = Number(match[2]);
      if (hour >= 0 && hour < 24 && minute >= 0 && minute < 60) {
        scheduledDate.setHours(hour, minute, 0, 0);
        return scheduledDate;
      }
    }

    match = timeStr.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
    if (match) {
      let hour = Number(match[1]);
      const minute = Number(match[2]);
      const period = match[3].toUpperCase();
      if (hour >= 1 && hour <= 12 && minute >= 0 && minute < 60) {
        if (period === 'PM' && hour !== 12) hour += 12;
        if (period === 'AM' && hour === 12) hour = 0;
        scheduledDate.setHours(hour, minute, 0, 0);
        return scheduledDate;
      }
    }
  }

  return scheduledDate;
};

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

export const validateCreateRequestBody = (body = {}) => {
  const errors = [];
  const validUrgencies = ['low', 'medium', 'high', 'critical'];

  const { type, urgency, requiredBy, date, time, isEmergency } = body;
  const bloodTypeInput = body.bloodTypes !== undefined ? body.bloodTypes : body.bloodType;
  const normalizedBloodTypes = normalizeBloodTypeList(bloodTypeInput);

  if (!type || (!urgency && isEmergency !== true) || (!requiredBy && !date)) {
    errors.push('Type, urgency or emergency flag, and requiredBy/date are required');
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

  const requiredByDate = buildRequiredByDate({ requiredBy, date, time });
  if (!requiredByDate || Number.isNaN(requiredByDate.getTime())) {
    errors.push('Required date must be a valid date');
  } else if (requiredByDate <= new Date()) {
    errors.push('Required date must be in the future');
  }

  return { valid: errors.length === 0, errors, bloodTypes: normalizedBloodTypes };
};


/**
 * Validate create emergency request payload.
 */
export const validateCreateEmergencyRequestBody = (body = {}) => {
  const errors = [];
  const allowedFields = new Set(['bloodType', 'unitsNeeded', 'patientDetails', 'isEmergency']);
  const unexpectedFields = Object.keys(body).filter((key) => !allowedFields.has(key));

  if (unexpectedFields.length > 0) {
    errors.push(`Unexpected field${unexpectedFields.length > 1 ? 's' : ''}: ${unexpectedFields.join(', ')}`);
  }

  if (!body.bloodType || typeof body.bloodType !== 'string' || !body.bloodType.trim()) {
    errors.push('bloodType is required');
  }

  const unitsNeeded = Number(body.unitsNeeded);
  if (!Number.isInteger(unitsNeeded) || unitsNeeded < 1) {
    errors.push('unitsNeeded is required and must be a positive integer');
  }

  if (typeof body.patientDetails !== 'string' || !body.patientDetails.trim()) {
    errors.push('patientDetails is required');
  }

  if (body.isEmergency !== undefined && body.isEmergency !== true) {
    errors.push('isEmergency must be true');
  }

  const bloodTypes = body.bloodType ? normalizeBloodTypeList(body.bloodType) : [];
  if (body.bloodType && bloodTypes.length === 0) {
    errors.push('bloodType must be a valid blood type');
  }

  return {
    valid: errors.length === 0,
    errors,
    bloodTypes,
    unitsNeeded: Number.isInteger(unitsNeeded) && unitsNeeded > 0 ? unitsNeeded : null,
    patientDetails: typeof body.patientDetails === 'string' ? body.patientDetails.trim() : '',
  };
};
