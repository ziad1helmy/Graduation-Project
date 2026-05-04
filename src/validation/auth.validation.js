/**
 * Auth Service Validation Layer
 * Handles validation for registration and login with strict role-specific field separation
 * Supports Arabic and English text input for names and text fields
 */

import { calculateAge } from '../utils/age.js';
import { isValidArabicEnglishText } from '../utils/textNormalization.js';

// Regex pattern for Arabic + English text (letters + spaces + dash + dot)
// Allows: Arabic (ا-ي, ء-ة), English (a-z, A-Z), spaces, dots (.), dashes (-)
// Rejects: numbers, special characters
const ARABIC_ENGLISH_PATTERN = /^[\u0600-\u06FFa-zA-Z\s\.\-]+$/;

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
    pattern: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/,
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
    validator: (val) => {
      const date = new Date(val);
      return date instanceof Date && date <= new Date() && date.getFullYear() >= 1900;
    },
    errorMessage: 'Date of birth must be a valid past date',
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
  licenseNumber: {
    required: true,
    minLength: 5,
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
    return { valid: false, error: `${fieldName} is required` };
  }

  // If not required and empty, skip further validation
  if (!rule.required && (value === undefined || value === null || value === '')) {
    return { valid: true, error: null };
  }

  // Check type
  if (rule.type === 'date') {
    const date = new Date(value);
    if (!(date instanceof Date) || isNaN(date.getTime())) {
      return { valid: false, error: `${fieldName} must be a valid date` };
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
 * @param {object} data - Login data { email, password, role, licenseNumber?, adminCode? }
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
    // Hospital requires licenseNumber
    if (data.licenseNumber === undefined || data.licenseNumber === null || data.licenseNumber === '') {
      errors.licenseNumber = 'licenseNumber is required for hospital login';
    } else {
      const { valid, error } = validateField('licenseNumber', data.licenseNumber);
      if (!valid) {
        errors.licenseNumber = error;
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

  // Validate role-specific required fields
  if (role === 'donor') {
    ['phoneNumber', 'dateOfBirth'].forEach((field) => {
      const { valid, error } = validateField(field, data[field]);
      if (!valid) {
        errors[field] = error;
      }
    });

    const age = calculateAge(data.dateOfBirth);
    if (!errors.dateOfBirth && age !== null && age < 17) {
      errors.dateOfBirth = 'You must be at least 17 years old to donate';
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
  } else if (role === 'hospital') {
    // Hospital requires: hospitalName and licenseNumber (only these)
    ['hospitalName', 'licenseNumber'].forEach((field) => {
      const { valid, error } = validateField(field, data[field]);
      if (!valid) {
        errors[field] = error;
      }
    });
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
};

export default {
  validateLogin,
  validateRegister,
  validateField,
};
