/**
 * Auth Service Validation Layer
 * Handles validation for registration and login with strict role-specific field separation
 * Supports Arabic and English text input for names and text fields
 */

import { calculateAge } from '../utils/age.js';
import { isValidArabicEnglishText } from '../utils/textNormalization.js';
import { ERR } from '../utils/errorCodes.js';
import ELIGIBILITY_KEYS from '../utils/eligibility-keys.js';

// Regex pattern for Arabic + English text (letters + spaces + dash + dot)
// Allows: Arabic (ا-ي, ء-ة), English (a-z, A-Z), spaces, dots (.), dashes (-)
// Rejects: numbers, special characters
const ARABIC_ENGLISH_PATTERN = /^[\u0600-\u06FFa-zA-Z\s\.\-]+$/;

export const PASSWORD_PATTERN = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;

const parseLocationCoordinates = (location) => {
  if (!location || typeof location !== 'object' || Array.isArray(location)) {
    return { lat: undefined, lng: undefined };
  }

  const rawLat = location.coordinates?.lat ?? location.lat ?? location.latitude;
  const rawLng = location.coordinates?.lng ?? location.lng ?? location.longitude;

  return {
    lat: rawLat === '' || rawLat === undefined || rawLat === null ? undefined : Number(rawLat),
    lng: rawLng === '' || rawLng === undefined || rawLng === null ? undefined : Number(rawLng),
  };
};

const isValidCoordinate = (value, min, max) => (
  typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max
);

// BASE VALIDATION RULES (all roles)
const BASE_RULES = {
  fullName: {
    required: true,
    minLength: 3,
    maxLength: 100,
    pattern: ARABIC_ENGLISH_PATTERN,
    errorMessage: 'fullName can contain Arabic and English letters, spaces, dots, and dashes only',
  },
  email: {
    required: true,
    pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  },
  password: {
    required: true,
    minLength: 8,
    // Pattern: at least one uppercase, one lowercase, one digit, one special char
    pattern: PASSWORD_PATTERN,
  },
  role: {
    required: true,
    enum: ['donor', 'hospital', 'admin'],
  },
};

// DONOR-SPECIFIC VALIDATION RULES
const DONOR_RULES = {
  phoneNumber: {
    required: true,
    pattern: /^[0-9]{11}$/,
    errorMessage: 'Phone number must be 11 digits',
  },
  dateOfBirth: {
    required: true,
    type: 'date',
    requiredMessage: ELIGIBILITY_KEYS.DATE_OF_BIRTH_REQUIRED,
    typeErrorMessage: ELIGIBILITY_KEYS.INVALID_DATE_OF_BIRTH,
    validator: (val) => {
      const date = new Date(val);
      return date instanceof Date && date <= new Date() && date.getFullYear() >= 1900;
    },
    errorMessage: ELIGIBILITY_KEYS.INVALID_DATE_OF_BIRTH,
  },
  bloodType: {
    required: true,
    enum: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'],
    errorMessage: 'bloodType must be one of A+, A-, B+, B-, AB+, AB-, O+, O-',
  },
  gender: {
    required: false,
    enum: ['male', 'female'],
  },
};

// HOSPITAL-SPECIFIC VALIDATION RULES
const HOSPITAL_RULES = {
  hospitalName: {
    required: true,
    minLength: 3,
    maxLength: 200,
    pattern: ARABIC_ENGLISH_PATTERN,
    errorMessage: 'hospitalName can contain Arabic and English letters, spaces, dots, and dashes only',
  },
  hospitalId: {
    required: true,
    minLength: 3,
    maxLength: 50,
  },
  address: {
    required: false,
    minLength: 3,
    maxLength: 300,
    pattern: ARABIC_ENGLISH_PATTERN,
    errorMessage: 'address can contain Arabic and English letters, spaces, dots, and dashes only',
  },
};

// SHARED VALIDATION RULES
const SHARED_RULES = {
  confirmPassword: {
    required: true,
  },
};

// Merged rule set for validateField()
const VALIDATION_RULES = {
  ...BASE_RULES,
  ...DONOR_RULES,
  ...HOSPITAL_RULES,
  ...SHARED_RULES,
};

/**
 * Validate a single field value
 * @param {string} fieldName - Field name to validate
 * @param {*} value - Value to validate
 * @returns {object} { valid: boolean, error: string | null }
 */
const validateField = (fieldName, value) => {
  const rule = VALIDATION_RULES[fieldName];

  if (!rule) {
    return { valid: true, error: null };
  }

  // Check required
  if (rule.required && (value === undefined || value === null || value === '')) {
    return { valid: false, error: rule.requiredMessage || `${fieldName} is required` };
  }

  // If not required and empty, skip further validation
  if (!rule.required && (value === undefined || value === null || value === '')) {
    return { valid: true, error: null };
  }

  // Check type
  if (rule.type === 'date') {
    try {
      const date = new Date(value);
      if (!(date instanceof Date) || isNaN(date.getTime())) {
        return { valid: false, error: rule.typeErrorMessage || `${fieldName} must be a valid date` };
      }
    } catch (error) {
      return { valid: false, error: ELIGIBILITY_KEYS.AGE_VERIFICATION_FAILED };
    }
  }

  if (rule.type === 'number') {
    if (typeof value !== 'number' && isNaN(Number(value))) {
      return { valid: false, error: `${fieldName} must be a number` };
    }
  }

  // Check minLength
  if (rule.minLength && typeof value === 'string' && value.length < rule.minLength) {
    return { valid: false, error: `${fieldName} must be at least ${rule.minLength} characters long` };
  }

  // Check maxLength
  if (rule.maxLength && typeof value === 'string' && value.length > rule.maxLength) {
    return { valid: false, error: `${fieldName} must be at most ${rule.maxLength} characters long` };
  }

  // Check pattern (regex)
  if (rule.pattern && !rule.pattern.test(String(value))) {
    return { valid: false, error: rule.errorMessage || `${fieldName} format is invalid` };
  }

  // Check enum
  if (rule.enum && !rule.enum.includes(value)) {
    return { valid: false, error: `${fieldName} must be one of: ${rule.enum.join(', ')}` };
  }

  // Check custom validator
  if (rule.validator && !rule.validator(value)) {
    return { valid: false, error: rule.errorMessage || `${fieldName} validation failed` };
  }

  return { valid: true, error: null };
};

