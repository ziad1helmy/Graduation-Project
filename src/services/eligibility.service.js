import { readFileSync } from 'node:fs';
import { calculateAge } from '../utils/age.js';

const malariaRiskCountries = JSON.parse(
  readFileSync(new URL('../data/malariaRiskCountries.json', import.meta.url), 'utf8')
);

const DEFAULT_DONATION_INTERVAL_DAYS = 56;
const GENDER_DONATION_INTERVAL_DAYS = {
  male: 84,
  female: 112,
};

// Per-donation-type cooldowns (days). Use request.type enum values.
const COOLDOWN_DAYS_BY_TYPE = {
  blood: 56,
  plasma: 14,
  platelets: 7,
  double_red_cells: 7,
};
const TRAVEL_DEFERRAL_DAYS = 28;
const MIN_HEMOGLOBIN_LEVEL = 12.5;

const normalizeCountry = (value) => String(value || '').trim().toLowerCase();

const riskCountrySet = new Set(malariaRiskCountries.map(normalizeCountry));

const isValidDate = (value) => value instanceof Date && !Number.isNaN(value.getTime());

const addDays = (date, days) => new Date(date.getTime() + days * 24 * 60 * 60 * 1000);

const getSeventeenthBirthday = (dateOfBirth) => {
  const birthDate = new Date(dateOfBirth);
  if (!isValidDate(birthDate)) return null;
  return new Date(birthDate.getFullYear() + 17, birthDate.getMonth(), birthDate.getDate());
};

const getRequiredDonationInterval = (gender, donationType) => {
  // Priority: per-type cooldown -> gender-based -> default
  if (donationType && COOLDOWN_DAYS_BY_TYPE[donationType]) {
    return COOLDOWN_DAYS_BY_TYPE[donationType];
  }
  const normalizedGender = typeof gender === 'string' ? gender.trim().toLowerCase() : '';
  return GENDER_DONATION_INTERVAL_DAYS[normalizedGender] || DEFAULT_DONATION_INTERVAL_DAYS;
};

const makeRuleResult = (valid, reason, nextEligibleDate) => ({
  valid,
  reason,
  ...(nextEligibleDate ? { nextEligibleDate } : {}),
});

const getTravelDeferral = (travelHistory = []) => {
  if (!Array.isArray(travelHistory) || travelHistory.length === 0) {
    return null;
  }

  let nextEligibleDate = null;

  for (const entry of travelHistory) {
    const country = normalizeCountry(entry?.country);
    if (!country || !riskCountrySet.has(country)) {
      continue;
    }

    const returnDate = new Date(entry.returnDate);
    if (!isValidDate(returnDate)) {
      continue;
    }

    const deferralDate = addDays(returnDate, TRAVEL_DEFERRAL_DAYS);
    if (!nextEligibleDate || deferralDate > nextEligibleDate) {
      nextEligibleDate = deferralDate;
    }
  }

  return nextEligibleDate && nextEligibleDate > new Date() ? nextEligibleDate : null;
};

const evaluateAgeRule = (donor) => {
  if (!donor) {
    return makeRuleResult(false, 'Donor not found');
  }

  const age = calculateAge(donor.dateOfBirth);
  if (age === null) {
    return makeRuleResult(false, 'Date of birth is required');
  }

  if (age < 17) {
    return makeRuleResult(false, 'You must be at least 17 years old to donate', getSeventeenthBirthday(donor.dateOfBirth));
  }

  return makeRuleResult(true, 'Age requirement satisfied');
};

const evaluateTemporaryDeferralRule = (donor) => {
  const now = new Date();

  if (!donor?.temporaryDeferralUntil) {
    return makeRuleResult(true, 'No temporary deferral');
  }

  const temporaryDeferralUntil = new Date(donor.temporaryDeferralUntil);
  if (!isValidDate(temporaryDeferralUntil) || temporaryDeferralUntil <= now) {
    return makeRuleResult(true, 'Temporary deferral expired');
  }

  return makeRuleResult(
    false,
    donor.lastDeferralReason || 'Temporarily deferred',
    temporaryDeferralUntil,
  );
};

