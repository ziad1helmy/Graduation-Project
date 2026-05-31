import { describe, it, expect } from 'vitest';
import { setupTestDB, clearDatabase } from '../helpers/db.js';
import { createDonor, createHospital, createRequest, createDonation } from '../helpers/factories.js';
import Notification from '../../src/models/Notification.model.js';
import NotificationOutbox from '../../src/models/NotificationOutbox.model.js';
import Request from '../../src/models/Request.model.js';
import Donation from '../../src/models/Donation.model.js';
import outboxWorker from '../../src/workers/notificationOutbox.worker.js';

setupTestDB();

describe('NotificationOutbox worker', () => {
  it('processes match outbox entries and creates hospital notification', async () => {
    await clearDatabase();

    const hospital = await createHospital();
    const req = await createRequest(hospital._id, { status: 'pending' });
    const donor = await createDonor();
    const donation = await createDonation(donor._id, req._id);

    // Mark request as accepted and link donation
    await Request.findByIdAndUpdate(req._id, { status: 'accepted', acceptedDonationId: donation._id, acceptedBy: donor._id });

    // Create outbox entry (match)
    const out = await NotificationOutbox.create({ requestId: req._id, userId: hospital._id, donorIds: [donor._id], type: 'match', status: 'pending' });

    // Process pending outbox
    const stats = await outboxWorker.processPendingOutbox({ maxIterations: 10 });
    expect(stats.processedSuccess).toBeGreaterThanOrEqual(1);

    // Verify Notification created for hospital with related donation id
    const notif = await Notification.findOne({ relatedId: donation._id, type: 'match', userId: hospital._id });
    expect(notif).toBeTruthy();

    // Verify outbox updated to sent
    const updated = await NotificationOutbox.findById(out._id);
    expect(updated.status).toBe('sent');
  });

  it('processes request outbox entries and creates donor notifications', async () => {
    await clearDatabase();

    const hospital = await createHospital();
    const req = await createRequest(hospital._id, { status: 'pending' });
    const donor1 = await createDonor();
    const donor2 = await createDonor();

    // Create outbox entry listing donors to notify
    const out = await NotificationOutbox.create({ requestId: req._id, donorIds: [donor1._id, donor2._id], type: 'request', status: 'pending' });

    // Process pending outbox
    const stats = await outboxWorker.processPendingOutbox({ maxIterations: 10 });
    expect(stats.processedSuccess).toBeGreaterThanOrEqual(1);

    // Verify notifications created for request (relatedId = request._id)
    const notifs = await Notification.find({ relatedId: req._id });
    expect(notifs.length).toBeGreaterThan(0);

    // Verify outbox updated to sent
    const updated = await NotificationOutbox.findById(out._id);
    expect(updated.status).toBe('sent');
  });
});
