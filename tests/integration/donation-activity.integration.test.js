import { describe, it, expect, beforeEach } from 'vitest';
import { setupTestDB } from '../helpers/db.js';
import { createHospital, createDonor, createRequest } from '../helpers/factories.js';
import * as donationService from '../../src/services/donation.service.js';
import * as activityService from '../../src/services/activity.service.js';
import Activity from '../../src/models/Activity.model.js';
import Donation from '../../src/models/Donation.model.js';

setupTestDB();

let testDonor;
let testHospital;

describe('Donation Activity Integration', () => {
  beforeEach(async () => {
    testHospital = await createHospital();
    testDonor = await createDonor();
    await Activity.deleteMany({ userId: testDonor._id });
  });

  describe('Activity Logging on Donation Creation', () => {
    it('should log activity when donation is created', async () => {
      const testRequest = await createRequest(testHospital._id, {
        bloodType: testDonor.bloodType,
      });

      const donation = await donationService.createDonation(
        testDonor._id,
        testRequest._id,
        { quantity: 1 }
      );

      // Wait a brief moment for fire-and-forget logging
      await new Promise((resolve) => setTimeout(resolve, 100));

      const activities = await Activity.find({
        userId: testDonor._id,
        type: 'donation',
        action: 'created_donation',
      });

      expect(activities.length).toBeGreaterThan(0);
      const activity = activities[activities.length - 1];
      expect(activity.title).toBe('Donation Created');
      expect(activity.referenceType).toBe('Donation');
      expect(activity.referenceId.toString()).toBe(donation._id.toString());
      expect(activity.metadata.quantity).toBe(1);
      expect(activity.metadata.requestId.toString()).toBe(testRequest._id.toString());
    });

    it('should include quantity in activity description', async () => {
      const testRequest = await createRequest(testHospital._id, {
        bloodType: testDonor.bloodType,
      });

      const donation = await donationService.createDonation(
        testDonor._id,
        testRequest._id,
        { quantity: 2 }
      );

      await new Promise((resolve) => setTimeout(resolve, 100));

      const activities = await Activity.find({
        userId: testDonor._id,
        type: 'donation',
        action: 'created_donation',
      }).sort({ createdAt: -1 });

      const activity = activities[0];
      expect(activity.description).toContain('2 unit(s)');
    });
  });

  describe('Activity Logging on Donation Completion', () => {
    it('should log activity when donation is completed', async () => {
      const req = await createRequest(testHospital._id, {
        bloodType: testDonor.bloodType,
      });

      const donation = await donationService.createDonation(
        testDonor._id,
        req._id,
        { quantity: 1 }
      );

      // Clear activities to avoid interference
      await Activity.deleteMany({ userId: testDonor._id });

      // Update donation status to completed
      await Donation.findByIdAndUpdate(donation._id, { status: 'scheduled' });
      await donationService.updateDonationStatus(donation._id, 'completed');

      await new Promise((resolve) => setTimeout(resolve, 100));

      const activities = await Activity.find({
        userId: testDonor._id,
        type: 'donation',
        action: 'completed_donation',
      });

      expect(activities.length).toBeGreaterThan(0);
      const activity = activities[activities.length - 1];
      expect(activity.title).toBe('Donation Completed');
      expect(activity.referenceType).toBe('Donation');
      expect(activity.referenceId.toString()).toBe(donation._id.toString());
      expect(activity.metadata.quantity).toBe(1);
      expect(activity.description).toContain('Successfully completed');
    });

    it('should set completedDate in activity metadata', async () => {
      const req = await createRequest(testHospital._id, {
        bloodType: testDonor.bloodType,
      });

      const donation = await donationService.createDonation(
        testDonor._id,
        req._id,
        { quantity: 1 }
      );

      await Activity.deleteMany({ userId: testDonor._id });

      await Donation.findByIdAndUpdate(donation._id, { status: 'scheduled' });
      await donationService.updateDonationStatus(donation._id, 'completed');

      await new Promise((resolve) => setTimeout(resolve, 100));

      const activity = await Activity.findOne({
        userId: testDonor._id,
        type: 'donation',
        action: 'completed_donation',
      });

      expect(activity.metadata.completedDate).toBeDefined();
      expect(activity.metadata.completedDate).toBeInstanceOf(Date);
    });
  });

  describe('Activity Logging on Donation Cancellation', () => {
    it('should log activity when donation is cancelled via updateStatus', async () => {
      const req = await createRequest(testHospital._id, {
        bloodType: testDonor.bloodType,
      });

      const donation = await donationService.createDonation(
        testDonor._id,
        req._id,
        { quantity: 1 }
      );

      await Activity.deleteMany({ userId: testDonor._id });

      await donationService.updateDonationStatus(donation._id, 'cancelled');

      await new Promise((resolve) => setTimeout(resolve, 100));

      const activities = await Activity.find({
        userId: testDonor._id,
        type: 'donation',
        action: 'cancelled_donation',
      });

      expect(activities.length).toBeGreaterThan(0);
      const activity = activities[activities.length - 1];
      expect(activity.title).toBe('Donation Cancelled');
      expect(activity.referenceType).toBe('Donation');
      expect(activity.referenceId.toString()).toBe(donation._id.toString());
      expect(activity.metadata.quantity).toBe(1);
    });

    it('should log activity when donation is cancelled directly', async () => {
      const req = await createRequest(testHospital._id, {
        bloodType: testDonor.bloodType,
      });

      const donation = await donationService.createDonation(
        testDonor._id,
        req._id,
        { quantity: 1 }
      );

      await Activity.deleteMany({ userId: testDonor._id });

      await donationService.cancelDonation(donation._id);

      await new Promise((resolve) => setTimeout(resolve, 100));

      const activities = await Activity.find({
        userId: testDonor._id,
        type: 'donation',
        action: 'cancelled_donation',
      });

      expect(activities.length).toBeGreaterThan(0);
      const activity = activities[activities.length - 1];
      expect(activity.description).toContain('Donation cancelled');
      expect(activity.metadata.previousStatus).toBe('pending');
    });

    it('should include previous status in activity metadata', async () => {
      const req = await createRequest(testHospital._id, {
        bloodType: testDonor.bloodType,
      });

      const donation = await donationService.createDonation(
        testDonor._id,
        req._id,
        { quantity: 1 }
      );

      // Move to scheduled first
      await donationService.updateDonationStatus(donation._id, 'scheduled', {
        scheduledDate: new Date(Date.now() + 86400000),
      });

      await Activity.deleteMany({ userId: testDonor._id });

      // Then cancel from scheduled
      await donationService.cancelDonation(donation._id);

      await new Promise((resolve) => setTimeout(resolve, 100));

      const activity = await Activity.findOne({
        userId: testDonor._id,
        type: 'donation',
        action: 'cancelled_donation',
      });

      expect(activity.metadata.previousStatus).toBe('scheduled');
    });
  });

  describe('Activity Timeline Integration', () => {
    it('should retrieve donation activities from timeline', async () => {
      const req = await createRequest(testHospital._id, {
        bloodType: testDonor.bloodType,
      });

      const donation = await donationService.createDonation(
        testDonor._id,
        req._id,
        { quantity: 1 }
      );

      await new Promise((resolve) => setTimeout(resolve, 100));

      const timeline = await activityService.getUserTimeline(testDonor._id, {
        type: 'donation',
      });

      expect(timeline.activities.length).toBeGreaterThan(0);
      const donationActivity = timeline.activities.find(
        (a) => a.referenceId.toString() === donation._id.toString()
      );
      expect(donationActivity).toBeDefined();
      expect(donationActivity.action).toBe('created_donation');
    });

    it('should filter donation activities by type', async () => {
      const req = await createRequest(testHospital._id, {
        bloodType: testDonor.bloodType,
      });

      await donationService.createDonation(testDonor._id, req._id, { quantity: 1 });

      await new Promise((resolve) => setTimeout(resolve, 100));

      const timeline = await activityService.getUserTimeline(testDonor._id, {
        type: 'donation',
      });

      expect(timeline.activities.length).toBeGreaterThan(0);
      expect(timeline.activities.every((a) => a.type === 'donation')).toBe(true);
    });
  });
});
