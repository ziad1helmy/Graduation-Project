/**
 * Auth Service Validation Layer
 * Handles validation for registration and login with role-specific fields
 */

const VALIDATION_RULES = {
  fullName: {
    required: true,
    minLength: 3,
    maxLength: 100,
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
    enum: ['donor', 'hospital'],
  },
  // Donor-specific fields
  phoneNumber: {
    pattern: /^[0-9]{10}$/,
    errorMessage: 'Phone number must be 10 digits',
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
  gender: {
    enum: ['male', 'female', 'not specified'],
  },
  // Hospital-specific fields
  hospitalName: {
    required: true,
    minLength: 3,
    maxLength: 200,
  },
  hospitalId: {
    required: true,
    type: 'number',
  },
  licenseNumber: {
    required: true,
    minLength: 5,
    maxLength: 50,
  },
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
 * Validate login data
 * @param {object} data - Login data { email, password }
 * @returns {object} { valid: boolean, errors: object }
 */
export const validateLogin = (data) => {
  const errors = {};

  ['email', 'password'].forEach((field) => {
    const { valid, error } = validateField(field, data[field]);
    if (!valid) {
      errors[field] = error;
    }
  });

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

  // Validate role-specific required fields
  if (role === 'donor') {
    ['phoneNumber', 'dateOfBirth'].forEach((field) => {
      const { valid, error } = validateField(field, data[field]);
      if (!valid) {
        errors[field] = error;
      }
    });

    // Validate optional donor fields
    if (data.gender) {
      const { valid, error } = validateField('gender', data.gender);
      if (!valid) {
        errors.gender = error;
      }
    }
  } else if (role === 'hospital') {
    ['hospitalName', 'hospitalId', 'licenseNumber'].forEach((field) => {
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
