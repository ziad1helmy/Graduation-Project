import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../../src/app.js';
import { setupTestDB, clearDatabase } from '../helpers/db.js';
import { createDonor, createHospital, createRequest } from '../helpers/factories.js';
import { signToken } from '../../src/utils/jwt.js';
import Donation from '../../src/models/Donation.model.js';
import Request from '../../src/models/Request.model.js';
import Donor from '../../src/models/Donor.model.js';
import Appointment from '../../src/models/Appointment.model.js';

setupTestDB();

beforeAll(async () => {
  await Request.ensureIndexes();
  await Donation.ensureIndexes();
  await Donor.ensureIndexes();
});

const tokenFor = (user) =>
  signToken({ userId: user._id.toString(), role: user.role, isEmailVerified: true });

describe('Request Flow — /requests/verify-qr edge cases', () => {
  it('rejects an expired QR token', async () => {
    await clearDatabase();
    const hospital = await createHospital();
    const donor = await createDonor();
    const reqRecord = await createRequest(hospital._id, {
      bloodType: donor.bloodType,
      urgency: 'critical',
    });

    const donorToken = tokenFor(donor);
    const hospitalToken = tokenFor(hospital);

    const acceptRes = await request(app)
      .post(`/requests/${reqRecord._id}/accept`)
      .set('Authorization', `Bearer ${donorToken}`)
      .send({});
    expect(acceptRes.status).toBe(200);

    const qrToken = acceptRes.body.data.qrToken;
    const donation = await Donation.findOne({ requestId: reqRecord._id, donorId: donor._id });

    donation.qrExpiresAt = new Date(Date.now() - 60 * 60 * 1000);
    await donation.save();

    const verifyRes = await request(app)
      .post('/requests/verify-qr')
      .set('Authorization', `Bearer ${hospitalToken}`)
      .send({ qrToken });

    expect(verifyRes.status).toBe(200);
    expect(verifyRes.body.data.valid).toBe(false);
    expect(verifyRes.body.data.message).toMatch(/expired/i);
  });

  it('rejects when request is cancelled after donor accepts', async () => {
    await clearDatabase();
    const hospital = await createHospital();
    const donor = await createDonor();
    const reqRecord = await createRequest(hospital._id, {
      bloodType: donor.bloodType,
      urgency: 'critical',
    });

    const donorToken = tokenFor(donor);
    const hospitalToken = tokenFor(hospital);

    const acceptRes = await request(app)
      .post(`/requests/${reqRecord._id}/accept`)
      .set('Authorization', `Bearer ${donorToken}`)
      .send({});
    expect(acceptRes.status).toBe(200);

    const qrToken = acceptRes.body.data.qrToken;

    await Request.findByIdAndUpdate(reqRecord._id, { status: 'cancelled' });

    const verifyRes = await request(app)
      .post('/requests/verify-qr')
      .set('Authorization', `Bearer ${hospitalToken}`)
      .send({ qrToken });

    expect(verifyRes.status).toBe(200);
    expect(verifyRes.body.data.valid).toBe(false);
    expect(verifyRes.body.data.message).toMatch(/no longer active/i);
  });

  it('rejects when donation is already completed by another donor', async () => {
    await clearDatabase();
    const hospital = await createHospital();
    const donor = await createDonor();
    const reqRecord = await createRequest(hospital._id, {
      bloodType: donor.bloodType,
      urgency: 'critical',
      unitsNeeded: 2,
    });

    const donorToken = tokenFor(donor);
    const hospitalToken = tokenFor(hospital);

    const acceptRes = await request(app)
      .post(`/requests/${reqRecord._id}/accept`)
      .set('Authorization', `Bearer ${donorToken}`)
      .send({});
    expect(acceptRes.status).toBe(200);

    const qrToken = acceptRes.body.data.qrToken;

    // Complete donation so it is no longer pending
    const donation = await Donation.findOne({ requestId: reqRecord._id, donorId: donor._id });
    await Donation.findByIdAndUpdate(donation._id, { status: 'completed' });

    const verifyRes = await request(app)
      .post('/requests/verify-qr')
      .set('Authorization', `Bearer ${hospitalToken}`)
      .send({ qrToken });

    expect(verifyRes.status).toBe(200);
    expect(verifyRes.body.data.valid).toBe(false);
    expect(verifyRes.body.data.message).toMatch(/no longer valid/i);
  });

  it('rejects double-scan (QR already used)', async () => {
    await clearDatabase();
    const hospital = await createHospital();
    const donor = await createDonor();
    const reqRecord = await createRequest(hospital._id, {
      bloodType: donor.bloodType,
      urgency: 'critical',
    });

    const donorToken = tokenFor(donor);
    const hospitalToken = tokenFor(hospital);

    const acceptRes = await request(app)
      .post(`/requests/${reqRecord._id}/accept`)
      .set('Authorization', `Bearer ${donorToken}`)
      .send({});
    expect(acceptRes.status).toBe(200);

    const qrToken = acceptRes.body.data.qrToken;

    const firstScan = await request(app)
      .post('/requests/verify-qr')
      .set('Authorization', `Bearer ${hospitalToken}`)
      .send({ qrToken });
    expect(firstScan.status).toBe(200);
    expect(firstScan.body.data.valid).toBe(true);

    const secondScan = await request(app)
      .post('/requests/verify-qr')
      .set('Authorization', `Bearer ${hospitalToken}`)
      .send({ qrToken });
    expect(secondScan.status).toBe(200);
    expect(secondScan.body.data.valid).toBe(false);
    expect(secondScan.body.data.message).toMatch(/already been used/i);
  });
});

