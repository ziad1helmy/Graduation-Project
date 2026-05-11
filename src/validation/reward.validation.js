const REQUIRED_TOP_LEVEL_KEYS = ['points', 'tiers', 'tierBonuses'];
const REQUIRED_POINT_KEYS = ['bloodDonation', 'emergencyResponse', 'profileCompletion', 'referral', 'firstDonation'];
const REQUIRED_TIER_KEYS = ['bronze', 'silver', 'gold', 'platinum'];
const REQUIRED_BONUS_KEYS = ['silver', 'gold', 'platinum'];

const isFiniteNumber = (value) => typeof value === 'number' && Number.isFinite(value);

const validateRequiredObject = (body, key, errors) => {
  if (!body[key] || typeof body[key] !== 'object' || Array.isArray(body[key])) {
    errors.push(`${key} is required`);
    return false;
  }
  return true;
};

const validateNumberMap = (value, keys, label, errors, { requireAscending = false } = {}) => {
  for (const key of keys) {
    if (!Object.prototype.hasOwnProperty.call(value, key)) {
      errors.push(`${label}.${key} is required`);
      continue;
    }

    const numberValue = Number(value[key]);
    if (!isFiniteNumber(numberValue)) {
      errors.push(`${label}.${key} must be a number`);
      continue;
    }

    if (label === 'tiers' && key === 'bronze') {
      if (numberValue < 0) {
        errors.push('tiers.bronze must be greater than or equal to 0');
      }
      continue;
    }

    if (numberValue <= 0) {
      errors.push(`${label}.${key} must be a positive number`);
    }
  }

  if (requireAscending) {
    for (let index = 1; index < keys.length; index += 1) {
      const previous = Number(value[keys[index - 1]]);
      const current = Number(value[keys[index]]);
      if (isFiniteNumber(previous) && isFiniteNumber(current) && current <= previous) {
        errors.push(`${label}.${keys[index]} must be greater than ${label}.${keys[index - 1]}`);
      }
    }
  }
};

export const validateRewardsConfigBody = (body = {}) => {
  const errors = [];

  for (const key of REQUIRED_TOP_LEVEL_KEYS) {
    validateRequiredObject(body, key, errors);
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  validateNumberMap(body.points, REQUIRED_POINT_KEYS, 'points', errors);
  validateNumberMap(body.tiers, REQUIRED_TIER_KEYS, 'tiers', errors, { requireAscending: true });
  validateNumberMap(body.tierBonuses, REQUIRED_BONUS_KEYS, 'tierBonuses', errors);

  return { valid: errors.length === 0, errors };
};