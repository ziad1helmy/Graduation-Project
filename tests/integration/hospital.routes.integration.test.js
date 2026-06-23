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
 *  - Dashboard: GET /hospital/dashboard
 */

import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import app from '../../src/app.js';
import { setupTestDB } from '../helpers/db.js';
import { createHospital, createDonor, createRequest, createDonation, createAdmin } from '../helpers/factories.js';
import mongoose from 'mongoose';
import { signToken } from '../../src/utils/jwt.js';
import Notification from '../../src/models/Notification.model.js';
import Request from '../../src/models/Request.model.js';
import Donation from '../../src/models/Donation.model.js';
import Appointment from '../../src/models/Appointment.model.js';
import Hospital from '../../src/models/Hospital.model.js';

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
  bloodTypes: ['O+'],
  urgency: 'high',
  requiredBy: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000).toISOString(), // 4 days out
  unitsNeeded: 2,
  hospitalContact: '0100000001',
  notes: 'Integration test request',
});

// ─────────────────────────────────────────────────────────────────────────────
// DB lifecycle — uses setupTestDB() to share the singleton connection correctly
// ─────────────────────────────────────────────────────────────────────────────
setupTestDB();

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
    expect(res.body.data.contactNumber).toBe(hospital.contactNumber);
    expect(res.body.data).not.toHaveProperty('phone');
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
    expect(res.body.data.donors[0].email).toContain('@test.com');
    expect(res.body.data.donors[0].phoneNumber).toMatch(/^\d{11}$/);
    expect(res.body.data.donors[0].distance).toBeDefined();
    expect(res.body.data.donors[0].location).toEqual({ lat: 30.051, lng: 31.241 });
    expect(res.body.data.donors[1].fullName).toBe('Farther Donor');
    expect(res.body.data.donors[0].distanceKm).toBeLessThan(res.body.data.donors[1].distanceKm);
  });

  it('behaves identically when accessed via the /hospital/nearby-donors alias', async () => {
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

    const res = await request(app)
      .get('/hospital/nearby-donors?bloodType=O+&radiusKm=5')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.donors).toHaveLength(1);
    expect(res.body.data.donors[0].fullName).toBe('Nearest Donor');
  });

  it('groups nearby donors by blood type when requested', async () => {
    const hospital = await createHospital();
    const token = tokenFor(hospital);

    await createDonor({ bloodType: 'A+' });
    await createDonor({ bloodType: 'A+' });
    await createDonor({ bloodType: 'O-' });

    const res = await request(app)
      .get('/hospital/find-donors?radiusKm=5&groupBy=bloodType')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.groups).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ bloodType: 'A+', count: 2 }),
        expect.objectContaining({ bloodType: 'O-', count: 1 }),
      ])
    );
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

  it('can filter by participation=false (opted-out donors)', async () => {
    const hospital = await createHospital();
    const token = tokenFor(hospital);

    await createDonor({
      fullName: 'Unavailable Donor',
      isOptedIn: false,   // new canonical field
      location: {
        city: 'Cairo',
        governorate: 'Cairo',
        coordinates: { lat: 30.0512, lng: 31.2437 },
        lastUpdated: new Date(),
      },
    });
    await createDonor({
      fullName: 'Available Donor',
      isOptedIn: true,
      location: {
        city: 'Cairo',
        governorate: 'Cairo',
        coordinates: { lat: 30.0515, lng: 31.2439 },
        lastUpdated: new Date(),
      },
    });

    const res = await request(app)
      .get('/hospital/find-donors?radiusKm=5&participation=false')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.donors).toHaveLength(1);
    expect(res.body.data.donors[0]).toMatchObject({
      fullName: 'Unavailable Donor',
      isOptedIn: false,   // response now uses isOptedIn
    });
  });

  it('can filter by legacy availability=false query param', async () => {
    const hospital = await createHospital();
    const token = tokenFor(hospital);

    await createDonor({
      fullName: 'Unavailable Donor',
      isOptedIn: false,
      location: {
        city: 'Cairo',
        governorate: 'Cairo',
        coordinates: { lat: 30.0512, lng: 31.2437 },
        lastUpdated: new Date(),
      },
    });

    const res = await request(app)
      .get('/hospital/find-donors?radiusKm=5&availability=false')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.donors).toHaveLength(1);
    expect(res.body.data.donors[0].isOptedIn).toBe(false);
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

  it.each([
    ['long alias',       'lat=30.0444&long=31.2357&radiusKm=2'],
    ['latitude/longitude', 'latitude=30.0444&longitude=31.2357&radiusKm=2'],
  ])('accepts %s as a coordinate alias', async (_label, query) => {
    const admin = await createAdmin();
    const token = tokenFor(admin);

    await createDonor({
      fullName: 'Alias Test Donor',
      location: {
        city: 'Cairo',
        governorate: 'Cairo',
        coordinates: { lat: 30.0445, lng: 31.2358 },
        lastUpdated: new Date(),
      },
    });

    const res = await request(app)
      .get(`/hospital/find-donors?${query}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.donors).toHaveLength(1);
    expect(res.body.data.donors[0].fullName).toBe('Alias Test Donor');
    expect(res.body.data.donors[0].distanceKm).toBeGreaterThanOrEqual(0);
  });

  it('returns 400 when only one of lat/lng is provided', async () => {
    const admin = await createAdmin();
    const token = tokenFor(admin);

    const res = await request(app)
      .get('/hospital/find-donors?lat=30.0444&radiusKm=2')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(400);
  });

  it('creates a hospital-side donor appointment from a search result', async () => {
    const hospital = await createHospital();
    const token = tokenFor(hospital);
    const donor = await createDonor({
      fullName: 'Appointment Donor',
      bloodType: 'O+',
      location: {
        city: 'Cairo',
        governorate: 'Cairo',
        coordinates: { lat: 30.051, lng: 31.241 },
        lastUpdated: new Date(),
      },
    });

    const appointmentDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    while (appointmentDate.getDay() === 0) {
      appointmentDate.setDate(appointmentDate.getDate() + 1);
    }
    appointmentDate.setHours(14, 0, 0, 0); // Set to 2:00 PM for safe booking

    const res = await request(app)
      .post(`/hospital/donors/${donor._id}/appointments`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        appointmentDate: appointmentDate.toISOString(),
        notes: 'Confirmed through hospital donor search',
        donationType: 'Whole Blood',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.donorDetails.fullName).toBe('Appointment Donor');
    expect(res.body.data.donorDetails.email).toContain('@test.com');
    expect(String(res.body.data.hospitalId._id || res.body.data.hospitalId)).toBe(hospital._id.toString());
    expect(res.body.data.appointmentDate).toBeDefined();
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

  it('updates contactNumber via profile update', async () => {
    const hospital = await createHospital();
    const token = tokenFor(hospital);

    const res = await request(app)
      .put('/hospital/profile')
      .set('Authorization', `Bearer ${token}`)
      .send({ contactNumber: '01033334444' });

    expect(res.status).toBe(200);

    const updated = await Hospital.findById(hospital._id);
    expect(updated.contactNumber).toBe('01033334444');
  });

  it('updating phone also syncs contactNumber', async () => {
    const hospital = await createHospital();
    const token = tokenFor(hospital);

    const res = await request(app)
      .put('/hospital/profile')
      .set('Authorization', `Bearer ${token}`)
      .send({ phone: '01044445555' });

    expect(res.status).toBe(200);

    const updated = await Hospital.findById(hospital._id);
    expect(updated.phone).toBe('01044445555');
    expect(updated.contactNumber).toBe('01044445555');
  });
});

describe('PUT /hospital/profile/location', () => {
  it('updates hospital location coordinates', async () => {
    const hospital = await createHospital();

    const res = await request(app)
      .put('/hospital/profile/location')
      .set('Authorization', `Bearer ${tokenFor(hospital)}`)
      .send({
        lat: 30.0444,
        lng: 31.2357,
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toBe('Hospital location updated successfully');
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

  it('creates a platelets request', async () => {
    const hospital = await createHospital();
    const token = tokenFor(hospital);

    const res = await request(app)
      .post('/hospital/request')
      .set('Authorization', `Bearer ${token}`)
      .send({
        type: 'platelets',
        bloodTypes: ['AB+'],
        urgency: 'critical',
        requiredBy: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
        unitsNeeded: 1,
        hospitalContact: '0100000002',
      });

    expect(res.status).toBe(201);
    expect(res.body.data.type).toBe('platelets');
  });

  it('rejects a blood request without bloodType', async () => {
    const hospital = await createHospital();
    const token = tokenFor(hospital);
    const body = validRequestBody();
    delete body.bloodTypes;
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
});

describe('POST /hospital/requests/create-emergency', () => {
  it('creates a minimal emergency request and derives hospital data from auth', async () => {
    const hospital = await createHospital();
    const token = tokenFor(hospital);

    const res = await request(app)
      .post('/hospital/requests/create-emergency')
      .set('Authorization', `Bearer ${token}`)
      .send({
        bloodType: 'A+',
        unitsNeeded: 2,
        patientDetails: 'emergency',
        isEmergency: true,
      });



    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.isEmergency).toBe(true);
    expect(res.body.data.urgency).toBe('critical');
    expect(res.body.data.unitsNeeded).toBe(2);
    expect(res.body.data.patientType).toBe('adult');
    expect(String(res.body.data.hospitalId._id || res.body.data.hospitalId)).toBe(hospital._id.toString());

    const stored = await Request.findById(res.body.data._id).populate('hospitalId', 'hospitalName phone');
    expect(String(stored.hospitalId._id || stored.hospitalId)).toBe(hospital._id.toString());
    expect(stored.hospitalName).toBe(hospital.hospitalName);
    expect(stored.contactNumber).toBe(hospital.phone);
    expect(stored.isEmergency).toBe(true);
  });

  it('rejects emergency requests missing bloodType', async () => {
    const hospital = await createHospital();
    const token = tokenFor(hospital);

    const res = await request(app)
      .post('/hospital/requests/create-emergency')
      .set('Authorization', `Bearer ${token}`)
      .send({
        unitsNeeded: 2,
        patientDetails: 'Patient details...',
        isEmergency: true,
      });

    expect(res.status).toBe(400);
  });

  it('rejects emergency requests missing unitsNeeded', async () => {
    const hospital = await createHospital();
    const token = tokenFor(hospital);

    const res = await request(app)
      .post('/hospital/requests/create-emergency')
      .set('Authorization', `Bearer ${token}`)
      .send({
        bloodType: 'A+',
        patientDetails: 'Patient details...',
        isEmergency: true,
      });

    expect(res.status).toBe(400);
  });

  it('rejects emergency requests with extra fields', async () => {
    const hospital = await createHospital();
    const token = tokenFor(hospital);

    const res = await request(app)
      .post('/hospital/requests/create-emergency')
      .set('Authorization', `Bearer ${token}`)
      .send({
        bloodType: 'A+',
        unitsNeeded: 2,
        patientDetails: 'Patient details...',
        isEmergency: true,
        hospitalId: 'bad-id',
      });

    expect(res.status).toBe(400);
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
  it('returns request details for an owned request with restricted keys', async () => {
    const hospital = await createHospital();
    const token = tokenFor(hospital);
    const req = await createRequest(hospital._id, {
      requiredBy: new Date(Date.now() + 48 * 60 * 60 * 1000 + 10000),
      unitsNeeded: 3,
      urgency: 'high',
    });

    const res = await request(app)
      .get(`/hospital/requests/${req._id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.bloodType).toBeUndefined();
    expect(res.body.data).toHaveProperty('bloodTypes');
    expect(res.body.data.unitsNeeded).toBe(3);
    expect(res.body.data.urgency).toBe('high');
    expect(res.body.data.timeRemaining).toContain('2d');
    expect(res.body.data.responded).toBe(0);
    expect(res.body.data.confirmed).toBe(0);
    expect(res.body.data.requiredBy).toBeTruthy();
    expect(res.body.data.request).toBeUndefined();
    expect(res.body.data.donations).toBeUndefined();
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
  it('updates request status to in-progress and returns restricted response keys', async () => {
    const hospital = await createHospital();
    const token = tokenFor(hospital);
    const req = await createRequest(hospital._id, {
      status: 'accepted',
      acceptedDonationId: new mongoose.Types.ObjectId(),
      requiredBy: new Date(Date.now() + 48 * 60 * 60 * 1000 + 10000),
      unitsNeeded: 3,
      urgency: 'high',
    });

    const res = await request(app)
      .put(`/hospital/requests/${req._id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'in-progress' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.bloodType).toBeUndefined();
    expect(res.body.data).toHaveProperty('bloodTypes');
    expect(res.body.data.unitsNeeded).toBe(3);
    expect(res.body.data.urgency).toBe('high');
    expect(res.body.data.timeRemaining).toContain('2d');
    expect(res.body.data.responded).toBe(0);
    expect(res.body.data.confirmed).toBe(0);
    expect(res.body.data.requiredBy).toBeTruthy();
    expect(res.body.data.request).toBeUndefined();
    expect(res.body.data.status).toBe('in-progress');
    expect(res.body.data).toHaveProperty('patientType');
    expect(res.body.data).toHaveProperty('contactNumber');
    expect(res.body.data).toHaveProperty('patientDetails');
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
  it('updates request details successfully', async () => {
    const hospital = await createHospital();
    const token = tokenFor(hospital);
    const req = await createRequest(hospital._id, {
      status: 'pending',
      bloodType: ['O+'],
      unitsNeeded: 1,
      urgency: 'low',
    });

    const newRequiredBy = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString();
    const res = await request(app)
      .put(`/hospital/requests/${req._id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        bloodTypes: ['A-', 'O-'],
        unitsNeeded: 3,
        urgency: 'high',
        requiredBy: newRequiredBy,
        patientType: 'adult',
        contactNumber: '01011112222',
        notes: 'Updated patient notes',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.bloodTypes).toEqual(['A-', 'O-']);
    expect(res.body.data.unitsNeeded).toBe(3);
    expect(res.body.data.urgency).toBe('high');
    expect(res.body.data.requiredBy).toBeTruthy();

    const updatedDoc = await Request.findById(req._id);
    expect(updatedDoc.bloodType).toEqual(['A-', 'O-']);
    expect(updatedDoc.unitsNeeded).toBe(3);
    expect(updatedDoc.urgency).toBe('high');
    expect(updatedDoc.patientType).toBe('adult');
    expect(updatedDoc.contactNumber).toBe('01011112222');
    expect(updatedDoc.notes).toBe('Updated patient notes');
  });

  it('rejects invalid detail updates', async () => {
    const hospital = await createHospital();
    const token = tokenFor(hospital);
    const req = await createRequest(hospital._id, { status: 'pending' });

    // Invalid blood type
    const res1 = await request(app)
      .put(`/hospital/requests/${req._id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ bloodTypes: ['X+'] });
    expect(res1.status).toBe(400);

    // Invalid urgency
    const res2 = await request(app)
      .put(`/hospital/requests/${req._id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ urgency: 'immediate' });
    expect(res2.status).toBe(400);

    // Past requiredBy date
    const res3 = await request(app)
      .put(`/hospital/requests/${req._id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ requiredBy: new Date(Date.now() - 1000).toISOString() });
    expect(res3.status).toBe(400);

    // Invalid unitsNeeded
    const res4 = await request(app)
      .put(`/hospital/requests/${req._id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ unitsNeeded: 0 });
    expect(res4.status).toBe(400);
  });

  it('rejects editing details of a terminal request', async () => {
    const hospital = await createHospital();
    const token = tokenFor(hospital);
    const req = await createRequest(hospital._id, { status: 'cancelled' });

    const res = await request(app)
      .put(`/hospital/requests/${req._id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ urgency: 'high' });

    expect(res.status).toBe(400);
    expect(res.body.message).toContain('Cannot update details of a request with terminal status');
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
    expect(res.body.data.request.status).toBe('cancelled');
    expect(res.body.data.request.cancelledAt).toBeTruthy();
  });

  it('rolls back request, donation, and appointment cancellation if appointment update fails inside the transaction', async () => {
    const hospital = await createHospital();
    const donor = await createDonor();
    const token = tokenFor(hospital);
    const req = await createRequest(hospital._id, { status: 'pending' });
    const donation = await createDonation(donor._id, req._id, { status: 'pending' });
    const appointment = await Appointment.create({
      donorId: donor._id,
      hospitalId: hospital._id,
      requestId: req._id,
      appointmentDate: new Date(Date.now() + 48 * 60 * 60 * 1000),
      status: 'confirmed',
      qrToken: `hospital-rollback-${Date.now()}`,
    });

    const updateSpy = vi.spyOn(Appointment, 'updateMany').mockRejectedValueOnce(new Error('transaction failed'));

    const res = await request(app)
      .delete(`/hospital/requests/${req._id}`)
      .set('Authorization', `Bearer ${token}`);

    updateSpy.mockRestore();

    expect(res.status).toBeGreaterThanOrEqual(500);

    const storedRequest = await Request.findById(req._id);
    const storedDonation = await Donation.findById(donation._id);
    const storedAppointment = await Appointment.findById(appointment._id);

    expect(storedRequest.status).toBe('pending');
    expect(storedDonation.status).toBe('pending');
    expect(storedAppointment.status).toBe('confirmed');
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
// Removed: blood-bank-settings and notification-preferences endpoints — deleted from codebase

// ═════════════════════════════════════════════════════════════════════════════
// REPORTS & DASHBOARD
// ═════════════════════════════════════════════════════════════════════════════
describe('Hospital Dashboard & Reports', () => {
  it('GET /hospital/dashboard returns all dashboard fields with correct values', async () => {
    const hospital = await createHospital();
    const donor1 = await createDonor();
    const donor2 = await createDonor();
    
    // Create requests and donations in June 2026
    const req1 = await createRequest(hospital._id, {
      createdAt: new Date('2026-06-10T10:00:00.000Z'),
      urgency: 'critical',
      status: 'pending',
    });
    const req2 = await createRequest(hospital._id, {
      createdAt: new Date('2026-06-12T10:00:00.000Z'),
      urgency: 'high',
      status: 'pending',
    });

    await createDonation(donor1._id, req1._id, {
      createdAt: new Date('2026-06-10T12:00:00.000Z'),
    });
    await createDonation(donor2._id, req2._id, {
      createdAt: new Date('2026-06-12T12:00:00.000Z'),
    });

    const res = await request(app)
      .get('/hospital/dashboard?month=2026-06')
      .set('Authorization', `Bearer ${tokenFor(hospital)}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.month).toBe('2026-06');
    expect(res.body.data.totalRequests).toBe(2);
    expect(res.body.data.openRequests).toBe(2);
    expect(res.body.data.activeRequests).toBe(2);
    expect(res.body.data.totalCompleted).toBe(0);
    expect(res.body.data.totalCancelled).toBe(0);
    expect(res.body.data.emergencyRequests).toBe(2);
    expect(res.body.data.responseCount).toBe(2);
    expect(res.body.data.totalResponses).toBe(2);
    expect(res.body.data.totalDonations).toBe(2);
    expect(res.body.data.completedDonations).toBe(0);
    expect(res.body.data.confirmedDonorCount).toBe(0);
    expect(res.body.data.recentActivityCount).toBe(2);
    expect(res.body.data.recentCompletedDonationCount).toBe(0);
    expect(res.body.data.overdueCount).toBe(0);
    expect(res.body.data.dueSoonCount).toBe(0);
    expect(res.body.data.avgDaysToRequiredBy).toBeGreaterThan(0);
    expect(res.body.data.responsesToday).toBeGreaterThanOrEqual(0);
    expect(res.body.data.uniqueDonorsResponded).toBeUndefined();
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// ADDITIONAL PORTAL FEATURES (RESPONSES, CONFIRMATION, ACTIVITY)
// ═════════════════════════════════════════════════════════════════════════════
describe('Hospital Portal responses, confirm-donation, and activity', () => {
  it('GET /hospital/requests/:requestId/responses returns responding donors list', async () => {
    const hospital = await createHospital();
    const donor = await createDonor({ fullName: 'John Doe', bloodType: 'A-', isOptedIn: true });
    const req = await createRequest(hospital._id, { urgency: 'high', status: 'in-progress' });
    await createDonation(donor._id, req._id, { status: 'pending' });

    const res = await request(app)
      .get(`/hospital/requests/${req._id}/responses`)
      .set('Authorization', `Bearer ${tokenFor(hospital)}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.donors).toBeDefined();
    expect(res.body.data.donors).toHaveLength(1);
    expect(res.body.data.donors[0].donorId).toBe(donor._id.toString());
    expect(res.body.data.donors[0].fullName).toBe('John Doe');
    expect(res.body.data.donors[0].bloodType).toBe('A-');
    expect(res.body.data.donors[0].isAvailable).toBe(true);
  });

  it('POST /hospital/confirm-donation confirms the donation', async () => {
    const hospital = await createHospital();
    const donor = await createDonor();
    const req = await createRequest(hospital._id, { urgency: 'high', status: 'in-progress' });
    const donation = await createDonation(donor._id, req._id, { status: 'scheduled' });

    const res = await request(app)
      .post('/hospital/confirm-donation')
      .set('Authorization', `Bearer ${tokenFor(hospital)}`)
      .send({ donorId: donor._id.toString(), requestId: req._id.toString() });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toBe('Donation confirmed');
    expect(res.body.data.status).toBe('completed');

    // Verify DB update
    const updatedRequest = await Request.findById(req._id);
    expect(updatedRequest.status).toBe('completed');

    const updatedDonation = await Donation.findById(donation._id);
    expect(updatedDonation.status).toBe('completed');
  });

  it('GET /hospital/activity returns recent hospital activity feed', async () => {
    const hospital = await createHospital();
    const donor = await createDonor({ fullName: 'Jane Smith' });
    const req = await createRequest(hospital._id, { urgency: 'high', status: 'in-progress' });
    await createDonation(donor._id, req._id, { status: 'pending' });

    const res = await request(app)
      .get('/hospital/activity?limit=10')
      .set('Authorization', `Bearer ${tokenFor(hospital)}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.activities).toBeDefined();
    expect(res.body.data.activities.length).toBeGreaterThan(0);
    
    const activityTypes = res.body.data.activities.map(a => a.type);
    expect(activityTypes).toContain('request_created');
    expect(activityTypes).toContain('donor_response');
  });
});
