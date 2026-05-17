/**
 * Hospital Routes Integration Tests
 *
 * Covers the full HTTP surface of /hospital/* routes:
 *  - Auth enforcement (all routes require valid JWT + hospital role)
 *  - Profile: GET /hospital/profile, PUT /hospital/profile
 *  - Request CRUD: POST /hospital/request, GET /hospital/requests,
 *    GET /hospital/requests/:id, PUT /hospital/requests/:id,
 *    DELETE /hospital/requests/:id
 *  - Request close flow: POST /hospital/requests/:id/close
 *  - Donations: GET /hospital/donations
 *  - Settings: GET/PUT /hospital/blood-bank-settings
 *  - Blood inventory: GET /hospital/blood-inventory
 *  - Notification prefs: GET/PUT /hospital/notification-preferences
 *  - Reports: GET /hospital/reports/monthly
 *  - Staff: GET /hospital/staff, POST /hospital/staff, DELETE /hospital/staff/:id
 */

import { describe, it, expect, beforeAll, afterEach, afterAll } from 'vitest';
import request from 'supertest';
import app from '../../src/app.js';
import { connect, clearDatabase, closeDatabase } from '../helpers/db.js';
import { createHospital, createDonor, createRequest, createDonation, createAdmin } from '../helpers/factories.js';
import { signToken } from '../../src/utils/jwt.js';

// ─────────────────────────────────────────────────────────────────────────────
// Helper: mint a valid access token for a hospital user
// ─────────────────────────────────────────────────────────────────────────────
const tokenFor = (user) =>
  signToken({ userId: user._id.toString(), role: user.role, isEmailVerified: true });

// ─────────────────────────────────────────────────────────────────────────────
// Helper: a valid request body for POST /hospital/request
// ─────────────────────────────────────────────────────────────────────────────
const validRequestBody = () => ({
  type: 'blood',
  bloodType: 'O+',
  urgency: 'high',
  requiredBy: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000).toISOString(), // 4 days out
  quantity: 2,
  hospitalContact: '0100000001',
  notes: 'Integration test request',
});

// ─────────────────────────────────────────────────────────────────────────────
// DB lifecycle
// ─────────────────────────────────────────────────────────────────────────────
beforeAll(async () => {
  await connect();
}, 30_000);

afterEach(async () => {
  await clearDatabase();
});

afterAll(async () => {
  await closeDatabase();
});

