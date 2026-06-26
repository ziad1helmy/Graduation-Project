import { describe, it, expect, vi, beforeEach } from 'vitest';
import { setupTestDB } from '../helpers/db.js';
import { createDonor, createHospital, createRequest } from '../helpers/factories.js';
import * as donorController from '../../src/controllers/donor.controller.js';
import * as matchingService from '../../src/services/matching.service.js';
import Donor from '../../src/models/Donor.model.js';
import Appointment from '../../src/models/Appointment.model.js';
import Donation from '../../src/models/Donation.model.js';
import { HttpError } from '../../src/utils/HttpError.js';

// ─── Mocks ────────────────────────────────────────────────────────────────────
vi.mock('../../src/models/Notification.model.js', () => ({
  default: { create: vi.fn().mockResolvedValue(null) },
}));

vi.mock('../../src/services/activity.service.js', () => ({
  getLatestActivities: vi.fn().mockResolvedValue([]),
  logActivity: vi.fn().mockResolvedValue(null),
}));

vi.mock('../../src/services/donation.service.js', () => ({
  getDonorStats: vi.fn().mockResolvedValue({ totalDonations: 3 }),
  getDonationHistory: vi.fn().mockResolvedValue([]),
  validateEligibility: vi.fn().mockResolvedValue({ eligible: true }),
}));

// NOTE: pointsBalance (not totalPoints) — matches current reward.service.js contract
vi.mock('../../src/services/reward.service.js', () => ({
  getPointsSummary: vi.fn().mockResolvedValue({ pointsBalance: 600, pointsToNextTier: 400 }),
  getDonorBadges: vi.fn().mockResolvedValue({
    badges: [],
    unlockedCount: 0,
    totalCount: 7,
    completionPercentage: 0,
  }),
  getPointsHistory: vi.fn().mockResolvedValue({ transactions: [], pagination: {} }),
}));

vi.mock('../../src/services/notification.service.js', () => ({
  notifyMatch: vi.fn().mockResolvedValue(null),
}));

vi.mock('../../src/services/matching.service.js', () => ({
  findCompatibleRequests: vi.fn().mockResolvedValue([]),
}));

setupTestDB();

// ─── helpers ─────────────────────────────────────────────────────────────────
const makeRes = () => {
  const res = { json: vi.fn(), status: vi.fn() };
  res.status.mockReturnValue(res);
  return res;
};

const expectHttpError = (next, statusCode, messagePattern) => {
  expect(next).toHaveBeenCalledTimes(1);
  const err = next.mock.calls[0][0];
  expect(err).toBeInstanceOf(HttpError);
  expect(err.statusCode).toBe(statusCode);
  if (messagePattern) expect(err.message).toMatch(messagePattern);
};

