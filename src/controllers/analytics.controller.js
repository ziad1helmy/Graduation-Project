import * as analyticsService from '../services/analytics.service.js';
import response from '../utils/response.js';
import { asyncHandler } from '../middlewares/asyncHandler.js';

/**
 * GET /analytics/my-stats
 * Get donor's personal donation statistics
 */
export const getMyStats = asyncHandler(async (req, res) => {
  const { userId } = req.user;
  const stats = await analyticsService.getDonorStats(userId);
  return response.success(res, 200, 'Donor stats retrieved', stats);
});

/**
 * GET /analytics/leaderboard
 * Get top donors leaderboard
 */
export const getLeaderboard = asyncHandler(async (req, res) => {
  const { limit = 10, days = 30 } = req.query;
  const leaderboard = await analyticsService.getLeaderboard(parseInt(limit), parseInt(days));
  return response.success(res, 200, 'Leaderboard retrieved', leaderboard);
});

/**
 * GET /analytics/donation-types
 * Get donation statistics by type
 */
export const getDonationTypeStats = asyncHandler(async (req, res) => {
  const stats = await analyticsService.getDonationTypeStats();
  return response.success(res, 200, 'Donation type stats retrieved', stats);
});

/**
 * GET /analytics/dashboard (Admin only)
 * Get dashboard summary with key metrics
 */
export const getDashboardSummary = asyncHandler(async (req, res) => {
  const summary = await analyticsService.getDashboardSummary();
  return response.success(res, 200, 'Dashboard summary retrieved', summary);
});

/**
 * GET /analytics/overview (Admin only)
 * Get analytics overview with growth rate, success rate, monthly trend, and AI predictions
 */
export const getAnalyticsOverview = asyncHandler(async (req, res) => {
  const overview = await analyticsService.getAnalyticsOverview();
  return response.success(res, 200, 'Analytics overview retrieved', overview);
});

/**
 * GET /admin/analytics/top-donors
 * Get top donors leaderboard by completed donations (Admin)
 */
export const getTopDonors = asyncHandler(async (req, res) => {
  const limit = parseInt(req.query.limit) || 10;
  const topDonors = await analyticsService.getTopDonors(limit);
  return response.success(res, 200, 'Top donors', { topDonors });
});

export default {
  getMyStats,
  getLeaderboard,
  getDonationTypeStats,
  getDashboardSummary,
  getAnalyticsOverview,
  getTopDonors,
};