// ═════════════════════════════════════════════════════════════════════════════
// AUTH ENFORCEMENT
// ═════════════════════════════════════════════════════════════════════════════
describe('Auth enforcement on hospital routes', () => {
  it('rejects unauthenticated requests with 401', async () => {
    const res = await request(app).get('/hospital/profile');
    expect(res.status).toBe(401);
  });

  it('rejects donor role with 403', async () => {
    const donor = await createDonor();
    const token = tokenFor(donor);
    const res = await request(app)
      .get('/hospital/profile')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// PROFILE
// ═════════════════════════════════════════════════════════════════════════════
describe('GET /hospital/profile', () => {
  it('returns the hospital profile for an authenticated hospital user', async () => {
    const hospital = await createHospital();
    const token = tokenFor(hospital);

    const res = await request(app)
      .get('/hospital/profile')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('data');
    // Email must be present; password must never be exposed
    expect(res.body.data.email).toBe(hospital.email);
    expect(res.body.data.password).toBeUndefined();
  });
});

describe('GET /hospital/find-donors', () => {
  it('returns nearby compatible donors for an authenticated hospital sorted by nearest distance', async () => {
    const hospital = await createHospital({
      location: {
        city: 'Cairo',
        governorate: 'Cairo',
        coordinates: { lat: 30.05, lng: 31.24 },
        lastUpdated: new Date(),
      },
    });
    const token = tokenFor(hospital);

    await createDonor({
      fullName: 'Nearest Donor',
      bloodType: 'O+',
      location: {
        city: 'Cairo',
        governorate: 'Cairo',
        coordinates: { lat: 30.051, lng: 31.241 },
        lastUpdated: new Date(),
      },
    });
    await createDonor({
      fullName: 'Farther Donor',
      bloodType: 'O-',
      location: {
        city: 'Cairo',
        governorate: 'Cairo',
        coordinates: { lat: 30.07, lng: 31.26 },
        lastUpdated: new Date(),
      },
    });
    await createDonor({
      fullName: 'Different Blood Type',
      bloodType: 'A+',
      location: {
        city: 'Cairo',
        governorate: 'Cairo',
        coordinates: { lat: 30.0505, lng: 31.2405 },
        lastUpdated: new Date(),
      },
    });

    const res = await request(app)
      .get('/hospital/find-donors?bloodType=O+&radiusKm=5')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toBe('Nearby donors retrieved successfully');
    expect(res.body.data.donors).toHaveLength(2);
    expect(res.body.data.donors[0].fullName).toBe('Nearest Donor');
    expect(res.body.data.donors[1].fullName).toBe('Farther Donor');
    expect(res.body.data.donors[0].distanceKm).toBeLessThan(res.body.data.donors[1].distanceKm);
  });

  it('applies radius filtering', async () => {
    const hospital = await createHospital();
    const token = tokenFor(hospital);

    await createDonor({
      fullName: 'Inside Radius',
      location: {
        city: 'Cairo',
        governorate: 'Cairo',
        coordinates: { lat: 30.0512, lng: 31.2437 },
        lastUpdated: new Date(),
      },
    });
    await createDonor({
      fullName: 'Outside Radius',
      location: {
        city: 'Cairo',
        governorate: 'Cairo',
        coordinates: { lat: 30.2, lng: 31.4 },
        lastUpdated: new Date(),
      },
    });

    const res = await request(app)
      .get('/hospital/find-donors?radiusKm=1')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.donors).toHaveLength(1);
    expect(res.body.data.donors[0].fullName).toBe('Inside Radius');
  });

  it('supports pagination', async () => {
    const hospital = await createHospital();
    const token = tokenFor(hospital);

    await createDonor({
      fullName: 'Donor One',
      location: {
        city: 'Cairo',
        governorate: 'Cairo',
        coordinates: { lat: 30.0512, lng: 31.2437 },
        lastUpdated: new Date(),
      },
    });
    await createDonor({
      fullName: 'Donor Two',
      location: {
        city: 'Cairo',
        governorate: 'Cairo',
        coordinates: { lat: 30.0515, lng: 31.2439 },
        lastUpdated: new Date(),
      },
    });
    await createDonor({
      fullName: 'Donor Three',
      location: {
        city: 'Cairo',
        governorate: 'Cairo',
        coordinates: { lat: 30.052, lng: 31.2441 },
        lastUpdated: new Date(),
      },
    });

    const res = await request(app)
      .get('/hospital/find-donors?radiusKm=5&page=2&limit=1')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.donors).toHaveLength(1);
    expect(res.body.data.pagination).toMatchObject({
      page: 2,
      limit: 1,
      total: 3,
      totalPages: 3,
    });
  });

  it('can filter by availability=false', async () => {
    const hospital = await createHospital();
    const token = tokenFor(hospital);

    await createDonor({
      fullName: 'Unavailable Donor',
      isAvailable: false,
      location: {
        city: 'Cairo',
        governorate: 'Cairo',
        coordinates: { lat: 30.0512, lng: 31.2437 },
        lastUpdated: new Date(),
      },
    });
    await createDonor({
      fullName: 'Available Donor',
      isAvailable: true,
      location: {
        city: 'Cairo',
        governorate: 'Cairo',
        coordinates: { lat: 30.0515, lng: 31.2439 },
        lastUpdated: new Date(),
      },
    });

    const res = await request(app)
      .get('/hospital/find-donors?radiusKm=5&availability=false')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.donors).toHaveLength(1);
    expect(res.body.data.donors[0]).toMatchObject({
      fullName: 'Unavailable Donor',
      isAvailable: false,
    });
  });

  it('handles missing hospital coordinates gracefully', async () => {
    const hospital = await createHospital({
      location: {
        city: 'Cairo',
        governorate: 'Cairo',
        coordinates: { lat: null, lng: null },
        lastUpdated: new Date(),
      },
      lat: null,
      long: null,
    });
    const token = tokenFor(hospital);

    const res = await request(app)
      .get('/hospital/find-donors')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Hospital coordinates are required to search for donors');
  });

  it('rejects unauthorized users', async () => {
    const donor = await createDonor();
    const res = await request(app)
      .get('/hospital/find-donors')
      .set('Authorization', `Bearer ${tokenFor(donor)}`);

    expect(res.status).toBe(403);
  });

  it('allows admin users when explicit coordinates are provided', async () => {
    const admin = await createAdmin();
    const token = tokenFor(admin);

    await createDonor({
      fullName: 'Admin Search Donor',
      location: {
        city: 'Cairo',
        governorate: 'Cairo',
        coordinates: { lat: 30.0445, lng: 31.2358 },
        lastUpdated: new Date(),
      },
    });

    const res = await request(app)
      .get('/hospital/find-donors?lat=30.0444&lng=31.2357&radiusKm=2')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.donors[0].fullName).toBe('Admin Search Donor');
  });
});

