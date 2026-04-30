import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../../src/app.js';
import { setupTestDB, clearDatabase } from '../helpers/db.js';
import { createDonor } from '../helpers/factories.js';
import { signToken } from '../../src/utils/jwt.js';
import Notification from '../../src/models/Notification.model.js';
import mongoose from 'mongoose';

setupTestDB();

describe('Notification Routes Integration', () => {
  it('GET /notifications returns notifications for authenticated user', async () => {
    await clearDatabase();
    const donor = await createDonor();

    // Create test notifications
    const badgeId = new mongoose.Types.ObjectId();
    await Notification.create({
      userId: donor._id,
      type: 'milestone',
      title: 'Badge Unlocked',
      message: 'You unlocked a badge',
      relatedType: 'Achievement',
      relatedId: badgeId,
    });

    const token = signToken({ userId: donor._id.toString(), role: donor.role });

    const response = await request(app)
      .get('/notifications')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toHaveProperty('notifications');
    expect(Array.isArray(response.body.data.notifications)).toBe(true);
    expect(response.body.data.notifications.length).toBeGreaterThan(0);
  });

  it('GET /notifications requires authentication', async () => {
    await clearDatabase();

    const response = await request(app).get('/notifications');

    expect(response.status).toBe(401);
  });

  it('GET /notifications filters by read status', async () => {
    await clearDatabase();
    const donor = await createDonor();

    // Create read and unread notifications
    const badgeId = new mongoose.Types.ObjectId();
    await Notification.create({
      userId: donor._id,
      type: 'milestone',
      title: 'Badge Unlocked',
      message: 'You unlocked a badge',
      relatedType: 'Achievement',
      relatedId: badgeId,
      read: true,
    });

    await Notification.create({
      userId: donor._id,
      type: 'request',
      title: 'New Request',
      message: 'A blood request matches your profile',
      relatedType: 'Request',
      relatedId: new mongoose.Types.ObjectId(),
    });

    const token = signToken({ userId: donor._id.toString(), role: donor.role });

    const response = await request(app)
      .get('/notifications?read=false')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    // Should only get unread notifications
    const unreadNotifications = response.body.data.notifications.filter((n) => !n.read);
    expect(unreadNotifications.length).toBeGreaterThan(0);
  });

  it('PATCH /notifications/:id/read marks notification as read', async () => {
    await clearDatabase();
    const donor = await createDonor();

    // Create unread notification
    const badgeId = new mongoose.Types.ObjectId();
    const notification = await Notification.create({
      userId: donor._id,
      type: 'milestone',
      title: 'Badge Unlocked',
      message: 'You unlocked a badge',
      relatedType: 'Achievement',
      relatedId: badgeId,
    });

    const token = signToken({ userId: donor._id.toString(), role: donor.role });

    const response = await request(app)
      .patch(`/notifications/${notification._id}/read`)
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.notification.read).toBe(true);

    const updated = await Notification.findById(notification._id);
    expect(updated.read).toBe(true);
  });

  it('PATCH /notifications/read-all marks all notifications as read', async () => {
    await clearDatabase();
    const donor = await createDonor();

    // Create multiple unread notifications
    const badgeId = new mongoose.Types.ObjectId();
    await Notification.create([
      {
        userId: donor._id,
        type: 'milestone',
        title: 'Badge 1',
        message: 'Badge 1',
        relatedType: 'Achievement',
        relatedId: badgeId,
      },
      {
        userId: donor._id,
        type: 'request',
        title: 'Request 1',
        message: 'Request 1',
        relatedType: 'Request',
        relatedId: new mongoose.Types.ObjectId(),
      },
    ]);

    const token = signToken({ userId: donor._id.toString(), role: donor.role });

    const response = await request(app)
      .patch('/notifications/read-all')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);

    const unreadCount = await Notification.countDocuments({ userId: donor._id, read: false });
    expect(unreadCount).toBe(0);
  });

  it('GET /notifications/:id retrieves single notification', async () => {
    await clearDatabase();
    const donor = await createDonor();

    const badgeId = new mongoose.Types.ObjectId();
    const notification = await Notification.create({
      userId: donor._id,
      type: 'milestone',
      title: 'Badge Unlocked',
      message: 'You unlocked a badge',
      relatedType: 'Achievement',
      relatedId: badgeId,
    });

    const token = signToken({ userId: donor._id.toString(), role: donor.role });

    const response = await request(app)
      .get(`/notifications/${notification._id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.notification._id.toString()).toBe(notification._id.toString());
    expect(response.body.data.notification.type).toBe('milestone');
  });

  it('GET /notifications/:id returns 404 for non-existent notification', async () => {
    await clearDatabase();
    const donor = await createDonor();

    const fakeId = new mongoose.Types.ObjectId();
    const token = signToken({ userId: donor._id.toString(), role: donor.role });

    const response = await request(app)
      .get(`/notifications/${fakeId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(404);
  });

  it('DELETE /notifications/:id deletes notification', async () => {
    await clearDatabase();
    const donor = await createDonor();

    const badgeId = new mongoose.Types.ObjectId();
    const notification = await Notification.create({
      userId: donor._id,
      type: 'milestone',
      title: 'Badge Unlocked',
      message: 'You unlocked a badge',
      relatedType: 'Achievement',
      relatedId: badgeId,
    });

    const token = signToken({ userId: donor._id.toString(), role: donor.role });

    const response = await request(app)
      .delete(`/notifications/${notification._id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);

    const deleted = await Notification.findById(notification._id);
    expect(deleted).toBeNull();
  });

  it('DELETE /notifications/:id returns 404 for non-existent notification', async () => {
    await clearDatabase();
    const donor = await createDonor();

    const fakeId = new mongoose.Types.ObjectId();
    const token = signToken({ userId: donor._id.toString(), role: donor.role });

    const response = await request(app)
      .delete(`/notifications/${fakeId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(404);
  });

  it('Notifications are only visible to their owner', async () => {
    await clearDatabase();
    const donor1 = await createDonor();
    const donor2 = await createDonor();

    // Create notification for donor1
    const badgeId = new mongoose.Types.ObjectId();
    const notification = await Notification.create({
      userId: donor1._id,
      type: 'milestone',
      title: 'Badge Unlocked',
      message: 'You unlocked a badge',
      relatedType: 'Achievement',
      relatedId: badgeId,
    });

    // Try to access with donor2's token
    const token2 = signToken({ userId: donor2._id.toString(), role: donor2.role });

    const response = await request(app)
      .get(`/notifications/${notification._id}`)
      .set('Authorization', `Bearer ${token2}`);

    expect(response.status).toBe(404);
  });
});
