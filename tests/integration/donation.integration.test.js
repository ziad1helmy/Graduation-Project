import { describe, it, expect, vi } from 'vitest';
import { setupTestDB } from '../helpers/db.js';
import { createHospital, createDonor, createRequest } from '../helpers/factories.js';
import * as donationService from '../../src/services/donation.service.js';

setupTestDB();

describe('Donation Integration', () => {
  it('creates a donation for an eligible donor and request', async () => {
    const hospital = await createHospital();
    const donor = await createDonor();

    const request = await createRequest(hospital._id, { bloodType: donor.bloodType });

    const donation = await donationService.createDonation(donor._id, request._id, { quantity: 1 });

    expect(donation).toBeTruthy();
    expect(donation.donorId.toString()).toBe(donor._id.toString());
    expect(donation.requestId.toString()).toBe(request._id.toString());
    expect(donation.status).toBe('pending');
  });

  it('rejects donors with an active donation in progress', async () => {
    const hospital = await createHospital();
    const donor = await createDonor({
      bloodType: 'O+',
      dateOfBirth: new Date('1990-01-01'),
      hemoglobinLevel: 14.5,
    });

    const request = await createRequest(hospital._id, { bloodType: donor.bloodType });
    await donationService.createDonation(donor._id, request._id, { quantity: 1 });

    await expect(
      donationService.createDonation(donor._id, request._id, { quantity: 1 })
    ).rejects.toThrow('eligibility.activeDonationInProgress');
  });
});