// =============================================================================
//  getDashboard
// =============================================================================
describe('getDashboard', () => {
  it('returns 200 with userInfo / stats / recentActivity / badges', async () => {
    const donor = await createDonor({ fullName: 'Ahmed Test', bloodType: 'O+' });
    const res = makeRes();
    const next = vi.fn();
    await donorController.getDashboard({ user: { userId: donor._id } }, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    const data = res.json.mock.calls[0][0].data;
    expect(data).toHaveProperty('userInfo');
    expect(data).toHaveProperty('stats');
    expect(data).toHaveProperty('recentActivity');
    expect(data).toHaveProperty('badges');
  });

  it('userInfo contains firstName, bloodType, donationStatus', async () => {
    const donor = await createDonor({ fullName: 'Fatima Test', bloodType: 'A-' });
    const res = makeRes();
    const next = vi.fn();
    await donorController.getDashboard({ user: { userId: donor._id } }, res, next);

    expect(next).not.toHaveBeenCalled();
    const { userInfo } = res.json.mock.calls[0][0].data;
    expect(userInfo.firstName).toBe('Fatima');
    expect(userInfo.bloodType).toBe('A-');
    expect(userInfo).toHaveProperty('donationStatus');
  });

  it('donationStatus is "eligible" when no pending appointments', async () => {
    const donor = await createDonor();
    const res = makeRes();
    const next = vi.fn();
    await donorController.getDashboard({ user: { userId: donor._id } }, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.json.mock.calls[0][0].data.userInfo.donationStatus).toBe('eligible');
  });

  it('donationStatus is "pending" when active appointment exists', async () => {
    const donor = await createDonor();
    const hospital = await createHospital();
    await Appointment.create({
      donorId: donor._id,
      hospitalId: hospital._id,
      appointmentDate: new Date(Date.now() + 48 * 3600 * 1000),
      status: 'pending',
    });
    const res = makeRes();
    const next = vi.fn();
    await donorController.getDashboard({ user: { userId: donor._id } }, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.json.mock.calls[0][0].data.userInfo.donationStatus).toBe('pending');
  });

  it('stats.points uses pointsBalance (not totalPoints)', async () => {
    const donor = await createDonor();
    const res = makeRes();
    const next = vi.fn();
    await donorController.getDashboard({ user: { userId: donor._id } }, res, next);

    expect(next).not.toHaveBeenCalled();
    // mock returns pointsBalance: 600 — previous bug returned undefined (was totalPoints)
    expect(res.json.mock.calls[0][0].data.stats.points).toBe(600);
  });

  it('stats.livesSaved = totalDonations * 3', async () => {
    const donor = await createDonor();
    const res = makeRes();
    const next = vi.fn();
    await donorController.getDashboard({ user: { userId: donor._id } }, res, next);

    expect(next).not.toHaveBeenCalled();
    const { stats } = res.json.mock.calls[0][0].data;
    expect(stats.livesSaved).toBe(stats.totalDonations * 3);
  });
});

// =============================================================================
//  getRequests
// =============================================================================
describe('getRequests', () => {
  it('getRequests returns only matched requests via matching service', async () => {
    // Must set location so the donor passes the Fix #5 location guard
    const donor = await createDonor({
      bloodType: 'O+',
      isOptedIn: true,
      location: { coordinates: { lat: 30.0444, lng: 31.2357 }, governorate: 'Cairo' },
    });
    const hospital = await createHospital();
    const request = await createRequest(hospital._id, { bloodType: 'O+' });

    matchingService.findCompatibleRequests.mockResolvedValue([
      {
        request,
        score: 99,
        locationScore: 88,
        compatibility: { bloodTypeMatch: true, eligible: true },
      },
    ]);

    const res = makeRes();
    const next = vi.fn();
    await donorController.getRequests({ user: { userId: donor._id }, query: {} }, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    const data = res.json.mock.calls[0][0].data;
    expect(data.matches).toHaveLength(1);
    expect(data.matches[0].request._id).toBe(request._id.toString());
  });

  it('getRequests keeps matched requests visible when donor has an active appointment', async () => {
    const donor = await createDonor({
      bloodType: 'O+',
      isOptedIn: true,
      location: { coordinates: { lat: 30.0444, lng: 31.2357 }, governorate: 'Cairo' },
    });
    const hospital = await createHospital();
    const request = await createRequest(hospital._id, { bloodType: 'O+' });
    await Appointment.create({
      donorId: donor._id,
      hospitalId: hospital._id,
      requestId: request._id,
      appointmentDate: new Date(Date.now() + 48 * 3600 * 1000),
      status: 'pending',
    });

    matchingService.findCompatibleRequests.mockResolvedValue([
      {
        request,
        score: 99,
        locationScore: 88,
        compatibility: { bloodTypeMatch: true, eligible: true },
      },
    ]);

    const res = makeRes();
    const next = vi.fn();
    await donorController.getRequests({ user: { userId: donor._id }, query: {} }, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    const data = res.json.mock.calls[0][0].data;
    expect(data.matches).toHaveLength(1);
    expect(data.reason).toBe('ACTIVE_APPOINTMENT_EXISTS');
    expect(data.message).toBe('You have an active appointment. Complete or cancel it to see new requests.');
  });

  it('getRequests returns 422 LOCATION_REQUIRED for donor without location', async () => {
    const donor = await createDonor({
      bloodType: 'O+',
      isOptedIn: true,
      location: { city: 'Cairo', governorate: 'Cairo', coordinates: {} },
    });
    const res = makeRes();
    const next = vi.fn();
    await donorController.getRequests({ user: { userId: donor._id }, query: {} }, res, next);
    expectHttpError(next, 422, /location/);
  });

});

// =============================================================================
//  getProfile  (enriched — new fields: age, weight, stats, badgeProgress)
// =============================================================================
describe('getProfile', () => {
  it('returns 200 with age, weight, stats, badgeProgress', async () => {
    const donor = await createDonor({ dateOfBirth: new Date('1990-01-01'), weight: 75 });
    const res = makeRes();
    const next = vi.fn();
    await donorController.getProfile({ user: { userId: donor._id } }, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    const data = res.json.mock.calls[0][0].data;
    expect(typeof data.age).toBe('number');
    expect(data.age).toBeGreaterThan(0);
    expect(data.weight).toBe(75);
    expect(data).toHaveProperty('stats');
    expect(data).toHaveProperty('badgeProgress');
  });

  it('returns 404 when donor not found', async () => {
    const res = makeRes();
    const next = vi.fn();
    await donorController.getProfile({ user: { userId: '507f1f77bcf86cd799439011' } }, res, next);
    expectHttpError(next, 404, /donor.error_profile_not_found/);
  });

  it('verificationStatus reflects isEmailVerified', async () => {
    const donor = await createDonor({ isEmailVerified: true });
    const res = makeRes();
    const next = vi.fn();
    await donorController.getProfile({ user: { userId: donor._id } }, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.json.mock.calls[0][0].data.verificationStatus).toBe('verified');
  });
});

// =============================================================================
//  updateProfile  (weight field)
// =============================================================================
describe('updateProfile', () => {
  it('updates weight successfully', async () => {
    const donor = await createDonor();
    const res = makeRes();
    const next = vi.fn();
    await donorController.updateProfile(
      { user: { userId: donor._id }, body: { weight: 80 } },
      res,
      next
    );
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    const updated = await Donor.findById(donor._id);
    expect(updated.weight).toBe(80);
  });

  it('rejects invalid phone number', async () => {
    const donor = await createDonor();
    const res = makeRes();
    const next = vi.fn();
    await donorController.updateProfile(
      { user: { userId: donor._id }, body: { phoneNumber: '123' } },
      res,
      next
    );
    expectHttpError(next, 400, /donor.error_invalid_phone/);
  });
});

// =============================================================================
//  getDonorStats (new endpoint)
// =============================================================================
describe('getDonorStats', () => {
  it('returns totalDonations, points, livesSaved', async () => {
    const donor = await createDonor();
    const res = makeRes();
    const next = vi.fn();
    await donorController.getDonorStats({ user: { userId: donor._id } }, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    const data = res.json.mock.calls[0][0].data;
    expect(data).toHaveProperty('totalDonations');
    expect(data).toHaveProperty('points');
    expect(data).toHaveProperty('livesSaved');
    expect(data.livesSaved).toBe(data.totalDonations * 3);
  });
});

// =============================================================================
//  getDonorRewards (new endpoint)
// =============================================================================
describe('getDonorRewards', () => {
  it('returns currentPoints, earnedBadges, lockedBadges, nextMilestone', async () => {
    const donor = await createDonor();
    const res = makeRes();
    const next = vi.fn();
    await donorController.getDonorRewards({ user: { userId: donor._id } }, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    const data = res.json.mock.calls[0][0].data;
    expect(data).toHaveProperty('currentPoints');
    expect(data).toHaveProperty('earnedBadges');
    expect(data).toHaveProperty('lockedBadges');
    expect(data).toHaveProperty('nextMilestone');
    expect(Array.isArray(data.earnedBadges)).toBe(true);
    expect(Array.isArray(data.lockedBadges)).toBe(true);
  });
});

// =============================================================================
//  respondToRequest  (accept — decrements unitsNeeded + auto-closes at 0)
// =============================================================================
describe('respondToRequest — accept', () => {
  it('keeps request unitsNeeded unchanged on accept', async () => {
    const hospital = await createHospital();
    const request = await createRequest(hospital._id, { urgency: 'high', unitsNeeded: 3, status: 'pending' });
    const donor = await createDonor();

    const res = makeRes();
    const next = vi.fn();
    await donorController.respondToRequest(
      { user: { userId: donor._id }, params: { requestId: request._id.toString() }, body: { quantity: 1 } },
      res,
      next
    );

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(201);
    const { default: Request } = await import('../../src/models/Request.model.js');
    const updated = await Request.findById(request._id);
    expect(updated.unitsNeeded).toBe(3);
    expect(updated.status).toBe('pending');
    expect(updated.unitsAccepted).toBe(1);
  });

  it('does not auto-close request when accepted quantity equals requested unitsNeeded', async () => {
    const hospital = await createHospital();
    const request = await createRequest(hospital._id, { urgency: 'critical', unitsNeeded: 1, status: 'pending' });
    const donor = await createDonor();

    const res = makeRes();
    const next = vi.fn();
    await donorController.respondToRequest(
      { user: { userId: donor._id }, params: { requestId: request._id.toString() }, body: { quantity: 1 } },
      res,
      next
    );

    expect(next).not.toHaveBeenCalled();
    const { default: Request } = await import('../../src/models/Request.model.js');
    const updated = await Request.findById(request._id);
    expect(updated.status).toBe('accepted');
  });

  it('prevents duplicate acceptance', async () => {
    const hospital = await createHospital();
    const request = await createRequest(hospital._id, { urgency: 'high', unitsNeeded: 5 });
    const donor = await createDonor();

    await Donation.create({ donorId: donor._id, requestId: request._id, quantity: 1, status: 'pending' });

    const res = makeRes();
    const next = vi.fn();
    await donorController.respondToRequest(
      { user: { userId: donor._id }, params: { requestId: request._id.toString() }, body: {} },
      res,
      next
    );
    expectHttpError(next, 400, /already responded/);
  });
});

// =============================================================================
//  getDonationHistory  (pointsEarned field now present via aggregation)
// =============================================================================
describe('getDonationHistory', () => {
  it('returns 200 with donations array and pagination', async () => {
    const donor = await createDonor();
    const res = makeRes();
    const next = vi.fn();
    await donorController.getDonationHistory(
      { user: { userId: donor._id }, query: {} },
      res,
      next
    );
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    const data = res.json.mock.calls[0][0].data;
    expect(Array.isArray(data.donations)).toBe(true);
    expect(data).toHaveProperty('pagination');
  });
});

// =============================================================================
//  Settings
// =============================================================================
describe('getSettings / updateSettings', () => {
  it('returns default settings', async () => {
    const donor = await createDonor();
    const res = makeRes();
    const next = vi.fn();
    await donorController.getSettings({ user: { userId: donor._id } }, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    const { settings } = res.json.mock.calls[0][0].data;
    expect(settings.pushNotifications).toBe(true);
    expect(settings.emergencyAlerts).toBe(true);
    expect(settings.privacyMode).toBe(false);
    expect(settings.language).toBe('en');
  });

  it('updates individual settings without affecting others', async () => {
    const donor = await createDonor();
    const res = makeRes();
    const next = vi.fn();
    await donorController.updateSettings(
      { user: { userId: donor._id }, body: { privacyMode: true, language: 'ar' } },
      res,
      next
    );

    expect(next).not.toHaveBeenCalled();
    const { settings } = res.json.mock.calls[0][0].data;
    expect(settings.privacyMode).toBe(true);
    expect(settings.language).toBe('ar');
    expect(settings.pushNotifications).toBe(true); // unchanged
  });

  it('rejects invalid language', async () => {
    const donor = await createDonor();
    const res = makeRes();
    const next = vi.fn();
    await donorController.updateSettings(
      { user: { userId: donor._id }, body: { language: 'fr' } },
      res,
      next
    );
    expectHttpError(next, 400, /donor.error_invalid_language/);
  });
});
