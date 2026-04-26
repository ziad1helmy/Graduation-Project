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

  const trends = await Donation.aggregate([
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

  return trends.map((t) => ({
    year: t._id.year,
    month: t._id.month,
    total: t.total,
    completed: t.completed,
    cancelled: t.cancelled,
    totalUnits: t.totalUnits,
    successRate: t.total > 0 ? ((t.completed / t.total) * 100).toFixed(1) + '%' : '0%',
  }));
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
