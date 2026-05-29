import mongoose from 'mongoose';
import User from '../models/User.model.js';
import Donor from '../models/Donor.model.js';
import Request from '../models/Request.model.js';
import Donation from '../models/Donation.model.js';

/**
 * Analytics Service - Dashboard metrics, trends, and statistics
 */

/**
 * Get dashboard summary with key metrics and critical alerts.
 */
export const getDashboardSummary = async () => {
  const [
    totalUsers,
    totalDonors,
    totalHospitals,
    activeRequests,
    criticalRequests,
    pendingDonations,
    completedDonations,
    unverifiedUsers,
    suspendedUsers,
  ] = await Promise.all([
    User.countDocuments({ deletedAt: null }),
    User.countDocuments({ role: 'donor', deletedAt: null }),
    User.countDocuments({ role: 'hospital', deletedAt: null }),
    Request.countDocuments({ status: { $in: ['pending', 'in-progress'] } }),
    Request.countDocuments({ urgency: 'critical', status: { $in: ['pending', 'in-progress'] } }),
    Donation.countDocuments({ status: 'pending' }),
    Donation.countDocuments({ status: 'completed' }),
    User.countDocuments({ isEmailVerified: false, deletedAt: null }),
    User.countDocuments({ isSuspended: true, deletedAt: null }),
  ]);

  return {
    users: { total: totalUsers, donors: totalDonors, hospitals: totalHospitals },
    requests: { active: activeRequests, critical: criticalRequests },
    donations: { pending: pendingDonations, completed: completedDonations },
    alerts: {
      unverifiedUsers,
      suspendedUsers,
      criticalRequests,
    },
  };
};

/**
 * Get monthly donation trends.
 * @param {number} months - Number of months to look back (default 6)
 */
