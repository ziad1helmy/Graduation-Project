import mongoose from 'mongoose';
import User from '../models/User.model.js';
import Donor from '../models/Donor.model.js';
import Request from '../models/Request.model.js';
import Donation from '../models/Donation.model.js';
import DonorPoints from '../models/DonorPoints.model.js';

import { getCompatibleDonorTypesForRequest } from '../utils/blood-type.js';
import cache from '../utils/cache.js';
import { logger } from '../utils/logger.js';
import { computeGrowth, safeEngine } from '../utils/insight-utils.js';
import { calculateAge } from '../utils/age.js';

/**
 * Analytics Service - Dashboard metrics, trends, and statistics
 */

const DASHBOARD_CACHE_KEY = 'analytics:dashboard:v2';
const DASHBOARD_CACHE_TTL = 60;
const DAYS_MS = 24 * 60 * 60 * 1000;


const buildGrowthAggregation = (matchFilter, thirtyDaysAgo, sixtyDaysAgo, dateField = '$createdAt') => [
  { $match: matchFilter },
  {
    $group: {
      _id: null,
      count: { $sum: 1 },
      current: { $sum: { $cond: [{ $gte: [dateField, thirtyDaysAgo] }, 1, 0] } },
      prev: { $sum: { $cond: [{ $and: [{ $gte: [dateField, sixtyDaysAgo] }, { $lt: [dateField, thirtyDaysAgo] }] }, 1, 0] } },
    },
  },
];

const computeSummaryStats = async () => {
  const now = new Date();
  const thirtyDaysAgo = new Date(now - 30 * DAYS_MS);
  const sixtyDaysAgo = new Date(now - 60 * DAYS_MS);

  const emptyResult = { count: 0, current: 0, prev: 0 };

  const [donorData, activeRequestData, criticalRequestData, completedDonationData] = await Promise.all([
    User.aggregate(buildGrowthAggregation({ role: 'donor', deletedAt: null }, thirtyDaysAgo, sixtyDaysAgo)),
    Request.aggregate(buildGrowthAggregation({ status: { $in: ['pending', 'in-progress'] } }, thirtyDaysAgo, sixtyDaysAgo)),
    Request.aggregate(buildGrowthAggregation({ urgency: 'critical', status: { $in: ['pending', 'in-progress'] } }, thirtyDaysAgo, sixtyDaysAgo)),
    Donation.aggregate(buildGrowthAggregation({ status: 'completed' }, thirtyDaysAgo, sixtyDaysAgo, '$completedDate')),
  ]);

  const donorStats = donorData[0] || emptyResult;
  const activeStats = activeRequestData[0] || emptyResult;
  const criticalStats = criticalRequestData[0] || emptyResult;
  const donationStats = completedDonationData[0] || emptyResult;

  return {
    totalDonors: donorStats.count,
    totalDonorsGrowth: computeGrowth(donorStats.current, donorStats.prev),
    activeRequests: activeStats.count,
    activeRequestsGrowth: computeGrowth(activeStats.current, activeStats.prev),
    criticalCases: criticalStats.count,
    criticalCasesGrowth: computeGrowth(criticalStats.current, criticalStats.prev),
    successfulDonations: donationStats.count,
    successfulDonationsGrowth: computeGrowth(donationStats.current, donationStats.prev),
  };
};

// MongoDB $dayOfWeek: 1=Sun, 2=Mon, ..., 7=Sat
// Flutter expects: Mon, Tue, Wed, Thu, Fri, Sat, Sun
const MONGO_DAY_TO_INDEX = { 2: 0, 3: 1, 4: 2, 5: 3, 6: 4, 7: 5, 1: 6 };
const WEEK_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const computeWeeklyTrends = async () => {
  const now = new Date();
  const sevenDaysAgo = new Date(now - 7 * DAYS_MS);

  const results = await Donation.aggregate([
    { $match: { createdAt: { $gte: sevenDaysAgo } } },
    { $group: { _id: { $dayOfWeek: '$createdAt' }, count: { $sum: 1 } } },
  ]);

  const dayMap = new Map(results.map((r) => [r._id, r.count]));
  const values = new Array(7).fill(0);

  for (const [mongoDay, count] of dayMap.entries()) {
    const idx = MONGO_DAY_TO_INDEX[mongoDay];
    if (idx !== undefined) values[idx] = count;
  }

  return { values, labels: WEEK_LABELS };
};

