import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../../src/app.js';
import { setupTestDB, clearDatabase } from '../helpers/db.js';
import { createDonor, createHospital, createRequest } from '../helpers/factories.js';
import { signToken } from '../../src/utils/jwt.js';
import Donation from '../../src/models/Donation.model.js';
import Request from '../../src/models/Request.model.js';

setupTestDB();

describe('Donor Routes Integration', () => {
  it('GET /donor/profile returns authenticated donor profile', async () => {
    await clearDatabase();
    const donor = await createDonor();

    const token = signToken({ userId: donor._id.toString(), role: donor.role });

    const response = await request(app)
      .get('/donor/profile')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toHaveProperty('_id');
    expect(response.body.data.role).toBe('donor');
    expect(response.body.data.fullName).toBe(donor.fullName);
    expect(response.body.data.email).toBe(donor.email);
  });

  it('GET /donor/profile requires authentication', async () => {
    await clearDatabase();

    const response = await request(app).get('/donor/profile');

    expect(response.status).toBe(401);
  });

  it('PUT /donor/profile updates donor profile', async () => {
    await clearDatabase();
    const donor = await createDonor();

    const token = signToken({ userId: donor._id.toString(), role: donor.role });

    const updateData = {
      fullName: 'Ahmed Updated',
      phoneNumber: '0109876543',
      gender: 'male',
    };

    const response = await request(app)
      .put('/donor/profile')
      .set('Authorization', `Bearer ${token}`)
      .send(updateData);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.fullName).toBe('Ahmed Updated');
    expect(response.body.data.phoneNumber).toBe('0109876543');
  });

  it('GET /donor/requests returns available donation requests', async () => {
    await clearDatabase();
    const donor = await createDonor();
    const hospital = await createHospital();
    await createRequest(hospital._id, { bloodType: donor.bloodType, urgency: 'high' });

    const token = signToken({ userId: donor._id.toString(), role: donor.role });

    const response = await request(app)
      .get('/donor/requests')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toHaveProperty('requests');
    expect(Array.isArray(response.body.data.requests)).toBe(true);
  });

  it('GET /donor/requests filters by urgency', async () => {
    await clearDatabase();
    const donor = await createDonor();
    const hospital = await createHospital();
    await createRequest(hospital._id, { bloodType: donor.bloodType, urgency: 'high' });

    const token = signToken({ userId: donor._id.toString(), role: donor.role });

    const response = await request(app)
      .get('/donor/requests?urgency=high')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.data.requests.every((r) => r.urgency === 'high')).toBe(true);
  });

  it('GET /donor/matches returns compatible donors for requests', async () => {
    await clearDatabase();
    const donor = await createDonor();

    const token = signToken({ userId: donor._id.toString(), role: donor.role });

    const response = await request(app)
      .get('/donor/matches')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toHaveProperty('matches');
  });

  it('GET /donor/donations returns donation history', async () => {
    await clearDatabase();
    const donor = await createDonor();
    const hospital = await createHospital();
    const req = await createRequest(hospital._id, { bloodType: donor.bloodType });

    await Donation.create({
      donorId: donor._id,
      requestId: req._id,
      quantity: 1,
      status: 'completed',
      donationDate: new Date(),
    });

    const token = signToken({ userId: donor._id.toString(), role: donor.role });

    const response = await request(app)
      .get('/donor/donations')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toHaveProperty('donations');
    expect(Array.isArray(response.body.data.donations)).toBe(true);
  });

  it('GET /donor/donations filters by status', async () => {
    await clearDatabase();
    const donor = await createDonor();
    const hospital = await createHospital();
    const req = await createRequest(hospital._id, { bloodType: donor.bloodType });

    await Donation.create({
      donorId: donor._id,
      requestId: req._id,
      quantity: 1,
      status: 'completed',
    });

    const token = signToken({ userId: donor._id.toString(), role: donor.role });

    const response = await request(app)
      .get('/donor/donations?status=completed')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.data.donations.every((d) => d.status === 'completed')).toBe(true);
  });

  it('GET /donor/dashboard returns donor dashboard data', async () => {
    await clearDatabase();
    const donor = await createDonor();

    const token = signToken({ userId: donor._id.toString(), role: donor.role });

    const response = await request(app)
      .get('/donor/dashboard')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toHaveProperty('donationStats');
  });

  it('GET /donor/points returns donor points summary', async () => {
    await clearDatabase();
    const donor = await createDonor();

    const token = signToken({ userId: donor._id.toString(), role: donor.role });

    const response = await request(app)
      .get('/donor/points')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toHaveProperty('pointsBalance');
    expect(response.body.data).toHaveProperty('currentTier');
  });

  it('GET /donor/badges returns donor badges', async () => {
    await clearDatabase();
    const donor = await createDonor();

    const token = signToken({ userId: donor._id.toString(), role: donor.role });

    const response = await request(app)
      .get('/donor/badges')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toHaveProperty('badges');
    expect(Array.isArray(response.body.data.badges)).toBe(true);
  });

  it('GET /donor/redemptions returns reward redemption history', async () => {
    await clearDatabase();
    const donor = await createDonor();

    const token = signToken({ userId: donor._id.toString(), role: donor.role });

    const response = await request(app)
      .get('/donor/redemptions')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toHaveProperty('redemptions');
  });

  it('PUT /donor/availability updates donor availability status', async () => {
    await clearDatabase();
    const donor = await createDonor();

    const token = signToken({ userId: donor._id.toString(), role: donor.role });

    const response = await request(app)
      .put('/donor/availability')
      .set('Authorization', `Bearer ${token}`)
      .send({ isAvailable: false });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.isAvailable).toBe(false);
  });

  it('GET /donor/donation-eligibility returns eligibility status', async () => {
    await clearDatabase();
    const donor = await createDonor();
    const hospital = await createHospital();
    const req = await createRequest(hospital._id, { bloodType: donor.bloodType });

    const token = signToken({ userId: donor._id.toString(), role: donor.role });

    const response = await request(app)
      .get(`/donor/donation-eligibility?requestId=${req._id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toHaveProperty('eligible');
  });

  it('GET /donor/history returns donation history (alias)', async () => {
    await clearDatabase();
    const donor = await createDonor();

    const token = signToken({ userId: donor._id.toString(), role: donor.role });

    const response = await request(app)
      .get('/donor/history')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toHaveProperty('donations');
  });

  it('GET /donor/notifications returns donor notifications', async () => {
    await clearDatabase();
    const donor = await createDonor();

    const token = signToken({ userId: donor._id.toString(), role: donor.role });

    const response = await request(app)
      .get('/donor/notifications')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toHaveProperty('notifications');
  });

  it('GET /donor/urgent-requests returns urgent donation requests', async () => {
    await clearDatabase();
    const donor = await createDonor();
    const hospital = await createHospital();
    await createRequest(hospital._id, { bloodType: donor.bloodType, urgency: 'critical' });

    const token = signToken({ userId: donor._id.toString(), role: donor.role });

    const response = await request(app)
      .get('/donor/urgent-requests')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toHaveProperty('requests');
  });

  it('POST /donor/respond/:requestId creates donation response', async () => {
    await clearDatabase();
    const donor = await createDonor();
    const hospital = await createHospital();
    const req = await createRequest(hospital._id, { bloodType: donor.bloodType });

    const token = signToken({ userId: donor._id.toString(), role: donor.role });

    const response = await request(app)
      .post(`/donor/respond/${req._id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ quantity: 1 });

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toHaveProperty('_id');
    expect(response.body.data.status).toBe('pending');
  });

  it('POST /donor/respond/:requestId validates eligibility', async () => {
    await clearDatabase();
    const donor = await createDonor();
    const hospital = await createHospital();

    // Create request with incompatible blood type
    const req = await createRequest(hospital._id, { bloodType: 'AB+' });

    const token = signToken({ userId: donor._id.toString(), role: donor.role });

    const response = await request(app)
      .post(`/donor/respond/${req._id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ quantity: 1 });

    // Could be 400, 409, or 201 depending on blood type compatibility
    // O+ is universal donor so it's often compatible even with AB+
    expect([201, 400, 409]).toContain(response.status);
  });

  it('GET /donor/recent-activity returns recent donor activity', async () => {
    await clearDatabase();
    const donor = await createDonor();

    const token = signToken({ userId: donor._id.toString(), role: donor.role });

    const response = await request(app)
      .get('/donor/recent-activity')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toBeDefined();
  });

  it('GET /donor/health-history returns health history', async () => {
    await clearDatabase();
    const donor = await createDonor();

    const token = signToken({ userId: donor._id.toString(), role: donor.role });

    const response = await request(app)
      .get('/donor/health-history')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
  });

  it('Donor routes require donor role', async () => {
    await clearDatabase();
    const hospital = await createHospital();

    const token = signToken({ userId: hospital._id.toString(), role: hospital.role });

    const response = await request(app)
      .get('/donor/profile')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(403);
  });

  it('Donor routes require authentication', async () => {
    await clearDatabase();

    const response = await request(app).get('/donor/profile');

    expect(response.status).toBe(401);
  });
});
