import mongoose from 'mongoose';
import User from '../models/User.model.js';
import Donor from '../models/Donor.model.js';
import Request from '../models/Request.model.js';
import Donation from '../models/Donation.model.js';
import DonorPoints from '../models/DonorPoints.model.js';
import { calculateAge } from '../utils/age.js';
import { getCompatibleDonorTypesForRequest } from '../utils/blood-type.js';
import cache from '../utils/cache.js';
import { logger } from '../utils/logger.js';

/**
 * Analytics Service - Dashboard metrics, trends, and statistics
 */

const DASHBOARD_CACHE_KEY = 'analytics:dashboard';
const DASHBOARD_CACHE_TTL = 60;
const DAYS_MS = 24 * 60 * 60 * 1000;
const DONATION_COOLDOWN_DAYS = 56;

const computeGrowth = (current, prev) => {
  if (current === 0 && prev === 0) return '0%';
  if (prev === 0) return '+100%';
  if (current === 0) return '-100%';
  const pct = ((current - prev) / prev * 100).toFixed(0);
  return (pct >= 0 ? '+' : '') + pct + '%';
};

const computeHealthStatus = (healthHistory) => {
  if (!healthHistory) return 'Good';
  if (healthHistory.chronicConditions?.length > 0) return 'Chronic';
  if (healthHistory.recentIllness) return 'Recovering';
  if (healthHistory.lastCheckupDate) {
    const monthsAgo = (Date.now() - new Date(healthHistory.lastCheckupDate)) / (30 * DAYS_MS);
    if (monthsAgo > 6) return 'Needs Checkup';
  }
  return 'Good';
};

const buildGrowthAggregation = (matchFilter, thirtyDaysAgo, sixtyDaysAgo) => [
  { $match: matchFilter },
  {
    $group: {
      _id: null,
      count: { $sum: 1 },
      current: { $sum: { $cond: [{ $gte: ['$createdAt', thirtyDaysAgo] }, 1, 0] } },
      prev: { $sum: { $cond: [{ $and: [{ $gte: ['$createdAt', sixtyDaysAgo] }, { $lt: ['$createdAt', thirtyDaysAgo] }] }, 1, 0] } },
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
    Donation.aggregate(buildGrowthAggregation({ status: 'completed' }, thirtyDaysAgo, sixtyDaysAgo)),
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
  const values = new Array(7).fill(0.0);

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

const formatLocationString = (location) => {
  if (!location) return 'Unknown';
  if (location.city && location.governorate) return `${location.city}, ${location.governorate}`;
  return location.governorate || 'Unknown';
};

const computeCriticalAlerts = async () => {
  const [requests, supplyDemand] = await Promise.all([
    Request.find({
      urgency: { $in: ['critical', 'high'] },
      status: { $in: ['pending', 'in-progress'] },
    })
      .sort({ urgency: 1, createdAt: -1 })
      .limit(10)
      .populate({ path: 'hospitalId', select: '+phone fullName location' })
      .lean(),
    computeBloodTypeSupplyDemand(),
  ]);

  const supplyByType = supplyDemand.reduce((map, s) => ({ ...map, [s.bloodType]: s.available }), {});

  return requests.map((request) => {
    const hospital = request.hospitalId;
    const bloodTypes = request.bloodType || [];

    let totalAvailable = 0;
    for (const bloodType of bloodTypes) {
      totalAvailable += supplyByType[bloodType] || 0;
    }

    const matchPercentage = Math.min(100, (totalAvailable / Math.max(request.unitsNeeded || 1, 1)) * 100);
    const alertType = request.urgency === 'critical'
      ? 'critical'
      : (request.isEmergency ? 'emergency' : 'system');

    return {
      id: request._id.toString(),
      title: request.patientType || 'Critical Blood Request',
      type: alertType,
      description: request.notes || `Critical request for ${bloodTypes.join(', ')} blood type(s).`,
      unitsNeeded: request.unitsNeeded || request.quantity || 1,
      bloodTypesNeeded: bloodTypes,
      hospitalId: hospital?._id?.toString() || 'Unknown',
      hospitalName: hospital?.fullName || 'Unknown Hospital',
      hospitalContact: hospital?.phone || request.hospitalContact || '',
      location: formatLocationString(hospital?.location),
      latitude: hospital?.location?.coordinates?.lat || null,
      longitude: hospital?.location?.coordinates?.lng || null,
      predictMatchPercentage: parseFloat(matchPercentage.toFixed(1)),
      date: request.createdAt?.toISOString(),
      createdAt: request.createdAt?.toISOString(),
    };
  });
};

const computeBloodTypeMap = async () => {
  const dist = await getBloodTypeDistribution();
  return dist.reduce((map, d) => ({ ...map, [d.bloodType]: d.donors }), {});
};

const deriveDonorEligibility = (user, donor, now) => {
  if (user?.isSuspended) return false;
  if (donor?.temporaryDeferralUntil && donor.temporaryDeferralUntil > now) return false;
  if (!donor?.lastDonationDate) return true;
  return (now - new Date(donor.lastDonationDate)) / DAYS_MS > DONATION_COOLDOWN_DAYS;
};

const formatDashboardDonor = (item, index, now) => {
  const user = item.user;
  const donor = item.donor;

  return {
    id: item._id.toString(),
    name: user?.fullName || 'Unknown',
    email: user?.email || '',
    phoneNumber: donor?.phoneNumber || '',
    bloodType: donor?.bloodType || '',
    totalDonations: item.totalDonations || 0,
    points: item.points?.pointsBalance || 0,
    isEligibleToDonate: deriveDonorEligibility(user, donor, now),
    isActive: !user?.isSuspended,
    isVerified: user?.isEmailVerified || false,
    location: user?.location?.city || 'Unknown',
    gender: donor?.gender || 'unknown',
    age: calculateAge(donor?.dateOfBirth),
    weight: donor?.weight || null,
    healthStatus: computeHealthStatus(donor?.healthHistory),
    isBanned: user?.isSuspended || false,
    donorRank: index + 1,
    createdAt: user?.createdAt?.toISOString(),
  };
};

const computeTopDonors = async (limit = 5) => {
  const now = new Date();

  const topDonors = await Donation.aggregate([
    { $match: { status: 'completed' } },
    {
      $group: {
        _id: '$donorId',
        totalDonations: { $sum: 1 },
        totalUnits: { $sum: '$quantity' },
        lastDonation: { $max: '$completedDate' },
      },
    },
    { $sort: { totalDonations: -1 } },
    { $limit: limit },
    {
      $lookup: {
        from: 'users',
        let: { donorId: '$_id' },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ['$_id', '$$donorId'] },
                  { $eq: ['$role', 'donor'] },
                  { $eq: ['$deletedAt', null] },
                ],
              },
            },
          },
          { $project: { fullName: 1, email: 1, location: 1, isSuspended: 1, isEmailVerified: 1, createdAt: 1 } },
        ],
        as: 'user',
      },
    },
    { $unwind: '$user' },
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
      $lookup: {
        from: 'donors',
        localField: 'user._id',
        foreignField: '_id',
        as: 'donor',
      },
    },
    { $unwind: { path: '$donor', preserveNullAndEmptyArrays: true } },
  ]);

  return topDonors.map((item, index) => formatDashboardDonor(item, index, now));
};

