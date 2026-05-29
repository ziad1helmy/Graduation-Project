import { describe, it, expect } from 'vitest';
import { setupTestDB } from '../helpers/db.js';
import { createDonor, createHospital, createRequest, createDonation } from '../helpers/factories.js';
import mongoose from 'mongoose';
import * as notificationService from '../../src/services/notification.service.js';
import Notification from '../../src/models/Notification.model.js';
import { buildEmergencyRequestNotificationData } from '../../src/utils/emergency-notification.js';

setupTestDB();

describe('Notification Service', () => {
  it('notifyMatch creates a match notification', async () => {
    const hospital = await createHospital();
    const request = await createRequest(hospital._id, { type: 'blood', bloodType: 'O+' });
    const donor = await createDonor({ bloodType: 'O+' });
    const donation = await createDonation(donor._id, request._id, { status: 'pending' });

    const n = await notificationService.notifyMatch(hospital._id, donation, request);
    expect(n).toBeTruthy();
    expect(n.type).toBe('match');
    const stored = await Notification.findById(n._id);
    expect(stored).toBeTruthy();
  });

  it('notifyRequest inserts notifications for donor list', async () => {
    const hospital = await createHospital();
    const request = await createRequest(hospital._id, { type: 'blood', bloodType: 'O+' });
    const d1 = await createDonor({ bloodType: 'O+' });
    const d2 = await createDonor({ bloodType: 'O+' });

    const items = await notificationService.notifyRequest([d1._id, d2._id], request);
    expect(items.length).toBe(2);
    expect(items[0].type).toBe('emergency');
    expect(items[0].data.type).toBe('emergency_request');
    expect(items[0].data.requestId).toBe(request._id.toString());
    expect(items[0].data.title_loc_key).toBe('emergency_request_title');
    expect(items[0].data.body_loc_key).toBe('emergency_request_body');
    expect(items[0].data.actionIds).toEqual(['accept', 'decline', 'view']);
    expect(items[0].data.actions[2].endpoint).toBe(`/urgent-requests/${request._id}`);
    const unread = await notificationService.getUnreadNotifications(d1._id);
    expect(unread.length).toBeGreaterThanOrEqual(1);
  });

  it('notifyRequest excludes opted-out and incompatible donors', async () => {
    const hospital = await createHospital();
    const request = await createRequest(hospital._id, {
      type: 'plasma',
      bloodType: 'O+',
      urgency: 'critical',
    });

    const eligibleDonor = await createDonor({
      bloodType: 'O+',
      location: {
        city: 'Cairo',
        governorate: 'Cairo',
        coordinates: { lat: 30.0444, lng: 31.2357 },
        lastUpdated: new Date(),
      },
    });
    const optedOutDonor = await createDonor({
      bloodType: 'O+',
      isOptedIn: false,
      location: {
        city: 'Cairo',
        governorate: 'Cairo',
        coordinates: { lat: 30.0444, lng: 31.2357 },
        lastUpdated: new Date(),
      },
    });
    const incompatibleDonor = await createDonor({
      bloodType: 'A+',
      location: {
        city: 'Cairo',
        governorate: 'Cairo',
        coordinates: { lat: 30.0444, lng: 31.2357 },
        lastUpdated: new Date(),
      },
    });

    await request.populate('hospitalId', 'fullName hospitalName address location contactNumber');

    const items = await notificationService.notifyRequest(
      [eligibleDonor._id, optedOutDonor._id, incompatibleDonor._id],
      request,
    );

    expect(items).toHaveLength(1);
    expect(items[0].userId.toString()).toBe(eligibleDonor._id.toString());
    expect(await Notification.countDocuments({ userId: optedOutDonor._id })).toBe(0);
    expect(await Notification.countDocuments({ userId: incompatibleDonor._id })).toBe(0);
  });

  it('buildEmergencyRequestNotificationData includes request snapshot fields', async () => {
    const hospital = await createHospital();
    const request = await createRequest(hospital._id, {
      type: 'blood',
      bloodType: 'O-',
      urgency: 'critical',
      unitsNeeded: 2,
    });
    const donor = await createDonor({ bloodType: 'O+' });
    await request.populate('hospitalId', 'fullName hospitalName address location contactNumber');

    const data = buildEmergencyRequestNotificationData(request, donor);

    expect(data.type).toBe('emergency_request');
    expect(data.requestId).toBe(request._id.toString());
    expect(data.bloodType).toBe('O-');
    expect(data.urgency).toBe('critical');
    expect(data.hospitalName).toBeTruthy();
    expect(data.unitsNeeded).toBe(2);
    expect(data.requiredBy).toBeTruthy();
    expect(data.requestStatus).toBe('pending');
    expect(data.createdAt).toBeTruthy();
    expect(data.title_loc_key).toBe('emergency_request_title');
    expect(data.body_loc_key).toBe('emergency_request_body');
    expect(Array.isArray(data.actions)).toBe(true);
    expect(data.actions.map((action) => action.id)).toEqual(['accept', 'decline', 'view']);
  });

  it('notifyMilestone creates milestone notification', async () => {
    const donor = await createDonor();
    const achievement = { id: new mongoose.Types.ObjectId(), title: '100 Donations', type: 'badge', points: 100 };
    const n = await notificationService.notifyMilestone(donor._id, achievement);
    expect(n).toBeTruthy();
    expect(n.type).toBe('milestone');
  });

  it('markAsRead and getUserNotifications work', async () => {
    const donor = await createDonor();
    const n1 = await notificationService.notifyMilestone(donor._id, { id: new mongoose.Types.ObjectId(), title: 'T1' });
    const n2 = await notificationService.notifyMilestone(donor._id, { id: new mongoose.Types.ObjectId(), title: 'T2' });

    await notificationService.markAsRead(n1._id);
    const { notifications, total } = await notificationService.getUserNotifications(donor._id, { offset: 0, limit: 10 });
    expect(total).toBeGreaterThanOrEqual(2);
    const unread = await notificationService.getUnreadNotifications(donor._id);
    expect(unread.find((x) => x._id.toString() === n1._id.toString())).toBeUndefined();
  });

  it('deleteNotification and clearAllNotifications work', async () => {
    const donor = await createDonor();
    const n = await notificationService.notifyMilestone(donor._id, { id: new mongoose.Types.ObjectId(), title: 'DeleteMe' });
    const deleted = await notificationService.deleteNotification(n._id);
    expect(deleted).toBeTruthy();

    await notificationService.notifyMilestone(donor._id, { id: new mongoose.Types.ObjectId(), title: 'ClearMe' });
    const res = await notificationService.clearAllNotifications(donor._id);
    expect(res).toBeTruthy();
  });

  it('getNotificationStats returns counts by type', async () => {
    const donor = await createDonor();
    await notificationService.notifyMilestone(donor._id, { id: new mongoose.Types.ObjectId(), title: 'S1' });
    await notificationService.notifyMilestone(donor._id, { id: new mongoose.Types.ObjectId(), title: 'S2' });
    const stats = await notificationService.getNotificationStats(donor._id);
    expect(stats.total).toBeGreaterThanOrEqual(2);
    expect(stats.byType).toHaveProperty('milestone');
  });

  describe('Appointment Type', () => {
    it('should create an appointment notification successfully', async () => {
      const donor = await createDonor();
      
      const notification = await Notification.create({
        userId: donor._id,
        type: 'appointment',
        relatedId: new mongoose.Types.ObjectId(),
        relatedType: 'Appointment',
        title: 'Appointment Scheduled',
        message: 'Your donation appointment has been scheduled.',
      });

      expect(notification).toBeDefined();
      expect(notification.type).toBe('appointment');
      expect(notification.relatedType).toBe('Appointment');
      
      const saved = await Notification.findById(notification._id);
      expect(saved).toBeTruthy();
      expect(saved.type).toBe('appointment');
      expect(saved.relatedType).toBe('Appointment');
    });
  });
});
