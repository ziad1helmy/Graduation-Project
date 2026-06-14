import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import app from '../../src/app.js';
import { setupTestDB, clearDatabase } from '../helpers/db.js';
import { createDonor, createHospital, createRequest } from '../helpers/factories.js';
import { signToken } from '../../src/utils/jwt.js';
import Request from '../../src/models/Request.model.js';
import Donation from '../../src/models/Donation.model.js';
import Appointment from '../../src/models/Appointment.model.js';
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
      patientType: 'accident',
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
    expect(response.body.data.patientType).toBe('accident');
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
      patientType: 'surgery',
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

    // A donor who has NOT accepted sees null — the hospital request-level QR is not their token
    const donorDetailResponse = await request(app)
      .get(`/requests/${urgentRequest._id}`)
      .set('Authorization', `Bearer ${signToken({ userId: donor._id.toString(), role: donor.role })}`);

    expect(donorDetailResponse.status).toBe(200);
    expect(donorDetailResponse.body.data.qrToken).toBeNull();

    // The hospital viewer still sees the request-level QR it generated
    const hospitalDetailResponse = await request(app)
      .get(`/requests/${urgentRequest._id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(hospitalDetailResponse.status).toBe(200);
    expect(hospitalDetailResponse.body.data.qrToken).toBe(response.body.data.qrToken);
  });

  it('POST /requests/verify-qr validates a donation QR token after donor accepts', async () => {
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
    const donorToken = signToken({ userId: donor._id.toString(), role: donor.role });

    // Donor accepts the request — creates donation with QR
    const acceptResponse = await request(app)
      .post(`/requests/${urgentRequest._id}/accept`)
      .set('Authorization', `Bearer ${donorToken}`)
      .send({});

    expect(acceptResponse.status).toBe(200);
    expect(acceptResponse.body.data.qrToken).toBeDefined();

    const qrToken = acceptResponse.body.data.qrToken;

    // Hospital verifies the QR token
    const verifyResponse = await request(app)
      .post('/requests/verify-qr')
      .set('Authorization', `Bearer ${hospitalToken}`)
      .send({ qrToken });

    expect(verifyResponse.status).toBe(200);
    expect(verifyResponse.body.success).toBe(true);
    expect(verifyResponse.body.data.valid).toBe(true);
    expect(verifyResponse.body.data.requestId).toBe(urgentRequest._id.toString());
    expect(verifyResponse.body.data.donationId).toBeDefined();
    expect(verifyResponse.body.data.hospitalName).toContain('Test Hospital');

    // Second scan should fail — QR already used
    const secondVerify = await request(app)
      .post('/requests/verify-qr')
      .set('Authorization', `Bearer ${hospitalToken}`)
      .send({ qrToken });

    expect(secondVerify.status).toBe(200);
    expect(secondVerify.body.data.valid).toBe(false);
    expect(secondVerify.body.data.message).toContain('already been used');
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

  it('POST /requests/:id/accept creates donation with QR and /cancel manages request status', async () => {
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
    expect(acceptResponse.body.data.status).toBe('accepted');
    expect(acceptResponse.body.data.requestId).toBe(urgentRequest._id.toString());
    expect(acceptResponse.body.data.donationId).toBeDefined();
    expect(acceptResponse.body.data.qrToken).toBeDefined();
    expect(acceptResponse.body.data.qrExpiresAt).toBeDefined();
    expect(acceptResponse.body.data.acceptedAt).toBeDefined();

    // Verify the stored request state
    const storedRequest = await Request.findById(urgentRequest._id);
    expect(storedRequest.status).toBe('accepted');
    expect(storedRequest.acceptedBy.toString()).toBe(donor._id.toString());

    // Verify the stored donation has QR
    const storedDonation = await Donation.findOne({ requestId: urgentRequest._id, donorId: donor._id });
    expect(storedDonation).toBeDefined();
    expect(storedDonation.qrToken).toBe(acceptResponse.body.data.qrToken);
    expect(storedDonation.arrivalDeadline).toBeDefined();

    const cancelResponse = await request(app)
      .post(`/requests/${urgentRequest._id}/cancel`)
      .set('Authorization', `Bearer ${donorToken}`)
      .send({});

    expect(cancelResponse.status).toBe(200);
    expect(cancelResponse.body.data.status).toBe('cancelled');
    expect(cancelResponse.body.data.requestId).toBe(urgentRequest._id.toString());

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

  it('POST /requests/:id/confirm completes donation and request after eligibility check', async () => {
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
    const hospitalToken = signToken({ userId: hospital._id.toString(), role: hospital.role });

    // Donor accepts the request
    const acceptResponse = await request(app)
      .post(`/requests/${urgentRequest._id}/accept`)
      .set('Authorization', `Bearer ${donorToken}`)
      .send({});

    expect(acceptResponse.status).toBe(200);

    // Hospital confirms the donation
    const confirmResponse = await request(app)
      .post(`/requests/${urgentRequest._id}/confirm`)
      .set('Authorization', `Bearer ${hospitalToken}`)
      .send({});

    expect(confirmResponse.status).toBe(200);
    expect(confirmResponse.body.data.status).toBe('completed');

    const storedRequest = await Request.findById(urgentRequest._id);
    expect(storedRequest.status).toBe('completed');

    const storedDonation = await Donation.findOne({ requestId: urgentRequest._id, donorId: donor._id });
    expect(storedDonation.status).toBe('completed');
  });

  it('GET /requests/accepted returns donor accepted requests', async () => {
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

    // Donor accepts the request
    const acceptResponse = await request(app)
      .post(`/requests/${urgentRequest._id}/accept`)
      .set('Authorization', `Bearer ${donorToken}`)
      .send({});

    expect(acceptResponse.status).toBe(200);

    // Get accepted requests
    const acceptedResponse = await request(app)
      .get('/requests/accepted')
      .set('Authorization', `Bearer ${donorToken}`);

    expect(acceptedResponse.status).toBe(200);
    expect(acceptedResponse.body.success).toBe(true);
    expect(Array.isArray(acceptedResponse.body.data.requests)).toBe(true);
    expect(acceptedResponse.body.data.requests.length).toBeGreaterThanOrEqual(1);

    const found = acceptedResponse.body.data.requests.find(
      (r) => r.requestId === urgentRequest._id.toString()
    );
    expect(found).toBeDefined();
    expect(found.status).toBe('accepted');
    expect(found.donationId).toBeDefined();
    expect(found.qrToken).toBeUndefined(); // Not returned in list view
    expect(found.hospitalName).toContain('Test Hospital');
  });

  it('GET /requests/accepted/:id returns full accepted request details', async () => {
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

    // Donor accepts the request
    const acceptResponse = await request(app)
      .post(`/requests/${urgentRequest._id}/accept`)
      .set('Authorization', `Bearer ${donorToken}`)
      .send({});

    expect(acceptResponse.status).toBe(200);

    // Get single accepted request details
    const detailsResponse = await request(app)
      .get(`/requests/accepted/${urgentRequest._id}`)
      .set('Authorization', `Bearer ${donorToken}`);

    expect(detailsResponse.status).toBe(200);
    expect(detailsResponse.body.success).toBe(true);
    expect(detailsResponse.body.data.requestId).toBe(urgentRequest._id.toString());
    expect(detailsResponse.body.data.donationId).toBeDefined();
    expect(detailsResponse.body.data.qrToken).toBeDefined();
    expect(detailsResponse.body.data.qrExpiresAt).toBeDefined();
    expect(detailsResponse.body.data.arrivalDeadline).toBeDefined();
    expect(detailsResponse.body.data.acceptedAt).toBeDefined();
    expect(detailsResponse.body.data.request).toBeDefined();
    expect(detailsResponse.body.data.request.bloodType).toBeDefined();
    expect(detailsResponse.body.data.hospital).toBeDefined();
    expect(detailsResponse.body.data.hospital.hospitalName).toContain('Test Hospital');
    expect(detailsResponse.body.data.isEligible).toBe(true);
  });

  it('GET /requests/accepted/:id rejects access by non-owner donor', async () => {
    await clearDatabase();
    const donor = await createDonor();
    const otherDonor = await createDonor({ email: 'other@test.com' });
    const hospital = await createHospital();
    const urgentRequest = await createRequest(hospital._id, {
      bloodType: donor.bloodType,
      contactNumber: hospital.contactNumber,
      isEmergency: true,
      urgency: 'critical',
    });

    const donorToken = signToken({ userId: donor._id.toString(), role: donor.role });

    // Donor accepts the request
    await request(app)
      .post(`/requests/${urgentRequest._id}/accept`)
      .set('Authorization', `Bearer ${donorToken}`)
      .send({});

    // Other donor tries to access
    const otherToken = signToken({ userId: otherDonor._id.toString(), role: otherDonor.role });
    const detailsResponse = await request(app)
      .get(`/requests/accepted/${urgentRequest._id}`)
      .set('Authorization', `Bearer ${otherToken}`);

    expect(detailsResponse.status).toBe(403);
  });

  it('GET /requests/:id returns donor-level QR code dynamically on accept/book/reschedule', async () => {
    await clearDatabase();
    const donor = await createDonor();
    const hospital = await createHospital();
    const urgentRequest = await createRequest(hospital._id, {
      bloodType: donor.bloodType,
      urgency: 'critical',
      patientType: 'accident',
      contactNumber: hospital.contactNumber,
      unitsNeeded: 3,
      isEmergency: true,
    });

    const donorToken = signToken({ userId: donor._id.toString(), role: donor.role });

    // Before accept, QR fields should be null for a donor with no active donation
    let response = await request(app)
      .get(`/requests/${urgentRequest._id}`)
      .set('Authorization', `Bearer ${donorToken}`);

    expect(response.status).toBe(200);
    expect(response.body.data.qrToken).toBeNull();
    expect(response.body.data.qrCreatedAt).toBeNull();
    expect(response.body.data.qrExpiresAt).toBeNull();

    // Donor accepts the request
    const acceptResponse = await request(app)
      .post(`/requests/${urgentRequest._id}/accept`)
      .set('Authorization', `Bearer ${donorToken}`)
      .send({});

    expect(acceptResponse.status).toBe(200);
    const donationQrToken = acceptResponse.body.data.qrToken;
    expect(donationQrToken).toBeDefined();

    // Now GET /requests/:id should return the donation's QR token
    response = await request(app)
      .get(`/requests/${urgentRequest._id}`)
      .set('Authorization', `Bearer ${donorToken}`);

    expect(response.status).toBe(200);
    expect(response.body.data.qrToken).toBe(donationQrToken);
    expect(response.body.data.qrCreatedAt).toBeDefined();
    expect(response.body.data.qrExpiresAt).toBeDefined();

    // Donor books an appointment — appointment QR should now take precedence
    const bookDate = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);
    bookDate.setHours(10, 0, 0, 0); // ensure exact hour for capacity checks
    const bookResponse = await request(app)
      .post('/donations/book-appointment')
      .set('Authorization', `Bearer ${donorToken}`)
      .send({
        hospitalId: hospital._id.toString(),
        requestId: urgentRequest._id.toString(),
        appointmentDate: bookDate.toISOString(),
        donationType: 'Whole Blood',
        notes: 'test booking',
      });

    expect(bookResponse.status).toBe(201);
    const apptQrToken = bookResponse.body.data.qrToken;
    expect(apptQrToken).toBeDefined();
    expect(apptQrToken).not.toBe(donationQrToken);

    // Now GET /requests/:id should return the appointment's QR token
    response = await request(app)
      .get(`/requests/${urgentRequest._id}`)
      .set('Authorization', `Bearer ${donorToken}`);

    expect(response.status).toBe(200);
    expect(response.body.data.qrToken).toBe(apptQrToken);

    // Donor reschedules — a new appointment QR token must be issued
    const rescheduleDate = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
    rescheduleDate.setHours(11, 0, 0, 0);
    const rescheduleResponse = await request(app)
      .patch(`/donations/book-appointment/${bookResponse.body.data._id}`)
      .set('Authorization', `Bearer ${donorToken}`)
      .send({
        appointmentDate: rescheduleDate.toISOString(),
        donationType: 'Whole Blood',
        reason: 'Change slot',
      });

    expect(rescheduleResponse.status).toBe(200);

    // Now GET /requests/:id should return the rescheduled appointment's QR token
    response = await request(app)
      .get(`/requests/${urgentRequest._id}`)
      .set('Authorization', `Bearer ${donorToken}`);

    expect(response.status).toBe(200);
    const newApptQrToken = response.body.data.qrToken;
    expect(newApptQrToken).toBeDefined();
    expect(newApptQrToken).not.toBeNull();
    expect(newApptQrToken).not.toBe(apptQrToken);
  });

  it('GET /requests/accepted/:id returns appointment QR code when donation is scheduled', async () => {
    await clearDatabase();
    const donor = await createDonor();
    const hospital = await createHospital();
    const urgentRequest = await createRequest(hospital._id, {
      bloodType: donor.bloodType,
      urgency: 'critical',
      patientType: 'accident',
      contactNumber: hospital.contactNumber,
      unitsNeeded: 3,
      isEmergency: true,
    });

    const donorToken = signToken({ userId: donor._id.toString(), role: donor.role });

    // Donor accepts
    await request(app)
      .post(`/requests/${urgentRequest._id}/accept`)
      .set('Authorization', `Bearer ${donorToken}`)
      .send({});

    // Donor books appointment
    const bookDate = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);
    bookDate.setHours(10, 0, 0, 0);
    const bookResponse = await request(app)
      .post('/donations/book-appointment')
      .set('Authorization', `Bearer ${donorToken}`)
      .send({
        hospitalId: hospital._id.toString(),
        requestId: urgentRequest._id.toString(),
        appointmentDate: bookDate.toISOString(),
        donationType: 'Whole Blood',
        notes: 'test booking',
      });

    expect(bookResponse.status).toBe(201);
    const apptQrToken = bookResponse.body.data.qrToken;

    // Get accepted details
    const detailsResponse = await request(app)
      .get(`/requests/accepted/${urgentRequest._id}`)
      .set('Authorization', `Bearer ${donorToken}`);

    expect(detailsResponse.status).toBe(200);
    expect(detailsResponse.body.data.qrToken).toBe(apptQrToken);
    expect(new Date(detailsResponse.body.data.arrivalDeadline).getTime()).toBe(new Date(bookDate).getTime());
  });
});