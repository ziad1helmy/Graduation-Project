import { describe, it, expect, beforeAll, afterEach, afterAll, vi } from 'vitest';
import request from 'supertest';
import app from '../../src/app.js';
import { connect, clearDatabase, closeDatabase } from '../helpers/db.js';
import { createHospital, createDonor } from '../helpers/factories.js';
import { signToken } from '../../src/utils/jwt.js';
import DonorPoints from '../../src/models/DonorPoints.model.js';

// Mock mailer and FCM to prevent real I/O calls
vi.mock('../../src/utils/mailer.js', () => ({
  sendEmailVerificationEmail: vi.fn().mockResolvedValue(true),
  sendPasswordResetEmail: vi.fn().mockResolvedValue(true),
  sendEmail: vi.fn().mockResolvedValue(true),
}));

vi.mock('../../src/utils/fcm.js', () => ({
  sendPushNotification: vi.fn().mockResolvedValue(true),
  subscribeToTopic: vi.fn().mockResolvedValue(true),
  unsubscribeFromTopic: vi.fn().mockResolvedValue(true),
}));

beforeAll(async () => {
  await connect();
}, 30_000);

afterEach(async () => {
  await clearDatabase();
  vi.clearAllMocks();
});

afterAll(async () => {
  await closeDatabase();
});

describe('Donation Lifecycle Smoke E2E Flow', () => {
  it('executes the full donation lifecycle (book -> verify QR -> checklist -> complete -> points)', async () => {
    // Seed
    const hospital = await createHospital();
    const hospitalToken = signToken({ userId: hospital._id.toString(), role: 'hospital', isEmailVerified: true });
    
    const donor = await createDonor({ bloodType: 'O+' });
    const donorId = donor._id;
    const donorToken = signToken({ userId: donor._id.toString(), role: 'donor', isEmailVerified: true });

    // 1. Hospital creates a blood request
    let res = await request(app)
      .post('/hospital/request')
      .set('Authorization', `Bearer ${hospitalToken}`)
      .send({
        type: 'blood',
        bloodType: 'O+',
        urgency: 'high',
        requiredBy: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
        quantity: 2,
        notes: 'Urgent request for integration test'
      });
      
    expect(res.status).toBe(201);
    const requestId = res.body.data._id || res.body.data.id;
    expect(requestId).toBeDefined();

    // 1.5. Donor responds to request (replaces request status with 'accepted')
    res = await request(app)
      .post(`/donor/respond/${requestId}`)
      .set('Authorization', `Bearer ${donorToken}`)
      .send({ quantity: 1 });
    expect(res.status).toBe(201);

    // 2. Donor books a hospital appointment for the request
    // Use a specific time (2:00 PM) to ensure it's within operating hours (9 AM - 5 PM)
    const appointmentDate = new Date(Date.now() + 4 * 24 * 60 * 60 * 1000);
    appointmentDate.setHours(14, 0, 0, 0); // Set to 2:00 PM
    
    res = await request(app)
      .post('/donations/book-appointment')
      .set('Authorization', `Bearer ${donorToken}`)
      .send({
        hospitalId: hospital._id.toString(),
        requestId,
        appointmentDate: appointmentDate.toISOString(),
        donationType: 'Whole Blood',
        notes: 'Book a verified appointment',
      });
    
    // Debug: Log response if not successful
    if (res.status !== 201) {
      console.log('Booking failed with status:', res.status);
      console.log('Response body:', JSON.stringify(res.body, null, 2));
    }
      
    expect(res.status).toBe(201);
    const appointmentId = res.body.data._id || res.body.data.id;
    const qrToken = res.body.data.qrToken;
    expect(appointmentId).toBeDefined();
    expect(qrToken).toBeDefined();

    // 3. Hospital scans the donor QR and starts verification
    res = await request(app)
      .post('/appointments/verify-qr')
      .set('Authorization', `Bearer ${hospitalToken}`)
      .send({ qrToken });
      
    expect(res.status).toBe(200);
    expect(res.body.data.verificationStatus).toBe('pending');

    // 4. Hospital completes the checklist and continues to donation details
    res = await request(app)
      .post(`/appointments/${appointmentId}/arrival`)
      .set('Authorization', `Bearer ${hospitalToken}`)
      .send({
        checklist: {
          idVerified: true,
          questionnaireCompleted: true,
          consentSigned: true,
        },
      });

    expect(res.status).toBe(200);
    expect(res.body.data.readyForDonation).toBe(true);

    // 4.5. Hospital updates request status to in-progress
    res = await request(app)
      .put(`/hospital/requests/${requestId}`)
      .set('Authorization', `Bearer ${hospitalToken}`)
      .send({ status: 'in-progress' });
    expect(res.status).toBe(200);

    // 5. Hospital confirms the donation with medical validation
    res = await request(app)
      .post('/donations/complete')
      .set('Authorization', `Bearer ${hospitalToken}`)
      .send({
        appointmentId,
        hemoglobinLevel: 14.8,
        weight: 72,
        unitsCollected: 1,
        notes: 'Donation completed successfully.',
      });

    if (res.status !== 200) {
      console.log('Completion failed with status:', res.status);
      console.log('Response body:', JSON.stringify(res.body, null, 2));
    }
    expect(res.status).toBe(200);
    expect(res.body.data.donation.status).toBe('completed');
    expect(res.body.data.pointsEarned).toBeGreaterThan(0);

    // 6. Verify DonorPoints balance increased
    await new Promise(r => setTimeout(r, 200));
    const account = await DonorPoints.findOne({ donorId });
    expect(account).not.toBeNull();
    expect(account.pointsBalance).toBeGreaterThan(0);
  });
});
