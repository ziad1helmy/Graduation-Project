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
  it('allows only one donor to accept a pending request (concurrent)', async () => {
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
    // Expect one 201 and one 409 (or 400 in some configs) — allow either 201/409 or 201/400
    expect(statusCodes.includes(201)).toBe(true);
    expect(statusCodes.filter((s) => s !== 201).length).toBe(1);

    // Verify request is accepted and linked to one donation
    const updatedReq = await RequestModel.findById(reqDoc._id);
    expect(updatedReq.status).toBe('accepted');
    expect(updatedReq.acceptedDonationId).toBeTruthy();

    const activeDonations = await Donation.find({ requestId: reqDoc._id, status: { $nin: ['cancelled', 'rejected'] } });
    expect(activeDonations.length).toBe(1);

    // Verify NotificationOutbox entry exists for match and no immediate Notification created
    const outbox = await NotificationOutbox.findOne({ requestId: reqDoc._id });
    expect(outbox).toBeTruthy();
    expect(outbox.type).toBe('match');

    const notifications = await Notification.find({ relatedId: reqDoc._id });
    expect(notifications.length).toBe(0);
  });
});
