import { describe, it, expect, beforeEach } from 'vitest';
import { setupTestDB } from '../helpers/db.js';
import { createDonor, createRequest, createDonation } from '../helpers/factories.js';
import mongoose from 'mongoose';
import Activity from '../../src/models/Activity.model.js';
import * as activityService from '../../src/services/activity.service.js';

setupTestDB();

describe('Activity Service', () => {
  describe('logActivity()', () => {
    it('should create an activity with all required fields', async () => {
      const donor = await createDonor();
      
      const activity = await activityService.logActivity(donor._id, {
        type: 'donation',
        action: 'created_donation',
        title: 'Blood Donation Submitted',
        description: 'Submitted A+ blood donation request to Cairo Hospital',
        referenceId: new mongoose.Types.ObjectId().toString(),
        referenceType: 'Donation',
        metadata: { bloodType: 'A+', hospitalName: 'Cairo Hospital' },
        icon: 'heart',
      });

      expect(activity).toBeTruthy();
      expect(activity.userId.toString()).toBe(donor._id.toString());
      expect(activity.type).toBe('donation');
      expect(activity.action).toBe('created_donation');
      expect(activity.title).toBe('Blood Donation Submitted');
    });

    it('should deduplicate activities with the same userId + action + referenceId', async () => {
      const donor = await createDonor();
      const referenceId = new mongoose.Types.ObjectId().toString();

      // Create first activity
      const first = await activityService.logActivity(donor._id, {
        type: 'donation',
        action: 'completed_donation',
        title: 'Donation Completed',
        description: 'Successfully completed donation',
        referenceId,
        referenceType: 'Donation',
      });

      // Try to create duplicate
      const second = await activityService.logActivity(donor._id, {
        type: 'donation',
        action: 'completed_donation',
        title: 'Donation Completed',
        description: 'Successfully completed donation',
        referenceId,
        referenceType: 'Donation',
      });

      expect(first).toBeTruthy();
      expect(second).toBeNull(); // Deduplicated, returns null

      // Verify only one activity exists
      const count = await Activity.countDocuments({
        userId: donor._id,
        action: 'completed_donation',
        referenceId,
      });
      expect(count).toBe(1);
    });

    it('should create activities without referenceId without deduplication', async () => {
      const donor = await createDonor();

      const first = await activityService.logActivity(donor._id, {
        type: 'profile_update',
        action: 'updated_profile',
        title: 'Profile Updated',
        description: 'Updated profile information',
        // No referenceId
      });

      const second = await activityService.logActivity(donor._id, {
        type: 'profile_update',
        action: 'updated_profile',
        title: 'Profile Updated',
        description: 'Updated profile information',
        // No referenceId
      });

      expect(first).toBeTruthy();
      expect(second).toBeTruthy(); // Both created, no dedup

      const count = await Activity.countDocuments({
        userId: donor._id,
        action: 'updated_profile',
      });
      expect(count).toBe(2);
    });

    it('should handle missing required fields gracefully', async () => {
      const donor = await createDonor();

      // Missing title
      const result1 = await activityService.logActivity(donor._id, {
        type: 'donation',
        action: 'created_donation',
        description: 'Test',
        // No title
      });
      expect(result1).toBeNull(); // Error logged, returns null

      // Missing userId
      const result2 = await activityService.logActivity(null, {
        type: 'donation',
        action: 'created_donation',
        title: 'Test',
        description: 'Test',
      });
      expect(result2).toBeNull();
    });
  });

  describe('getUserTimeline()', () => {
    beforeEach(async () => {
      // Create a donor with multiple activities
      const donor = await createDonor();
      
      for (let i = 0; i < 5; i++) {
        await activityService.logActivity(donor._id, {
          type: 'donation',
          action: 'created_donation',
          title: `Donation ${i}`,
          description: `Test donation ${i}`,
          referenceId: new mongoose.Types.ObjectId().toString(),
        });
      }

      for (let i = 0; i < 3; i++) {
        await activityService.logActivity(donor._id, {
          type: 'reward',
          action: 'earned_points',
          title: `Points Earned ${i}`,
          description: `Earned points`,
          referenceId: new mongoose.Types.ObjectId().toString(),
        });
      }
    });

    it('should return paginated activities for a user', async () => {
      const donor = await createDonor();
      
      for (let i = 0; i < 30; i++) {
        await activityService.logActivity(donor._id, {
          type: 'donation',
          action: 'created_donation',
          title: `Activity ${i}`,
          description: 'Test',
          referenceId: new mongoose.Types.ObjectId().toString(),
        });
      }

      const result = await activityService.getUserTimeline(donor._id, {
        page: 1,
        limit: 10,
      });

      expect(result.activities).toHaveLength(10);
      expect(result.pagination.total).toBe(30);
      expect(result.pagination.page).toBe(1);
      expect(result.pagination.totalPages).toBe(3);
      expect(result.pagination.hasNextPage).toBe(true);
      expect(result.pagination.hasPrevPage).toBe(false);
    });

    it('should return activities in newest-first order', async () => {
      const donor = await createDonor();
      const refIds = [];

      for (let i = 0; i < 3; i++) {
        const refId = new mongoose.Types.ObjectId().toString();
        refIds.push(refId);
        await activityService.logActivity(donor._id, {
          type: 'donation',
          action: 'created_donation',
          title: `Activity ${i}`,
          description: 'Test',
          referenceId: refId,
        });
        // Small delay to ensure different timestamps
        await new Promise(resolve => setTimeout(resolve, 10));
      }

      const result = await activityService.getUserTimeline(donor._id, {
        page: 1,
        limit: 10,
      });

      // Should be in reverse order (newest first)
      expect(result.activities[0].referenceId).toBe(refIds[2]);
      expect(result.activities[1].referenceId).toBe(refIds[1]);
      expect(result.activities[2].referenceId).toBe(refIds[0]);
    });

    it('should filter activities by type', async () => {
      const donor = await createDonor();

      // Create mixed activities
      for (let i = 0; i < 5; i++) {
        await activityService.logActivity(donor._id, {
          type: 'donation',
          action: 'created_donation',
          title: `Donation ${i}`,
          description: 'Test',
          referenceId: new mongoose.Types.ObjectId().toString(),
        });
      }

      for (let i = 0; i < 3; i++) {
        await activityService.logActivity(donor._id, {
          type: 'reward',
          action: 'earned_points',
          title: `Reward ${i}`,
          description: 'Test',
          referenceId: new mongoose.Types.ObjectId().toString(),
        });
      }

      const result = await activityService.getUserTimeline(donor._id, {
        page: 1,
        limit: 20,
        type: 'donation',
      });

      expect(result.activities).toHaveLength(5);
      result.activities.forEach(activity => {
        expect(activity.type).toBe('donation');
      });
    });

    it('should handle pagination correctly', async () => {
      const donor = await createDonor();

      for (let i = 0; i < 25; i++) {
        await activityService.logActivity(donor._id, {
          type: 'donation',
          action: 'created_donation',
          title: `Activity ${i}`,
          description: 'Test',
          referenceId: new mongoose.Types.ObjectId().toString(),
        });
      }

      // Page 2
      const page2 = await activityService.getUserTimeline(donor._id, {
        page: 2,
        limit: 10,
      });

      expect(page2.activities).toHaveLength(10);
      expect(page2.pagination.page).toBe(2);
      expect(page2.pagination.hasNextPage).toBe(true);
      expect(page2.pagination.hasPrevPage).toBe(true);

      // Page 3
      const page3 = await activityService.getUserTimeline(donor._id, {
        page: 3,
        limit: 10,
      });

      expect(page3.activities).toHaveLength(5);
      expect(page3.pagination.page).toBe(3);
      expect(page3.pagination.hasNextPage).toBe(false);
      expect(page3.pagination.hasPrevPage).toBe(true);
    });
  });

  describe('getLatestActivities()', () => {
    it('should return latest N activities without pagination overhead', async () => {
      const donor = await createDonor();

      for (let i = 0; i < 15; i++) {
        await activityService.logActivity(donor._id, {
          type: 'donation',
          action: 'created_donation',
          title: `Activity ${i}`,
          description: 'Test',
          referenceId: new mongoose.Types.ObjectId().toString(),
        });
      }

      const latest = await activityService.getLatestActivities(donor._id, 5);

      expect(latest).toHaveLength(5);
      expect(latest[0].createdAt >= latest[4].createdAt).toBe(true); // Newest first
    });

    it('should return default count of 5 when not specified', async () => {
      const donor = await createDonor();

      for (let i = 0; i < 20; i++) {
        await activityService.logActivity(donor._id, {
          type: 'donation',
          action: 'created_donation',
          title: `Activity ${i}`,
          description: 'Test',
          referenceId: new mongoose.Types.ObjectId().toString(),
        });
      }

      const latest = await activityService.getLatestActivities(donor._id);

      expect(latest).toHaveLength(5);
    });

    it('should handle fewer activities than requested count', async () => {
      const donor = await createDonor();

      for (let i = 0; i < 3; i++) {
        await activityService.logActivity(donor._id, {
          type: 'donation',
          action: 'created_donation',
          title: `Activity ${i}`,
          description: 'Test',
          referenceId: new mongoose.Types.ObjectId().toString(),
        });
      }

      const latest = await activityService.getLatestActivities(donor._id, 5);

      expect(latest).toHaveLength(3);
    });
  });

  describe('deleteUserActivities()', () => {
    it('should delete all activities for a user', async () => {
      const donor = await createDonor();

      for (let i = 0; i < 10; i++) {
        await activityService.logActivity(donor._id, {
          type: 'donation',
          action: 'created_donation',
          title: `Activity ${i}`,
          description: 'Test',
          referenceId: new mongoose.Types.ObjectId().toString(),
        });
      }

      const beforeCount = await Activity.countDocuments({ userId: donor._id });
      expect(beforeCount).toBe(10);

      const result = await activityService.deleteUserActivities(donor._id);

      expect(result.deletedCount).toBe(10);

      const afterCount = await Activity.countDocuments({ userId: donor._id });
      expect(afterCount).toBe(0);
    });

    it('should handle deletion for user with no activities', async () => {
      const donor = await createDonor();

      const result = await activityService.deleteUserActivities(donor._id);

      expect(result.deletedCount).toBe(0);
    });
  });
});
