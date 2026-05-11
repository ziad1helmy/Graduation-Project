import response from '../utils/response.js';
import * as rewardService from '../services/reward.service.js';
import { parsePagination } from '../utils/pagination.js';

// ── Donor endpoints ──────────────────────────

export const getPoints = async (req, res, next) => {
  try {
    const data = await rewardService.getPointsSummary(req.user.userId);
    response.success(res, 200, 'Points retrieved successfully', data);
  } catch (err) { next(err); }
};

export const getRewardsDashboard = async (req, res, next) => {
  try {
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
  } catch (err) { next(err); }
};

export const getRewardsStats = async (req, res, next) => {
  try {
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
  } catch (err) { next(err); }
};

export const getPointsHistory = async (req, res, next) => {
  try {
    const { filter, date_from, date_to } = req.query;
    const { page, limit } = parsePagination(req.query, 20);
    const data = await rewardService.getPointsHistory(req.user.userId, { page, limit, filter, dateFrom: date_from, dateTo: date_to });
    response.success(res, 200, 'Points history retrieved successfully', data);
  } catch (err) { next(err); }
};

export const getRewards = async (req, res, next) => {
  try {
    const data = await rewardService.getRewardsCatalog(req.query);
    response.success(res, 200, 'Rewards retrieved successfully', data);
  } catch (err) { next(err); }
};
export const getEarningRules = async (req, res, next) => {
  try {
    const data = await rewardService.getEarningRules();
    response.success(res, 200, 'Reward earning rules retrieved successfully', data);
  } catch (err) { next(err); }
};

export const redeemReward = async (req, res, next) => {
  try {
    const { rewardId } = req.params;
    const { delivery_preference, delivery_contact } = req.body;
    const data = await rewardService.redeemReward(req.user.userId, rewardId, {
      deliveryMethod: delivery_preference || 'IN_APP',
      deliveryContact: delivery_contact || null,
    });
    response.success(res, 200, 'Reward redeemed successfully', data);
  } catch (err) {
    if (err.code === 'INSUFFICIENT_POINTS') {
      return response.error(res, 409, err.message, err.details);
    }
    if (err.statusCode) return response.error(res, err.statusCode, err.message);
    next(err);
  }
};

export const getRedemptions = async (req, res, next) => {
  try {
    const { status } = req.query;
    const { page, limit } = parsePagination(req.query, 20);
    const data = await rewardService.getDonorRedemptions(req.user.userId, { page, limit, status });
    response.success(res, 200, 'Redemptions retrieved successfully', data);
  } catch (err) { next(err); }
};

export const getHistory = async (req, res, next) => {
  try {
    const { status } = req.query;
    const { page, limit } = parsePagination(req.query, 20);
    const data = await rewardService.getDonorRedemptions(req.user.userId, { page, limit, status });
    response.success(res, 200, 'Reward history retrieved successfully', data);
  } catch (err) { next(err); }
};

export const getBadges = async (req, res, next) => {
  try {
    const data = await rewardService.getDonorBadges(req.user.userId);
    response.success(res, 200, 'Badges retrieved successfully', data);
  } catch (err) { next(err); }
};

export const getLeaderboard = async (req, res, next) => {
  try {
    const limit = parseInt(req.query.limit) || 20;
    const data = await rewardService.getLeaderboard(limit);
    response.success(res, 200, 'Leaderboard retrieved successfully', { leaderboard: data });
  } catch (err) { next(err); }
};

// ── Admin endpoints ──────────────────────────

export const adminAdjustPoints = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { amount, reason } = req.body;
    if (!amount || !reason) return response.error(res, 400, 'Amount and reason are required');
    const data = await rewardService.adminAdjustPoints(userId, parseInt(amount), reason, req.user.userId);
    response.success(res, 200, 'Points adjusted successfully', data);
  } catch (err) {
    if (err.statusCode) return response.error(res, err.statusCode, err.message);
    next(err);
  }
};

export const adminUpdateRewardStatus = async (req, res, next) => {
  try {
    const { rewardId } = req.params;
    const { status } = req.body;
    if (!['ACTIVE', 'INACTIVE', 'LIMITED'].includes(status)) {
      return response.error(res, 400, 'Status must be ACTIVE, INACTIVE, or LIMITED');
    }
    const data = await rewardService.adminUpdateRewardStatus(rewardId, status, req.user.userId);
    response.success(res, 200, 'Reward status updated', data);
  } catch (err) {
    if (err.statusCode) return response.error(res, err.statusCode, err.message);
    next(err);
  }
};

export const adminGetRewardsAnalytics = async (req, res, next) => {
  try {
    const data = await rewardService.getRewardsAnalytics();
    response.success(res, 200, 'Rewards analytics retrieved', data);
  } catch (err) { next(err); }
};