const computeBloodTypeSupplyDemand = async () => {
  const [activeRequests, donorCounts] = await Promise.all([
    Request.aggregate([
      { $match: { status: { $in: ['pending', 'in-progress'] }, type: 'blood' } },
      { $unwind: '$bloodType' },
      { $group: { _id: '$bloodType', unitsNeeded: { $sum: '$unitsNeeded' } } },
    ]),
    Donor.aggregate([
      { $match: { isSuspended: false, deletedAt: null, bloodType: { $ne: null } } },
      { $group: { _id: '$bloodType', available: { $sum: 1 } } },
    ]),
  ]);

  const donorMap = donorCounts.reduce((map, d) => ({ ...map, [d._id]: d.available }), {});

  return activeRequests.map((req) => {
    const compatible = getCompatibleDonorTypesForRequest([req._id]);
    const available = compatible.reduce((sum, c) => sum + (donorMap[c] || 0), 0);
    return {
      bloodType: req._id,
      unitsNeeded: req.unitsNeeded,
      available,
      ratio: req.unitsNeeded / Math.max(available, 1),
    };
  });
};

const computeCriticalAlerts = async () => {
  const requests = await Request.find({
    urgency: { $in: ['critical', 'high'] },
    status: { $in: ['pending', 'in-progress'] },
  })
    .sort({ urgency: 1, createdAt: -1 })
    .limit(10)
    .populate('hospitalId', 'fullName location contactNumber')
    .lean();

  return requests.map((request) => {
    const bloodTypes = request.bloodType || [];
    const alertType = request.urgency === 'critical' ? 'critical' : 'system';
    const hospital = request.hospitalId || {};
    const hospitalLoc = hospital.location || {};
    const reqLoc = request.hospitalLocationGeo;
    const lat = reqLoc?.coordinates?.[1] ?? request.locationHospital?.latitude ?? hospitalLoc.coordinates?.lat ?? null;
    const lng = reqLoc?.coordinates?.[0] ?? request.locationHospital?.longitude ?? hospitalLoc.coordinates?.lng ?? null;
    const locationStr = request.hospitalName || hospital.fullName || '';

    return {
      id: request._id.toString(),
      title: `Critical need for ${bloodTypes.join(', ')}`,
      type: alertType,
      description: request.notes || `Critical request for ${bloodTypes.join(', ')} blood type(s).`,
      unitsNeeded: request.unitsNeeded ?? request.quantity ?? 1,
      bloodTypesNeeded: bloodTypes,
      hospitalId: hospital._id?.toString?.() || request.hospitalId?.toString?.() || '',
      hospitalName: request.hospitalName || hospital.fullName || '',
      hospitalContact: request.hospitalContact || hospital.contactNumber || '',
      location: locationStr,
      latitude: lat !== null ? parseFloat(lat) : null,
      longitude: lng !== null ? parseFloat(lng) : null,
      predictMatchPercentage: null,
      date: request.requiredBy?.toISOString?.() || request.createdAt?.toISOString?.(),
      createdAt: request.createdAt?.toISOString?.(),
    };
  });
};

const computeBloodTypeMap = async () => {
  const dist = await getBloodTypeDistribution();
  return dist.reduce((map, d) => ({ ...map, [d.bloodType]: d.donors }), {});
};



// ─────────────────────────────────────────────────────────────────────────────
//  AI Insights Engine
const precomputeTrendData = async () => {
  const now = new Date();
  const threeDaysAgo = new Date(now - 3 * DAYS_MS);
  const sevenDaysAgo = new Date(now - 7 * DAYS_MS);
  const fourteenDaysAgo = new Date(now - 14 * DAYS_MS);
  const thirtyDaysAgo = new Date(now - 30 * DAYS_MS);
  const sixtyDaysAgo = new Date(now - 60 * DAYS_MS);

  const [
    requestsLast7d,
    requestsLast14d,
    requestsLast30d,
    requestsLast3d,
    donationsByDay,
    donorActivity,
  ] = await Promise.all([
    Request.countDocuments({ createdAt: { $gte: sevenDaysAgo } }),
    Request.countDocuments({ createdAt: { $gte: fourteenDaysAgo } }),
    Request.countDocuments({ createdAt: { $gte: thirtyDaysAgo } }),
    Request.countDocuments({ createdAt: { $gte: threeDaysAgo } }),
    Donation.aggregate([
      { $match: { createdAt: { $gte: thirtyDaysAgo } } },
      { $group: { _id: { $dayOfWeek: '$createdAt' }, count: { $sum: 1 } } },
    ]),
    Donation.aggregate([
      { $match: { status: 'completed', completedDate: { $gte: sixtyDaysAgo } } },
      { $group: { _id: '$donorId', lastDonation: { $max: '$completedDate' } } },
      { $group: {
        _id: null,
        last30d: { $sum: { $cond: [{ $gte: ['$lastDonation', thirtyDaysAgo] }, 1, 0] } },
        prev30d: { $sum: { $cond: [{ $and: [{ $gte: ['$lastDonation', sixtyDaysAgo] }, { $lt: ['$lastDonation', thirtyDaysAgo] }] }, 1, 0] } },
      }},
    ]),
  ]);

  return {
    requestsLast7d, requestsLast14d, requestsLast30d, requestsLast3d,
    donationsByDay,
    donorActivity: donorActivity[0] || { last30d: 0, prev30d: 0 },
  };
};

