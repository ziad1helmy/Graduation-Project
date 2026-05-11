import * as analyticsService from '../services/analytics.service.js';
import { logger } from '../utils/logger.js';

/**
 * GET /analytics/my-stats
 * Get donor's personal donation statistics
 */
export const getMyStats = async (req, res, next) => {
  try {
    const { userId } = req.user;
    const stats = await analyticsService.getDonorStats(userId);
    return res.status(200).json({ success: true, data: stats });
  } catch (error) {
    logger.error('Error fetching donor stats', { error: error?.message, userId: req.user?.userId });
    return next(error);
  }
};

/**
 * GET /analytics/leaderboard
 * Get top donors leaderboard
 */
export const getLeaderboard = async (req, res, next) => {
  try {
    const { limit = 10, days = 30 } = req.query;
    const leaderboard = await analyticsService.getLeaderboard(parseInt(limit), parseInt(days));
    return res.status(200).json({ success: true, data: leaderboard });
  } catch (error) {
    logger.error('Error fetching leaderboard', { error: error?.message });
    return next(error);
  }
};

/**
 * GET /analytics/donation-types
 * Get donation statistics by type
 */
export const getDonationTypeStats = async (req, res, next) => {
  try {
    const stats = await analyticsService.getDonationTypeStats();
    return res.status(200).json({ success: true, data: stats });
  } catch (error) {
    logger.error('Error fetching donation type stats', { error: error?.message });
    return next(error);
  }
};

/**
 * GET /analytics/dashboard (Admin only)
 * Get dashboard summary with key metrics
 */
export const getDashboardSummary = async (req, res, next) => {
  try {
    const summary = await analyticsService.getDashboardSummary();
    return res.status(200).json({ success: true, data: summary });
  } catch (error) {
    logger.error('Error fetching dashboard summary', { error: error?.message });
    return next(error);
  }
};

export default {
  getMyStats,
  getLeaderboard,
  getDonationTypeStats,
  getDashboardSummary,
};
