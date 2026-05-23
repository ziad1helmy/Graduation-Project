import { describe, it, expect, beforeEach } from 'vitest';
import { setupTestDB } from '../helpers/db.js';
import { createDonor } from '../helpers/factories.js';
import mongoose from 'mongoose';
import Activity from '../../src/models/Activity.model.js';
import * as activityService from '../../src/services/activity.service.js';

/**
 * Activity Integration Tests — Service Layer
 *
 * Verifies that:
 * 1. Activities are created correctly through the service
 * 2. The service can retrieve them with proper pagination
 * 3. Response formatting is correct
 */

setupTestDB();

describe('Activity API Integration', () => {
  describe('GET /donor/activity', () => {
    beforeEach(async () => {
      // This is a unit/integration test for the service
      // The actual HTTP endpoint will be tested in e2e tests
    });

    it('should return paginated activities with correct shape', async () => {
      const donor = await createDonor();

      // Create mixed activities
      for (let i = 0; i < 25; i++) {
        const type = i % 2 === 0 ? 'donation' : 'reward';
        const action = type === 'donation' ? 'created_donation' : 'earned_points';
        await activityService.logActivity(donor._id, {
          type,
          action,
          title: `Activity ${i}`,
          description: `Test activity ${i}`,
          referenceId: new mongoose.Types.ObjectId().toString(),
          referenceType: type === 'donation' ? 'Donation' : 'PointsTransaction',
          metadata: { index: i },
          icon: 'heart',
        });
      }

      // Simulate controller behavior: call service with pagination
      const result = await activityService.getUserTimeline(donor._id, {
        page: 1,
        limit: 20,
      });

      // Verify response shape
      expect(result).toHaveProperty('activities');
      expect(result).toHaveProperty('pagination');
      expect(Array.isArray(result.activities)).toBe(true);
      expect(result.activities).toHaveLength(20);

      // Verify pagination metadata
      expect(result.pagination.total).toBe(25);
      expect(result.pagination.page).toBe(1);
      expect(result.pagination.limit).toBe(20);
      expect(result.pagination.totalPages).toBe(2);
      expect(result.pagination.hasNextPage).toBe(true);
      expect(result.pagination.hasPrevPage).toBe(false);

      // Verify activity document shape
      const activity = result.activities[0];
      expect(activity).toHaveProperty('_id');
      expect(activity).toHaveProperty('userId');
      expect(activity).toHaveProperty('type');
      expect(activity).toHaveProperty('action');
      expect(activity).toHaveProperty('title');
      expect(activity).toHaveProperty('description');
      expect(activity).toHaveProperty('icon');
      expect(activity).toHaveProperty('createdAt');
      expect(activity).toHaveProperty('referenceId');
      expect(activity).toHaveProperty('referenceType');
      expect(activity).toHaveProperty('metadata');
    });

    it('should return all activity types in a unified timeline', async () => {
      const donor = await createDonor();

      // Create donation activities
      for (let i = 0; i < 5; i++) {
        await activityService.logActivity(donor._id, {
          type: 'donation',
          action: 'created_donation',
          title: `Donation ${i}`,
          description: 'Test',
          referenceId: new mongoose.Types.ObjectId().toString(),
        });
      }

      // Create reward activities
      for (let i = 0; i < 3; i++) {
        await activityService.logActivity(donor._id, {
          type: 'reward',
          action: 'earned_points',
          title: `Reward ${i}`,
          description: 'Test',
          referenceId: new mongoose.Types.ObjectId().toString(),
        });
      }

      const timelineResult = await activityService.getUserTimeline(donor._id, {
        page: 1,
        limit: 20,
      });

      expect(timelineResult.activities).toHaveLength(8);
      expect(timelineResult.pagination.total).toBe(8);

      const types = new Set(timelineResult.activities.map((activity) => activity.type));
      expect(types.has('donation')).toBe(true);
      expect(types.has('reward')).toBe(true);
    });

    it('should return latest 5 activities for dashboard', async () => {
      const donor = await createDonor();

      // Create 15 activities
      const referenceIds = [];
      for (let i = 0; i < 15; i++) {
        const refId = new mongoose.Types.ObjectId().toString();
        referenceIds.push(refId);
        await activityService.logActivity(donor._id, {
          type: 'donation',
          action: 'created_donation',
          title: `Activity ${i}`,
          description: 'Test',
          referenceId: refId,
        });
        // Small delay to ensure different timestamps
        await new Promise(resolve => setTimeout(resolve, 5));
      }

      // Get latest 5 (dashboard shortcut)
      const latest = await activityService.getLatestActivities(donor._id, 5);

      expect(latest).toHaveLength(5);
      // Should be in reverse order (newest first)
      expect(latest[0].referenceId).toBe(referenceIds[14]);
      expect(latest[1].referenceId).toBe(referenceIds[13]);
      expect(latest[4].referenceId).toBe(referenceIds[10]);
    });

    it('should handle empty activities gracefully', async () => {
      const donor = await createDonor();

      const result = await activityService.getUserTimeline(donor._id, {
        page: 1,
        limit: 20,
      });

      expect(result.activities).toHaveLength(0);
      expect(result.pagination.total).toBe(0);
      expect(result.pagination.totalPages).toBe(1);
      expect(result.pagination.hasNextPage).toBe(false);
    });

    it('should handle high page numbers gracefully', async () => {
      const donor = await createDonor();

      for (let i = 0; i < 5; i++) {
        await activityService.logActivity(donor._id, {
          type: 'donation',
          action: 'created_donation',
          title: `Activity ${i}`,
          description: 'Test',
          referenceId: new mongoose.Types.ObjectId().toString(),
        });
      }

      // Request page 10 (doesn't exist)
      const result = await activityService.getUserTimeline(donor._id, {
        page: 10,
        limit: 20,
      });

      expect(result.activities).toHaveLength(0);
      expect(result.pagination.page).toBe(10);
      expect(result.pagination.total).toBe(5);
    });

    it('should enforce limit max of 100', async () => {
      const donor = await createDonor();

      for (let i = 0; i < 150; i++) {
        await activityService.logActivity(donor._id, {
          type: 'donation',
          action: 'created_donation',
          title: `Activity ${i}`,
          description: 'Test',
          referenceId: new mongoose.Types.ObjectId().toString(),
        });
      }

      // Request with limit > 100
      const result = await activityService.getUserTimeline(donor._id, {
        page: 1,
        limit: 200, // Should be capped at 100
      });

      expect(result.activities).toHaveLength(100);
      expect(result.pagination.limit).toBe(100);
    });
  });

  describe('Dashboard Integration', () => {
    it('should include latestActivity in dashboard response shape', async () => {
      const donor = await createDonor();

      // Create a few activities
      for (let i = 0; i < 8; i++) {
        await activityService.logActivity(donor._id, {
          type: 'donation',
          action: 'created_donation',
          title: `Activity ${i}`,
          description: 'Test',
          referenceId: new mongoose.Types.ObjectId().toString(),
        });
      }

      // Simulate dashboard controller
      const latest = await activityService.getLatestActivities(donor._id, 5);

      // Verify dashboard can include this in response
      expect(Array.isArray(latest)).toBe(true);
      expect(latest.length).toBeLessThanOrEqual(5);

      // Each activity should have required dashboard fields
      latest.forEach(activity => {
        expect(activity).toHaveProperty('type');
        expect(activity).toHaveProperty('action');
        expect(activity).toHaveProperty('title');
        expect(activity).toHaveProperty('icon');
        expect(activity).toHaveProperty('createdAt');
      });
    });
  });
});