const computeWeekOverWeekGrowth = (current, totalForBothWeeks) => {
  const previous = totalForBothWeeks - current;
  return previous > 0 ? (current - previous) / previous : 0;
};

const demandForecastEngine = (data) => {
  const growthRate = computeWeekOverWeekGrowth(data.requestsLast7d, data.requestsLast14d);

  if (growthRate > 0.30) {
    return { title: 'Predicted High Demand', description: `A ${Math.round(growthRate * 100)}% increase in blood requests is predicted next week.`, confidence: Math.round(Math.min(95, 50 + growthRate * 100)) };
  }
  if (growthRate > 0.15) {
    return { title: 'Rising Demand Trend', description: 'Blood requests are trending upward. Prepare additional resources.', confidence: Math.round(Math.min(85, 40 + growthRate * 80)) };
  }
  if (growthRate < -0.20) {
    return { title: 'Declining Demand', description: 'Blood requests are declining. Review inventory allocation.', confidence: Math.round(Math.min(80, 40 + Math.abs(growthRate) * 80)) };
  }
  return null;
};

const shortageEngine = async (supplyDemand) => {
  if (!supplyDemand || supplyDemand.length === 0) return null;

  const worstEntry = supplyDemand.reduce((worst, entry) => (entry.ratio > worst.ratio ? entry : worst), { ratio: 0, bloodType: null });

  if (worstEntry.ratio > 2.0) {
    return { title: 'Shortage Risk', description: `${worstEntry.bloodType} blood stock is expected to deplete within the next 4 days.`, confidence: Math.round(Math.min(98, 60 + worstEntry.ratio * 10)) };
  }
  if (worstEntry.ratio > 1.0) {
    return { title: 'Supply Warning', description: `${worstEntry.bloodType} blood supply is approaching critical levels.`, confidence: Math.round(Math.min(85, 50 + worstEntry.ratio * 10)) };
  }
  return null;
};

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const weeklyPatternEngine = (data) => {
  const dayMap = new Map(data.donationsByDay.map((d) => [d._id, d.count]));
  const counts = [1, 2, 3, 4, 5, 6, 7].map((d) => dayMap.get(d) || 0);
  const avg = counts.reduce((sum, c) => sum + c, 0) / 7;
  if (avg === 0) return null;

  const peakCount = Math.max(...counts);
  const peakDay = DAY_NAMES[counts.indexOf(peakCount)];

  if (peakCount > avg * 1.5) {
    const pct = Math.round(((peakCount - avg) / avg) * 100);
    return { title: 'Peak Day Insight', description: `${peakDay} shows ${pct}% higher donation activity. Consider scheduling more drives on this day.`, confidence: 65 };
  }

  return null;
};

const retentionEngine = (data) => {
  const { last30d, prev30d } = data.donorActivity;
  const retentionRate = prev30d > 0 ? last30d / prev30d : 1;

  if (retentionRate < 0.7) {
    return { title: 'Donor Retention Alert', description: 'Donor return rate has dropped significantly. Consider re-engagement campaigns.', confidence: Math.round(Math.min(90, 60 + (1 - retentionRate) * 100)) };
  }
  if (retentionRate > 1.2) {
    return { title: 'Donor Growth Positive', description: 'More donors are returning compared to last month. Momentum is strong.', confidence: Math.round(Math.min(85, 55 + (retentionRate - 1) * 80)) };
  }
  return null;
};

