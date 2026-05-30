import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../../src/app.js';
import { setupTestDB } from '../helpers/db.js';
import { createDonor, createHospital, createRequest, createDonation } from '../helpers/factories.js';
import { signToken } from '../../src/utils/jwt.js';
import Appointment from '../../src/models/Appointment.model.js';
import Donation from '../../src/models/Donation.model.js';
import Request from '../../src/models/Request.model.js';

setupTestDB();

const tokenFor = (user) =>
  signToken({ userId: user._id.toString(), role: user.role, isEmailVerified: true });

describe('Audit business-rule fixes', () => {
  it('accepting a request creates a pending donation without decrementing request quantity', async () => {
    const donor = await createDonor({ bloodType: 'O+' });
    const hospital = await createHospital();
    const bloodRequest = await createRequest(hospital._id, {
      bloodType: 'O+',
      quantity: 1,
      unitsNeeded: 1,
      status: 'pending',
    });

    const res = await request(app)
      .post(`/donor/respond/${bloodRequest._id}`)
      .set('Authorization', `Bearer ${tokenFor(donor)}`)
      .send({ quantity: 1 });

    expect(res.status).toBe(201);

    const updatedRequest = await Request.findById(bloodRequest._id);
    const donation = await Donation.findOne({ requestId: bloodRequest._id, donorId: donor._id });

    expect(updatedRequest.status).toBe('accepted');
    expect(updatedRequest.quantity).toBe(1);
    expect(updatedRequest.unitsNeeded).toBe(1);
    expect(donation.status).toBe('pending');
  });

  it('rejects donor responses for non-pending requests', async () => {
    const donor = await createDonor({ bloodType: 'O+' });
    const hospital = await createHospital();
    const bloodRequest = await createRequest(hospital._id, {
      bloodType: 'O+',
      status: 'accepted',
    });

    const res = await request(app)
      .post(`/donor/respond/${bloodRequest._id}`)
      .set('Authorization', `Bearer ${tokenFor(donor)}`)
      .send({ quantity: 1 });

    expect(res.status).toBe(400);
    expect(await Donation.countDocuments({ requestId: bloodRequest._id })).toBe(0);
  });

  it('blocks hospital request completion without a completed donation for the same request', async () => {
    const hospital = await createHospital();
    const donor = await createDonor({ bloodType: 'O+' });
    const requestToClose = await createRequest(hospital._id, { bloodType: 'O+', status: 'in-progress' });
    const unrelatedRequest = await createRequest(hospital._id, { bloodType: 'O+', status: 'in-progress' });
    await createDonation(donor._id, unrelatedRequest._id, { status: 'completed' });

    const res = await request(app)
      .post(`/hospital/requests/${requestToClose._id}/close`)
      .set('Authorization', `Bearer ${tokenFor(hospital)}`);

    expect(res.status).toBe(400);
    const updatedRequest = await Request.findById(requestToClose._id);
    expect(updatedRequest.status).toBe('in-progress');
  });

  it('reuses the accepted pending donation when an appointment is completed', async () => {
    const donor = await createDonor({ bloodType: 'O+', hemoglobinLevel: 15, weight: 70 });
    const hospital = await createHospital();
    const bloodRequest = await createRequest(hospital._id, { bloodType: 'O+', status: 'in-progress' });
    const pendingDonation = await createDonation(donor._id, bloodRequest._id, { status: 'pending' });
    const appointment = await Appointment.create({
      donorId: donor._id,
      hospitalId: hospital._id,
      requestId: bloodRequest._id,
      appointmentDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
      status: 'confirmed',
      qrToken: `audit-${Date.now()}`,
      qrScannedAt: new Date(),
      verificationStatus: 'verified',
      verificationChecklist: {
        idVerified: true,
        questionnaireCompleted: true,
        consentSigned: true,
        completedAt: new Date(),
      },
      donationType: 'Whole Blood',
    });

    const res = await request(app)
      .post('/donations/complete')
      .set('Authorization', `Bearer ${tokenFor(hospital)}`)
      .send({
        appointmentId: appointment._id.toString(),
        hemoglobinLevel: 14.5,
        weight: 72,
        unitsCollected: 1,
      });

    expect(res.status).toBe(200);

    const donations = await Donation.find({ requestId: bloodRequest._id });
    expect(donations).toHaveLength(1);
    expect(donations[0]._id.toString()).toBe(pendingDonation._id.toString());
    expect(donations[0].status).toBe('completed');
    expect(donations[0].appointmentId.toString()).toBe(appointment._id.toString());
  });
});
