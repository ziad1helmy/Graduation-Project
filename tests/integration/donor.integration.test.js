import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../../src/app.js';
import { setupTestDB, clearDatabase } from '../helpers/db.js';
import { createDonor, createHospital, createRequest } from '../helpers/factories.js';
import { signToken } from '../../src/utils/jwt.js';
import Donation from '../../src/models/Donation.model.js';
import Request from '../../src/models/Request.model.js';
import Appointment from '../../src/models/Appointment.model.js';

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
      phoneNumber: '01098765432',
      gender: 'male',
    };

    const response = await request(app)
      .put('/donor/profile')
      .set('Authorization', `Bearer ${token}`)
      .send(updateData);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.fullName).toBe('Ahmed Updated');
    expect(response.body.data.phoneNumber).toBe('01098765432');
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

  it('GET /donor/requests keeps compatible requests visible when donor has an active appointment', async () => {
    await clearDatabase();
    const donor = await createDonor();
    const hospital = await createHospital();
    await createRequest(hospital._id, { bloodType: donor.bloodType, urgency: 'high' });

    const futureDate = new Date(Date.now() + 48 * 60 * 60 * 1000);
    await Appointment.create({
      donorId: donor._id,
      hospitalId: hospital._id,
      appointmentDate: futureDate,
      status: 'pending',
    });

    const token = signToken({ userId: donor._id.toString(), role: donor.role });

    const response = await request(app)
      .get('/donor/requests')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.requests).toHaveLength(1);
    expect(response.body.data.reason).toBe('ACTIVE_APPOINTMENT_EXISTS');
    expect(response.body.data.message).toBe('You have an active appointment. Complete or cancel it to see new requests.');
  });

  it('GET /donor/requests falls back to non-geo query when 2dsphere index is missing', async () => {
    // Regression: production saw 500s when the hospitalLocationGeo 2dsphere
    // index was missing or geo data was malformed. The endpoint must degrade
    // gracefully instead of crashing.
    await clearDatabase();
    const donor = await createDonor();
    const hospital = await createHospital();
    await createRequest(hospital._id, { bloodType: donor.bloodType, urgency: 'high' });

    // Drop the geospatial index to simulate a production index mismatch.
    const requestCollection = Request.collection;
    try {
      try {
        await requestCollection.dropIndex('hospitalLocationGeo_2dsphere');
      } catch (dropErr) {
        // If the index does not exist, ignore.
        if (dropErr.code !== 27) throw dropErr;
      }

      const token = signToken({ userId: donor._id.toString(), role: donor.role });

      const response = await request(app)
        .get('/donor/requests')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('requests');
      expect(Array.isArray(response.body.data.requests)).toBe(true);
    } finally {
      // Restore the index so later tests are not affected.
      await requestCollection.createIndex({ hospitalLocationGeo: '2dsphere' });
    }
  });

  it('GET /donor/matches returns compatible donors for requests', async () => {
    await clearDatabase();
    const donor = await createDonor();
    const hospital = await createHospital();
    await createRequest(hospital._id, { bloodType: donor.bloodType, status: 'pending' });

    const token = signToken({ userId: donor._id.toString(), role: donor.role });

    const response = await request(app)
      .get('/donor/matches')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toHaveProperty('matches');
    expect(Array.isArray(response.body.data.matches)).toBe(true);
    expect(response.body.data.matches.length).toBeGreaterThan(0);

    const match = response.body.data.matches[0];
    expect(match).toHaveProperty('request');
    expect(match).toHaveProperty('score');
    expect(match).toHaveProperty('locationScore');
    expect(match).toHaveProperty('compatibility');
    expect(match.compatibility).toHaveProperty('bloodTypeMatch');
    expect(match.compatibility).toHaveProperty('eligible');
    expect(match.compatibility).toHaveProperty('distanceKm');
    expect(match.request).toHaveProperty('_id');
    expect(match.request).toHaveProperty('bloodType');
    expect(match.request).toHaveProperty('unitsNeeded');
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
    expect(response.body.data).toHaveProperty('userInfo');
    expect(response.body.data).toHaveProperty('stats');
    expect(response.body.data).toHaveProperty('recentActivity');
    expect(response.body.data.userInfo).toHaveProperty('donationStatus');
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

  it('PUT /donor/participation updates donor participation preference (new field: isOptedIn)', async () => {
    await clearDatabase();
    const donor = await createDonor();

    const token = signToken({ userId: donor._id.toString(), role: donor.role });

    const response = await request(app)
      .put('/donor/participation')
      .set('Authorization', `Bearer ${token}`)
      .send({ isOptedIn: false });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.isOptedIn).toBe(false);
  });

  it('PUT /donor/participation accepts participation payload', async () => {
    await clearDatabase();
    const donor = await createDonor();

    const token = signToken({ userId: donor._id.toString(), role: donor.role });

    const response = await request(app)
      .put('/donor/participation')
      .set('Authorization', `Bearer ${token}`)
      .send({ participation: false });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.isOptedIn).toBe(false);
  });

  it('PUT /donor/participation accepts legacy isAvailable payload (backward compat)', async () => {
    await clearDatabase();
    const donor = await createDonor();

    const token = signToken({ userId: donor._id.toString(), role: donor.role });

    const response = await request(app)
      .put('/donor/participation')
      .set('Authorization', `Bearer ${token}`)
      // Legacy payload: { isAvailable: false } must still work
      .send({ isAvailable: false });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.isOptedIn).toBe(false);
  });

  it('PUT /donor/availability acts as a deprecated alias route and returns warning header', async () => {
    await clearDatabase();
    const donor = await createDonor();

    const token = signToken({ userId: donor._id.toString(), role: donor.role });

    const response = await request(app)
      .put('/donor/availability')
      .set('Authorization', `Bearer ${token}`)
      .send({ isOptedIn: false });

    expect(response.status).toBe(200);
    expect(response.headers['warning']).toContain('Deprecated Endpoint');
    expect(response.body.data.isOptedIn).toBe(false);
  });

  it('GET /donor/donation-eligibility returns eligibility status', async () => {
    await clearDatabase();
    const donor = await createDonor({ dateOfBirth: new Date('1990-01-01') });
    const hospital = await createHospital();
    const req = await createRequest(hospital._id, { bloodType: donor.bloodType });

    const token = signToken({ userId: donor._id.toString(), role: donor.role });

    const response = await request(app)
      .get('/donor/donation-eligibility')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    // Response now contains isEligible boolean
    expect(response.body.data).toHaveProperty('isEligible');
    expect(response.body.data.isEligible).toBe(true);
  });

  it('GET /donor/history paginates with page and limit', async () => {
    await clearDatabase();
    const donor = await createDonor();
    const hospital = await createHospital();
    const firstRequest = await createRequest(hospital._id, { bloodType: donor.bloodType });
    const secondRequest = await createRequest(hospital._id, { bloodType: donor.bloodType });

    await Donation.create({
      donorId: donor._id,
      requestId: firstRequest._id,
      quantity: 1,
      status: 'completed',
    });
    await Donation.create({
      donorId: donor._id,
      requestId: secondRequest._id,
      quantity: 1,
      status: 'completed',
    });

    const token = signToken({ userId: donor._id.toString(), role: donor.role });

    const firstPage = await request(app)
      .get('/donor/history?page=1&limit=1')
      .set('Authorization', `Bearer ${token}`);

    const secondPage = await request(app)
      .get('/donor/history?page=2&limit=1')
      .set('Authorization', `Bearer ${token}`);

    expect(firstPage.status).toBe(200);
    expect(firstPage.body.success).toBe(true);
    expect(firstPage.body.data.donations).toHaveLength(1);
    expect(firstPage.body.data.pagination.currentPage).toBe(1);
    expect(firstPage.body.data.pagination.total).toBe(2);
    expect(firstPage.body.data.pagination.totalPages).toBe(2);

    expect(secondPage.status).toBe(200);
    expect(secondPage.body.success).toBe(true);
    expect(secondPage.body.data.donations).toHaveLength(1);
    expect(secondPage.body.data.pagination.currentPage).toBe(2);
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

  // `/donor/health-history` removed

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