describe('Request Flow — /requests/:id/confirm eligibility re-check', () => {
  it('rejects and reopens request when donor is suspended after accept', async () => {
    await clearDatabase();
    const hospital = await createHospital();
    const donor = await createDonor();
    const reqRecord = await createRequest(hospital._id, {
      bloodType: donor.bloodType,
      urgency: 'critical',
      unitsNeeded: 1,
    });

    const donorToken = tokenFor(donor);
    const hospitalToken = tokenFor(hospital);

    const acceptRes = await request(app)
      .post(`/requests/${reqRecord._id}/accept`)
      .set('Authorization', `Bearer ${donorToken}`)
      .send({});
    expect(acceptRes.status).toBe(200);

    await Donor.findByIdAndUpdate(donor._id, { isSuspended: true });

    const confirmRes = await request(app)
      .post(`/requests/${reqRecord._id}/confirm`)
      .set('Authorization', `Bearer ${hospitalToken}`)
      .send({});

    expect(confirmRes.status).toBe(200);
    expect(confirmRes.body.message).toMatch(/no longer eligible/i);

    const updatedDonation = await Donation.findOne({ requestId: reqRecord._id, donorId: donor._id });
    expect(updatedDonation.status).toBe('rejected');

    const updatedRequest = await Request.findById(reqRecord._id);
    expect(updatedRequest.status).toBe('pending');
    expect(updatedRequest.acceptedBy).toBeNull();
    expect(updatedRequest.acceptedDonationId).toBeNull();
  });

  it('rejects and reopens request when donor donates elsewhere (cooldown) after accept', async () => {
    await clearDatabase();
    const hospital = await createHospital();
    const donor = await createDonor({ gender: 'male' });
    const reqRecord = await createRequest(hospital._id, {
      bloodType: donor.bloodType,
      urgency: 'critical',
      unitsNeeded: 1,
    });

    const donorToken = tokenFor(donor);
    const hospitalToken = tokenFor(hospital);

    const acceptRes = await request(app)
      .post(`/requests/${reqRecord._id}/accept`)
      .set('Authorization', `Bearer ${donorToken}`)
      .send({});
    expect(acceptRes.status).toBe(200);

    await Donor.findByIdAndUpdate(donor._id, { lastDonationDate: new Date() });

    const confirmRes = await request(app)
      .post(`/requests/${reqRecord._id}/confirm`)
      .set('Authorization', `Bearer ${hospitalToken}`)
      .send({});

    expect(confirmRes.status).toBe(200);
    expect(confirmRes.body.message).toMatch(/no longer eligible/i);

    const updatedRequest = await Request.findById(reqRecord._id);
    expect(updatedRequest.status).toBe('pending');
  });

  it('rejects and reopens request when donor gets temporary deferral after accept', async () => {
    await clearDatabase();
    const hospital = await createHospital();
    const donor = await createDonor();
    const reqRecord = await createRequest(hospital._id, {
      bloodType: donor.bloodType,
      urgency: 'critical',
      unitsNeeded: 1,
    });

    const donorToken = tokenFor(donor);
    const hospitalToken = tokenFor(hospital);

    const acceptRes = await request(app)
      .post(`/requests/${reqRecord._id}/accept`)
      .set('Authorization', `Bearer ${donorToken}`)
      .send({});
    expect(acceptRes.status).toBe(200);

    await Donor.findByIdAndUpdate(donor._id, {
      temporaryDeferralUntil: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      lastDeferralReason: 'Recent vaccination',
    });

    const confirmRes = await request(app)
      .post(`/requests/${reqRecord._id}/confirm`)
      .set('Authorization', `Bearer ${hospitalToken}`)
      .send({});

    expect(confirmRes.status).toBe(200);
    expect(confirmRes.body.message).toMatch(/no longer eligible/i);

    const updatedRequest = await Request.findById(reqRecord._id);
    expect(updatedRequest.status).toBe('pending');
  });

  it('rejects and reopens request when donor gets travel deferral after accept', async () => {
    await clearDatabase();
    const hospital = await createHospital();
    const donor = await createDonor();
    const reqRecord = await createRequest(hospital._id, {
      bloodType: donor.bloodType,
      urgency: 'critical',
      unitsNeeded: 1,
    });

    const donorToken = tokenFor(donor);
    const hospitalToken = tokenFor(hospital);

    const acceptRes = await request(app)
      .post(`/requests/${reqRecord._id}/accept`)
      .set('Authorization', `Bearer ${donorToken}`)
      .send({});
    expect(acceptRes.status).toBe(200);

    await Donor.findByIdAndUpdate(donor._id, {
      travelHistory: [
        { country: 'Nigeria', returnDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000) },
      ],
    });

    const confirmRes = await request(app)
      .post(`/requests/${reqRecord._id}/confirm`)
      .set('Authorization', `Bearer ${hospitalToken}`)
      .send({});

    expect(confirmRes.status).toBe(200);
    expect(confirmRes.body.message).toMatch(/no longer eligible/i);

    const updatedRequest = await Request.findById(reqRecord._id);
    expect(updatedRequest.status).toBe('pending');
  });

  it('rejects when arrival deadline has passed', async () => {
    await clearDatabase();
    const hospital = await createHospital();
    const donor = await createDonor();
    const reqRecord = await createRequest(hospital._id, {
      bloodType: donor.bloodType,
      urgency: 'critical',
      unitsNeeded: 1,
    });

    const donorToken = tokenFor(donor);
    const hospitalToken = tokenFor(hospital);

    const acceptRes = await request(app)
      .post(`/requests/${reqRecord._id}/accept`)
      .set('Authorization', `Bearer ${donorToken}`)
      .send({});
    expect(acceptRes.status).toBe(200);

    const donation = await Donation.findOne({ requestId: reqRecord._id, donorId: donor._id });
    donation.arrivalDeadline = new Date(Date.now() - 60 * 60 * 1000);
    await donation.save();

    const confirmRes = await request(app)
      .post(`/requests/${reqRecord._id}/confirm`)
      .set('Authorization', `Bearer ${hospitalToken}`)
      .send({});

    expect(confirmRes.status).toBe(400);
    expect(confirmRes.body.message).toMatch(/deadline has passed/i);
  });

  it('rejects when QR has expired at confirm time', async () => {
    await clearDatabase();
    const hospital = await createHospital();
    const donor = await createDonor();
    const reqRecord = await createRequest(hospital._id, {
      bloodType: donor.bloodType,
      urgency: 'critical',
      unitsNeeded: 1,
    });

    const donorToken = tokenFor(donor);
    const hospitalToken = tokenFor(hospital);

    const acceptRes = await request(app)
      .post(`/requests/${reqRecord._id}/accept`)
      .set('Authorization', `Bearer ${donorToken}`)
      .send({});
    expect(acceptRes.status).toBe(200);

    const donation = await Donation.findOne({ requestId: reqRecord._id, donorId: donor._id });
    donation.qrExpiresAt = new Date(Date.now() - 60 * 60 * 1000);
    await donation.save();

    const confirmRes = await request(app)
      .post(`/requests/${reqRecord._id}/confirm`)
      .set('Authorization', `Bearer ${hospitalToken}`)
      .send({});

    expect(confirmRes.status).toBe(400);
    expect(confirmRes.body.message).toMatch(/QR code has expired/i);
  });
});

