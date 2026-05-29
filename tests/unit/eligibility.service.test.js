/**
 * Tests for src/services/eligibility.service.js
 *
 * Covers:
 * - Per-type cooldown enforcement (blood: 56d, plasma: 14d, platelets: 7d)
 * - Age eligibility (minimum 17 years)
 * - Temporary and travel deferrals
 * - Hemoglobin level requirements
 */

import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import ELIGIBILITY_KEYS from '../../src/utils/eligibility-keys.js';
import { connect, clearDatabase, closeDatabase } from '../helpers/db.js';
import { createDonor } from '../helpers/factories.js';
import { canDonate } from '../../src/services/eligibility.service.js';

beforeAll(async () => {
  await connect();
});

afterEach(async () => {
  await clearDatabase();
});

afterAll(async () => {
  await closeDatabase();
});

describe('Eligibility Service — Donation Interval Cooldowns', () => {
  it('should allow donation when no lastDonationDate (first donation)', async () => {
    const donor = await createDonor({ lastDonationDate: null });

    const result = await canDonate(donor, { donationType: 'blood' });

    expect(result.eligible).toBe(true);
    expect(result.reason).toBe(ELIGIBILITY_KEYS.DONOR_ELIGIBLE);
  });

  it('should prevent blood donation before 56 days cooldown expires', async () => {
    const lastDate = new Date();
    lastDate.setDate(lastDate.getDate() - 40); // 40 days ago (16 days too soon)
    
    const donor = await createDonor({ lastDonationDate: lastDate });

    const result = await canDonate(donor, { donationType: 'blood' });

    expect(result.eligible).toBe(false);
    expect(result.reason).toBe(ELIGIBILITY_KEYS.DONATION_COOLDOWN_ACTIVE);
    expect(result.nextEligibleDate).toBeDefined();
    
    // Calculate expected next eligible date (lastDate + 56 days)
    const expectedDate = new Date(lastDate);
    expectedDate.setDate(expectedDate.getDate() + 56);
    
    const expectedTime = expectedDate.getTime();
    const resultTime = new Date(result.nextEligibleDate).getTime();
    const diff = Math.abs(expectedTime - resultTime);
    
    expect(diff).toBeLessThanOrEqual(1000 * 60 * 60); // within 1 hour tolerance
  });

  it('should allow blood donation after 56 days cooldown expires', async () => {
    const lastDate = new Date();
    lastDate.setDate(lastDate.getDate() - 57); // 57 days ago (1 day past cooldown)
    
    const donor = await createDonor({ lastDonationDate: lastDate });

    const result = await canDonate(donor, { donationType: 'blood' });

    expect(result.eligible).toBe(true);
    expect(result.reason).toBe(ELIGIBILITY_KEYS.DONOR_ELIGIBLE);
  });

  it('should prevent plasma donation before 14 days cooldown expires', async () => {
    const lastDate = new Date();
    lastDate.setDate(lastDate.getDate() - 10); // 10 days ago (4 days too soon)
    
    const donor = await createDonor({ lastDonationDate: lastDate });

    const result = await canDonate(donor, { donationType: 'plasma' });

    expect(result.eligible).toBe(false);
    expect(result.reason).toBe(ELIGIBILITY_KEYS.DONATION_COOLDOWN_ACTIVE);
    expect(result.nextEligibleDate).toBeDefined();
  });

  it('should allow plasma donation after 14 days cooldown expires', async () => {
    const lastDate = new Date();
    lastDate.setDate(lastDate.getDate() - 15); // 15 days ago (1 day past cooldown)
    
    const donor = await createDonor({ lastDonationDate: lastDate });

    const result = await canDonate(donor, { donationType: 'plasma' });

    expect(result.eligible).toBe(true);
    expect(result.reason).toBe(ELIGIBILITY_KEYS.DONOR_ELIGIBLE);
  });

  it('should prevent platelets donation before 7 days cooldown expires', async () => {
    const lastDate = new Date();
    lastDate.setDate(lastDate.getDate() - 5); // 5 days ago (2 days too soon)
    
    const donor = await createDonor({ lastDonationDate: lastDate });

    const result = await canDonate(donor, { donationType: 'platelets' });

    expect(result.eligible).toBe(false);
    expect(result.reason).toBe(ELIGIBILITY_KEYS.DONATION_COOLDOWN_ACTIVE);
    expect(result.nextEligibleDate).toBeDefined();
  });

  it('should allow platelets donation after 7 days cooldown expires', async () => {
    const lastDate = new Date();
    lastDate.setDate(lastDate.getDate() - 8); // 8 days ago (1 day past cooldown)
    
    const donor = await createDonor({ lastDonationDate: lastDate });

    const result = await canDonate(donor, { donationType: 'platelets' });

    expect(result.eligible).toBe(true);
    expect(result.reason).toBe(ELIGIBILITY_KEYS.DONOR_ELIGIBLE);
    expect(result.reason).toMatch(/eligible/i);
  });

  it('should use blood (56d) cooldown when donationType not specified', async () => {
    const lastDate = new Date();
    lastDate.setDate(lastDate.getDate() - 40); // 40 days ago (16 days too soon for blood)
    
    const donor = await createDonor({ lastDonationDate: lastDate });

    const result = await canDonate(donor); // no donationType passed

    expect(result.eligible).toBe(false);
    expect(result.reason).toBe(ELIGIBILITY_KEYS.DONATION_COOLDOWN_ACTIVE);
  });
});

