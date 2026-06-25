import { describe, it, expect, vi } from 'vitest';
import crypto from 'node:crypto';
import { setupTestDB } from '../helpers/db.js';
import { createDonor, createHospital, createRequest, createDonation } from '../helpers/factories.js';
import * as donationController from '../../src/controllers/donation.controller.js';
import Appointment from '../../src/models/Appointment.model.js';
import Donation from '../../src/models/Donation.model.js';
import Request from '../../src/models/Request.model.js';
import * as eligibilityService from '../../src/services/eligibility.service.js';
import * as activityService from '../../src/services/activity.service.js';
import { HttpError } from '../../src/utils/HttpError.js';

vi.mock('../../src/services/reward.service.js', () => ({
  onDonationCompleted: vi.fn().mockResolvedValue(null),
}));

vi.mock('../../src/services/activity.service.js', () => ({
  logActivity: vi.fn().mockResolvedValue(null),
}));

vi.mock('../../src/services/eligibility.service.js', () => ({
  canDonate: vi.fn().mockResolvedValue({ eligible: true, reason: null }),
}));

setupTestDB();

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

const createVerifiedAppointment = async ({ donor, hospital, request = null, donationType = 'Whole Blood' } = {}) => {
  const qrToken = crypto.randomBytes(32).toString('hex');
  const appointment = await Appointment.create({
    donorId: donor._id,
    hospitalId: hospital._id,
    requestId: request?._id || null,
    appointmentDate: new Date(Date.now() + 48 * 3600 * 1000),
    status: 'confirmed',
    qrToken,
    donationType,
  });

  const scanRes = makeRes();
  await donationController.verifyQr(
    { user: { userId: hospital._id }, body: { qrToken } },
    scanRes,
    vi.fn()
  );

  const sessionId = scanRes.json.mock.calls[0][0].data.verificationSessionId;

  const confirmRes = makeRes();
  await donationController.confirmVerification(
    {
      user: { userId: hospital._id },
      params: { appointmentId: appointment._id.toString() },
      body: {
        verificationSessionId: sessionId,
        checklist: { idVerified: true, questionnaireCompleted: true, consentSigned: true },
        diseaseScreening: { screeningCompleted: true, disqualifyingDiseaseFound: false, disqualifyingDiseases: [], notes: '' },
      },
    },
    confirmRes,
    vi.fn()
  );

  return Appointment.findById(appointment._id);
};

// =============================================================================
//  getDonationTypes
// =============================================================================
describe('getDonationTypes', () => {
  it('returns the four supported types', () => {
    const res = makeRes();
    donationController.getDonationTypes({}, res);
    const data = res.json.mock.calls[0][0].data;
    expect(data).toEqual(['Whole Blood', 'Plasma', 'Platelets', 'Double Red Cells']);
  });
});

// =============================================================================
//  validateDonationEligibility
// =============================================================================
describe('validateDonationEligibility', () => {
  it('returns canDonate:true for an eligible donor', async () => {
    const donor = await createDonor();
    const hospital = await createHospital();
    const res = makeRes();

    await donationController.validateDonationEligibility(
      {
        user: { userId: donor._id },
        body: { hospitalId: hospital._id.toString(), date: new Date(Date.now() + 48 * 3600 * 1000).toISOString() },
      },
      res,
      vi.fn()
    );

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json.mock.calls[0][0].data.canDonate).toBe(true);
  });

  it('returns canDonate:false when duplicate booking exists', async () => {
    const donor = await createDonor();
    const hospital = await createHospital();
    const appointmentDate = new Date(Date.now() + 48 * 3600 * 1000);

    await Appointment.create({
      donorId: donor._id,
      hospitalId: hospital._id,
      appointmentDate,
      status: 'pending',
      qrToken: crypto.randomBytes(32).toString('hex'),
    });

    const res = makeRes();
    await donationController.validateDonationEligibility(
      {
        user: { userId: donor._id },
        body: { hospitalId: hospital._id.toString(), date: appointmentDate.toISOString() },
      },
      res,
      vi.fn()
    );

    expect(res.json.mock.calls[0][0].data.canDonate).toBe(false);
    expect(res.json.mock.calls[0][0].data.reason).toContain('booking');
  });
});