describe('Appointment Flow — /appointments/verify-qr eligibility checks', () => {
  it('rejects when donor is suspended after booking', async () => {
    await clearDatabase();
    const hospital = await createHospital();
    const donor = await createDonor();
    const reqRecord = await createRequest(hospital._id, {
      bloodType: donor.bloodType,
      urgency: 'high',
    });

    const donorToken = tokenFor(donor);
    const hospitalToken = tokenFor(hospital);

    const appointmentDate = new Date(Date.now() + 4 * 24 * 60 * 60 * 1000);
    appointmentDate.setHours(14, 0, 0, 0);

    const bookRes = await request(app)
      .post('/donations/book-appointment')
      .set('Authorization', `Bearer ${donorToken}`)
      .send({
        hospitalId: hospital._id.toString(),
        requestId: reqRecord._id.toString(),
        appointmentDate: appointmentDate.toISOString(),
        donationType: 'Whole Blood',
      });
    expect(bookRes.status).toBe(201);
    const qrToken = bookRes.body.data.qrToken;

    await Donor.findByIdAndUpdate(donor._id, { isSuspended: true });

    const verifyRes = await request(app)
      .post('/appointments/verify-qr')
      .set('Authorization', `Bearer ${hospitalToken}`)
      .send({ qrToken });

    expect(verifyRes.status).toBe(403);
    expect(verifyRes.body.message).toMatch(/suspended/i);
  });

  it('rejects when donor is on cooldown after booking', async () => {
    await clearDatabase();
    const hospital = await createHospital();
    const donor = await createDonor({ gender: 'male' });
    const reqRecord = await createRequest(hospital._id, {
      bloodType: donor.bloodType,
      urgency: 'high',
    });

    const donorToken = tokenFor(donor);
    const hospitalToken = tokenFor(hospital);

    // Book an appointment
    const appointmentDate = new Date(Date.now() + 4 * 24 * 60 * 60 * 1000);
    appointmentDate.setHours(14, 0, 0, 0);

    const bookRes = await request(app)
      .post('/donations/book-appointment')
      .set('Authorization', `Bearer ${donorToken}`)
      .send({
        hospitalId: hospital._id.toString(),
        requestId: reqRecord._id.toString(),
        appointmentDate: appointmentDate.toISOString(),
        donationType: 'Whole Blood',
      });
    expect(bookRes.status).toBe(201);
    const qrToken = bookRes.body.data.qrToken;

    await Donor.findByIdAndUpdate(donor._id, { lastDonationDate: new Date() });

    const verifyRes = await request(app)
      .post('/appointments/verify-qr')
      .set('Authorization', `Bearer ${hospitalToken}`)
      .send({ qrToken });

    expect(verifyRes.status).toBe(403);
    expect(verifyRes.body.message).toMatch(/cooldown|interval|eligible|wait before donating/i);
  });

  it('rejects expired QR token', async () => {
    await clearDatabase();
    const hospital = await createHospital();
    const donor = await createDonor();
    const reqRecord = await createRequest(hospital._id, {
      bloodType: donor.bloodType,
      urgency: 'high',
    });

    const donorToken = tokenFor(donor);
    const hospitalToken = tokenFor(hospital);

    const appointmentDate = new Date(Date.now() + 4 * 24 * 60 * 60 * 1000);
    appointmentDate.setHours(14, 0, 0, 0);

    const bookRes = await request(app)
      .post('/donations/book-appointment')
      .set('Authorization', `Bearer ${donorToken}`)
      .send({
        hospitalId: hospital._id.toString(),
        requestId: reqRecord._id.toString(),
        appointmentDate: appointmentDate.toISOString(),
        donationType: 'Whole Blood',
      });
    expect(bookRes.status).toBe(201);
    const qrToken = bookRes.body.data.qrToken;

    await Appointment.findByIdAndUpdate(bookRes.body.data._id, {
      qrExpiresAt: new Date(Date.now() - 60 * 60 * 1000),
    });

    const verifyRes = await request(app)
      .post('/appointments/verify-qr')
      .set('Authorization', `Bearer ${hospitalToken}`)
      .send({ qrToken });

    expect(verifyRes.status).toBe(400);
    expect(verifyRes.body.message).toMatch(/expired/i);
  });

  it('rejects double-scan with 409', async () => {
    await clearDatabase();
    const hospital = await createHospital();
    const donor = await createDonor();
    const reqRecord = await createRequest(hospital._id, {
      bloodType: donor.bloodType,
      urgency: 'high',
    });

    const donorToken = tokenFor(donor);
    const hospitalToken = tokenFor(hospital);

    const appointmentDate = new Date(Date.now() + 4 * 24 * 60 * 60 * 1000);
    appointmentDate.setHours(14, 0, 0, 0);

    const bookRes = await request(app)
      .post('/donations/book-appointment')
      .set('Authorization', `Bearer ${donorToken}`)
      .send({
        hospitalId: hospital._id.toString(),
        requestId: reqRecord._id.toString(),
        appointmentDate: appointmentDate.toISOString(),
        donationType: 'Whole Blood',
      });
    expect(bookRes.status).toBe(201);
    const qrToken = bookRes.body.data.qrToken;

    const first = await request(app)
      .post('/appointments/verify-qr')
      .set('Authorization', `Bearer ${hospitalToken}`)
      .send({ qrToken });
    expect(first.status).toBe(200);

    const second = await request(app)
      .post('/appointments/verify-qr')
      .set('Authorization', `Bearer ${hospitalToken}`)
      .send({ qrToken });
    expect(second.status).toBe(409);
    expect(second.body.message).toMatch(/already used/i);
  });
});

