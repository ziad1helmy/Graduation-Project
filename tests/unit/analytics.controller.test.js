import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as analyticsController from '../../src/controllers/analytics.controller.js';
import * as analyticsService from '../../src/services/analytics.service.js';
import { makeMockReq, makeMockRes } from '../helpers/mocks.js';

vi.mock('../../src/services/analytics.service.js', () => ({
  getDonorStats: vi.fn(),
  getLeaderboard: vi.fn(),
  getDonationTypeStats: vi.fn(),
  getDashboardSummary: vi.fn(),
}));

describe('Analytics Controller', () => {
  const userId = '507f1f77bcf86cd799439011';

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('getMyStats', () => {
    it('returns 200 and stats data', async () => {
      const req = makeMockReq({ user: { userId } });
      const res = makeMockRes();
      const next = vi.fn();

      const mockStats = { totalDonations: 5, totalPoints: 1000 };
      analyticsService.getDonorStats.mockResolvedValue(mockStats);

      await analyticsController.getMyStats(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      const callArgs = res.json.mock.calls[0][0];
      expect(callArgs.success).toBe(true);
      expect(callArgs.data).toEqual(mockStats);
    });

    it('passes errors to next handler', async () => {
      const req = makeMockReq({ user: { userId } });
      const res = makeMockRes();
      const next = vi.fn();

      const error = new Error('Service error');
      analyticsService.getDonorStats.mockRejectedValue(error);

      await analyticsController.getMyStats(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe('getLeaderboard', () => {
    it('returns 200 and leaderboard using query parameters', async () => {
      const req = makeMockReq({ query: { limit: '5', days: '7' } });
      const res = makeMockRes();
      const next = vi.fn();

      const mockLeaderboard = [{ name: 'Donor 1', points: 500 }];
      analyticsService.getLeaderboard.mockResolvedValue(mockLeaderboard);

      await analyticsController.getLeaderboard(req, res, next);

      expect(analyticsService.getLeaderboard).toHaveBeenCalledWith(5, 7);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json.mock.calls[0][0].data).toEqual(mockLeaderboard);
    });
  });

  describe('getDonationTypeStats', () => {
    it('returns 200 and donation type stats', async () => {
      const req = makeMockReq();
      const res = makeMockRes();
      const next = vi.fn();

      const mockStats = { wholeBlood: 10, plasma: 5 };
      analyticsService.getDonationTypeStats.mockResolvedValue(mockStats);

      await analyticsController.getDonationTypeStats(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json.mock.calls[0][0].data).toEqual(mockStats);
    });
  });

  describe('getDashboardSummary', () => {
    it('returns 200 and admin dashboard summary', async () => {
      const req = makeMockReq();
      const res = makeMockRes();
      const next = vi.fn();

      const mockSummary = { usersCount: 150, donationsCount: 300 };
      analyticsService.getDashboardSummary.mockResolvedValue(mockSummary);

      await analyticsController.getDashboardSummary(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json.mock.calls[0][0].data).toEqual(mockSummary);
    });
  });
});
