import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import app from '../../src/app.js';
import { setupTestDB, clearDatabase } from '../helpers/db.js';
import { createDonor, createHospital, createRequest } from '../helpers/factories.js';
import { signToken } from '../../src/utils/jwt.js';
import Request from '../../src/models/Request.model.js';
import Donation from '../../src/models/Donation.model.js';
import * as stateMachine from '../../src/utils/state-machine.js';

describe('Request Details Integration', () => {
  setupTestDB();

  it('GET /requests/:id returns request details ready for Flutter', async () => {
    await clearDatabase();
    const donor = await createDonor();
    const hospital = await createHospital();
    const urgentRequest = await createRequest(hospital._id, {
      bloodType: donor.bloodType,
      urgency: 'critical',
      patientType: 'Accident Case',
      contactNumber: hospital.contactNumber,
      unitsNeeded: 3,
      isEmergency: true,
    });

    const token = signToken({ userId: donor._id.toString(), role: donor.role });

    const response = await request(app)
      .get(`/requests/${urgentRequest._id}?lat=30.0444&lng=31.2357`)
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.requestId).toBe(urgentRequest._id.toString());
    const respBlood = Array.isArray(response.body.data.bloodType)
      ? response.body.data.bloodType[0]
      : response.body.data.bloodType;
    expect(respBlood).toBe(donor.bloodType);
    expect(response.body.data.hospitalName).toContain('Test Hospital');
    expect(response.body.data.patientType).toBe('Accident Case');
    expect(response.body.data.contactNumber).toBe(hospital.contactNumber);
    expect(response.body.data.unitsNeeded).toBe(3);
    expect(response.body.data.isEmergency).toBe(true);
    expect(response.body.data.location).toEqual({ lat: 30.0511, lng: 31.2435 });
    expect(response.body.data.distanceKm).toBeDefined();
    expect(typeof response.body.data.distanceKm).toBe('number');
  });

  it('POST /requests/:id/generate-qr stores a secure token and image', async () => {
    await clearDatabase();
    const hospital = await createHospital();
    const donor = await createDonor();
    const urgentRequest = await createRequest(hospital._id, {
      bloodType: donor.bloodType,
      patientType: 'Emergency Surgery',
      contactNumber: hospital.contactNumber,
      isEmergency: true,
      urgency: 'critical',
    });

    const token = signToken({ userId: hospital._id.toString(), role: hospital.role });

    const response = await request(app)
      .post(`/requests/${urgentRequest._id}/generate-qr`)
      .set('Authorization', `Bearer ${token}`)
      .send({});

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.qrToken).toBeDefined();
    expect(response.body.data.qrImage).toMatch(/^data:image\/png;base64,/);
    expect(response.body.data.qrExpiresAt).toBeDefined();

    const detailResponse = await request(app)
      .get(`/requests/${urgentRequest._id}`)
      .set('Authorization', `Bearer ${signToken({ userId: donor._id.toString(), role: donor.role })}`);

    expect(detailResponse.status).toBe(200);
    expect(detailResponse.body.data.qrToken).toBe(response.body.data.qrToken);
  });

  it('POST /requests/verify-qr validates a generated token', async () => {
    await clearDatabase();
    const hospital = await createHospital();
    const donor = await createDonor();
    const urgentRequest = await createRequest(hospital._id, {
      bloodType: donor.bloodType,
      contactNumber: hospital.contactNumber,
      isEmergency: true,
      urgency: 'critical',
    });

    const hospitalToken = signToken({ userId: hospital._id.toString(), role: hospital.role });
    const generateResponse = await request(app)
      .post(`/requests/${urgentRequest._id}/generate-qr`)
      .set('Authorization', `Bearer ${hospitalToken}`)
      .send({});

    const verifyResponse = await request(app)
      .post('/requests/verify-qr')
      .set('Authorization', `Bearer ${hospitalToken}`)
      .send({ qrToken: generateResponse.body.data.qrToken });

    expect(verifyResponse.status).toBe(200);
    expect(verifyResponse.body.success).toBe(true);
    expect(verifyResponse.body.data.valid).toBe(true);
    expect(verifyResponse.body.data.requestId).toBe(urgentRequest._id.toString());
    expect(verifyResponse.body.data.hospitalName).toContain('Test Hospital');
  });

  it('GET /requests/nearby filters by radius and sorts by distance', async () => {
    await clearDatabase();
    const donor = await createDonor({
      location: {
        city: 'Cairo',
        governorate: 'Cairo',
        coordinates: { lat: 30.0444, lng: 31.2357 },
        lastUpdated: new Date(),
      },
    });

    const nearHospital = await createHospital({
      location: {
        city: 'Cairo',
        governorate: 'Cairo',
        coordinates: { lat: 30.05, lng: 31.24 },
        lastUpdated: new Date(),
      },
    });

    const farHospital = await createHospital({
      location: {
        city: 'Alexandria',
        governorate: 'Alexandria',
        coordinates: { lat: 31.2, lng: 29.95 },
        lastUpdated: new Date(),
      },
    });

    const nearRequest = await createRequest(nearHospital._id, {
      bloodType: donor.bloodType,
      urgency: 'critical',
      isEmergency: true,
      locationHospital: {
        latitude: nearHospital.location.coordinates.lat,
        longitude: nearHospital.location.coordinates.lng,
      },
      hospitalLocation: {
        lat: nearHospital.location.coordinates.lat,
        lng: nearHospital.location.coordinates.lng,
      },
      hospitalLocationGeo: {
        type: 'Point',
        coordinates: [nearHospital.location.coordinates.lng, nearHospital.location.coordinates.lat],
      },
    });
    await createRequest(farHospital._id, {
      bloodType: donor.bloodType,
      urgency: 'critical',
      isEmergency: true,
      locationHospital: {
        latitude: farHospital.location.coordinates.lat,
        longitude: farHospital.location.coordinates.lng,
      },
      hospitalLocation: {
        lat: farHospital.location.coordinates.lat,
        lng: farHospital.location.coordinates.lng,
      },
      hospitalLocationGeo: {
        type: 'Point',
        coordinates: [farHospital.location.coordinates.lng, farHospital.location.coordinates.lat],
      },
    });

    const token = signToken({ userId: donor._id.toString(), role: donor.role });

    const response = await request(app)
      .get('/requests/nearby?lat=30.0444&lng=31.2357&radius=10')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(Array.isArray(response.body.data.requests)).toBe(true);
    expect(response.body.data.requests.length).toBe(1);
    expect(response.body.data.requests[0].requestId).toBe(nearRequest._id.toString());
    expect(response.body.data.requests[0].distanceKm).toBeDefined();
    expect(typeof response.body.data.requests[0].distanceKm).toBe('number');
  });

  it('POST /requests/:id/accept and /cancel manage request status', async () => {
    await clearDatabase();
    const donor = await createDonor();
    const hospital = await createHospital();
    const urgentRequest = await createRequest(hospital._id, {
      bloodType: donor.bloodType,
      contactNumber: hospital.contactNumber,
      isEmergency: true,
      urgency: 'critical',
    });

    const donorToken = signToken({ userId: donor._id.toString(), role: donor.role });

    const acceptResponse = await request(app)
      .post(`/requests/${urgentRequest._id}/accept`)
      .set('Authorization', `Bearer ${donorToken}`)
      .send({});

    expect(acceptResponse.status).toBe(200);
    expect(acceptResponse.body.data.request.status).toBe('accepted');
    expect(acceptResponse.body.data.donor.id).toBe(donor._id.toString());

    const cancelResponse = await request(app)
      .post(`/requests/${urgentRequest._id}/cancel`)
      .set('Authorization', `Bearer ${donorToken}`)
      .send({});

    expect(cancelResponse.status).toBe(200);
    expect(cancelResponse.body.data.request.status).toBe('cancelled');

    const stored = await Request.findById(urgentRequest._id);
    expect(stored.status).toBe('cancelled');
  });

  it('POST /requests/:id/accept rolls back when orphan validation fails', async () => {
    await clearDatabase();
    const donor = await createDonor();
    const hospital = await createHospital();
    const urgentRequest = await createRequest(hospital._id, {
      bloodType: donor.bloodType,
      contactNumber: hospital.contactNumber,
      isEmergency: true,
      urgency: 'critical',
    });

    const donorToken = signToken({ userId: donor._id.toString(), role: donor.role });
    const orphanSpy = vi.spyOn(stateMachine, 'validateOrphanState').mockImplementation(() => {
      throw new Error('Injected orphan validation failure');
    });

    try {
      const acceptResponse = await request(app)
        .post(`/requests/${urgentRequest._id}/accept`)
        .set('Authorization', `Bearer ${donorToken}`)
        .send({});

      expect(acceptResponse.status).toBe(500);

      const storedRequest = await Request.findById(urgentRequest._id);
      const storedDonation = await Donation.findOne({ requestId: urgentRequest._id, donorId: donor._id });

      expect(storedRequest.status).toBe('pending');
      expect(storedRequest.acceptedBy).toBeNull();
      expect(storedRequest.acceptedDonationId).toBeNull();
      expect(storedDonation).toBeNull();
      expect(await Donation.countDocuments({ requestId: urgentRequest._id })).toBe(0);
    } finally {
      orphanSpy.mockRestore();
      vi.restoreAllMocks();
    }
  });
});
