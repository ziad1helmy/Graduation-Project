const BLOOD_TYPE_VALUES = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

const BLOOD_TYPE_COMPATIBILITY = {
  'O+': ['O+', 'A+', 'B+', 'AB+'],
  'O-': ['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-'],
  'A+': ['A+', 'AB+'],
  'A-': ['A+', 'A-', 'AB+', 'AB-'],
  'B+': ['B+', 'AB+'],
  'B-': ['B+', 'B-', 'AB+', 'AB-'],
  'AB+': ['AB+'],
  'AB-': ['AB+', 'AB-'],
};

const normalizeBloodTypeValue = (value) => {
  if (value === undefined || value === null) return null;

  const normalized = String(value).trim().toUpperCase().replace(/\s+/g, '+');
  return BLOOD_TYPE_VALUES.includes(normalized) ? normalized : null;
};

export const normalizeBloodTypeList = (value) => {
  const values = Array.isArray(value)
    ? value
    : value === undefined || value === null || value === ''
      ? []
      : [value];

  const normalized = [];
  for (const item of values) {
    const bloodType = normalizeBloodTypeValue(item);
    if (bloodType && !normalized.includes(bloodType)) {
      normalized.push(bloodType);
    }
  }

  return normalized;
};

export const isValidBloodType = (value) => normalizeBloodTypeValue(value) !== null;

export const isValidBloodTypeList = (value, { allowEmpty = false } = {}) => {
  const bloodTypes = normalizeBloodTypeList(value);
  return bloodTypes.length > 0 || (allowEmpty && Array.isArray(value) && value.length === 0);
};

export const formatBloodTypeList = (value, { separator = ', ', fallback = 'blood' } = {}) => {
  const bloodTypes = normalizeBloodTypeList(value);
  return bloodTypes.length > 0 ? bloodTypes.join(separator) : fallback;
};

export const getCompatibleDonorTypesForRequest = (value) => {
  const requestBloodTypes = normalizeBloodTypeList(value);
  if (requestBloodTypes.length === 0) return [];

  const donorTypes = new Set();
  for (const requestBloodType of requestBloodTypes) {
    for (const [donorType, recipients] of Object.entries(BLOOD_TYPE_COMPATIBILITY)) {
      if (recipients.includes(requestBloodType)) {
        donorTypes.add(donorType);
      }
    }
  }

  return [...donorTypes];
};

export const isBloodTypeCompatibleWithAnyRequestType = (donorBloodType, requestBloodTypes) => {
  const normalizedDonorBloodType = normalizeBloodTypeValue(donorBloodType);
  if (!normalizedDonorBloodType) return false;

  const recipientTypes = normalizeBloodTypeList(requestBloodTypes);
  if (recipientTypes.length === 0) return false;

  const compatibleRecipients = BLOOD_TYPE_COMPATIBILITY[normalizedDonorBloodType] || [];
  return recipientTypes.some((recipientBloodType) => compatibleRecipients.includes(recipientBloodType));
};

export const formatBloodTypeLabel = (value, options = {}) => formatBloodTypeList(value, options);

export const extractFirstBloodType = (value) => {
  if (Array.isArray(value)) {
    const first = value.find((entry) => typeof entry === 'string' && entry.trim());
    return first ? first : null;
  }
  if (typeof value === 'string' && value.trim()) {
    return value.includes(',') ? value.split(',')[0].trim() : value.trim();
  }
  return null;
};

export { BLOOD_TYPE_VALUES, BLOOD_TYPE_COMPATIBILITY, normalizeBloodTypeValue };