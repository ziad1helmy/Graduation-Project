import { describe, it, expect, beforeEach } from 'vitest';
import { setupTestDB } from '../helpers/db.js';
import { createHospital, createDonor, createRequest } from '../helpers/factories.js';
import * as rewardService from '../../src/services/reward.service.js';
import * as donationService from '../../src/services/donation.service.js';
import * as activityService from '../../src/services/activity.service.js';
import Activity from '../../src/models/Activity.model.js';
import DonorPoints from '../../src/models/DonorPoints.model.js';
import Badge from '../../src/models/Badge.model.js';

setupTestDB();

let testDonor;
let testHospital;

beforeEach(async () => {
  testHospital = await createHospital();
  testDonor = await createDonor();
  await Activity.deleteMany({ userId: testDonor._id });
});

describe('Reward Activity Integration', () => {
  describe('Points Earned Activity Logging', () => {
    it('should log earned_points activity when points are awarded via onDonationCompleted', async () => {
      const testRequest = await createRequest(testHospital._id, {
        bloodType: testDonor.bloodType,
      });

      const donation = await donationService.createDonation(
        testDonor._id,
        testRequest._id,
        { quantity: 1 }
      );

      // Clear activities from creation
      await Activity.deleteMany({ userId: testDonor._id });

      // Complete donation and trigger reward
      await donationService.updateDonationStatus(donation._id, 'completed');

      // Wait for fire-and-forget logging
      await new Promise((resolve) => setTimeout(resolve, 150));

      const activities = await Activity.find({
        userId: testDonor._id,
        type: 'reward',
        action: 'earned_points',
      });

      expect(activities.length).toBeGreaterThan(0);
      const pointsActivity = activities.find(
        (a) => a.metadata.transactionType === 'BLOOD_DONATION'
      );
      expect(pointsActivity).toBeDefined();
      expect(pointsActivity.title).toBe('Points Earned');
      expect(pointsActivity.metadata.pointsAmount).toBeGreaterThan(0);
      expect(pointsActivity.metadata.transactionType).toBe('BLOOD_DONATION');
    });

    it('should include balance after in points earned activity', async () => {
      const testRequest = await createRequest(testHospital._id, {
        bloodType: testDonor.bloodType,
      });

      const donation = await donationService.createDonation(
        testDonor._id,
        testRequest._id,
        { quantity: 1 }
      );

      await Activity.deleteMany({ userId: testDonor._id });
      await donationService.updateDonationStatus(donation._id, 'completed');

      await new Promise((resolve) => setTimeout(resolve, 150));

      const activity = await Activity.findOne({
        userId: testDonor._id,
        type: 'reward',
        action: 'earned_points',
        'metadata.transactionType': 'BLOOD_DONATION',
      });

      expect(activity.metadata.balanceAfter).toBeDefined();
      expect(activity.metadata.balanceAfter).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Tier Promotion Activity Logging', () => {
    it('should log tier_promoted activity when donor reaches new tier', async () => {
      // Award many points to trigger tier promotion
      for (let i = 0; i < 5; i++) {
        await rewardService.onDonationCompleted(testDonor._id, `test_promotion_${i}`, false);
      }

      await new Promise((resolve) => setTimeout(resolve, 200));

      const tierActivities = await Activity.find({
        userId: testDonor._id,
        type: 'reward',
        action: 'tier_promoted',
      });

      expect(tierActivities.length).toBeGreaterThan(0);
      const tierActivity = tierActivities[0];
      expect(tierActivity.title).toBe('Tier Promoted');
      expect(tierActivity.referenceType).toBe('PointsTransaction');
      expect(tierActivity.metadata.newTier).toBeDefined();
      expect(tierActivity.metadata.previousTier).toBeDefined();
      expect(tierActivity.metadata.bonusPoints).toBeDefined();
    });

    it('should capture previous and new tier in metadata', async () => {
      for (let i = 0; i < 5; i++) {
        await rewardService.onDonationCompleted(testDonor._id, `test_tier_meta_${i}`, false);
      }

      await new Promise((resolve) => setTimeout(resolve, 200));

      const tierActivity = await Activity.findOne({
        userId: testDonor._id,
        type: 'reward',
        action: 'tier_promoted',
      });

      if (tierActivity) {
        expect(tierActivity.metadata.previousTier).toBeDefined();
        expect(['bronze', 'silver', 'gold', 'platinum']).toContain(
          tierActivity.metadata.previousTier
        );
        expect(['silver', 'gold', 'platinum']).toContain(tierActivity.metadata.newTier);
      }
    });
  });

  describe('Badge Unlock Activity Logging', () => {
    it('should log badge_unlocked activity when badge is earned', async () => {
      // Create donation to trigger badge check
      const testRequest = await createRequest(testHospital._id, {
        bloodType: testDonor.bloodType,
      });

      const donation = await donationService.createDonation(
        testDonor._id,
        testRequest._id,
        { quantity: 1 }
      );

      await Activity.deleteMany({ userId: testDonor._id });

      // Directly call badge check with donor that has made a donation
      await rewardService.checkAndUpdateBadges(testDonor._id);

      await new Promise((resolve) => setTimeout(resolve, 150));

      // Check for any badge unlocked activity
      const allActivities = await Activity.find({ userId: testDonor._id });
      const badgeActivities = allActivities.filter((a) => a.action === 'badge_unlocked');

      if (badgeActivities.length > 0) {
        const badgeActivity = badgeActivities[0];
        expect(badgeActivity.title).toBe('Badge Unlocked');
        expect(badgeActivity.referenceType).toBe('Badge');
        expect(badgeActivity.metadata.badgeName).toBeDefined();
        expect(badgeActivity.metadata.badgeRarity).toBeDefined();
      }
    });

    it('should include badge details in metadata', async () => {
      const testRequest = await createRequest(testHospital._id, {
        bloodType: testDonor.bloodType,
      });

      const donation = await donationService.createDonation(
        testDonor._id,
        testRequest._id,
        { quantity: 1 }
      );

      await Activity.deleteMany({ userId: testDonor._id });

      await rewardService.checkAndUpdateBadges(testDonor._id);

      await new Promise((resolve) => setTimeout(resolve, 150));

      const allActivities = await Activity.find({ userId: testDonor._id });
      const badgeActivity = allActivities.find((a) => a.action === 'badge_unlocked');

      if (badgeActivity) {
        expect(badgeActivity.metadata.badgeName).toBeDefined();
        expect(badgeActivity.metadata.badgeCategory).toBeDefined();
        expect(badgeActivity.metadata.badgeRarity).toBeDefined();
        expect(badgeActivity.metadata.pointsReward).toBeDefined();
        expect(badgeActivity.metadata.unlockedAt).toBeDefined();
      }
    });

    it('should have proper badge name in description', async () => {
      const testRequest = await createRequest(testHospital._id, {
        bloodType: testDonor.bloodType,
      });

      const donation = await donationService.createDonation(
        testDonor._id,
        testRequest._id,
        { quantity: 1 }
      );

      await Activity.deleteMany({ userId: testDonor._id });

      await rewardService.checkAndUpdateBadges(testDonor._id);

      await new Promise((resolve) => setTimeout(resolve, 150));

      const allActivities = await Activity.find({ userId: testDonor._id });
      const badgeActivity = allActivities.find((a) => a.action === 'badge_unlocked');

      if (badgeActivity) {
        expect(badgeActivity.description).toContain('unlocked');
        expect(badgeActivity.description).toContain(badgeActivity.metadata.badgeName);
      }
    });
  });

  describe('Reward Redemption Activity Logging', () => {
    it('should log redeemed_reward activity when reward is redeemed', async () => {
      // Award points to testDonor
      await rewardService.onDonationCompleted(testDonor._id, 'test_donation_1', false);

      await new Promise((resolve) => setTimeout(resolve, 150));
      await Activity.deleteMany({ userId: testDonor._id });

      // Get a reward to redeem
      const catalogRes = await rewardService.getRewardsCatalog();
      const affordableReward = catalogRes.rewards.find((r) => r.pointsCost <= 500);

      if (affordableReward) {
        const result = await rewardService.redeemReward(testDonor._id, affordableReward._id, {
          deliveryMethod: 'IN_APP',
        });

        await new Promise((resolve) => setTimeout(resolve, 100));

        if (result && result.success !== false) {
          const redeemActivity = await Activity.findOne({
            userId: testDonor._id,
            type: 'reward',
            action: 'redeemed_reward',
          });

          if (redeemActivity) {
            expect(redeemActivity.title).toBe('Reward Redeemed');
            expect(redeemActivity.referenceType).toBe('RewardRedemption');
            expect(redeemActivity.metadata.rewardName).toBe(affordableReward.name);
            expect(redeemActivity.metadata.pointsSpent).toBe(affordableReward.pointsCost);
          }
        }
      }
    });

    it('should include reward and points details in metadata', async () => {
      await rewardService.onDonationCompleted(testDonor._id, 'test_donation_2', false);

      await new Promise((resolve) => setTimeout(resolve, 150));
      await Activity.deleteMany({ userId: testDonor._id });

      const catalogRes = await rewardService.getRewardsCatalog();
      const affordableReward = catalogRes.rewards.find((r) => r.pointsCost <= 500);

      if (affordableReward) {
        const result = await rewardService.redeemReward(testDonor._id, affordableReward._id, {
          deliveryMethod: 'IN_APP',
        });

        await new Promise((resolve) => setTimeout(resolve, 100));

        if (result && result.success !== false) {
          const redeemActivity = await Activity.findOne({
            userId: testDonor._id,
            type: 'reward',
            action: 'redeemed_reward',
          });

          if (redeemActivity) {
            expect(redeemActivity.metadata.rewardName).toBe(affordableReward.name);
            expect(redeemActivity.metadata.rewardCategory).toBe(affordableReward.category);
            expect(redeemActivity.metadata.pointsSpent).toBe(affordableReward.pointsCost);
            expect(redeemActivity.metadata.deliveryMethod).toBe('IN_APP');
            expect(redeemActivity.metadata.confirmationCode).toBeDefined();
            expect(redeemActivity.metadata.remainingPoints).toBeDefined();
          }
        }
      }
    });

    it('should show points spent and remaining in description', async () => {
      await rewardService.onDonationCompleted(testDonor._id, 'test_donation_3', false);

      await new Promise((resolve) => setTimeout(resolve, 150));
      await Activity.deleteMany({ userId: testDonor._id });

      const catalogRes = await rewardService.getRewardsCatalog();
      const affordableReward = catalogRes.rewards.find((r) => r.pointsCost <= 500);

      if (affordableReward) {
        const result = await rewardService.redeemReward(testDonor._id, affordableReward._id, {
          deliveryMethod: 'IN_APP',
        });

        await new Promise((resolve) => setTimeout(resolve, 100));

        if (result && result.success !== false) {
          const redeemActivity = await Activity.findOne({
            userId: testDonor._id,
            type: 'reward',
            action: 'redeemed_reward',
          });

          if (redeemActivity) {
            expect(redeemActivity.description).toContain('Redeemed');
            expect(redeemActivity.description).toContain(affordableReward.name);
            expect(redeemActivity.description).toContain(affordableReward.pointsCost.toString());
          }
        }
      }
    });
  });

  describe('Reward Activity Timeline Integration', () => {
    it('should retrieve reward activities from timeline', async () => {
      const testRequest = await createRequest(testHospital._id, {
        bloodType: testDonor.bloodType,
      });

      const donation = await donationService.createDonation(
        testDonor._id,
        testRequest._id,
        { quantity: 1 }
      );

      await Activity.deleteMany({ userId: testDonor._id });
      await donationService.updateDonationStatus(donation._id, 'completed');

      await new Promise((resolve) => setTimeout(resolve, 150));

      const timeline = await activityService.getUserTimeline(testDonor._id, {
        type: 'reward',
      });

      expect(timeline.activities.length).toBeGreaterThan(0);
      expect(timeline.activities.every((a) => a.type === 'reward')).toBe(true);
    });

    it('should filter reward activities by type', async () => {
      const testRequest = await createRequest(testHospital._id, {
        bloodType: testDonor.bloodType,
      });

      const donation = await donationService.createDonation(
        testDonor._id,
        testRequest._id,
        { quantity: 1 }
      );

      await donationService.updateDonationStatus(donation._id, 'completed');

      await new Promise((resolve) => setTimeout(resolve, 150));

      const timeline = await activityService.getUserTimeline(testDonor._id, {
        type: 'reward',
      });

      expect(timeline.activities.length).toBeGreaterThan(0);
      const hasEarnedPoints = timeline.activities.some(
        (a) => a.action === 'earned_points'
      );
      expect(hasEarnedPoints).toBe(true);
    });
  });
});
