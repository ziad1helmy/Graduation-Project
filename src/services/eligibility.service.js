import { readFileSync } from 'node:fs';
import Donation from '../models/Donation.model.js';
import { calculateAge } from '../utils/age.js';
import ELIGIBILITY_KEYS from '../utils/eligibility-keys.js';

const malariaRiskCountries = JSON.parse(
  readFileSync(new URL('../data/malariaRiskCountries.json', import.meta.url), 'utf8')
);

const DEFAULT_DONATION_INTERVAL_DAYS = 56;
const GENDER_DONATION_INTERVAL_DAYS = {
  male: 84,
  female: 112,
};

const ACTIVE_DONATION_STATUSES = ['pending', 'scheduled'];

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

const getDonorId = (donor) => donor?._id || donor?.id || null;

export const hasActiveDonationInProgress = async (donor, options = {}) => {
  const donorId = getDonorId(donor);
  if (!donorId) {
    return false;
  }

  const query = {
    donorId,
    status: { $in: ACTIVE_DONATION_STATUSES },
  };

  if (options.excludeDonationId) {
    query._id = { $ne: options.excludeDonationId };
  }

  const activeDonation = await Donation.exists(query);

  return Boolean(activeDonation);
};

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
    return makeRuleResult(false, ELIGIBILITY_KEYS.DONOR_NOT_FOUND);
  }

  if (donor.dateOfBirth === undefined || donor.dateOfBirth === null || donor.dateOfBirth === '') {
    return makeRuleResult(false, ELIGIBILITY_KEYS.DATE_OF_BIRTH_REQUIRED);
  }

  try {
    const birthDate = new Date(donor.dateOfBirth);
    if (Number.isNaN(birthDate.getTime())) {
      return makeRuleResult(false, ELIGIBILITY_KEYS.INVALID_DATE_OF_BIRTH);
    }

    const age = calculateAge(donor.dateOfBirth);
    if (age === null) {
      return makeRuleResult(false, ELIGIBILITY_KEYS.AGE_VERIFICATION_FAILED);
    }

    if (age < 17) {
      return makeRuleResult(false, ELIGIBILITY_KEYS.MINIMUM_AGE, getSeventeenthBirthday(donor.dateOfBirth));
    }
  } catch (error) {
    return makeRuleResult(false, ELIGIBILITY_KEYS.AGE_VERIFICATION_FAILED);
  }

  return makeRuleResult(true, ELIGIBILITY_KEYS.DONOR_ELIGIBLE);
};

const evaluateTemporaryDeferralRule = (donor) => {
  const now = new Date();

  if (!donor?.temporaryDeferralUntil) {
    return makeRuleResult(true, ELIGIBILITY_KEYS.NO_TEMPORARY_DEFERRAL);
  }

  const temporaryDeferralUntil = new Date(donor.temporaryDeferralUntil);
  if (!isValidDate(temporaryDeferralUntil) || temporaryDeferralUntil <= now) {
    return makeRuleResult(true, ELIGIBILITY_KEYS.TEMPORARY_DEFERRAL_EXPIRED);
  }

  return makeRuleResult(
    false,
    donor.lastDeferralReason || ELIGIBILITY_KEYS.TEMPORARILY_DEFERRED,
    temporaryDeferralUntil,
  );
};

const evaluateTravelDeferralRule = async (donor, { persistTravelDeferral = true } = {}) => {
  const travelDeferralDate = getTravelDeferral(donor?.travelHistory);
  if (!travelDeferralDate) {
    return makeRuleResult(true, ELIGIBILITY_KEYS.NO_TEMPORARY_DEFERRAL);
  }

  donor.temporaryDeferralUntil = travelDeferralDate;
  donor.lastDeferralReason = ELIGIBILITY_KEYS.TRAVEL_DEFERRAL;

  if (persistTravelDeferral && typeof donor.save === 'function') {
    await donor.save({ validateBeforeSave: false });
  }

  return makeRuleResult(false, ELIGIBILITY_KEYS.TRAVEL_DEFERRAL, travelDeferralDate);
};

const evaluateDonationIntervalRule = (donor, { donationType } = {}) => {
  const now = new Date();
  if (!donor?.lastDonationDate) {
    return makeRuleResult(true, ELIGIBILITY_KEYS.NO_DONATION_INTERVAL_RESTRICTION);
  }

  const lastDonationDate = new Date(donor.lastDonationDate);
  if (!isValidDate(lastDonationDate)) {
    return makeRuleResult(true, ELIGIBILITY_KEYS.INVALID_LAST_DONATION_DATE_IGNORED);
  }

  const requiredIntervalDays = getRequiredDonationInterval(donor.gender, donationType);
  const nextEligibleDate = addDays(lastDonationDate, requiredIntervalDays);
  if (nextEligibleDate > now) {
    return makeRuleResult(false, ELIGIBILITY_KEYS.DONATION_COOLDOWN_ACTIVE, nextEligibleDate);
  }

  return makeRuleResult(true, ELIGIBILITY_KEYS.DONATION_INTERVAL_SATISFIED);
};

const evaluateHemoglobinRule = (donor) => {
  if (donor?.hemoglobinLevel === undefined || donor?.hemoglobinLevel === null || donor?.hemoglobinLevel === '') {
    return makeRuleResult(true, ELIGIBILITY_KEYS.NO_HEMOGLOBIN_RESTRICTION);
  }

  const hemoglobinLevel = Number(donor.hemoglobinLevel);
  if (!Number.isNaN(hemoglobinLevel) && hemoglobinLevel < MIN_HEMOGLOBIN_LEVEL) {
    return makeRuleResult(false, ELIGIBILITY_KEYS.HEMOGLOBIN_BELOW_MINIMUM);
  }

  return makeRuleResult(true, ELIGIBILITY_KEYS.HEMOGLOBIN_LEVEL_ACCEPTABLE);
};

export const canDonate = async (donor, options = {}) => {
  if (await hasActiveDonationInProgress(donor, options)) {
    return {
      eligible: false,
      reason: ELIGIBILITY_KEYS.ACTIVE_DONATION_IN_PROGRESS,
    };
  }

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
    reason: ELIGIBILITY_KEYS.DONOR_ELIGIBLE,
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