const surgeEngine = (data) => {
  const expected3Days = (data.requestsLast30d / 30) * 3;
  const surgeRatio = expected3Days > 0 ? data.requestsLast3d / expected3Days : 1;

  if (surgeRatio > 2.0) {
    return { title: 'Emergency Demand Spike', description: 'Blood demand has surged unexpectedly in the last 3 days. Emergency response may be needed.', confidence: Math.round(Math.min(95, 70 + surgeRatio * 8)) };
  }
  return null;
};

const generateAIInsights = async () => {
  const [data, supplyDemand] = await Promise.all([precomputeTrendData(), computeBloodTypeSupplyDemand()]);
  const insights = await Promise.all([
    safeEngine(() => demandForecastEngine(data), 'demandForecast'),
    safeEngine(() => shortageEngine(supplyDemand), 'shortage'),
    safeEngine(() => weeklyPatternEngine(data), 'weeklyPattern'),
    safeEngine(() => retentionEngine(data), 'retention'),
    safeEngine(() => surgeEngine(data), 'surge'),
  ]);

  return insights
    .filter(Boolean)
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 5);
};

// ─────────────────────────────────────────────────────────────────────────────
//  Main Dashboard Service
// ─────────────────────────────────────────────────────────────────────────────
export const getDashboardSummary = async () => {
  const cached = await cache.get(DASHBOARD_CACHE_KEY);
  if (cached) return cached;

  const [summaryStats, weeklyTrends, criticalAlerts, bloodTypeDistribution, topDonors, aiInsights] =
    await Promise.all([
      computeSummaryStats(),
      computeWeeklyTrends(),
      computeCriticalAlerts(),
      computeBloodTypeMap(),
      getTopDonors(5),
      generateAIInsights(),
    ]);

  const result = {
    ...summaryStats,
    weeklyTrends,
    criticalAlerts,
    bloodTypeDistribution,
    topDonors,
    aiInsights,
  };

  await cache.set(DASHBOARD_CACHE_KEY, result, DASHBOARD_CACHE_TTL);
  return result;
};

/**
 * Get blood type distribution for donors and active requests.
 */
export const getBloodTypeDistribution = async () => {
  const bloodTypes = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

  const [donorDist, requestDist] = await Promise.all([
    Donor.aggregate([
      { $match: { bloodType: { $ne: null }, deletedAt: null } },
      { $group: { _id: '$bloodType', count: { $sum: 1 } } },
    ]),
    Request.aggregate([
      { $match: { type: 'blood', status: { $in: ['pending', 'in-progress'] } } },
      { $group: { _id: '$bloodType', count: { $sum: 1 } } },
    ]),
  ]);

  const donorMap = donorDist.reduce((acc, d) => ({ ...acc, [d._id]: d.count }), {});
  const requestMap = requestDist.reduce((acc, r) => ({ ...acc, [r._id]: r.count }), {});

  return bloodTypes.map((bt) => ({
    bloodType: bt,
    donors: donorMap[bt] || 0,
    activeRequests: requestMap[bt] || 0,
  }));
};

/**
 * Get top donors by completed donation count.
 * @param {number} limit - Number of top donors to return (default 10)
 */
