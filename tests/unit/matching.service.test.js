import { describe, it, expect, vi } from 'vitest';
import { setupTestDB } from '../helpers/db.js';
import { buildDonor, createDonor, createHospital, createRequest, createDonation } from '../helpers/factories.js';
import * as matchingService from '../../src/services/matching.service.js';

vi.mock('../../src/utils/geo.js', () => ({
  calculateDistance: vi.fn(({ latitude: lat1 }, { latitude: lat2 }) => {
    // crude distance approximation: degrees * 111 km/deg
    return Math.abs(lat1 - lat2) * 111;
  }),
  getLocationScore: vi.fn((distance, maxDistance = 100) => {
    const score = Math.max(0, Math.round((1 - (distance / maxDistance)) * 100));
    return score;
  }),
}));

// setupTestDB(); // Removed to prevent duplicate connections

describe('Matching Service — pure helpers', () => {
  it('correctly reports blood type compatibility', () => {
    expect(matchingService.isBloodTypeCompatible('O+', 'A+')).toBe(true);
    expect(matchingService.isBloodTypeCompatible('A+', 'O+')).toBe(false);
    expect(matchingService.isBloodTypeCompatible(null, 'A+')).toBe(false);
  });

  it('checks eligibility with missing blood type', () => {
    const donor = { isAvailable: true, bloodType: null, healthHistory: {} };
    const request = { type: 'blood', bloodType: 'A+' };
    const res = matchingService.checkEligibility(donor, request);
    expect(res.eligible).toBe(false);
    expect(res.reason).toMatch(/has not provided blood type/i);
  });
});

describe('Matching Service — DB-backed flows', () => {
  it('findCompatibleDonors returns only compatible, available donors', async () => {
    const hospital = await createHospital();
    const request = await createRequest(hospital._id, { type: 'blood', bloodType: 'O+' });

    // create compatible donor
    const donorA = await createDonor({ bloodType: 'O+', isAvailable: true });
    // create incompatible donor
    const donorB = await createDonor({ bloodType: 'A+', isAvailable: true });
    // create unavailable donor
    const donorC = await createDonor({ bloodType: 'O+', isAvailable: false });

    // mark donorA as already responded
    await createDonation(donorA._id, request._id, { status: 'pending' });

    const results = await matchingService.findCompatibleDonors(request._id);

    // donorA should be excluded because they already responded
    expect(results.find((r) => r.donor._id.toString() === donorA._id.toString())).toBeUndefined();
    // donorB is incompatible
    expect(results.find((r) => r.donor._id.toString() === donorB._id.toString())).toBeUndefined();
    // donorC is unavailable so also excluded
    expect(results.find((r) => r.donor._id.toString() === donorC._id.toString())).toBeUndefined();
  });
});
/**
 * Tests for src/services/matching.service.js
 *
 * Covers:
 * - Blood type compatibility matrix
 * - Donor eligibility checks (cooldown, availability, blood type)
 * - findCompatibleDonors with geo-scoring
 * - findCompatibleRequests with urgency and geo-scoring
 * - N+1 elimination (donors who already responded are excluded)
 */

import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { connect, clearDatabase, closeDatabase } from '../helpers/db.js';
import { createDonor, createHospital, createRequest, createDonation } from '../helpers/factories.js';
import {
  isBloodTypeCompatible,
  findCompatibleDonors,
  findCompatibleRequests,
} from '../../src/services/matching.service.js';

beforeAll(async () => {
  await connect();
});

afterEach(async () => {
  await clearDatabase();
});

afterAll(async () => {
  await closeDatabase();
});

// ──────────────────────────────────────────────
//  Blood Type Compatibility Matrix
// ──────────────────────────────────────────────

describe('isBloodTypeCompatible', () => {
  it('O- is universal donor — compatible with all types', () => {
    const allTypes = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
    allTypes.forEach((type) => {
      expect(isBloodTypeCompatible('O-', type)).toBe(true);
    });
  });

  it('AB+ can only donate to AB+', () => {
    expect(isBloodTypeCompatible('AB+', 'AB+')).toBe(true);
    expect(isBloodTypeCompatible('AB+', 'O+')).toBe(false);
    expect(isBloodTypeCompatible('AB+', 'A+')).toBe(false);
  });

  it('A+ can donate to A+ and AB+', () => {
    expect(isBloodTypeCompatible('A+', 'A+')).toBe(true);
    expect(isBloodTypeCompatible('A+', 'AB+')).toBe(true);
    expect(isBloodTypeCompatible('A+', 'B+')).toBe(false);
    expect(isBloodTypeCompatible('A+', 'O+')).toBe(false);
  });

  it('returns false for null/undefined inputs', () => {
    expect(isBloodTypeCompatible(null, 'A+')).toBe(false);
    expect(isBloodTypeCompatible('A+', null)).toBe(false);
    expect(isBloodTypeCompatible(undefined, undefined)).toBe(false);
  });
});

// ──────────────────────────────────────────────
//  findCompatibleDonors
// ──────────────────────────────────────────────