// =============================================================================
//  verifyQr
// =============================================================================
describe('verifyQr', () => {
  it('starts verification and does not create a donation record', async () => {
    const donor = await createDonor();
    const hospital = await createHospital();
    const qrToken = crypto.randomBytes(32).toString('hex');

    const appointment = await Appointment.create({
      donorId: donor._id,
      hospitalId: hospital._id,
      appointmentDate: new Date(Date.now() + 48 * 3600 * 1000),
      status: 'confirmed',
      qrToken,
      donationType: 'Whole Blood',
    });

    const res = makeRes();
    await donationController.verifyQr({ user: { userId: hospital._id }, body: { qrToken } }, res, vi.fn());

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json.mock.calls[0][0].data.verificationStatus).toBe('pending');
    expect(res.json.mock.calls[0][0].data.donor.fullName).toBeTruthy();

    const updated = await Appointment.findById(appointment._id);
    expect(updated.qrScannedAt).toBeTruthy();
    expect(updated.verificationStartedAt).toBeTruthy();
    expect(await Donation.countDocuments({ appointmentId: appointment._id })).toBe(0);
  });

  it('blocks duplicate QR scans', async () => {
    const donor = await createDonor();
    const hospital = await createHospital();
    const qrToken = crypto.randomBytes(32).toString('hex');

    await Appointment.create({
      donorId: donor._id,
      hospitalId: hospital._id,
      appointmentDate: new Date(Date.now() + 48 * 3600 * 1000),
      status: 'confirmed',
      qrToken,
    });

    const res1 = makeRes();
    const next1 = vi.fn();
    await donationController.verifyQr({ user: { userId: hospital._id }, body: { qrToken } }, res1, next1);

    const res2 = makeRes();
    const next2 = vi.fn();
    await donationController.verifyQr({ user: { userId: hospital._id }, body: { qrToken } }, res2, next2);

    expectHttpError(next2, 409);
  });

  it('returns 400 for an expired QR token', async () => {
    const donor = await createDonor();
    const hospital = await createHospital();
    const qrToken = crypto.randomBytes(32).toString('hex');

    await Appointment.create({
      donorId: donor._id,
      hospitalId: hospital._id,
      appointmentDate: new Date(Date.now() + 48 * 3600 * 1000),
      status: 'confirmed',
      qrToken,
      qrExpiresAt: new Date(Date.now() - 3600 * 1000),
    });

    const res = makeRes();
    const next = vi.fn();
    await donationController.verifyQr({ user: { userId: hospital._id }, body: { qrToken } }, res, next);

    expectHttpError(next, 400, /expired/);
  });

  it('returns 403 for an ineligible donor', async () => {
    const donor = await createDonor({ lastDonationDate: new Date(Date.now() - 7 * 24 * 3600 * 1000) });
    const hospital = await createHospital();
    const qrToken = crypto.randomBytes(32).toString('hex');

    eligibilityService.canDonate.mockResolvedValueOnce({
      eligible: false,
      reason: 'You need to wait before donating again',
    });

    await Appointment.create({
      donorId: donor._id,
      hospitalId: hospital._id,
      appointmentDate: new Date(Date.now() + 48 * 3600 * 1000),
      status: 'confirmed',
      qrToken,
    });

    const res = makeRes();
    const next = vi.fn();
    await donationController.verifyQr({ user: { userId: hospital._id }, body: { qrToken } }, res, next);

    expectHttpError(next, 403);
  });
});

// =============================================================================
//  reject / reset
// =============================================================================
describe('verification flow', () => {
  it('rejects and then allows a safe reset', async () => {
    const donor = await createDonor();
    const hospital = await createHospital();
    const qrToken = crypto.randomBytes(32).toString('hex');

    const appointment = await Appointment.create({
      donorId: donor._id,
      hospitalId: hospital._id,
      appointmentDate: new Date(Date.now() + 48 * 3600 * 1000),
      status: 'confirmed',
      qrToken,
    });

    await donationController.verifyQr({ user: { userId: hospital._id }, body: { qrToken } }, makeRes(), vi.fn());

    const rejectRes = makeRes();
    const nextMock = vi.fn();
    await donationController.rejectVerification(
      {
        user: { userId: hospital._id },
        body: { appointmentId: appointment._id.toString(), reason: 'Patient not ready' },
      },
      rejectRes,
      nextMock
    );

    if (nextMock.mock.calls.length) {
      console.log('REJECT_ERROR:', nextMock.mock.calls[0][0]);
    }

    expect(rejectRes.status).toHaveBeenCalledWith(200);

    const resetRes = makeRes();
    const resetNext = vi.fn();
    await donationController.resetVerification(
      {
        user: { userId: hospital._id },
        body: { appointmentId: appointment._id.toString() },
      },
      resetRes,
      resetNext
    );

    if (resetNext.mock.calls.length) {
      console.log('RESET_ERROR:', resetNext.mock.calls[0][0]);
    }

    expect(resetRes.status).toHaveBeenCalledWith(200);

    const updated = await Appointment.findById(appointment._id);
    expect(updated.qrScannedAt).toBeNull();
    expect(updated.verificationStatus).toBe('pending');
  });
});

