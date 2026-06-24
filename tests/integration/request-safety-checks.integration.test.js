import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../../src/app.js';
import { setupTestDB } from '../helpers/db.js';
import { createDonor, createHospital, createRequest, createDonation } from '../helpers/factories.js';
import { signToken } from '../../src/utils/jwt.js';
import Donation from '../../src/models/Donation.model.js';
import Request from '../../src/models/Request.model.js';
import Donor from '../../src/models/Donor.model.js';
import * as matchingService from '../../src/services/matching.service.js';

setupTestDB();

beforeAll(async () => {
  await Request.ensureIndexes();
  await Donation.ensureIndexes();
  await Donor.ensureIndexes();
});

const tokenFor = (user) =>
  signToken({ userId: user._id.toString(), role: user.role, isEmailVerified: true });

describe('Hospital Request Flow Safety Checks', () => {
  it('prevents request visibility/matching for suspended, opted-out, deferred, or chronic condition donors', async () => {
    const hospital = await createHospital();
    const requestRecord = await createRequest(hospital._id, { bloodType: 'O+' });

    // 1. Suspended Donor
    const suspendedDonor = await createDonor({ bloodType: 'O+', isSuspended: true });
    let matches = await matchingService.findCompatibleRequests(suspendedDonor._id);
    expect(matches).toHaveLength(0);

    // 2. Opted-out Donor
    const optedOutDonor = await createDonor({ bloodType: 'O+', isOptedIn: false });
    matches = await matchingService.findCompatibleRequests(optedOutDonor._id);
    expect(matches).toHaveLength(0);

    // 3. Deferred Donor
    const deferredDonor = await createDonor({
      bloodType: 'O+',
      temporaryDeferralUntil: new Date(Date.now() + 24 * 60 * 60 * 1000)
    });
    matches = await matchingService.findCompatibleRequests(deferredDonor._id);
    expect(matches).toHaveLength(0);

    // 4. Chronic Condition Donor
    const chronicDonor = await createDonor({
      bloodType: 'O+',
      healthHistory: { chronicConditions: ['Diabetes'] }
    });
    matches = await matchingService.findCompatibleRequests(chronicDonor._id);
    expect(matches).toHaveLength(0);
  });

  it('prevents matching for donors who already completed or rejected the request', async () => {
    const hospital = await createHospital();
    const requestRecord = await createRequest(hospital._id, { bloodType: 'O+' });
    const donor = await createDonor({ bloodType: 'O+' });

    // Completed donation
    await createDonation(donor._id, requestRecord._id, { status: 'completed' });
    let matches = await matchingService.findCompatibleRequests(donor._id);
    expect(matches).toHaveLength(0);

    // Clean up and test rejected
    await Donation.deleteMany({});
    await createDonation(donor._id, requestRecord._id, { status: 'rejected' });
    matches = await matchingService.findCompatibleRequests(donor._id);
    expect(matches).toHaveLength(0);
  });

  it('re-runs eligibility at the final hospital confirmation step and rejects donation/reopens request if check fails', async () => {
    const hospital = await createHospital();
    const requestRecord = await createRequest(hospital._id, { bloodType: 'O+', unitsNeeded: 1 });
    const donor = await createDonor({ bloodType: 'O+' });

    const donorToken = tokenFor(donor);
    const hospitalToken = tokenFor(hospital);

    // Donor accepts request
    const acceptResponse = await request(app)
      .post(`/donor/respond/${requestRecord._id}`)
      .set('Authorization', `Bearer ${donorToken}`)
      .send({});
    expect(acceptResponse.status).toBe(201);

    const donationId = acceptResponse.body.data._id;

    // Scan QR
    const scanRes = await request(app)
      .post('/appointments/verify-qr')
      .set('Authorization', `Bearer ${hospitalToken}`)
      .send({ qrToken: acceptResponse.body.data.qrToken });
    expect(scanRes.status).toBe(200);
    expect(scanRes.body.data.verificationStatus).toBe('pending');

    // Mark donation as verified (simulating confirm step)
    await Donation.findByIdAndUpdate(donationId, {
      $set: {
        verificationStatus: 'verified',
        verificationChecklist: {
          idVerified: true,
          questionnaireCompleted: true,
          consentSigned: true,
          completedAt: new Date(),
        },
      },
    });

    // Make donor ineligible post-acceptance (e.g. suspend donor)
    await Donor.findByIdAndUpdate(donor._id, { isSuspended: true });

    // Confirm Donation completion (Hospital confirmation step)
    const completeRes = await request(app)
      .post('/donations/complete')
      .set('Authorization', `Bearer ${hospitalToken}`)
      .send({
        donationId,
        hemoglobinLevel: 14.5,
        weight: 70,
        unitsCollected: 1
      });

    // Verification failed!
    expect(completeRes.status).toBe(403);
    expect(completeRes.body.message).toContain('Safety validation failed');

    // Donation must be rejected, request reverted to pending, acceptedBy cleared
    const updatedDonation = await Donation.findById(donationId);
    expect(updatedDonation.status).toBe('rejected');

    const updatedRequest = await Request.findById(requestRecord._id);
    expect(updatedRequest.status).toBe('pending');
    expect(updatedRequest.acceptedBy).toBeNull();
    expect(updatedRequest.acceptedDonationId).toBeNull();
  });
});