export const getTopDonors = async (limit = 10) => {
  const topDonors = await Donation.aggregate([
    { $match: { status: 'completed' } },
    {
      $group: {
        _id: '$donorId',
        completedDonations: { $sum: 1 },
        totalUnits: { $sum: '$quantity' },
        lastDonation: { $max: '$completedDate' },
      },
    },
    { $sort: { completedDonations: -1 } },
    { $limit: parseInt(limit) },
    {
      $lookup: {
        from: 'users',
        localField: '_id',
        foreignField: '_id',
        pipeline: [
          { $match: { deletedAt: null } },
          { $project: {
              fullName: 1,
              email: 1,
              phoneNumber: 1,
              bloodType: 1,
              location: 1,
              isSuspended: 1,
              isEmailVerified: 1,
              dateOfBirth: 1,
              gender: 1,
              weight: 1,
              healthHistory: 1,
              temporaryDeferralUntil: 1,
              createdAt: 1,
            } },
        ],
        as: 'donor',
      },
    },
    { $unwind: '$donor' },
    {
      $lookup: {
        from: 'donorpoints',
        localField: '_id',
        foreignField: 'donorId',
        as: 'points',
      },
    },
    { $unwind: { path: '$points', preserveNullAndEmptyArrays: true } },
    {
      $project: {
        donorId: '$_id',
        completedDonations: '$completedDonations',
        totalUnits: 1,
        lastDonation: 1,
        fullName: '$donor.fullName',
        email: '$donor.email',
        phoneNumber: '$donor.phoneNumber',
        bloodType: '$donor.bloodType',
        location: '$donor.location',
        isSuspended: '$donor.isSuspended',
        isEmailVerified: '$donor.isEmailVerified',
        dateOfBirth: '$donor.dateOfBirth',
        gender: '$donor.gender',
        weight: '$donor.weight',
        healthHistory: '$donor.healthHistory',
        temporaryDeferralUntil: '$donor.temporaryDeferralUntil',
        createdAt: '$donor.createdAt',
        points: { $ifNull: ['$points.pointsBalance', 0] },
        tier: { $ifNull: ['$points.tier', 'bronze'] },
      },
    },
  ]);

  return topDonors.map((d, i) => {
    const age = d.dateOfBirth ? calculateAge(d.dateOfBirth) : null;
    const hasChronic = d.healthHistory?.chronicConditions?.length > 0;
    const isTempDeferred = d.temporaryDeferralUntil && new Date(d.temporaryDeferralUntil) > new Date();
    const isEligible = !d.isSuspended && !hasChronic && age !== null && age >= 17 && !isTempDeferred;
    const loc = d.location;
    const locationString = loc ? (loc.city && loc.governorate ? `${loc.city}, ${loc.governorate}` : loc.city || loc.governorate || '') : '';

    return {
      id: d.donorId.toString(),
      name: d.fullName,
      email: d.email,
      phoneNumber: d.phoneNumber,
      bloodType: d.bloodType,
      totalDonations: Math.floor(d.completedDonations),
      points: Math.floor(d.points),
      isEligibleToDonate: isEligible,
      isActive: !d.isSuspended,
      isVerified: d.isEmailVerified,
      location: locationString,
      gender: d.gender,
      age,
      weight: d.weight,
      healthStatus: hasChronic ? 'chronic_conditions' : 'healthy',
      isBanned: d.isSuspended,
      donorRank: i + 1,
      createdAt: d.createdAt?.toISOString ? d.createdAt.toISOString() : d.createdAt,
    };
  });
};

/**
 * Get donor's lifetime donation statistics
 */
export const getDonorStats = async (donorId) => {
  try {
    const donor = await Donor.findById(donorId).lean();
    if (!donor) throw new Error('Donor not found');

    const typeStats = await Donation.aggregate([
      { $match: { donorId: new mongoose.Types.ObjectId(donorId), status: 'completed' } },
      {
        $lookup: {
          from: 'requests',
          localField: 'requestId',
          foreignField: '_id',
          as: 'req',
        },
      },
      { $unwind: { path: '$req', preserveNullAndEmptyArrays: true } },
      {
        $group: {
          _id: { $ifNull: ['$req.type', 'blood'] },
          count: { $sum: 1 },
        },
      },
    ]);

    const donationsByType = { blood: 0, plasma: 0, platelets: 0 };
    let totalDonations = 0;
    for (const item of typeStats) {
      const type = item._id || 'blood';
      if (donationsByType[type] !== undefined) {
        donationsByType[type] = item.count;
        totalDonations += item.count;
      }
    }

    return {
      donorId,
      fullName: donor.fullName,
      email: donor.email,
      bloodType: donor.bloodType,
      pointsBalance: donor.pointsBalance || 0,
      totalDonations,
      donationsByType,
      lastDonationDate: donor.lastDonationDate,
      isSuspended: donor.isSuspended,
      joinDate: donor.createdAt,
    };
  } catch (error) {
    logger.error('Error fetching donor stats', { error: error?.message, donorId });
    throw error;
  }
};

/**
 * Get top donors leaderboard
 */