describe('findCompatibleDonors', () => {
  it('should find donors with matching blood type', async () => {
    const hospital = await createHospital();
    const request = await createRequest(hospital._id, { bloodType: 'O+' });
    const matchingDonor = await createDonor({ bloodType: 'O+' });
    await createDonor({ bloodType: 'AB-' }); // incompatible

    const results = await findCompatibleDonors(request._id);

    expect(results.length).toBeGreaterThanOrEqual(1);
    const donorIds = results.map((r) => r.donor._id.toString());
    expect(donorIds).toContain(matchingDonor._id.toString());
  });

  it('should exclude donors who already responded', async () => {
    const hospital = await createHospital();
    const request = await createRequest(hospital._id, { bloodType: 'O+' });
    const donor = await createDonor({ bloodType: 'O+' });

    // Donor already has a pending donation for this request
    await createDonation(donor._id, request._id, { status: 'pending' });

    const results = await findCompatibleDonors(request._id);
    const donorIds = results.map((r) => r.donor._id.toString());
    expect(donorIds).not.toContain(donor._id.toString());
  });

  it('should include donors whose previous donation was cancelled', async () => {
    const hospital = await createHospital();
    const request = await createRequest(hospital._id, { bloodType: 'O+' });
    const donor = await createDonor({ bloodType: 'O+' });

    // Cancelled donation should NOT prevent re-matching
    await createDonation(donor._id, request._id, { status: 'cancelled' });

    const results = await findCompatibleDonors(request._id);
    const donorIds = results.map((r) => r.donor._id.toString());
    expect(donorIds).toContain(donor._id.toString());
  });

  it('should exclude unavailable donors', async () => {
    // Clear DB to ensure no donors from previous tests leak in
    await clearDatabase();

    const hospital = await createHospital();
    const request = await createRequest(hospital._id, { bloodType: 'O+' });
    await createDonor({ bloodType: 'O+', isAvailable: false });

    const results = await findCompatibleDonors(request._id);
    expect(results).toHaveLength(0);
  });

  it('should assign higher location score to nearby donors', async () => {
    const hospital = await createHospital({
      location: {
        city: 'Cairo', governorate: 'Cairo',
        coordinates: { lat: 30.0444, lng: 31.2357 },
        lastUpdated: new Date(),
      },
    });
    const request = await createRequest(hospital._id, { bloodType: 'O+' });

    // Nearby donor (Nasr City, ~10km)
    const nearbyDonor = await createDonor({
      bloodType: 'O+',
      location: {
        city: 'Nasr City', governorate: 'Cairo',
        coordinates: { lat: 30.0637, lng: 31.3303 },
        lastUpdated: new Date(),
      },
    });

    // Far donor (Alexandria, ~200km)
    const farDonor = await createDonor({
      bloodType: 'O+',
      location: {
        city: 'Alexandria', governorate: 'Alexandria',
        coordinates: { lat: 31.2001, lng: 29.9187 },
        lastUpdated: new Date(),
      },
    });

    const results = await findCompatibleDonors(request._id);

    const nearbyResult = results.find((r) => r.donor._id.toString() === nearbyDonor._id.toString());
    const farResult = results.find((r) => r.donor._id.toString() === farDonor._id.toString());

    expect(nearbyResult).toBeDefined();
    expect(farResult).toBeDefined();
    expect(nearbyResult.locationScore).toBeGreaterThan(farResult.locationScore);
    expect(nearbyResult.score).toBeGreaterThan(farResult.score);
  });

  it('should throw for non-existent request', async () => {
    const fakeId = '000000000000000000000000';
    await expect(findCompatibleDonors(fakeId)).rejects.toThrow('Request not found');
  });
});

// ──────────────────────────────────────────────
//  findCompatibleRequests
// ──────────────────────────────────────────────

describe('findCompatibleRequests', () => {
  it('should find active requests matching donor blood type', async () => {
    const hospital = await createHospital();
    const donor = await createDonor({ bloodType: 'O+' });
    const matchingReq = await createRequest(hospital._id, { bloodType: 'O+', status: 'pending' });
    await createRequest(hospital._id, { bloodType: 'O+', status: 'completed' }); // inactive

    const results = await findCompatibleRequests(donor._id);

    expect(results.length).toBeGreaterThanOrEqual(1);
    const reqIds = results.map((r) => r.request._id.toString());
    expect(reqIds).toContain(matchingReq._id.toString());
  });

  it('should prioritize critical urgency requests', async () => {
    const hospital = await createHospital();
    const donor = await createDonor({ bloodType: 'O+' });

    const lowReq = await createRequest(hospital._id, { bloodType: 'O+', urgency: 'low' });
    const criticalReq = await createRequest(hospital._id, { bloodType: 'O+', urgency: 'critical' });

    const results = await findCompatibleRequests(donor._id);

    // Critical should score higher and appear first
    expect(results[0].request._id.toString()).toBe(criticalReq._id.toString());
  });

  it('should exclude requests donor already responded to', async () => {
    const hospital = await createHospital();
    const donor = await createDonor({ bloodType: 'O+' });
    const request = await createRequest(hospital._id, { bloodType: 'O+' });

    await createDonation(donor._id, request._id, { status: 'scheduled' });

    const results = await findCompatibleRequests(donor._id);
    const reqIds = results.map((r) => r.request._id.toString());
    expect(reqIds).not.toContain(request._id.toString());
  });

  it('should throw for non-existent donor', async () => {
    const fakeId = '000000000000000000000000';
    await expect(findCompatibleRequests(fakeId)).rejects.toThrow('Donor not found');
  });
});
