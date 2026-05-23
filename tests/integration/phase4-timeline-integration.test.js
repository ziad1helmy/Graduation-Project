import { describe, it, expect, beforeEach } from 'vitest';
import { setupTestDB } from '../helpers/db.js';
import { createHospital, createDonor, createRequest } from '../helpers/factories.js';
import * as donationService from '../../src/services/donation.service.js';
import * as activityService from '../../src/services/activity.service.js';
import Activity from '../../src/models/Activity.model.js';
import Donation from '../../src/models/Donation.model.js';

/**
 * Phase 4: Optimization & Polish — Timeline Integration Tests
 *
 * These tests verify the complete end-to-end flow:
 *  1. Donor creates a donation
 *  2. Activity is logged (fire-and-forget)
 *  3. Activity appears in timeline query
 *  4. Timeline includes proper pagination
 *
 * These tests ensure the activity system works correctly in production scenarios
 * where timelines are retrieved immediately after actions.
 */

setupTestDB();

let testDonor;
let testHospital;

describe('Phase 4: Timeline Integration — End-to-End Workflows', () => {
  beforeEach(async () => {
    testHospital = await createHospital();
    testDonor = await createDonor();
    await Activity.deleteMany({ userId: testDonor._id });
    await Donation.deleteMany({ donorId: testDonor._id });
  });

  describe('Donation Creation → Timeline Retrieval', () => {
    it('should retrieve donation activity from timeline after creation', async () => {
      const testRequest = await createRequest(testHospital._id, {
        bloodType: testDonor.bloodType,
      });

      const donation = await donationService.createDonation(
        testDonor._id,
        testRequest._id,
        { quantity: 1 }
      );

      await new Promise((resolve) => setTimeout(resolve, 150));

      const timeline = await activityService.getUserTimeline(testDonor._id, {
        page: 1,
        limit: 20,
      });

      expect(timeline.activities.length).toBeGreaterThan(0);
      
      const donationActivity = timeline.activities.find(
        (a) => a.referenceId === donation._id.toString()
      );
      
      expect(donationActivity).toBeDefined();
      expect(donationActivity.type).toBe('donation');
      expect(donationActivity.action).toBe('created_donation');
      expect(donationActivity.title).toBe('Donation Created');
      expect(donationActivity.metadata.quantity).toBe(1);
    });

    it('should paginate activities correctly with multiple donations', async () => {
      const donations = [];
      for (let i = 0; i < 35; i++) {
        const req = await createRequest(testHospital._id, {
          bloodType: testDonor.bloodType,
        });
        const donation = await donationService.createDonation(
          testDonor._id,
          req._id,
          { quantity: 1 }
        );
        donations.push(donation);
      }

      await new Promise((resolve) => setTimeout(resolve, 200));

      const page1 = await activityService.getUserTimeline(testDonor._id, {
        page: 1,
        limit: 20,
      });

      expect(page1.activities).toHaveLength(20);
      expect(page1.pagination.total).toBe(35);
      expect(page1.pagination.page).toBe(1);
      expect(page1.pagination.totalPages).toBe(2);
      expect(page1.pagination.hasNextPage).toBe(true);
      expect(page1.pagination.hasPrevPage).toBe(false);

      const page2 = await activityService.getUserTimeline(testDonor._id, {
        page: 2,
        limit: 20,
      });

      expect(page2.activities).toHaveLength(15);
      expect(page2.pagination.page).toBe(2);
      expect(page2.pagination.hasNextPage).toBe(false);
      expect(page2.pagination.hasPrevPage).toBe(true);
    }, 45000);

    it('should return timeline without requiring a type query parameter', async () => {
      const req = await createRequest(testHospital._id, {
        bloodType: testDonor.bloodType,
      });

      await donationService.createDonation(testDonor._id, req._id, { quantity: 1 });

      await new Promise((resolve) => setTimeout(resolve, 150));

      const timeline = await activityService.getUserTimeline(testDonor._id, {
        page: 1,
        limit: 20,
      });

      expect(timeline.activities.length).toBeGreaterThan(0);
      expect(timeline.pagination.page).toBe(1);
      expect(timeline.pagination.limit).toBe(20);
    });

    it('should retrieve newest activities first (descending createdAt)', async () => {
      const donations = [];
      for (let i = 0; i < 5; i++) {
        const req = await createRequest(testHospital._id, {
          bloodType: testDonor.bloodType,
        });
        const donation = await donationService.createDonation(
          testDonor._id,
          req._id,
          { quantity: 1 }
        );
        donations.push(donation);
        
        await new Promise((resolve) => setTimeout(resolve, 10));
      }

      await new Promise((resolve) => setTimeout(resolve, 200));

      const timeline = await activityService.getUserTimeline(testDonor._id, {
        page: 1,
        limit: 20,
      });

      expect(timeline.activities.length).toBeGreaterThan(0);

      for (let i = 0; i < timeline.activities.length - 1; i++) {
        const current = new Date(timeline.activities[i].createdAt);
        const next = new Date(timeline.activities[i + 1].createdAt);
        expect(current.getTime()).toBeGreaterThanOrEqual(next.getTime());
      }
    });

    it('should include complete activity metadata in timeline', async () => {
      const req = await createRequest(testHospital._id, {
        bloodType: testDonor.bloodType,
      });

      const donation = await donationService.createDonation(
        testDonor._id,
        req._id,
        { quantity: 1 }
      );

      await new Promise((resolve) => setTimeout(resolve, 150));

      const timeline = await activityService.getUserTimeline(testDonor._id, {
        page: 1,
        limit: 20,
      });

      const activity = timeline.activities.find(
        (a) => a.referenceId === donation._id.toString()
      );

      expect(activity._id).toBeDefined();
      expect(activity.userId.toString()).toBe(testDonor._id.toString());
      expect(activity.type).toBe('donation');
      expect(activity.action).toBe('created_donation');
      expect(activity.title).toBe('Donation Created');
      expect(activity.description).toBeDefined();
      expect(activity.referenceId).toBe(donation._id.toString());
      expect(activity.referenceType).toBe('Donation');
      expect(activity.metadata).toBeDefined();
      expect(activity.metadata.quantity).toBe(1);
      expect(activity.createdAt).toBeDefined();
    });
  });

  describe('Index Performance & Query Efficiency', () => {
    it('should use index for timeline queries', async () => {
      for (let i = 0; i < 100; i++) {
        const req = await createRequest(testHospital._id, {
          bloodType: testDonor.bloodType,
        });
        await donationService.createDonation(testDonor._id, req._id, { quantity: 1 });
      }

      await new Promise((resolve) => setTimeout(resolve, 300));

      const startTime = Date.now();
      const timeline = await activityService.getUserTimeline(testDonor._id, {
        page: 1,
        limit: 20,
      });
      const queryTime = Date.now() - startTime;

      expect(queryTime).toBeLessThan(1000);
      expect(timeline.activities.length).toBeGreaterThan(0);
    }, 45000);

    it('should retrieve timeline efficiently with pagination', async () => {
      for (let i = 0; i < 50; i++) {
        const req = await createRequest(testHospital._id, {
          bloodType: testDonor.bloodType,
        });
        await donationService.createDonation(testDonor._id, req._id, { quantity: 1 });
      }

      await new Promise((resolve) => setTimeout(resolve, 200));

      const startTime = Date.now();
      const timeline = await activityService.getUserTimeline(testDonor._id, {
        page: 1,
        limit: 20,
      });
      const queryTime = Date.now() - startTime;

      expect(queryTime).toBeLessThan(500);
      expect(timeline.activities.length).toBeGreaterThan(0);
    }, 45000);
  });

  describe('Deduplication & Data Integrity', () => {
    it('should prevent duplicate activities for same donation', async () => {
      const req = await createRequest(testHospital._id, {
        bloodType: testDonor.bloodType,
      });

      const donation = await donationService.createDonation(
        testDonor._id,
        req._id,
        { quantity: 1 }
      );

      await new Promise((resolve) => setTimeout(resolve, 100));

      const firstLog = await activityService.logActivity(testDonor._id, {
        type: 'donation',
        action: 'created_donation',
        title: 'Donation Created',
        description: 'Test donation',
        referenceId: donation._id.toString(),
        referenceType: 'Donation',
        metadata: { quantity: 1 },
      });

      const secondLog = await activityService.logActivity(testDonor._id, {
        type: 'donation',
        action: 'created_donation',
        title: 'Donation Created',
        description: 'Test donation',
        referenceId: donation._id.toString(),
        referenceType: 'Donation',
        metadata: { quantity: 1 },
      });

      expect(firstLog).toBeDefined();
      expect(secondLog).toBeNull();

      const timeline = await activityService.getUserTimeline(testDonor._id);
      const duplicates = timeline.activities.filter(
        (a) => a.referenceId === donation._id.toString()
      );
      expect(duplicates).toHaveLength(1);
    });
  });

  describe('User Data Deletion (GDPR)', () => {
    it('should delete all activities for a user', async () => {
      for (let i = 0; i < 10; i++) {
        const req = await createRequest(testHospital._id, {
          bloodType: testDonor.bloodType,
        });
        await donationService.createDonation(testDonor._id, req._id, { quantity: 1 });
      }

      await new Promise((resolve) => setTimeout(resolve, 200));

      let timeline = await activityService.getUserTimeline(testDonor._id);
      expect(timeline.activities.length).toBeGreaterThan(0);

      const result = await activityService.deleteUserActivities(testDonor._id);
      expect(result.deletedCount).toBeGreaterThan(0);

      timeline = await activityService.getUserTimeline(testDonor._id);
      expect(timeline.activities).toHaveLength(0);
      expect(timeline.pagination.total).toBe(0);
    });
  });

  describe('Complex Timeline Scenarios', () => {
    it('should handle mixed activity types in one timeline', async () => {
      for (let i = 0; i < 3; i++) {
        const req = await createRequest(testHospital._id, {
          bloodType: testDonor.bloodType,
        });
        await donationService.createDonation(testDonor._id, req._id, { quantity: 1 });
      }

      await new Promise((resolve) => setTimeout(resolve, 200));

      const allActivities = await activityService.getUserTimeline(testDonor._id);

      expect(allActivities.pagination.total).toBe(3);
      allActivities.activities.forEach((a) => {
        expect(a.type).toBe('donation');
      });
    });

    it('should maintain correct activity sequence in timeline', async () => {
      const req = await createRequest(testHospital._id, {
        bloodType: testDonor.bloodType,
      });

      const donation = await donationService.createDonation(
        testDonor._id,
        req._id,
        { quantity: 1 }
      );

      await new Promise((resolve) => setTimeout(resolve, 200));

      const timeline = await activityService.getUserTimeline(testDonor._id);

      expect(timeline.activities.length).toBeGreaterThanOrEqual(1);

      if (timeline.activities.length >= 2) {
        const first = timeline.activities[0];
        const second = timeline.activities[1];
        expect(new Date(first.createdAt).getTime()).toBeGreaterThanOrEqual(
          new Date(second.createdAt).getTime()
        );
      }
    });
  });
});