export const getDonationTrends = async (months = 6) => {
  const startDate = new Date();
  startDate.setMonth(startDate.getMonth() - months);

  const monthlyTrends = await Donation.aggregate([
    { $match: { createdAt: { $gte: startDate } } },
    {
      $group: {
        _id: {
          year: { $year: '$createdAt' },
          month: { $month: '$createdAt' },
        },
        total: { $sum: 1 },
        completed: {
          $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] },
        },
        cancelled: {
          $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0] },
        },
        totalUnits: {
          $sum: { $cond: [{ $eq: ['$status', 'completed'] }, '$quantity', 0] },
        },
      },
    },
    { $sort: { '_id.year': 1, '_id.month': 1 } },
  ]);

  const dailyTrends = await Donation.aggregate([
    { $match: { createdAt: { $gte: startDate } } },
    {
      $group: {
        _id: {
          year: { $year: '$createdAt' },
          month: { $month: '$createdAt' },
          day: { $dayOfMonth: '$createdAt' },
        },
        total: { $sum: 1 },
        completed: {
          $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] },
        },
        cancelled: {
          $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0] },
        },
        totalUnits: {
          $sum: { $cond: [{ $eq: ['$status', 'completed'] }, '$quantity', 0] },
        },
      },
    },
    { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } },
  ]);

  const requestRegionResults = await Request.aggregate([
    { $match: { createdAt: { $gte: startDate } } },
    {
      $lookup: {
        from: 'users',
        localField: 'hospitalId',
        foreignField: '_id',
        as: 'hospital',
      },
    },
    { $unwind: { path: '$hospital', preserveNullAndEmptyArrays: true } },
    {
      $group: {
        _id: { $ifNull: ['$hospital.location.governorate', 'Unknown'] },
        requests: { $sum: 1 },
        activeRequests: {
          $sum: {
            $cond: [{ $in: ['$status', ['pending', 'in-progress']] }, 1, 0],
          },
        },
      },
    },
    { $sort: { requests: -1 } },
  ]);

  const donationRegionResults = await Donation.aggregate([
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
        as: 'hospital',
      },
    },
    { $unwind: { path: '$hospital', preserveNullAndEmptyArrays: true } },
    {
      $group: {
        _id: { $ifNull: ['$hospital.location.governorate', 'Unknown'] },
        completedDonations: { $sum: 1 },
        donatedUnits: { $sum: '$quantity' },
      },
    },
    { $sort: { completedDonations: -1 } },
  ]);

  const regionalMap = new Map();
  for (const region of requestRegionResults) {
    regionalMap.set(String(region._id), {
      region: String(region._id),
      requests: region.requests || 0,
      activeRequests: region.activeRequests || 0,
      completedDonations: 0,
      donatedUnits: 0,
    });
  }

  for (const region of donationRegionResults) {
    const key = String(region._id);
    const current = regionalMap.get(key) || {
      region: key,
      requests: 0,
      activeRequests: 0,
      completedDonations: 0,
      donatedUnits: 0,
    };

    current.completedDonations = region.completedDonations || 0;
    current.donatedUnits = region.donatedUnits || 0;
    regionalMap.set(key, current);
  }

  const trends = monthlyTrends.map((t) => ({
    year: t._id.year,
    month: t._id.month,
    total: t.total,
    completed: t.completed,
    cancelled: t.cancelled,
    totalUnits: t.totalUnits,
    successRate: t.total > 0 ? ((t.completed / t.total) * 100).toFixed(1) + '%' : '0%',
  }));

  trends.dailyTrends = dailyTrends.map((t) => ({
    year: t._id.year,
    month: t._id.month,
    day: t._id.day,
    total: t.total,
    completed: t.completed,
    cancelled: t.cancelled,
    totalUnits: t.totalUnits,
    successRate: t.total > 0 ? ((t.completed / t.total) * 100).toFixed(1) + '%' : '0%',
  }));

  trends.regionalBreakdown = Array.from(regionalMap.values()).sort((a, b) => (b.requests + b.completedDonations) - (a.requests + a.completedDonations));

  return trends;
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
        as: 'donor',
      },
    },
    { $unwind: '$donor' },
    {
      $project: {
        _id: 1,
        completedDonations: 1,
        totalUnits: 1,
        lastDonation: 1,
        'donor.fullName': 1,
        'donor.email': 1,
        'donor.bloodType': 1,
        'donor.location': 1,
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

    const donations = await Donation.find({ donorId, status: 'completed' }).lean();
    const requestIds = [...new Set(donations.map((donation) => donation.requestId).filter(Boolean))];
    const requests = requestIds.length
      ? await Request.find({ _id: { $in: requestIds } }).select('_id type').lean()
      : [];
    const requestTypeById = new Map(requests.map((request) => [request._id.toString(), request.type]));
    
    // Group donations by type
    const donationsByType = {
      blood: 0,
      plasma: 0,
      platelets: 0,
    };

    let totalDonations = 0;
    let totalPoints = 0;
    const lastDonationDate = donor.lastDonationDate;

    for (const donation of donations) {
      const donationType = requestTypeById.get(donation.requestId?.toString?.()) || 'blood';
      donationsByType[donationType]++;
      totalDonations++;
    }

    return {
      donorId,
      fullName: donor.fullName,
      email: donor.email,
      bloodType: donor.bloodType,
      pointsBalance: donor.pointsBalance || 0,
      totalDonations,
      donationsByType,
      lastDonationDate,
      isSuspended: donor.isSuspended,
      joinDate: donor.createdAt,
    };
  } catch (error) {
    console.error('Error fetching donor stats', error);
    throw error;
  }
};

/**
 * Get top donors leaderboard
 */
export const getLeaderboard = async (limit = 10, days = 30) => {
  try {
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const topDonors = await Donor.find({
      isSuspended: false,
      isEmailVerified: true,
      lastDonationDate: { $gte: startDate },
    })
      .select('fullName email bloodType pointsBalance lastDonationDate')
      .sort({ pointsBalance: -1 })
      .limit(limit)
      .lean();

    return {
      period: `Last ${days} days`,
      count: topDonors.length,
      leaderboard: topDonors.map((donor, index) => ({
        rank: index + 1,
        ...donor,
      })),
    };
  } catch (error) {
    console.error('Error fetching leaderboard', error);
    throw error;
  }
};

/**
 * Get donation statistics by type
 */
export const getDonationTypeStats = async () => {
  try {
    const completedDonations = await Donation.find({ status: 'completed' })
      .populate('requestId', 'type')
      .lean();

    const stats = {
      blood: { count: 0, avgPoints: 0 },
      plasma: { count: 0, avgPoints: 0 },
      platelets: { count: 0, avgPoints: 0 },
    };

    for (const donation of completedDonations) {
      const donationType = donation.requestId?.type || 'blood';
      if (stats[donationType]) {
        stats[donationType].count++;
      }
    }

    return {
      totalDonations: completedDonations.length,
      byType: stats,
    };
  } catch (error) {
    console.error('Error fetching donation type stats', error);
    throw error;
  }
};
