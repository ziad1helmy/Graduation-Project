import response from '../utils/response.js';
import * as rewardService from '../services/reward.service.js';
import { parsePagination } from '../utils/pagination.js';
import { asyncHandler } from '../middlewares/asyncHandler.js';
import { HttpError } from '../utils/HttpError.js';


// ── Donor endpoints ──────────────────────────

export const getPoints = asyncHandler(async (req, res) => {
  const data = await rewardService.getPointsSummary(req.user.userId);
  response.success(res, 200, 'Points retrieved successfully', data);
});

export const getRewardsDashboard = asyncHandler(async (req, res) => {
  const donorId = req.user.userId;
  const [pointsSummary, rewards, history, badges] = await Promise.all([
    rewardService.getPointsSummary(donorId),
    rewardService.getRewardsCatalog({}),
    rewardService.getPointsHistory(donorId, { page: 1, limit: 10 }),
    rewardService.getDonorBadges(donorId),
  ]);

  const nextRewardPoints = rewards.rewards.find(r => r.pointsCost > pointsSummary.pointsBalance)?.pointsCost || 0;

  response.success(res, 200, 'Rewards dashboard retrieved', {
    points: pointsSummary.pointsBalance,
    nextRewardPoints,
    pointsToNextReward: Math.max(0, nextRewardPoints - pointsSummary.pointsBalance),
    rewards: rewards.rewards.map(r => ({
      id: r._id, title: r.name,
      pointsRequired: r.pointsCost, isAvailable: r.status === 'ACTIVE',
    })),
    history: history.transactions.slice(0, 10).map(t => ({
      id: t._id, type: t.transactionType,
      title: t.description, points: t.pointsAmount, createdAt: t.createdAt,
    })),
    badges: {
      unlocked: badges.unlockedCount,
      total: badges.totalCount,
      completion: badges.completionPercentage,
      list: badges.badges.map(b => ({
        id: b.badgeId, title: b.badgeName,
        description: b.badgeDescription,
        isUnlocked: b.unlockStatus === 'UNLOCKED',
        progress: b.progressCurrent, target: b.progressTarget,
      })),
    },
  });
});

export const getRewardsStats = asyncHandler(async (req, res) => {
  const donorId = req.user.userId;
  const [pointsSummary, badges] = await Promise.all([
    rewardService.getPointsSummary(donorId),
    rewardService.getDonorBadges(donorId),
  ]);
  const catalog = await rewardService.getRewardsCatalog({});
  const nextReward = catalog.rewards.find(r => r.pointsCost > pointsSummary.pointsBalance);

  response.success(res, 200, 'Rewards stats retrieved', {
    points: pointsSummary.pointsBalance,
    nextReward: { pointsToGo: nextReward ? nextReward.pointsCost - pointsSummary.pointsBalance : 0 },
    badgesUnlocked: badges.unlockedCount,
    totalBadges: badges.totalCount,
    completionPercent: badges.completionPercentage,
  });
});

export const getPointsHistory = asyncHandler(async (req, res) => {
  const { filter, date_from, date_to } = req.query;
  const { page, limit } = parsePagination(req.query, 20);
  const data = await rewardService.getPointsHistory(req.user.userId, { page, limit, filter, dateFrom: date_from, dateTo: date_to });
  response.success(res, 200, 'Points history retrieved successfully', data);
});

export const getRewards = asyncHandler(async (req, res) => {
  // Exclude internal management fields for donor requests; admins receive full catalog.
  const projection = req.user?.role === 'donor'
    ? '-__v -createdAt -updatedAt -status -dailyLimit -monthlyLimit -redemptionCount'
    : null;
  const data = await rewardService.getRewardsCatalog(req.query, projection);
  response.success(res, 200, 'Rewards retrieved successfully', data);
});
export const getEarningRules = asyncHandler(async (req, res) => {
  const data = await rewardService.getEarningRules();
  response.success(res, 200, 'Reward earning rules retrieved successfully', data);
});

export const redeemReward = asyncHandler(async (req, res) => {
  const { rewardId } = req.params;
  const { delivery_preference, delivery_contact } = req.body;
  try {
    const data = await rewardService.redeemReward(req.user.userId, rewardId, {
      deliveryMethod: delivery_preference || 'IN_APP',
      deliveryContact: delivery_contact || null,
    });
    response.success(res, 200, 'Reward redeemed successfully', data);
  } catch (err) {
    if (err.code === 'INSUFFICIENT_POINTS') {
      throw new HttpError(409, err.message, err.details);
    }
    if (err.statusCode) throw new HttpError(err.statusCode, err.message);
    throw err;
  }
});

export const getRedemptions = asyncHandler(async (req, res) => {
  const { status } = req.query;
  const { page, limit } = parsePagination(req.query, 20);
  const data = await rewardService.getDonorRedemptions(req.user.userId, { page, limit, status });
  response.success(res, 200, 'Redemptions retrieved successfully', data);
});

export const getHistory = asyncHandler(async (req, res) => {
  const { status } = req.query;
  const { page, limit } = parsePagination(req.query, 20);
  const data = await rewardService.getDonorRedemptions(req.user.userId, { page, limit, status });
  response.success(res, 200, 'Reward history retrieved successfully', data);
});

export const getBadges = asyncHandler(async (req, res) => {
  const data = await rewardService.getDonorBadges(req.user.userId);
  response.success(res, 200, 'Badges retrieved successfully', data);
});

export const getLeaderboard = asyncHandler(async (req, res) => {
  const limit = parseInt(req.query.limit) || 20;
  const data = await rewardService.getLeaderboard(limit);
  response.success(res, 200, 'Leaderboard retrieved successfully', { leaderboard: data });
});

// ── Admin endpoints ──────────────────────────

export const adminGetRewardsAnalytics = asyncHandler(async (req, res) => {
  const data = await rewardService.getRewardsAnalytics();
  response.success(res, 200, 'Rewards analytics retrieved', data);
});
