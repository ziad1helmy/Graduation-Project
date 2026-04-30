import { describe, it, expect, vi, beforeEach } from 'vitest';
import { setupTestDB } from '../helpers/db.js';
import { createDonor, createHospital, createRequest, createDonation as createDonationRecord } from '../helpers/factories.js';

// Mock external dependencies before importing the service under test
vi.mock('../../src/services/reward.service.js', () => ({
  onDonationCompleted: vi.fn(),
}));

vi.mock('../../src/services/matching.service.js', () => ({
  checkEligibility: vi.fn(() => ({ eligible: true, reason: 'ok' })),
}));

import * as donationService from '../../src/services/donation.service.js';
import Donation from '../../src/models/Donation.model.js';
import Donor from '../../src/models/Donor.model.js';
import Request from '../../src/models/Request.model.js';
import * as rewardService from '../../src/services/reward.service.js';

setupTestDB();

describe('Donation Service', () => {
  it('validateEligibility returns matching service result', async () => {
    const donor = { isAvailable: true, bloodType: 'O+' };
    const request = { type: 'blood', bloodType: 'O+' };

    const res = await donationService.validateEligibility(donor, request);
    expect(res.eligible).toBe(true);
  });

  it('createDonation creates a donation when eligible and not already responded', async () => {
    const hospital = await createHospital();
    const request = await createRequest(hospital._id, { type: 'blood', bloodType: 'O+' });
    const donor = await createDonor({ bloodType: 'O+' });

    const donation = await donationService.createDonation(donor._id, request._id, { quantity: 1 });

    expect(donation).toBeTruthy();
    expect(donation.donorId.toString()).toBe(donor._id.toString());
    expect(donation.requestId.toString()).toBe(request._id.toString());
  });

  it('createDonation rejects if donor already responded', async () => {
    const hospital = await createHospital();
    const request = await createRequest(hospital._id, { type: 'blood', bloodType: 'O+' });
    const donor = await createDonor({ bloodType: 'O+' });

    await createDonationRecord(donor._id, request._id, { status: 'pending' });

    await expect(donationService.createDonation(donor._id, request._id)).rejects.toThrow(/already responded/);
  });

  it('updateDonationStatus completes donation and triggers reward', async () => {
    const hospital = await createHospital();
    const request = await createRequest(hospital._id, { type: 'blood', bloodType: 'O+', urgency: 'critical' });
    const donor = await createDonor({ bloodType: 'O+' });
    const donation = await createDonationRecord(donor._id, request._id, { status: 'pending' });

    const updated = await donationService.updateDonationStatus(donation._id, 'completed');
    expect(updated.status).toBe('completed');

    // donor.lastDonationDate should be set
    const updatedDonor = await Donor.findById(donor._id);
    expect(updatedDonor.lastDonationDate).toBeTruthy();

    // rewardService.onDonationCompleted is called asynchronously — wait briefly
    await new Promise((r) => setTimeout(r, 50));
    expect(rewardService.onDonationCompleted).toHaveBeenCalled();
  });

  it('getDonationHistory and stats return expected shapes', async () => {
    const hospital = await createHospital();
    const request = await createRequest(hospital._id, { type: 'blood', bloodType: 'O+' });
    const donor = await createDonor({ bloodType: 'O+' });

    await createDonationRecord(donor._id, request._id, { status: 'completed', quantity: 2 });
    await createDonationRecord(donor._id, request._id, { status: 'pending', quantity: 1 });

    const history = await donationService.getDonationHistory(donor._id, {});
    expect(history).toHaveProperty('donations');
    expect(history).toHaveProperty('total');

    const stats = await donationService.getDonorStats(donor._id);
    expect(stats.totalDonations).toBeGreaterThanOrEqual(2);
    expect(stats.totalUnitsDonated).toBeGreaterThanOrEqual(2);
  });

  it('cancelDonation updates status to cancelled', async () => {
    const hospital = await createHospital();
    const request = await createRequest(hospital._id, { type: 'blood', bloodType: 'O+' });
    const donor = await createDonor({ bloodType: 'O+' });
    const donation = await createDonationRecord(donor._id, request._id, { status: 'pending' });

    const cancelled = await donationService.cancelDonation(donation._id);
    expect(cancelled.status).toBe('cancelled');
  });
});