// ─────────────────────────────────────────────────────────────────────────────
//  AI Insights Engine
// ─────────────────────────────────────────────────────────────────────────────

const safeEngine = async (engineFn, engineName = 'unknown') => {
  try {
    return await engineFn();
  } catch (e) {
    logger.error(`AI engine "${engineName}" failed`, { error: e?.message });
    return null;
  }
};

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
      { $match: { status: 'completed', createdAt: { $gte: sixtyDaysAgo } } },
      { $group: { _id: '$donorId', lastDonation: { $max: '$createdAt' } } },
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
    return { title: 'Predicted High Demand', description: `A ${Math.round(growthRate * 100)}% increase in blood requests is predicted next week.`, confidence: Math.min(95, 50 + growthRate * 100) };
  }
  if (growthRate > 0.15) {
    return { title: 'Rising Demand Trend', description: 'Blood requests are trending upward. Prepare additional resources.', confidence: Math.min(85, 40 + growthRate * 80) };
  }
  if (growthRate < -0.20) {
    return { title: 'Declining Demand', description: 'Blood requests are declining. Review inventory allocation.', confidence: Math.min(80, 40 + Math.abs(growthRate) * 80) };
  }
  return null;
};

const shortageEngine = async (supplyDemand) => {
  if (!supplyDemand || supplyDemand.length === 0) return null;

  const worstEntry = supplyDemand.reduce((worst, entry) => (entry.ratio > worst.ratio ? entry : worst), { ratio: 0, bloodType: null });

  if (worstEntry.ratio > 2.0) {
    return { title: 'Shortage Risk', description: `${worstEntry.bloodType} blood stock is expected to deplete within the next 4 days.`, confidence: Math.min(98, 60 + worstEntry.ratio * 10) };
  }
  if (worstEntry.ratio > 1.0) {
    return { title: 'Supply Warning', description: `${worstEntry.bloodType} blood supply is approaching critical levels.`, confidence: Math.min(85, 50 + worstEntry.ratio * 10) };
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
    return { title: 'Donor Retention Alert', description: 'Donor return rate has dropped significantly. Consider re-engagement campaigns.', confidence: Math.min(90, 60 + (1 - retentionRate) * 100) };
  }
  if (retentionRate > 1.2) {
    return { title: 'Donor Growth Positive', description: 'More donors are returning compared to last month. Momentum is strong.', confidence: Math.min(85, 55 + (retentionRate - 1) * 80) };
  }
  return null;
};