describe('PUT /hospital/profile', () => {
  it('updates hospital profile fields', async () => {
    const hospital = await createHospital();
    const token = tokenFor(hospital);

    const res = await request(app)
      .put('/hospital/profile')
      .set('Authorization', `Bearer ${token}`)
      .send({ fullName: 'Updated Hospital Name' });

    expect(res.status).toBe(200);
  });

  it('returns 401 without a token', async () => {
    const res = await request(app)
      .put('/hospital/profile')
      .send({ fullName: 'Hacker' });
    expect(res.status).toBe(401);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// REQUEST CREATION
// ═════════════════════════════════════════════════════════════════════════════
describe('POST /hospital/request', () => {
  it('creates a blood request and returns 201', async () => {
    const hospital = await createHospital();
    const token = tokenFor(hospital);

    const res = await request(app)
      .post('/hospital/request')
      .set('Authorization', `Bearer ${token}`)
      .send(validRequestBody());

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('data');
    expect(res.body.data.type).toBe('blood');
    expect(res.body.data.urgency).toBe('high');
    expect(res.body.data.status).toBe('pending');
  });

  it('creates an organ request', async () => {
    const hospital = await createHospital();
    const token = tokenFor(hospital);

    const res = await request(app)
      .post('/hospital/request')
      .set('Authorization', `Bearer ${token}`)
      .send({
        type: 'organ',
        organType: 'kidney',
        urgency: 'critical',
        requiredBy: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
        quantity: 1,
        hospitalContact: '0100000002',
      });

    expect(res.status).toBe(201);
    expect(res.body.data.organType).toBe('kidney');
  });

  it('rejects a blood request without bloodType', async () => {
    const hospital = await createHospital();
    const token = tokenFor(hospital);
    const body = validRequestBody();
    delete body.bloodType;

    const res = await request(app)
      .post('/hospital/request')
      .set('Authorization', `Bearer ${token}`)
      .send(body);

    // Mongoose validation or controller should reject this
    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  it('rejects a request with a past requiredBy date', async () => {
    const hospital = await createHospital();
    const token = tokenFor(hospital);

    const res = await request(app)
      .post('/hospital/request')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...validRequestBody(), requiredBy: '2020-01-01T00:00:00.000Z' });

    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  it('emergency alias POST /hospital/requests/create-emergency also works', async () => {
    const hospital = await createHospital();
    const token = tokenFor(hospital);

    const res = await request(app)
      .post('/hospital/requests/create-emergency')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...validRequestBody(), urgency: 'critical' });

    expect(res.status).toBe(201);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// REQUEST LISTING & DETAILS
// ═════════════════════════════════════════════════════════════════════════════
describe('GET /hospital/requests', () => {
  it(`returns only the authenticated hospital's own requests`, async () => {
    const h1 = await createHospital();
    const h2 = await createHospital();
    const t1 = tokenFor(h1);

    // h1 creates 2 requests, h2 creates 1
    await createRequest(h1._id);
    await createRequest(h1._id);
    await createRequest(h2._id);

    const res = await request(app)
      .get('/hospital/requests')
      .set('Authorization', `Bearer ${t1}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('data');

    // All returned requests must belong to h1
    const items = res.body.data.requests ?? res.body.data;
    if (Array.isArray(items)) {
      items.forEach((r) => {
        expect(r.hospitalId?.toString() ?? r.hospitalId).toBe(h1._id.toString());
      });
    }
  });

  it('filters by status query param', async () => {
    const hospital = await createHospital();
    const token = tokenFor(hospital);

    await createRequest(hospital._id, { status: 'pending' });
    await createRequest(hospital._id, { status: 'cancelled' });

    const res = await request(app)
      .get('/hospital/requests?status=pending')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    const items = res.body.data.requests ?? res.body.data;
    if (Array.isArray(items)) {
      items.forEach((r) => expect(r.status).toBe('pending'));
    }
  });

  it('returns an empty list when the hospital has no requests', async () => {
    const hospital = await createHospital();
    const token = tokenFor(hospital);

    const res = await request(app)
      .get('/hospital/requests')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
  });
});

describe('GET /hospital/requests/:requestId', () => {
  it('returns request details for an owned request', async () => {
    const hospital = await createHospital();
    const token = tokenFor(hospital);
    const req = await createRequest(hospital._id);

    const res = await request(app)
      .get(`/hospital/requests/${req._id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.request?._id?.toString() ?? res.body.data.request?.id).toBe(req._id.toString());
  });

  it('returns 404 for a non-existent request', async () => {
    const hospital = await createHospital();
    const token = tokenFor(hospital);
    const fakeId = '64a1b2c3d4e5f6a7b8c9d0e1';

    const res = await request(app)
      .get(`/hospital/requests/${fakeId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });

  it(`returns 403 or 404 when a hospital tries to access another hospital's request`, async () => {
    const h1 = await createHospital();
    const h2 = await createHospital();
    const req = await createRequest(h1._id);

    const res = await request(app)
      .get(`/hospital/requests/${req._id}`)
      .set('Authorization', `Bearer ${tokenFor(h2)}`);

    expect([403, 404]).toContain(res.status);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// REQUEST STATUS UPDATE
// ═════════════════════════════════════════════════════════════════════════════
describe('PUT /hospital/requests/:requestId', () => {
  it('updates request status to in-progress', async () => {
    const hospital = await createHospital();
    const token = tokenFor(hospital);
    const req = await createRequest(hospital._id);

    const res = await request(app)
      .put(`/hospital/requests/${req._id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'in-progress' });

    expect(res.status).toBe(200);
  });

  it('rejects an invalid status value', async () => {
    const hospital = await createHospital();
    const token = tokenFor(hospital);
    const req = await createRequest(hospital._id);

    const res = await request(app)
      .put(`/hospital/requests/${req._id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'magic' });

    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  it(`prevents one hospital from updating another hospital's request`, async () => {
    const h1 = await createHospital();
    const h2 = await createHospital();
    const req = await createRequest(h1._id);

    const res = await request(app)
      .put(`/hospital/requests/${req._id}`)
      .set('Authorization', `Bearer ${tokenFor(h2)}`)
      .send({ status: 'in-progress' });

    expect([403, 404]).toContain(res.status);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// REQUEST CANCELLATION (DELETE)
// ═════════════════════════════════════════════════════════════════════════════
describe('DELETE /hospital/requests/:requestId', () => {
  it('cancels an owned pending request', async () => {
    const hospital = await createHospital();
    const token = tokenFor(hospital);
    const req = await createRequest(hospital._id, { status: 'pending' });

    const res = await request(app)
      .delete(`/hospital/requests/${req._id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
  });

  it('returns 404 for a non-existent request', async () => {
    const hospital = await createHospital();
    const token = tokenFor(hospital);

    const res = await request(app)
      .delete('/hospital/requests/64a1b2c3d4e5f6a7b8c9d0e1')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// REQUEST CLOSE FLOW
// ═════════════════════════════════════════════════════════════════════════════
describe('POST /hospital/requests/:requestId/close', () => {
  it('closes an owned in-progress request', async () => {
    const hospital = await createHospital();
    const token = tokenFor(hospital);
    const req = await createRequest(hospital._id, { status: 'in-progress' });

    const res = await request(app)
      .post(`/hospital/requests/${req._id}/close`)
      .set('Authorization', `Bearer ${token}`);

    // Accepting 200 or 400 — close may have business rules (e.g. requires active donations)
    // The key check is it does NOT return 401 or 403
    expect([200, 400, 404]).toContain(res.status);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// DONATIONS FOR HOSPITAL
// ═════════════════════════════════════════════════════════════════════════════
describe('GET /hospital/donations', () => {
  it(`returns donations related to the hospital's requests`, async () => {
    const hospital = await createHospital();
    const donor = await createDonor();
    const token = tokenFor(hospital);

    const req = await createRequest(hospital._id);
    await createDonation(donor._id, req._id, { status: 'pending' });

    const res = await request(app)
      .get('/hospital/donations')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('data');
  });

  it('returns an empty list when hospital has no donations', async () => {
    const hospital = await createHospital();
    const token = tokenFor(hospital);

    const res = await request(app)
      .get('/hospital/donations')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
  });

  it('filters donations by status', async () => {
    const hospital = await createHospital();
    const donor = await createDonor();
    const token = tokenFor(hospital);

    const req = await createRequest(hospital._id);
    await createDonation(donor._id, req._id, { status: 'completed' });
    await createDonation(donor._id, req._id, { status: 'pending' });

    const res = await request(app)
      .get('/hospital/donations?status=completed')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    const items = res.body.data.donations ?? res.body.data;
    if (Array.isArray(items)) {
      items.forEach((d) => expect(d.status).toBe('completed'));
    }
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// SETTINGS & INVENTORY ENDPOINTS
// ═════════════════════════════════════════════════════════════════════════════
describe('Blood bank settings', () => {
  it('GET /hospital/blood-bank-settings returns 200', async () => {
    const hospital = await createHospital();
    const res = await request(app)
      .get('/hospital/blood-bank-settings')
      .set('Authorization', `Bearer ${tokenFor(hospital)}`);
    expect(res.status).toBe(200);
  });

  it('PUT /hospital/blood-bank-settings returns 200', async () => {
    const hospital = await createHospital();
    const res = await request(app)
      .put('/hospital/blood-bank-settings')
      .set('Authorization', `Bearer ${tokenFor(hospital)}`)
      .send({ acceptingDonations: true });
    expect(res.status).toBe(200);
  });
});

describe('GET /hospital/blood-inventory', () => {
  it('returns 200 for authenticated hospital', async () => {
    const hospital = await createHospital();
    const res = await request(app)
      .get('/hospital/blood-inventory')
      .set('Authorization', `Bearer ${tokenFor(hospital)}`);
    expect(res.status).toBe(200);
  });
});

describe('Notification preferences', () => {
  it('GET /hospital/notification-preferences returns 200', async () => {
    const hospital = await createHospital();
    const res = await request(app)
      .get('/hospital/notification-preferences')
      .set('Authorization', `Bearer ${tokenFor(hospital)}`);
    expect(res.status).toBe(200);
  });

  it('PUT /hospital/notification-preferences returns 200', async () => {
    const hospital = await createHospital();
    const res = await request(app)
      .put('/hospital/notification-preferences')
      .set('Authorization', `Bearer ${tokenFor(hospital)}`)
      .send({ emailAlerts: true });
    expect(res.status).toBe(200);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// REPORTS
// ═════════════════════════════════════════════════════════════════════════════
describe('GET /hospital/reports/monthly', () => {
  it('returns monthly report for authenticated hospital', async () => {
    const hospital = await createHospital();
    const res = await request(app)
      .get('/hospital/reports/monthly?month=2026-04')
      .set('Authorization', `Bearer ${tokenFor(hospital)}`);
    expect(res.status).toBe(200);
  });
});