describe('Matching visibility — eligibility guards before display', () => {
  it('excludes donor with active pending donation from nearby requests', async () => {
    await clearDatabase();
    const hospital = await createHospital();
    const donor = await createDonor();
    const reqRecord = await createRequest(hospital._id, {
      bloodType: donor.bloodType,
      urgency: 'high',
    });

    // Create an active donation for this donor on a different request
    const otherHospital = await createHospital();
    const otherRequest = await createRequest(otherHospital._id, {
      bloodType: donor.bloodType,
      urgency: 'high',
    });
    await Donation.create({
      donorId: donor._id,
      requestId: otherRequest._id,
      status: 'pending',
      quantity: 1,
    });

    const donorToken = tokenFor(donor);
    const nearbyRes = await request(app)
      .get('/requests/nearby')
      .set('Authorization', `Bearer ${donorToken}`)
      .query({ lat: 30.0444, lng: 31.2357 });

    expect(nearbyRes.status).toBe(200);
    const ids = (nearbyRes.body.data.requests || []).map((r) => r.id || r._id);
    expect(ids).not.toContain(reqRecord._id.toString());
  });

  it('excludes donor with active appointment from nearby requests', async () => {
    await clearDatabase();
    const hospital = await createHospital();
    const donor = await createDonor();
    const reqRecord = await createRequest(hospital._id, {
      bloodType: donor.bloodType,
      urgency: 'high',
    });

    await Appointment.create({
      donorId: donor._id,
      hospitalId: hospital._id,
      requestId: reqRecord._id,
      status: 'confirmed',
      appointmentDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
      donationType: 'Whole Blood',
      qrToken: 'test-qr-token-123',
    });

    const donorToken = tokenFor(donor);
    const nearbyRes = await request(app)
      .get('/requests/nearby')
      .set('Authorization', `Bearer ${donorToken}`)
      .query({ lat: 30.0444, lng: 31.2357 });

    expect(nearbyRes.status).toBe(200);
    expect(nearbyRes.body.data.requests || []).toHaveLength(0);
  });
});