const surgeEngine = (data) => {
  const expected3Days = (data.requestsLast30d / 30) * 3;
  const surgeRatio = expected3Days > 0 ? data.requestsLast3d / expected3Days : 1;

  if (surgeRatio > 2.0) {
    return { title: 'Emergency Demand Spike', description: 'Blood demand has surged unexpectedly in the last 3 days. Emergency response may be needed.', confidence: Math.min(95, 70 + surgeRatio * 8) };
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

  return insights.filter(Boolean).sort((a, b) => b.confidence - a.confidence).slice(0, 5);
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
      computeTopDonors(5),
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
 * Get monthly donation trends.
 * @param {number} months - Number of months to look back (default 6)
 */
export const getDonationTrends = async (months = 6) => {
  const startDate = new Date();
  startDate.setMonth(startDate.getMonth() - months);

  const [monthlyTrends, dailyTrends, regionalBreakdown] = await Promise.all([
    Donation.aggregate([
      { $match: { createdAt: { $gte: startDate } } },
      {
        $group: {
          _id: { year: { $year: '$createdAt' }, month: { $month: '$createdAt' } },
          total: { $sum: 1 },
          completed: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } },
          cancelled: { $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0] } },
          pending: { $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] } },
          totalUnits: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, '$quantity', 0] } },
        },
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } },
    ]),
    Donation.aggregate([
      { $match: { createdAt: { $gte: startDate } } },
      {
        $group: {
          _id: { year: { $year: '$createdAt' }, month: { $month: '$createdAt' }, day: { $dayOfMonth: '$createdAt' } },
          total: { $sum: 1 },
          completed: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } },
          cancelled: { $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0] } },
          pending: { $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] } },
          totalUnits: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, '$quantity', 0] } },
        },
      },
      { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } },
    ]),
    buildRegionalBreakdown(startDate),
  ]);

  return {
    trends: monthlyTrends.map(formatMonthlyTrend),
    dailyTrends: dailyTrends.map(formatDailyTrend),
    regionalBreakdown,
  };
};

const buildRegionalBreakdown = async (startDate) => {
  const [requestResults, donationResults] = await Promise.all([
    Request.aggregate([
      { $match: { createdAt: { $gte: startDate } } },
      {
        $lookup: {
          from: 'users',
          localField: 'hospitalId',
          foreignField: '_id',
          pipeline: [{ $match: { deletedAt: null } }, { $project: { location: 1 } }],
          as: 'hospital',
        },
      },
      { $unwind: { path: '$hospital', preserveNullAndEmptyArrays: true } },
      {
        $group: {
          _id: { $ifNull: ['$hospital.location.governorate', 'Unknown'] },
          requests: { $sum: 1 },
          activeRequests: { $sum: { $cond: [{ $in: ['$status', ['pending', 'in-progress']] }, 1, 0] } },
        },
      },
    ]),
    Donation.aggregate([
      { $match: { createdAt: { $gte: startDate }, status: 'completed' } },
      {
        $lookup: {
          from: 'requests',
          localField: 'requestId',
          foreignField: '_id',
          as: 'request',
        },
      },
      { $unwind: { path: '$request', preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: 'users',
          localField: 'request.hospitalId',
          foreignField: '_id',
          pipeline: [{ $match: { deletedAt: null } }, { $project: { location: 1 } }],
          as: 'hospital',
        },
      },
      { $unwind: { path: '$hospital', preserveNullAndEmptyArrays: true } },
      {
        $group: {
          _id: { $ifNull: ['$hospital.location.governorate', 'Unknown'] },
          completed: { $sum: 1 },
          donatedUnits: { $sum: '$quantity' },
        },
      },
    ]),
  ]);

  const regionalMap = new Map();
  for (const result of requestResults) {
    regionalMap.set(String(result._id), {
      governorate: String(result._id),
      requests: result.requests || 0,
      activeRequests: result.activeRequests || 0,
      completed: 0,
      donatedUnits: 0,
    });
  }

  for (const result of donationResults) {
    const key = String(result._id);
    const existing = regionalMap.get(key) || { governorate: key, requests: 0, activeRequests: 0, completed: 0, donatedUnits: 0 };
    existing.completed = result.completed || 0;
    existing.donatedUnits = result.donatedUnits || 0;
    regionalMap.set(key, existing);
  }

  return Array.from(regionalMap.values()).sort(
    (a, b) => (b.requests + b.completed) - (a.requests + a.completed)
  );
};