// =============================================================================
//  completeDonation
// =============================================================================
describe('completeDonation', () => {
  it('completes a verified appointment donation and awards points', async () => {
    const donor = await createDonor({ hemoglobinLevel: 15, weight: 70 });
    const hospital = await createHospital();
    const request = await createRequest(hospital._id, { bloodType: donor.bloodType, status: 'in-progress' });
    const appointment = await createVerifiedAppointment({ donor, hospital, request, donationType: 'Whole Blood' });
    const next = vi.fn();

    const res = makeRes();
    await donationController.completeDonation(
      {
        user: { userId: hospital._id },
        body: {
          appointmentId: appointment._id.toString(),
          hemoglobinLevel: 14.8,
          weight: 71,
          unitsCollected: 1,
          notes: 'Stable vitals',
        },
      },
      res,
      next
    );

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json.mock.calls[0][0].data.pointsEarned).toBe(200);

    const createdDonation = await Donation.findOne({ appointmentId: appointment._id });
    expect(createdDonation).not.toBeNull();
    expect(createdDonation.hemoglobinLevel).toBe(14.8);
    expect(createdDonation.weight).toBe(71);
    expect(createdDonation.unitsCollected).toBe(1);

    const updatedAppointment = await Appointment.findById(appointment._id);
    expect(updatedAppointment.status).toBe('completed');
    expect(updatedAppointment.verificationStatus).toBe('completed');

    const updatedRequest = await Request.findById(request._id);
    expect(updatedRequest.status).toBe('completed');
    expect(updatedRequest.acceptedDonationId).toBeTruthy();
  });

  it('blocks duplicate confirmations for the same appointment', async () => {
    const donor = await createDonor({ hemoglobinLevel: 15, weight: 70 });
    const hospital = await createHospital();
    const appointment = await createVerifiedAppointment({ donor, hospital, donationType: 'Whole Blood' });

    const first = makeRes();
    await donationController.completeDonation(
      {
        user: { userId: hospital._id },
        body: {
          appointmentId: appointment._id.toString(),
          hemoglobinLevel: 14.8,
          weight: 70,
          unitsCollected: 1,
        },
      },
      first,
      vi.fn()
    );

    const second = makeRes();
    const next = vi.fn();
    await donationController.completeDonation(
      {
        user: { userId: hospital._id },
        body: {
          appointmentId: appointment._id.toString(),
          hemoglobinLevel: 14.8,
          weight: 70,
          unitsCollected: 1,
        },
      },
      second,
      next
    );

    expectHttpError(next, 409);
  });

  it('keeps the legacy donationId completion path working', async () => {
    const donor = await createDonor();
    const request = await createRequest((await createHospital())._id, { bloodType: donor.bloodType });
    const donation = await createDonation(donor._id, request._id, { status: 'scheduled' });

    const res = makeRes();
    await donationController.completeDonation(
      {
        user: { userId: donor._id },
        body: { donationId: donation._id.toString(), notes: 'Legacy completion' },
      },
      res,
      vi.fn()
    );

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json.mock.calls[0][0].data.status).toBe('completed');
  });

  it('succeeds even if activity logging fails, and logs the failure', async () => {
    const logger = (await import('../../src/utils/logger.js')).logger;

    // Spy on logger.error
    const loggerErrorSpy = vi.spyOn(logger, 'error').mockImplementation(() => {});

    const donor = await createDonor({ hemoglobinLevel: 15, weight: 70 });
    const hospital = await createHospital();
    const request = await createRequest(hospital._id, { bloodType: donor.bloodType, status: 'in-progress' });
    const appointment = await createVerifiedAppointment({ donor, hospital, request, donationType: 'Whole Blood' });

    // Mock logActivity to reject for the next call in completeDonation
    activityService.logActivity.mockRejectedValueOnce(new Error('Activity database timeout'));

    const res = makeRes();
    await donationController.completeDonation(
      {
        user: { userId: hospital._id },
        body: {
          appointmentId: appointment._id.toString(),
          hemoglobinLevel: 14.8,
          weight: 71,
          unitsCollected: 1,
          notes: 'Stable vitals',
        },
      },
      res,
      vi.fn()
    );

    // Wait for the asynchronous catch handler of activityService.logActivity to execute
    await new Promise((resolve) => setTimeout(resolve, 200));

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json.mock.calls[0][0].data.pointsEarned).toBe(200);

    // Assert logger.error was called with the failure event
    expect(loggerErrorSpy).toHaveBeenCalledWith(
      'DONATION_COMPLETION_ACTIVITY_LOG_FAILED',
      expect.objectContaining({
        event: 'DONATION_COMPLETION_ACTIVITY_LOG_FAILED',
        donorId: donor._id.toString(),
        error: 'Activity database timeout',
      })
    );

    // Restore mocks
    loggerErrorSpy.mockRestore();
  });
});