describe('Eligibility Service — Age Restrictions', () => {
  it('should prevent donation for donors under 17', async () => {
    const dateOfBirth = new Date();
    dateOfBirth.setFullYear(dateOfBirth.getFullYear() - 16); // 16 years old
    
    const donor = await createDonor({ dateOfBirth });

    const result = await canDonate(donor, { donationType: 'blood' });

    expect(result.eligible).toBe(false);
    expect(result.reason).toBe(ELIGIBILITY_KEYS.MINIMUM_AGE);
    expect(result.nextEligibleDate).toBeDefined(); // Should show 17th birthday
  });

  it('should allow donation for donors 17+', async () => {
    const dateOfBirth = new Date();
    dateOfBirth.setFullYear(dateOfBirth.getFullYear() - 25); // 25 years old
    
    const donor = await createDonor({ dateOfBirth });

    const result = await canDonate(donor, { donationType: 'blood' });

    expect(result.eligible).toBe(true);
  });
});

describe('Eligibility Service — Temporary Deferrals', () => {
  it('should prevent donation during temporary deferral period', async () => {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 5); // 5 days in future
    
    const donor = await createDonor({
      temporaryDeferralUntil: futureDate,
      lastDeferralReason: 'Medical condition',
    });

    const result = await canDonate(donor, { donationType: 'blood' });

    expect(result.eligible).toBe(false);
    expect(result.reason).toMatch(/deferred|medical/i);
    expect(result.nextEligibleDate).toBeDefined();
  });

  it('should allow donation after temporary deferral expires', async () => {
    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - 1); // 1 day in past
    
    const donor = await createDonor({
      temporaryDeferralUntil: pastDate,
      lastDeferralReason: 'Medical condition',
    });

    const result = await canDonate(donor, { donationType: 'blood' });

    expect(result.eligible).toBe(true);
  });
});

describe('Eligibility Service — Hemoglobin Levels', () => {
  it('should prevent donation with low hemoglobin (< 12.5)', async () => {
    const donor = await createDonor({ hemoglobinLevel: 12.0 });

    const result = await canDonate(donor, { donationType: 'blood' });

    expect(result.eligible).toBe(false);
    expect(result.reason).toMatch(/hemoglobin/i);
  });

  it('should allow donation with adequate hemoglobin (>= 12.5)', async () => {
    const donor = await createDonor({ hemoglobinLevel: 14.5 });

    const result = await canDonate(donor, { donationType: 'blood' });

    expect(result.eligible).toBe(true);
  });

  it('should allow donation when hemoglobin not set', async () => {
    const donor = await createDonor({ hemoglobinLevel: undefined });

    const result = await canDonate(donor, { donationType: 'blood' });

    expect(result.eligible).toBe(true);
  });
});