export const getLeaderboard = async (limit = 10, days = 30) => {
  try {
    const startDate = new Date(Date.now() - days * DAYS_MS);

    const donors = await Donor.find({
      isSuspended: false,
      isEmailVerified: true,
      lastDonationDate: { $gte: startDate },
    })
      .select('fullName email bloodType lastDonationDate')
      .lean();

    const donorIds = donors.map((donor) => donor._id);
    const pointsAccounts = await DonorPoints.find({ donorId: { $in: donorIds } })
      .sort({ pointsBalance: -1 })
      .limit(parseInt(limit))
      .select('donorId pointsBalance lifetimePointsEarned tier')
      .lean();

    const topDonors = pointsAccounts.map((account, index) => {
      const donor = donors.find((d) => d._id.toString() === account.donorId.toString());
      return {
        rank: index + 1,
        ...donor,
        pointsBalance: account?.pointsBalance ?? 0,
        lifetimePointsEarned: account?.lifetimePointsEarned ?? 0,
        tier: account?.tier || DonorPoints.calculateTier(account?.lifetimePointsEarned ?? 0),
      };
    });

    return {
      period: `Last ${days} days`,
      count: topDonors.length,
      leaderboard: topDonors,
    };
  } catch (error) {
    logger.error('Error fetching leaderboard', { error: error?.message });
    throw error;
  }
};

/**
 * Get donation statistics by type
 */
export const getDonationTypeStats = async () => {
  try {
    const typeStats = await Donation.aggregate([
      { $match: { status: 'completed' } },
      {
        $lookup: {
          from: 'requests',
          localField: 'requestId',
          foreignField: '_id',
          as: 'req',
        },
      },
      { $unwind: { path: '$req', preserveNullAndEmptyArrays: true } },
      {
        $group: {
          _id: { $ifNull: ['$req.type', 'blood'] },
          count: { $sum: 1 },
        },
      },
    ]);

    const stats = {
      blood: { count: 0, avgPoints: 0 },
      plasma: { count: 0, avgPoints: 0 },
      platelets: { count: 0, avgPoints: 0 },
    };

    let totalDonations = 0;
    for (const item of typeStats) {
      const type = item._id || 'blood';
      if (stats[type]) {
        stats[type].count = item.count;
        totalDonations += item.count;
      }
    }

    return {
      totalDonations,
      byType: stats,
    };
  } catch (error) {
    logger.error('Error fetching donation type stats', { error: error?.message });
    throw error;
  }
};

// ─────────────────────────────────────────────────────────────────────────────
//  Analytics Overview (GET /analytics/overview)
// ─────────────────────────────────────────────────────────────────────────────

const OVERVIEW_CACHE_KEY = 'analytics:overview:v2';
const OVERVIEW_CACHE_TTL = 120;

const computeGrowthRate = async () => {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfPrevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

  const [current, prev] = await Promise.all([
    User.countDocuments({ createdAt: { $gte: startOfMonth } }),
    User.countDocuments({ createdAt: { $gte: startOfPrevMonth, $lt: startOfMonth } }),
  ]);

  return computeGrowth(current, prev);
};

const computeSuccessRate = async () => {
  const [total, completed] = await Promise.all([
    Donation.countDocuments({}),
    Donation.countDocuments({ status: 'completed' }),
  ]);
  return total > 0 ? ((completed / total) * 100).toFixed(1) + '%' : '0%';
};

const computeMonthlyTrend = async () => {
  const now = new Date();
  const sevenMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 6, 1);

  const results = await Donation.aggregate([
    { $match: { createdAt: { $gte: sevenMonthsAgo } } },
    { $group: { _id: { year: { $year: '$createdAt' }, month: { $month: '$createdAt' } }, count: { $sum: 1 } } },
    { $sort: { '_id.year': 1, '_id.month': 1 } },
  ]);

  const monthLabels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const values = [];
  const labels = [];

  for (let i = 0; i < 7; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - 6 + i, 1);
    const year = d.getFullYear();
    const month = d.getMonth() + 1;
    const found = results.find((r) => r._id.year === year && r._id.month === month);
    values.push(found ? found.count : 0);
    labels.push(monthLabels[d.getMonth()]);
  }

  return { values, labels };
};

const generateDemandPrediction = (data) => {
  const growthRate = computeWeekOverWeekGrowth(data.requestsLast7d, data.requestsLast14d);
  const absGrowth = Math.abs(growthRate);
  if (growthRate > 0.10) {
    return `Blood demand expected to increase ${Math.round(growthRate * 100)}% next month based on historical trends — consider scheduling additional donation drives and sending proactive alerts to O+ and A+ donors.`;
  }
  if (growthRate > 0.05) {
    return `Blood demand showing a steady ${Math.round(growthRate * 100)}% weekly increase. Monitor inventory levels closely over the next 2 weeks.`;
  }
  if (growthRate < -0.15) {
    return `Blood demand has declined ${Math.round(absGrowth * 100)}% in the past week. Consider reducing scheduled drive frequency and reviewing inventory redistribution across hospitals.`;
  }
  return null;
};

