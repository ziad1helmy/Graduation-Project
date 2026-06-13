import * as analyticsService from '../services/analytics.service.js';
import response from '../utils/response.js';
import { logger } from '../utils/logger.js';

/**
 * GET /analytics/my-stats
 * Get donor's personal donation statistics
 */
export const getMyStats = async (req, res, next) => {
  try {
    const { userId } = req.user;
    const stats = await analyticsService.getDonorStats(userId);
    return response.success(res, 200, 'Donor stats retrieved', stats);
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
    return response.success(res, 200, 'Leaderboard retrieved', leaderboard);
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
    return response.success(res, 200, 'Donation type stats retrieved', stats);
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
    return response.success(res, 200, 'Dashboard summary retrieved', summary);
  } catch (error) {
    logger.error('Error fetching dashboard summary', { error: error?.message });
    return next(error);
  }
};

/**
 * GET /analytics/overview (Admin only)
 * Get analytics overview with growth rate, success rate, monthly trend, and AI predictions
 */
export const getAnalyticsOverview = async (req, res, next) => {
  try {
    const overview = await analyticsService.getAnalyticsOverview();
    return response.success(res, 200, 'Analytics overview retrieved', overview);
  } catch (error) {
    logger.error('Error fetching analytics overview', { error: error?.message });
    return next(error);
  }
};

export default {
  getMyStats,
  getLeaderboard,
  getDonationTypeStats,
  getDashboardSummary,
  getAnalyticsOverview,
};