/**
 * Validate login data with role-specific requirements
 * @param {object} data - Login data { email, password, role, hospitalId?, adminCode? }
 * @returns {object} { valid: boolean, errors: object }
 */
export const validateLogin = (data) => {
  const errors = {};
  const { role } = data;

  // Validate base fields (email, password, role)
  ['email', 'password', 'role'].forEach((field) => {
    const { valid, error } = validateField(field, data[field]);
    if (!valid) {
      errors[field] = error;
    }
  });

  // Role-specific validation
  if (role === 'hospital') {
    // Hospital requires hospitalId
    if (data.hospitalId === undefined || data.hospitalId === null || data.hospitalId === '') {
      errors.hospitalId = 'hospitalId is required for hospital login';
    } else {
      const { valid, error } = validateField('hospitalId', data.hospitalId);
      if (!valid) {
        errors.hospitalId = error;
      }
    }
  } else if (role === 'admin') {
    // Admin requires adminCode
    if (data.adminCode === undefined || data.adminCode === null || data.adminCode === '') {
      errors.adminCode = 'adminCode is required for admin login';
    } else {
      const { valid, error } = validateField('adminCode', data.adminCode);
      if (!valid) {
        errors.adminCode = error;
      }
    }
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
};

/**
 * Validate password change data for authenticated users.
 * @param {object} data - Change password data
 * @returns {object} { valid: boolean, errors: object }
 */
export const validateChangePassword = (data) => {
  const errors = {};

  if (!data.currentPassword) {
    errors.currentPassword = 'currentPassword is required';
  }

  const newPassword = data.newPassword;
  const { valid: newPasswordValid, error: newPasswordError } = validateField('password', newPassword);
  if (!newPasswordValid) {
    errors.newPassword = newPasswordError;
  }

  if (newPassword) {
    const confirmPassword = data.confirmPassword;
    if (confirmPassword === undefined || confirmPassword === null || confirmPassword === '') {
      errors.confirmPassword = 'confirmPassword is required';
    } else if (String(confirmPassword) !== String(newPassword)) {
      errors.confirmPassword = 'confirmPassword must match newPassword';
    }
  }

  if (
    data.currentPassword &&
    newPassword &&
    String(data.currentPassword) === String(newPassword)
  ) {
    errors.newPassword = 'newPassword must be different from currentPassword';
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
};

/**
 * Validate registration data based on role
 * @param {object} data - Registration data
 * @returns {object} { valid: boolean, errors: object }
 */
export const validateRegister = (data) => {
  const errors = {};
  const { role } = data;

  // Validate base fields
  ['fullName', 'email', 'password', 'role'].forEach((field) => {
    const { valid, error } = validateField(field, data[field]);
    if (!valid) {
      errors[field] = error;
    }
  });

  // confirmPassword must match password (always checked when registering)
  if (data.password) {
    const confirm = data.confirmPassword;
    if (confirm === undefined || confirm === null || confirm === '') {
      errors.confirmPassword = 'confirmPassword is required';
    } else if (String(confirm) !== String(data.password)) {
      errors.confirmPassword = 'confirmPassword must match password';
    }
  }

  if (role && role !== 'donor') {
    errors.role = 'Public signup is available for donors only';
  }

  // Validate role-specific required fields
  if (role === 'donor') {
    ['phoneNumber', 'dateOfBirth'].forEach((field) => {
      const { valid, error } = validateField(field, data[field]);
      if (!valid) {
        errors[field] = error;
      }
    });

    if (!errors.dateOfBirth) {
      try {
        const age = calculateAge(data.dateOfBirth);
        if (age === null) {
          errors.dateOfBirth = ELIGIBILITY_KEYS.AGE_VERIFICATION_FAILED;
        } else if (age < 17) {
          errors.dateOfBirth = ELIGIBILITY_KEYS.MINIMUM_AGE;
        }
      } catch (error) {
        errors.dateOfBirth = ELIGIBILITY_KEYS.AGE_VERIFICATION_FAILED;
      }
    }

    // Validate optional donor fields
    if (data.gender) {
      const { valid, error } = validateField('gender', data.gender);
      if (!valid) {
        errors.gender = error;
      }
    }

    // Validate bloodType
    const { valid: btValid, error: btError } = validateField('bloodType', data.bloodType);
    if (!btValid) {
      errors.bloodType = btError;
    }

    if (data.location && typeof data.location === 'object' && !Array.isArray(data.location)) {
      const { lat, lng } = parseLocationCoordinates(data.location);
      const hasLat = lat !== undefined;
      const hasLng = lng !== undefined;

      if (hasLat || hasLng) {
        if (!hasLat || !hasLng) {
          errors.location = ERR.LOCATION_INVALID_PAIR;
        } else if (!isValidCoordinate(lat, -90, 90) || !isValidCoordinate(lng, -180, 180)) {
          errors.location = ERR.LOCATION_OUT_OF_RANGE;
        }
      }
    }
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
};

export default {
  validateLogin,
  validateRegister,
  validateChangePassword,
  validateField,
};