const generateShortagePredictions = (supplyDemand) => {
  const predictions = [];
  const sortedByRatio = [...supplyDemand].sort((a, b) => b.ratio - a.ratio);
  for (const entry of sortedByRatio.slice(0, 2)) {
    if (entry.ratio > 3.0) {
      predictions.push(`${entry.bloodType} critically low — only ${entry.available} donors available against ${entry.unitsNeeded} units needed. Launch emergency campaign within 48 hours.`);
    } else if (entry.ratio > 1.5) {
      predictions.push(`${entry.bloodType} supply at risk with a ${entry.ratio.toFixed(1)}:1 demand-to-supply ratio. Proactive targeted outreach to ${entry.bloodType} donors recommended this week.`);
    }
  }
  return predictions;
};

const generateRetentionPrediction = (data) => {
  const { last30d, prev30d } = data.donorActivity;
  if (prev30d <= 0) return null;
  const retentionRate = (last30d / prev30d) * 100;
  if (retentionRate < 70) {
    return `Donor return rate has dropped to ${Math.round(retentionRate)}% — consider launching a re-engagement campaign with bonus points for returning donors this month.`;
  }
  if (retentionRate > 120) {
    return `Donor retention has improved to ${Math.round(retentionRate)}% — current momentum is strong. Capitalize by introducing referral rewards to sustain growth.`;
  }
  return null;
};

const generatePeakDayPrediction = (data) => {
  const dayMap = new Map(data.donationsByDay.map((d) => [d._id, d.count]));
  const counts = [1, 2, 3, 4, 5, 6, 7].map((d) => dayMap.get(d) || 0);
  const peakCount = Math.max(...counts);
  const avgCount = counts.reduce((sum, c) => sum + c, 0) / 7;
  if (peakCount <= avgCount * 1.4 || avgCount <= 0) return null;
  const peakDayIndex = counts.indexOf(peakCount);
  const pct = Math.round(((peakCount - avgCount) / avgCount) * 100);
  return `${DAY_NAMES[peakDayIndex]} shows ${pct}% higher donation activity — schedule more mobile drives and staff on this day to maximize collections.`;
};

const generateWeekendPrediction = (data) => {
  const dayMap = new Map(data.donationsByDay.map((d) => [d._id, d.count]));
  const weekendCount = (dayMap.get(1) || 0) + (dayMap.get(7) || 0);
  const weekdayCount = [2, 3, 4, 5, 6].reduce((sum, d) => sum + (dayMap.get(d) || 0), 0);
  const avgWeekend = weekendCount / 2;
  const avgWeekday = weekdayCount / 5;
  if (avgWeekend <= avgWeekday * 1.2 || avgWeekday <= 0) return null;
  const pct = Math.round(((avgWeekend - avgWeekday) / avgWeekday) * 100);
  return `Weekend donation drives show ${pct}% higher success rates compared to weekdays. Prioritize weekend scheduling for upcoming emergency campaigns.`;
};

const generateAIPredictions = async () => {
  const [data, supplyDemand] = await Promise.all([precomputeTrendData(), computeBloodTypeSupplyDemand()]);
  const predictions = [];

  const demand = generateDemandPrediction(data);
  if (demand) predictions.push(demand);

  predictions.push(...generateShortagePredictions(supplyDemand));

  const retention = generateRetentionPrediction(data);
  if (retention) predictions.push(retention);

  const peakDay = generatePeakDayPrediction(data);
  if (peakDay) predictions.push(peakDay);

  const weekend = generateWeekendPrediction(data);
  if (weekend) predictions.push(weekend);

  return predictions.slice(0, 5);
};

export const getAnalyticsOverview = async () => {
  const cached = await cache.get(OVERVIEW_CACHE_KEY);
  if (cached) return cached;

  const [growthRate, successRate, monthlyTrend, aiPredictions] = await Promise.all([
    computeGrowthRate(),
    computeSuccessRate(),
    computeMonthlyTrend(),
    generateAIPredictions(),
  ]);

  const result = { growthRate, successRate, monthlyTrend, aiPredictions };
  await cache.set(OVERVIEW_CACHE_KEY, result, OVERVIEW_CACHE_TTL);
  return result;
};
