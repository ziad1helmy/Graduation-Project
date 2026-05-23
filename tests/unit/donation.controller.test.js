import { describe, it, expect, vi } from 'vitest';
import crypto from 'node:crypto';
import { setupTestDB } from '../helpers/db.js';
import { createDonor, createHospital, createRequest } from '../helpers/factories.js';
import * as donationController from '../../src/controllers/donation.controller.js';
import Appointment from '../../src/models/Appointment.model.js';
import Donation from '../../src/models/Donation.model.js';

// ─── Mocks ────────────────────────────────────────────────────────────────────
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

  it('returns 400 when hospitalId is missing', async () => {
    const donor = await createDonor();
    const res = makeRes();
    await donationController.validateDonationEligibility(
      { user: { userId: donor._id }, body: { date: '2026-06-01' } },
      res,
      vi.fn()
    );
    expect(res.status).toHaveBeenCalledWith(400);
  });
});

// =============================================================================
//  verifyQr  (POST /appointments/verify-qr — Hospital scanner endpoint)
// =============================================================================
describe('verifyQr', () => {
  it('successfully verifies a valid QR and returns nested donation object', async () => {
    const donor = await createDonor();
    const hospital = await createHospital();
    const qrToken = crypto.randomBytes(32).toString('hex');

    await Appointment.create({
      donorId: donor._id,
      hospitalId: hospital._id,
      appointmentDate: new Date(Date.now() + 48 * 3600 * 1000),
      status: 'confirmed',
      qrToken,
      donationType: 'Whole Blood',
    });

    const res = makeRes();
    await donationController.verifyQr(
      { user: { userId: hospital._id }, body: { qrToken } },
      res,
      vi.fn()
    );

    expect(res.status).toHaveBeenCalledWith(200);
    const data = res.json.mock.calls[0][0].data;
    expect(data).toHaveProperty('donation');
    expect(data.donation).toHaveProperty('donationId');
    expect(data.donation).toHaveProperty('type');
    expect(data.donation).toHaveProperty('date');
    expect(data.donation).toHaveProperty('location');
    expect(data.donation.status).toBe('confirmed');
    expect(data).toHaveProperty('pointsEarned');
    expect(data.pointsEarned).toBe(100); // Whole Blood
  });

  it('returns 400 when qrToken is missing', async () => {
    const res = makeRes();
    await donationController.verifyQr({ user: {}, body: {} }, res, vi.fn());
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('returns 404 for an invalid QR token', async () => {
    const res = makeRes();
    await donationController.verifyQr({ user: {}, body: { qrToken: 'invalid-token-xyz' } }, res, vi.fn());
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('returns 409 when QR has already been used', async () => {
    const donor = await createDonor();
    const hospital = await createHospital();
    const qrToken = crypto.randomBytes(32).toString('hex');

    await Appointment.create({
      donorId: donor._id,
      hospitalId: hospital._id,
      appointmentDate: new Date(Date.now() + 48 * 3600 * 1000),
      status: 'completed',
      qrToken,
      qrScannedAt: new Date(), // already scanned
    });

    const res = makeRes();
    await donationController.verifyQr({ user: {}, body: { qrToken } }, res, vi.fn());
    expect(res.status).toHaveBeenCalledWith(409);
  });

  it('returns 400 for a cancelled appointment', async () => {
    const donor = await createDonor();
    const hospital = await createHospital();
    const qrToken = crypto.randomBytes(32).toString('hex');

    await Appointment.create({
      donorId: donor._id,
      hospitalId: hospital._id,
      appointmentDate: new Date(Date.now() + 48 * 3600 * 1000),
      status: 'cancelled',
      qrToken,
    });

    const res = makeRes();
    await donationController.verifyQr({ user: {}, body: { qrToken } }, res, vi.fn());
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json.mock.calls[0][0].message).toContain('cancelled');
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
      qrExpiresAt: new Date(Date.now() - 3600 * 1000), // expired 1h ago
    });

    const res = makeRes();
    await donationController.verifyQr({ user: {}, body: { qrToken } }, res, vi.fn());
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json.mock.calls[0][0].message).toContain('expired');
  });

  it('marks appointment as completed and qrScannedAt is set', async () => {
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

    const res = makeRes();
    await donationController.verifyQr({ user: {}, body: { qrToken } }, res, vi.fn());

    const updated = await Appointment.findById(appointment._id);
    expect(updated.status).toBe('completed');
    expect(updated.qrScannedAt).toBeTruthy();
  });

  it('creates a Donation record in the database', async () => {
    const donor = await createDonor();
    const hospital = await createHospital();
    const qrToken = crypto.randomBytes(32).toString('hex');

    await Appointment.create({
      donorId: donor._id,
      hospitalId: hospital._id,
      appointmentDate: new Date(Date.now() + 48 * 3600 * 1000),
      status: 'pending',
      qrToken,
    });

    const countBefore = await Donation.countDocuments({ donorId: donor._id });

    const res = makeRes();
    await donationController.verifyQr({ user: {}, body: { qrToken } }, res, vi.fn());

    const countAfter = await Donation.countDocuments({ donorId: donor._id });
    expect(countAfter).toBe(countBefore + 1);
  });

  it('pointsEarned is 120 for non-Whole-Blood donation type', async () => {
    const donor = await createDonor();
    const hospital = await createHospital();
    const qrToken = crypto.randomBytes(32).toString('hex');

    await Appointment.create({
      donorId: donor._id,
      hospitalId: hospital._id,
      appointmentDate: new Date(Date.now() + 48 * 3600 * 1000),
      status: 'confirmed',
      qrToken,
      donationType: 'Platelets',
    });

    const res = makeRes();
    await donationController.verifyQr({ user: {}, body: { qrToken } }, res, vi.fn());

    expect(res.json.mock.calls[0][0].data.pointsEarned).toBe(120);
  });
});

// =============================================================================
//  scanQr  (legacy hospital endpoint — still supported)
// =============================================================================
describe('scanQr (legacy)', () => {
  it('confirms a donation using the original scan endpoint', async () => {
    const donor = await createDonor();
    const hospital = await createHospital();
    const request = await createRequest(hospital._id, { bloodType: donor.bloodType });
    const qrToken = crypto.randomBytes(32).toString('hex');

    await Appointment.create({
      donorId: donor._id,
      hospitalId: hospital._id,
      requestId: request._id,
      appointmentDate: new Date(Date.now() + 48 * 3600 * 1000),
      status: 'confirmed',
      qrToken,
      donationType: 'Whole Blood',
    });

    const res = makeRes();
    await donationController.scanQr(
      { user: { userId: hospital._id }, body: { qrToken, units: 1 } },
      res,
      vi.fn()
    );

    expect(res.status).toHaveBeenCalledWith(200);
    const data = res.json.mock.calls[0][0].data;
    expect(data.donationId).toBeTruthy();
    expect(data.pointsEarned).toBe(100);
  });
});