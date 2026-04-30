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
  it('executes the full donation lifecycle (create -> respond -> complete -> points)', async () => {
    // Seed
    const hospital = await createHospital();
    const hospitalToken = signToken({ userId: hospital._id.toString(), role: 'hospital', isEmailVerified: true });
    
    const donor = await createDonor({ bloodType: 'O+' });
    const donorId = donor._id;
    const donorToken = signToken({ userId: donor._id.toString(), role: 'donor', isEmailVerified: true });

    // 1. Hospital creates a blood request
    let res = await request(app)
      .post('/api/v1/hospital/request')
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

    // 2. Donor responds
    res = await request(app)
      .post(`/api/v1/donor/respond/${requestId}`)
      .set('Authorization', `Bearer ${donorToken}`)
      .send({ quantity: 1 });
      
    expect(res.status).toBe(201);
    const donationId = res.body.data._id || res.body.data.id;
    expect(donationId).toBeDefined();

    // 3. Hospital marks donation complete
    res = await request(app)
      .post('/api/v1/donations/complete')
      .set('Authorization', `Bearer ${hospitalToken}`)
      .send({ donationId });
      
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('completed');

    // 4. Verify DonorPoints balance increased
    await new Promise(r => setTimeout(r, 200));
    const account = await DonorPoints.findOne({ donorId });
    expect(account).not.toBeNull();
    expect(account.pointsBalance).toBeGreaterThan(0);
  });
});