const evaluateTravelDeferralRule = async (donor, { persistTravelDeferral = true } = {}) => {
  const travelDeferralDate = getTravelDeferral(donor?.travelHistory);
  if (!travelDeferralDate) {
    return makeRuleResult(true, 'No travel deferral');
  }

  donor.temporaryDeferralUntil = travelDeferralDate;
  donor.lastDeferralReason = 'Travel to high-risk country';

  if (persistTravelDeferral && typeof donor.save === 'function') {
    await donor.save({ validateBeforeSave: false });
  }

  return makeRuleResult(false, 'Travel to high-risk country', travelDeferralDate);
};

const evaluateDonationIntervalRule = (donor, { donationType } = {}) => {
  const now = new Date();
  if (!donor?.lastDonationDate) {
    return makeRuleResult(true, 'No donation interval restriction');
  }

  const lastDonationDate = new Date(donor.lastDonationDate);
  if (!isValidDate(lastDonationDate)) {
    return makeRuleResult(true, 'Invalid last donation date ignored');
  }

  const requiredIntervalDays = getRequiredDonationInterval(donor.gender, donationType);
  const nextEligibleDate = addDays(lastDonationDate, requiredIntervalDays);
  if (nextEligibleDate > now) {
    return makeRuleResult(false, 'You need to wait before donating again', nextEligibleDate);
  }

  return makeRuleResult(true, 'Donation interval satisfied');
};

const evaluateHemoglobinRule = (donor) => {
  if (donor?.hemoglobinLevel === undefined || donor?.hemoglobinLevel === null || donor?.hemoglobinLevel === '') {
    return makeRuleResult(true, 'No hemoglobin restriction');
  }

  const hemoglobinLevel = Number(donor.hemoglobinLevel);
  if (!Number.isNaN(hemoglobinLevel) && hemoglobinLevel < MIN_HEMOGLOBIN_LEVEL) {
    return makeRuleResult(false, 'Low hemoglobin level');
  }

  return makeRuleResult(true, 'Hemoglobin level acceptable');
};

export const canDonate = async (donor, options = {}) => {
  const rules = [
    () => evaluateAgeRule(donor),
    () => evaluateTemporaryDeferralRule(donor),
    () => evaluateTravelDeferralRule(donor, options),
      () => evaluateDonationIntervalRule(donor, options),
    () => evaluateHemoglobinRule(donor),
  ];

  for (const rule of rules) {
    const result = await rule();
    if (!result.valid) {
      return {
        eligible: false,
        reason: result.reason,
        ...(result.nextEligibleDate ? { nextEligibleDate: result.nextEligibleDate } : {}),
      };
    }
  }

  return {
    eligible: true,
    reason: 'Donor is eligible',
  };
};

export default {
  canDonate,
};

// Helper exports for controller/UI usage -------------------------------------------------
// Return the cooldown (required interval) in days for a donor or gender + donation type
export const getCooldownDays = (donorOrGender, donationType) => {
  try {
    if (!donorOrGender) return getRequiredDonationInterval(undefined, donationType);
    // If passed a donor object, prefer the donor.gender
    if (typeof donorOrGender === 'object') {
      return getRequiredDonationInterval(donorOrGender.gender, donationType);
    }
    // Otherwise treat as gender string
    return getRequiredDonationInterval(donorOrGender, donationType);
  } catch (e) {
    return DEFAULT_DONATION_INTERVAL_DAYS;
  }
};

// Compute the next eligible date based on donor.lastDonationDate and cooldown days
export const computeNextEligibleDate = (donor, donationType) => {
  try {
    if (!donor || !donor.lastDonationDate) return null;
    const last = new Date(donor.lastDonationDate);
    if (Number.isNaN(last.getTime())) return null;
    const days = getCooldownDays(donor, donationType);
    const nextDate = addDays(last, days);
    return nextDate;
  } catch (e) {
    return null;
  }
};