const formatSuccessRate = (completed, total) => total > 0 ? ((completed / total) * 100).toFixed(1) + '%' : '0%';

const formatMonthlyTrend = (t) => ({
  year: t._id.year,
  month: t._id.month,
  total: t.total,
  completed: t.completed,
  cancelled: t.cancelled,
  pending: t.pending,
  totalUnits: t.totalUnits,
  successRate: formatSuccessRate(t.completed, t.total),
});

const formatDailyTrend = (t) => ({
  date: `${t._id.year}-${String(t._id.month).padStart(2, '0')}-${String(t._id.day).padStart(2, '0')}`,
  total: t.total,
  completed: t.completed,
  pending: t.pending,
  cancelled: t.cancelled,
  totalUnits: t.totalUnits,
  successRate: formatSuccessRate(t.completed, t.total),
});

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
        let: { donorId: '$_id' },
        pipeline: [
          { $match: { $expr: { $and: [{ $eq: ['$_id', '$$donorId'] }, { $eq: ['$deletedAt', null] }] } } },
          { $project: { fullName: 1, email: 1, bloodType: 1, location: 1, isSuspended: 1, isEmailVerified: 1 } },
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
        completedDonations: 1,
        totalUnits: 1,
        lastDonation: 1,
        fullName: '$donor.fullName',
        email: '$donor.email',
        bloodType: '$donor.bloodType',
        location: '$donor.location',
        isActive: { $not: '$donor.isSuspended' },
        isVerified: '$donor.isEmailVerified',
        points: { $ifNull: ['$points.pointsBalance', 0] },
        tier: { $ifNull: ['$points.tier', 'bronze'] },
      },
    },
  ]);

  return topDonors;
};

/**
 * Get growth metrics over time (new users, requests, donations).
 * @param {number} months - Number of months to look back (default 6)
 */
export const getGrowthMetrics = async (months = 6) => {
  const startDate = new Date();
  startDate.setMonth(startDate.getMonth() - months);

  const [userGrowth, requestGrowth, donationGrowth] = await Promise.all([
    User.aggregate([
      { $match: { createdAt: { $gte: startDate } } },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' },
          },
          count: { $sum: 1 },
          donors: { $sum: { $cond: [{ $eq: ['$role', 'donor'] }, 1, 0] } },
          hospitals: { $sum: { $cond: [{ $eq: ['$role', 'hospital'] }, 1, 0] } },
        },
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } },
    ]),
    Request.aggregate([
      { $match: { createdAt: { $gte: startDate } } },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' },
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } },
    ]),
    Donation.aggregate([
      { $match: { createdAt: { $gte: startDate } } },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' },
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } },
    ]),
  ]);

  return { userGrowth, requestGrowth, donationGrowth };
};

/**
 * Get donor's lifetime donation statistics
 */
export const getDonorStats = async (donorId) => {
  try {
    const donor = await Donor.findById(donorId).lean();
    if (!donor) throw new Error('Donor not found');

    const [typeStats, responseCount] = await Promise.all([
      Donation.aggregate([
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
      ]),
      Donation.countDocuments({ donorId: new mongoose.Types.ObjectId(donorId) }),
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
      responseCount,
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

const OVERVIEW_CACHE_KEY = 'analytics:overview';
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

const generateAIPredictions = async () => {
  const [data, supplyDemand] = await Promise.all([precomputeTrendData(), computeBloodTypeSupplyDemand()]);
  const predictions = [];

  const growthRate = computeWeekOverWeekGrowth(data.requestsLast7d, data.requestsLast14d);
  if (growthRate > 0.10) {
    predictions.push(`Blood demand expected to increase ${Math.round(growthRate * 100)}% next month based on historical trends.`);
  }

  const shortageEntry = supplyDemand.find((s) => s.ratio > 2.0);
  if (shortageEntry) {
    predictions.push(`${shortageEntry.bloodType} type shortage likely in 3 weeks — proactive donor outreach recommended.`);
  }

  const dayMap = new Map(data.donationsByDay.map((d) => [d._id, d.count]));
  const weekendCount = (dayMap.get(1) || 0) + (dayMap.get(7) || 0);
  const weekdayCount = [2, 3, 4, 5, 6].reduce((sum, d) => sum + (dayMap.get(d) || 0), 0);
  const avgWeekend = weekendCount / 2;
  const avgWeekday = weekdayCount / 5;
  if (avgWeekend > avgWeekday * 1.2) {
    const pct = Math.round(((avgWeekend - avgWeekday) / avgWeekday) * 100);
    predictions.push(`Weekend donation drives show ${pct}% higher success rates.`);
  }

  return predictions;
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
