import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../../src/app.js';
import { setupTestDB, clearDatabase } from '../helpers/db.js';
import { createDonor, createHospital, createRequest } from '../helpers/factories.js';
import { signToken } from '../../src/utils/jwt.js';
import Appointment from '../../src/models/Appointment.model.js';
import Request from '../../src/models/Request.model.js';
import Donation from '../../src/models/Donation.model.js';
import Donor from '../../src/models/Donor.model.js';
import * as matchingService from '../../src/services/matching.service.js';
import * as eligibilityService from '../../src/services/eligibility.service.js';
import * as appointmentService from '../../src/services/appointment.service.js';

describe('Request rejection lifecycle', () => {
  setupTestDB();

  it('rejects an accepted request, releases eligibility, and allows the donor to respond again', async () => {
    await clearDatabase();
    await Request.collection.createIndex({ hospitalLocationGeo: '2dsphere' });

    const donor = await createDonor();
    const hospital = await createHospital();
    const requestRecord = await createRequest(hospital._id, {
      bloodType: donor.bloodType,
      contactNumber: hospital.contactNumber,
      isEmergency: true,
      urgency: 'critical',
    });

    const donorToken = signToken({ userId: donor._id.toString(), role: donor.role });
    const hospitalToken = signToken({ userId: hospital._id.toString(), role: hospital.role });

    const acceptResponse = await request(app)
      .post(`/requests/${requestRecord._id}/accept`)
      .set('Authorization', `Bearer ${donorToken}`)
      .send({});

    expect(acceptResponse.status).toBe(200);

    const appointmentDate = new Date(Date.now() + 48 * 60 * 60 * 1000);
    const appointment = await Appointment.create({
      donorId: donor._id,
      hospitalId: hospital._id,
      requestId: requestRecord._id,
      appointmentDate,
      status: 'confirmed',
      donationType: 'Whole Blood',
      qrToken: 'reject-flow-test-token',
    });

    const rejectResponse = await request(app)
      .post(`/requests/${requestRecord._id}/reject`)
      .set('Authorization', `Bearer ${hospitalToken}`)
      .send({ reason: 'Medical mismatch' });

    expect(rejectResponse.status).toBe(200);
    expect(rejectResponse.body.data.request.status).toBe('pending');
    expect(rejectResponse.body.data.donation.status).toBe('rejected');

    const storedRequest = await Request.findById(requestRecord._id);
    const storedDonation = await Donation.findOne({ requestId: requestRecord._id, donorId: donor._id });
    const storedAppointment = await Appointment.findById(appointment._id);
    const storedDonor = await Donor.findById(donor._id);

    expect(storedRequest.status).toBe('pending');
    expect(storedRequest.acceptedDonationId).toBeNull();
    expect(storedDonation.status).toBe('rejected');
    expect(storedAppointment.status).toBe('cancelled');
    expect(storedDonor.lastDonationDate).toBeUndefined();

    const eligible = await eligibilityService.canDonate(storedDonor, { donationType: requestRecord.type });
    expect(eligible.eligible).toBe(true);

    const matches = await matchingService.findCompatibleRequests(donor._id);
    expect(matches.some((entry) => entry.request._id.toString() === requestRecord._id.toString())).toBe(true);

    const nearbyResponse = await request(app)
      .get(`/requests/nearby?lat=${hospital.location.coordinates.lat}&lng=${hospital.location.coordinates.lng}&radius=50`)
      .set('Authorization', `Bearer ${donorToken}`);

    expect(nearbyResponse.status).toBe(200);
    expect(nearbyResponse.body.data.requests.some((entry) => entry.requestId === requestRecord._id.toString())).toBe(true);

    const requestDetailsResponse = await request(app)
      .get(`/requests/${requestRecord._id}`)
      .set('Authorization', `Bearer ${hospitalToken}`);

    expect(requestDetailsResponse.status).toBe(200);
    expect(requestDetailsResponse.body.data.responseCount).toBe(1);
    expect(requestDetailsResponse.body.data.donationCount).toBe(1);

    const followUpDate = new Date();
    followUpDate.setDate(followUpDate.getDate() + 2);
    followUpDate.setHours(10, 0, 0, 0);

    const bookedAppointment = await appointmentService.bookAppointment(
      donor._id,
      hospital._id,
      requestRecord._id,
      followUpDate,
      'follow-up booking',
      'Whole Blood'
    );

    expect(bookedAppointment).toBeTruthy();
    expect(bookedAppointment.status).toBe('pending');
  });
});