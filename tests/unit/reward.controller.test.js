import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as rewardController from '../../src/controllers/reward.controller.js';
import * as rewardService from '../../src/services/reward.service.js';
import { makeMockReq, makeMockRes } from '../helpers/mocks.js';

vi.mock('../../src/services/reward.service.js', () => ({
  getPointsSummary: vi.fn(),
  getRewardsCatalog: vi.fn(),
  getPointsHistory: vi.fn(),
  getDonorBadges: vi.fn(),
  getEarningRules: vi.fn(),
  redeemReward: vi.fn(),
  getDonorRedemptions: vi.fn(),
  getLeaderboard: vi.fn(),
  adminAdjustPoints: vi.fn(),
  adminUpdateRewardStatus: vi.fn(),
  getRewardsAnalytics: vi.fn(),
}));

describe('Reward Controller', () => {
  const userId = '507f1f77bcf86cd799439011';
  const adminId = '507f1f77bcf86cd799439099';
  const rewardId = '507f1f77bcf86cd799439055';

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('getPoints', () => {
    it('returns points summary', async () => {
      const req = makeMockReq({ user: { userId } });
      const res = makeMockRes();
      const next = vi.fn();

      const mockSummary = { pointsBalance: 500, pointsEarnedLifeTime: 1000 };
      rewardService.getPointsSummary.mockResolvedValue(mockSummary);

      await rewardController.getPoints(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json.mock.calls[0][0].data).toEqual(mockSummary);
    });
  });

  describe('getRewardsDashboard', () => {
    it('returns structured rewards dashboard payload', async () => {
      const req = makeMockReq({ user: { userId } });
      const res = makeMockRes();
      const next = vi.fn();

      rewardService.getPointsSummary.mockResolvedValue({ pointsBalance: 200 });
      rewardService.getRewardsCatalog.mockResolvedValue({
        rewards: [
          { _id: 'r1', name: 'Free Mug', pointsCost: 150, status: 'ACTIVE' },
          { _id: 'r2', name: 'T-Shirt', pointsCost: 300, status: 'ACTIVE' },
        ],
      });
      rewardService.getPointsHistory.mockResolvedValue({
        transactions: [{ _id: 't1', transactionType: 'earn', description: 'Donation', pointsAmount: 200, createdAt: new Date() }],
      });
      rewardService.getDonorBadges.mockResolvedValue({
        unlockedCount: 1,
        totalCount: 5,
        completionPercentage: 20,
        badges: [
          { badgeId: 'b1', badgeName: 'First Don', badgeDescription: 'Desc', unlockStatus: 'UNLOCKED', progressCurrent: 1, progressTarget: 1 },
        ],
      });

      await rewardController.getRewardsDashboard(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      const data = res.json.mock.calls[0][0].data;
      expect(data.points).toBe(200);
      expect(data.nextRewardPoints).toBe(300);
      expect(data.pointsToNextReward).toBe(100);
      expect(data.rewards).toHaveLength(2);
      expect(data.history).toHaveLength(1);
      expect(data.badges.unlocked).toBe(1);
    });
  });

  describe('redeemReward', () => {
    it('successfully redeems a reward', async () => {
      const req = makeMockReq({
        user: { userId },
        params: { rewardId },
        body: { delivery_preference: 'EMAIL', delivery_contact: 'test@email.com' },
      });
      const res = makeMockRes();
      const next = vi.fn();

      const mockRedeemResult = { redemptionId: 'red123', status: 'SUCCESS' };
      rewardService.redeemReward.mockResolvedValue(mockRedeemResult);

      await rewardController.redeemReward(req, res, next);

      expect(rewardService.redeemReward).toHaveBeenCalledWith(userId, rewardId, {
        deliveryMethod: 'EMAIL',
        deliveryContact: 'test@email.com',
      });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json.mock.calls[0][0].data).toEqual(mockRedeemResult);
    });

    it('returns 409 when client has insufficient points', async () => {
      const req = makeMockReq({
        user: { userId },
        params: { rewardId },
        body: {},
      });
      const res = makeMockRes();
      const next = vi.fn();

      const err = new Error('Insufficient points');
      err.code = 'INSUFFICIENT_POINTS';
      err.details = { required: 300, current: 100 };
      rewardService.redeemReward.mockRejectedValue(err);

      await rewardController.redeemReward(req, res, next);

      expect(res.status).toHaveBeenCalledWith(409);
      expect(res.json.mock.calls[0][0].success).toBe(false);
      expect(res.json.mock.calls[0][0].details).toEqual(err.details);
    });
  });

  describe('adminAdjustPoints', () => {
    it('returns 400 if amount or reason missing', async () => {
      const req = makeMockReq({
        user: { userId: adminId },
        params: { userId },
        body: { amount: 100 }, // missing reason
      });
      const res = makeMockRes();
      const next = vi.fn();

      await rewardController.adminAdjustPoints(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json.mock.calls[0][0].message).toBe('Amount and reason are required');
    });

    it('successfully adjusts points when request is valid', async () => {
      const req = makeMockReq({
        user: { userId: adminId },
        params: { userId },
        body: { amount: 100, reason: 'Good deed' },
      });
      const res = makeMockRes();
      const next = vi.fn();

      rewardService.adminAdjustPoints.mockResolvedValue({ success: true, pointsBalance: 200 });

      await rewardController.adminAdjustPoints(req, res, next);

      expect(rewardService.adminAdjustPoints).toHaveBeenCalledWith(userId, 100, 'Good deed', adminId);
      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

  describe('adminUpdateRewardStatus', () => {
    it('returns 400 if status is invalid', async () => {
      const req = makeMockReq({
        user: { userId: adminId },
        params: { rewardId },
        body: { status: 'EXPIRED' }, // Invalid status, should be ACTIVE/INACTIVE/LIMITED
      });
      const res = makeMockRes();
      const next = vi.fn();

      await rewardController.adminUpdateRewardStatus(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('updates status when status is valid', async () => {
      const req = makeMockReq({
        user: { userId: adminId },
        params: { rewardId },
        body: { status: 'ACTIVE' },
      });
      const res = makeMockRes();
      const next = vi.fn();

      rewardService.adminUpdateRewardStatus.mockResolvedValue({ rewardId, status: 'ACTIVE' });

      await rewardController.adminUpdateRewardStatus(req, res, next);

      expect(rewardService.adminUpdateRewardStatus).toHaveBeenCalledWith(rewardId, 'ACTIVE', adminId);
      expect(res.status).toHaveBeenCalledWith(200);
    });
  });
});