describe('Eligibility Service — Multi-Rule Checks', () => {
  it('should fail if any single rule fails (age too young)', async () => {
    const dateOfBirth = new Date();
    dateOfBirth.setFullYear(dateOfBirth.getFullYear() - 16); // 16 years old
    
    const lastDate = new Date();
    lastDate.setDate(lastDate.getDate() - 60); // eligible by cooldown
    
    const donor = await createDonor({
      dateOfBirth,
      lastDonationDate: lastDate,
      hemoglobinLevel: 15,
    });

    const result = await canDonate(donor, { donationType: 'blood' });

    expect(result.eligible).toBe(false);
    expect(result.reason).toBe(ELIGIBILITY_KEYS.MINIMUM_AGE); // Age failure reported first
  });

  it('should fail if any single rule fails (cooldown not met)', async () => {
    const dateOfBirth = new Date();
    dateOfBirth.setFullYear(dateOfBirth.getFullYear() - 25); // 25 years old
    
    const lastDate = new Date();
    lastDate.setDate(lastDate.getDate() - 40); // Only 40 days, need 56 for blood
    
    const donor = await createDonor({
      dateOfBirth,
      lastDonationDate: lastDate,
      hemoglobinLevel: 15,
    });

    const result = await canDonate(donor, { donationType: 'blood' });

    expect(result.eligible).toBe(false);
    expect(result.reason).toBe(ELIGIBILITY_KEYS.DONATION_COOLDOWN_ACTIVE);
  });

  it('should pass all checks (fully eligible)', async () => {
    const dateOfBirth = new Date();
    dateOfBirth.setFullYear(dateOfBirth.getFullYear() - 30); // 30 years old
    
    const lastDate = new Date();
    lastDate.setDate(lastDate.getDate() - 60); // 60 days ago (past 56-day cooldown)
    
    const donor = await createDonor({
      dateOfBirth,
      lastDonationDate: lastDate,
      hemoglobinLevel: 15,
      temporaryDeferralUntil: null,
    });

    const result = await canDonate(donor, { donationType: 'blood' });

    expect(result.eligible).toBe(true);
    expect(result.reason).toMatch(/eligible/i);
  });
});

describe('Eligibility Service — Exact Cooldown Boundaries', () => {
  it('should prevent donation exactly at cooldown boundary (blood 56d)', async () => {
    const lastDate = new Date();
    lastDate.setDate(lastDate.getDate() - 56);
    lastDate.setHours(lastDate.getHours() + 1); // 1 hour before cooldown expires
    
    const donor = await createDonor({ lastDonationDate: lastDate });

    const result = await canDonate(donor, { donationType: 'blood' });

    expect(result.eligible).toBe(false);
  });

  it('should allow donation after cooldown boundary (blood 56d)', async () => {
    const lastDate = new Date();
    lastDate.setDate(lastDate.getDate() - 56);
    lastDate.setHours(lastDate.getHours() - 1); // 1 hour after cooldown expires
    
    const donor = await createDonor({ lastDonationDate: lastDate });

    const result = await canDonate(donor, { donationType: 'blood' });

    expect(result.eligible).toBe(true);
  });

  it('should return correct nextEligibleDate for plasma (14d)', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 4, 15, 12, 0, 0));

    const lastDate = new Date(2026, 4, 10, 12, 0, 0); // May 10, 2026, 12:00 PM
    
    const donor = await createDonor({ lastDonationDate: lastDate });

    const result = await canDonate(donor, { donationType: 'plasma' });

    expect(result.eligible).toBe(false);
    
    // Expected: May 10 + 14 days = May 24, 2026, 12:00 PM
    const expectedDate = new Date(2026, 4, 24, 12, 0, 0);
    const resultDate = new Date(result.nextEligibleDate);
    
    // Allow 1-minute tolerance for time zone rounding
    const diff = Math.abs(expectedDate.getTime() - resultDate.getTime());
    expect(diff).toBeLessThan(60 * 1000);

    vi.useRealTimers();
  });
});
