import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../../src/app.js';
import { setupTestDB, clearDatabase } from '../helpers/db.js';
import { createDonor, createHospital, createRequest } from '../helpers/factories.js';
import { signToken } from '../../src/utils/jwt.js';
import Donation from '../../src/models/Donation.model.js';
import RequestModel from '../../src/models/Request.model.js';
import Notification from '../../src/models/Notification.model.js';
import NotificationOutbox from '../../src/models/NotificationOutbox.model.js';

setupTestDB();

describe('Concurrent donor respond', () => {
  it('allows only one donor to accept a pending request (concurrent)', { timeout: 15000 }, async () => {
    await clearDatabase();

    const hospital = await createHospital();
    const reqDoc = await createRequest(hospital._id, { status: 'pending' });

    const donor1 = await createDonor();
    const donor2 = await createDonor();

    const token1 = signToken({ userId: donor1._id.toString(), role: donor1.role });
    const token2 = signToken({ userId: donor2._id.toString(), role: donor2.role });

    const p1 = request(app)
      .post(`/donor/respond/${reqDoc._id}`)
      .set('Authorization', `Bearer ${token1}`)
      .send({ quantity: 1 });

    const p2 = request(app)
      .post(`/donor/respond/${reqDoc._id}`)
      .set('Authorization', `Bearer ${token2}`)
      .send({ quantity: 1 });

    const results = await Promise.all([p1, p2]);

    const statusCodes = results.map((r) => r.status).sort();
    // With unitsNeeded=2 (factory default) and 2 donors pledging 1 each, both succeed
    expect(statusCodes).toEqual([201, 201]);

    // Verify request is accepted with both donations
    const updatedReq = await RequestModel.findById(reqDoc._id);
    expect(updatedReq.status).toBe('accepted');
    expect(updatedReq.unitsAccepted).toBe(2);

    const activeDonations = await Donation.find({ requestId: reqDoc._id, status: { $nin: ['cancelled', 'rejected'] } });
    expect(activeDonations.length).toBe(2);

    // Verify NotificationOutbox entries for both donors
    const outboxEntries = await NotificationOutbox.find({ requestId: reqDoc._id });
    expect(outboxEntries.length).toBe(2);

    const notifications = await Notification.find({ relatedId: reqDoc._id });
    expect(notifications.length).toBe(0);
  });
});
