import mongoose from 'mongoose';
import DonorPoints from '../models/DonorPoints.model.js';
import PointsTransaction, { POINTS_CONFIG } from '../models/PointsTransaction.model.js';
import RewardCatalog from '../models/RewardCatalog.model.js';
import RewardRedemption from '../models/RewardRedemption.model.js';
import Badge from '../models/Badge.model.js';
import UserBadge from '../models/UserBadge.model.js';
import Donation from '../models/Donation.model.js';
import Notification from '../models/Notification.model.js';
import { paginationMeta } from '../utils/pagination.js';

// ──────────────────────────────────────────────
//  Seed Data
// ──────────────────────────────────────────────

const SEED_BADGES = [
  { badgeName: 'First Timer', badgeDescription: 'Completed your first blood donation', badgeIcon: 'heart', category: 'DONATION', rarity: 'COMMON', unlockCondition: 'completedDonations', unlockThreshold: 1, pointsReward: 0, sortOrder: 1 },
  { badgeName: 'Regular Donor', badgeDescription: 'Completed 5 blood donations', badgeIcon: 'trophy', category: 'DONATION', rarity: 'COMMON', unlockCondition: 'completedDonations', unlockThreshold: 5, pointsReward: 50, sortOrder: 2 },
  { badgeName: 'Life Saver', badgeDescription: 'Completed 10 blood donations', badgeIcon: 'star', category: 'DONATION', rarity: 'RARE', unlockCondition: 'completedDonations', unlockThreshold: 10, pointsReward: 100, sortOrder: 3 },
  { badgeName: 'Hero', badgeDescription: 'Completed 20 blood donations', badgeIcon: 'badge', category: 'DONATION', rarity: 'EPIC', unlockCondition: 'completedDonations', unlockThreshold: 20, pointsReward: 200, sortOrder: 4 },
  { badgeName: 'Legend', badgeDescription: 'Completed 50 blood donations', badgeIcon: 'crown', category: 'DONATION', rarity: 'LEGENDARY', unlockCondition: 'completedDonations', unlockThreshold: 50, pointsReward: 500, sortOrder: 5 },
  { badgeName: 'Emergency Responder', badgeDescription: 'Responded to 10 emergency requests', badgeIcon: 'flash', category: 'EMERGENCY', rarity: 'EPIC', unlockCondition: 'emergencyResponses', unlockThreshold: 10, pointsReward: 200, sortOrder: 6 },
  { badgeName: 'Community Helper', badgeDescription: 'Responded to 25 emergency requests', badgeIcon: 'shield', category: 'EMERGENCY', rarity: 'LEGENDARY', unlockCondition: 'emergencyResponses', unlockThreshold: 25, pointsReward: 500, sortOrder: 7 },
];

const SEED_REWARDS = [
  { name: 'Coffee Voucher', description: 'Free coffee at partner cafes', pointsCost: 500, category: 'FOOD', iconType: 'coffee', colorCode: '#8B4513' },
  { name: 'Movie Tickets', description: '2 movie tickets at major cinemas', pointsCost: 1000, category: 'ENTERTAINMENT', iconType: 'movie', colorCode: '#6A0DAD', dailyLimit: 5, monthlyLimit: 50 },
  { name: 'Restaurant Gift Card', description: 'Gift card for partner restaurants', pointsCost: 1500, category: 'FOOD', iconType: 'restaurant', colorCode: '#E53935' },
  { name: 'Health Check-up', description: 'Full health check-up at partner clinics', pointsCost: 2000, category: 'HEALTH', iconType: 'medical', colorCode: '#2E7D32' },
  { name: 'Premium Badge', description: 'Exclusive premium badge on your profile', pointsCost: 2500, category: 'STATUS', iconType: 'premium', colorCode: '#F9A825' },
  { name: 'Gym Membership', description: 'One-month gym membership at partner gyms', pointsCost: 3000, category: 'HEALTH', iconType: 'gym', colorCode: '#1565C0' },
];

export const seedRewardData = async () => {
  try {
    for (const badge of SEED_BADGES) {
      await Badge.findOneAndUpdate({ badgeName: badge.badgeName }, { $setOnInsert: badge }, { upsert: true });
    }
    for (const reward of SEED_REWARDS) {
      await RewardCatalog.findOneAndUpdate({ name: reward.name }, { $setOnInsert: reward }, { upsert: true });
    }
  } catch (err) {
    console.error('[Rewards] Seed error:', err.message);
  }
};

// ──────────────────────────────────────────────
//  Internal helpers
// ──────────────────────────────────────────────

/**
 * Get or create the points account for a donor.
 */
const getOrCreateAccount = async (donorId) => {
  return DonorPoints.findOneAndUpdate(
    { donorId },
    { $setOnInsert: { donorId } },
    { upsert: true, new: true }
  );
};

const isMongoDuplicateKeyError = (err) => {
  return err?.code === 11000 || (typeof err?.message === 'string' && err.message.includes('E11000'));
};

/**
 * Award points to a donor atomically.
 * Handles tier promotion detection and bonus points.
 * Returns { account, transaction, newBadges }
 */
const awardPoints = async (donorId, amount, type, description, referenceId = null) => {
  const normalizedReferenceId = referenceId ? String(referenceId) : null;

  // Deduplication: don't award the same reference twice
  if (normalizedReferenceId) {
    const existing = await PointsTransaction.findOne({ donorId, referenceId: normalizedReferenceId, transactionType: type });
    if (existing) return null; // already awarded
  }

  const session = await mongoose.startSession();
  let result = null;

  try {
    await session.withTransaction(async () => {
      const account = await DonorPoints.findOneAndUpdate(
        { donorId },
        {
          $inc: { pointsBalance: amount, lifetimePointsEarned: amount },
          $setOnInsert: { donorId },
        },
        { upsert: true, new: true, session }
      );

      // Recalculate tier
      const newTier = DonorPoints.calculateTier(account.lifetimePointsEarned);
      const tierChanged = newTier !== account.tier;
      if (tierChanged) {
        await DonorPoints.findByIdAndUpdate(account._id, { tier: newTier }, { session });
        account.tier = newTier;
      }

      const transaction = await PointsTransaction.create(
        [{
          donorId,
          pointsAmount: amount,
          transactionType: type,
          description,
          referenceId: normalizedReferenceId,
          balanceAfter: account.pointsBalance,
        }],
        { session }
      );

      result = { account, transaction: transaction[0], tierChanged, newTier };
    });
  } catch (err) {
    // Final dedup protection under concurrency.
    if (normalizedReferenceId && isMongoDuplicateKeyError(err)) {
      return null;
    }
    throw err;
  } finally {
    session.endSession();
  }

  // Award tier bonus outside transaction (non-critical)
  if (result?.tierChanged) {
    const tierBonusMap = { silver: POINTS_CONFIG.TIER_BONUS_SILVER, gold: POINTS_CONFIG.TIER_BONUS_GOLD, platinum: POINTS_CONFIG.TIER_BONUS_PLATINUM };
    const bonus = tierBonusMap[result.newTier];
    if (bonus) {
      await awardPoints(donorId, bonus, 'TIER_BONUS', `Tier promotion bonus: ${result.newTier}`, `tier_${result.newTier}_${donorId}`);
    }

    // Notify donor of tier promotion
    Notification.create({
      userId: donorId,
      type: 'system',
      title: `🎉 Tier Upgraded to ${result.newTier.charAt(0).toUpperCase() + result.newTier.slice(1)}!`,
      message: `Congratulations! You've reached ${result.newTier} tier. Keep donating to unlock more rewards!`,
    }).catch(() => {});
  }

  return result;
};

// ──────────────────────────────────────────────
//  Points earning triggers (called from donation.service.js)
// ──────────────────────────────────────────────

/**
 * Called when a donation status is set to 'completed'.
 * Awards base donation points + first-donation bonus if applicable.
 * Then checks for newly unlocked badges.
 */
export const onDonationCompleted = async (donorId, donationId, isEmergency = false) => {
  try {
    const account = await getOrCreateAccount(donorId);

    // Base donation points
    await awardPoints(
      donorId,
      POINTS_CONFIG.BLOOD_DONATION,
      'BLOOD_DONATION',
      'Blood Donation - Successful',
      `donation_${donationId}`
    );

    // First donation bonus (one-time)
    if (!account.firstDonationAwarded) {
      await awardPoints(donorId, POINTS_CONFIG.FIRST_DONATION, 'FIRST_DONATION', 'First Donation Bonus!', `first_donation_${donorId}`);
      await DonorPoints.findOneAndUpdate({ donorId }, { firstDonationAwarded: true });
    }

    // Emergency response bonus
    if (isEmergency) {
      await awardPoints(donorId, POINTS_CONFIG.EMERGENCY_RESPONSE, 'EMERGENCY_RESPONSE', 'Emergency Response Bonus', `emergency_${donationId}`);
    }

    // Check badges (fire-and-forget — never blocks the main flow)
    checkAndUpdateBadges(donorId).catch((e) => console.error('[Rewards] Badge check error:', e.message));
  } catch (err) {
    // Reward errors must NEVER break the donation flow
    console.error('[Rewards] onDonationCompleted error:', err.message);
  }
};

/**
 * Called when donor completes their profile (one-time award).
 */
export const onProfileCompleted = async (donorId) => {
  try {
    const account = await getOrCreateAccount(donorId);
    if (account.profileCompletionAwarded) return;

    await awardPoints(donorId, POINTS_CONFIG.PROFILE_COMPLETION, 'PROFILE_COMPLETION', 'Profile Completed', `profile_${donorId}`);
    await DonorPoints.findOneAndUpdate({ donorId }, { profileCompletionAwarded: true });
  } catch (err) {
    console.error('[Rewards] onProfileCompleted error:', err.message);
  }
};

// ──────────────────────────────────────────────
//  Badge checking
// ──────────────────────────────────────────────

/**
 * Evaluate all badges for a donor and unlock any newly earned ones.
 * Returns array of newly unlocked badge names.
 */
export const checkAndUpdateBadges = async (donorId) => {
  const [allBadges, completedDonations, emergencyResponses] = await Promise.all([
    Badge.find().sort({ sortOrder: 1 }),
    Donation.countDocuments({ donorId, status: 'completed' }),
    // Emergency responses: donations on requests marked as emergency urgency
    Donation.aggregate([
      { $match: { donorId: new mongoose.Types.ObjectId(donorId), status: 'completed' } },
      { $lookup: { from: 'requests', localField: 'requestId', foreignField: '_id', as: 'request' } },
      { $match: { 'request.urgency': 'critical' } },
      { $count: 'total' },
    ]).then((r) => r[0]?.total || 0),
  ]);

  const metricMap = { completedDonations, emergencyResponses };
  const newlyUnlocked = [];

  for (const badge of allBadges) {
    const current = metricMap[badge.unlockCondition] ?? 0;
    const isUnlocked = current >= badge.unlockThreshold;

    const updated = await UserBadge.findOneAndUpdate(
      { donorId, badgeId: badge._id },
      {
        $set: {
          progressCurrent: Math.min(current, badge.unlockThreshold),
          progressTarget: badge.unlockThreshold,
          ...(isUnlocked ? { unlockStatus: 'UNLOCKED', unlockedAt: new Date() } : {}),
        },
        $setOnInsert: { donorId, badgeId: badge._id },
      },
      { upsert: true, new: true }
    );

    // If just unlocked (wasn't before), award badge points and notify
    if (isUnlocked && updated.unlockStatus === 'UNLOCKED' && updated.unlockedAt) {
      const wasAlreadyUnlocked = await PointsTransaction.exists({
        donorId,
        referenceId: `badge_${badge._id}`,
      });

      if (!wasAlreadyUnlocked && badge.pointsReward > 0) {
        await awardPoints(donorId, badge.pointsReward, 'BADGE_UNLOCK', `Badge Unlocked: ${badge.badgeName}`, `badge_${badge._id}`);
      }

      if (!wasAlreadyUnlocked) {
        newlyUnlocked.push(badge.badgeName);
        Notification.create({
          userId: donorId,
          type: 'system',
          title: `🏆 Badge Unlocked: ${badge.badgeName}`,
          message: badge.badgeDescription,
          data: { badgeId: badge._id, rarity: badge.rarity },
        }).catch(() => {});
      }
    }
  }

  return newlyUnlocked;
};

// ──────────────────────────────────────────────
//  Donor-facing read operations
// ──────────────────────────────────────────────

export const getPointsSummary = async (donorId) => {
  const account = await getOrCreateAccount(donorId);
  const tier = DonorPoints.calculateTier(account.lifetimePointsEarned);
  const pointsToNext = DonorPoints.pointsToNextTier(account.lifetimePointsEarned);
  const tierOrder = ['bronze', 'silver', 'gold', 'platinum'];
  const nextTier = tierOrder[tierOrder.indexOf(tier) + 1] || null;

  return {
    pointsBalance: account.pointsBalance,
    lifetimePointsEarned: account.lifetimePointsEarned,
    currentTier: tier,
    nextTier,
    pointsToNextTier: pointsToNext,
    tierBenefits: {
      bronze: ['Access to basic rewards'],
      silver: ['10% more points per donation', 'Early access to limited rewards'],
      gold: ['15% more points per donation', 'Exclusive gold rewards'],
      platinum: ['20% more points per donation', 'VIP support', 'All exclusive rewards'],
    },
  };
};

export const getPointsHistory = async (donorId, filters = {}) => {
  const { page = 1, limit = 20, filter = 'ALL', dateFrom, dateTo } = filters;
  const skip = (page - 1) * limit;

  const query = { donorId };

  if (filter === 'EARNED') query.pointsAmount = { $gt: 0 };
  if (filter === 'REDEEMED') query.transactionType = 'REWARD_REDEEMED';
  if (filter === 'ADJUSTMENTS') query.transactionType = 'ADMIN_ADJUSTMENT';
  if (dateFrom) query.createdAt = { ...query.createdAt, $gte: new Date(dateFrom) };
  if (dateTo) query.createdAt = { ...query.createdAt, $lte: new Date(dateTo) };

  const [transactions, total] = await Promise.all([
    PointsTransaction.find(query).sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit)),
    PointsTransaction.countDocuments(query),
  ]);

  return {
    transactions,
    pagination: paginationMeta(total, parseInt(page), parseInt(limit)),
  };
};

export const getDonorBadges = async (donorId) => {
  await checkAndUpdateBadges(donorId);

  const [allBadges, userBadges, completedDonations, emergencyResponses, donor] = await Promise.all([
    Badge.find().sort({ sortOrder: 1 }),
    UserBadge.find({ donorId }),
    Donation.countDocuments({ donorId, status: 'completed' }),
    Donation.aggregate([
      { $match: { donorId: new mongoose.Types.ObjectId(donorId), status: 'completed' } },
      { $lookup: { from: 'requests', localField: 'requestId', foreignField: '_id', as: 'request' } },
      { $match: { 'request.urgency': 'critical' } },
      { $count: 'total' },
    ]).then((r) => r[0]?.total || 0),
    // Days as donor — from first completed donation
    Donation.findOne({ donorId, status: 'completed' }).sort({ createdAt: 1 }),
  ]);

  const userBadgeMap = Object.fromEntries(userBadges.map((ub) => [String(ub.badgeId), ub]));

  const badges = allBadges.map((badge) => {
    const ub = userBadgeMap[String(badge._id)];
    const progressCurrent = ub?.progressCurrent ?? 0;
    const progressTarget = badge.unlockThreshold;
    return {
      badgeId: badge._id,
      badgeName: badge.badgeName,
      badgeDescription: badge.badgeDescription,
      badgeIcon: badge.badgeIcon,
      category: badge.category,
      rarity: badge.rarity,
      unlockStatus: ub?.unlockStatus ?? 'LOCKED',
      unlockedAt: ub?.unlockedAt ?? null,
      progressCurrent,
      progressTarget,
      progressPercentage: Math.min(Math.round((progressCurrent / progressTarget) * 100), 100),
    };
  });

  const unlockedCount = badges.filter((b) => b.unlockStatus === 'UNLOCKED').length;
  const daysAsDonor = donor ? Math.floor((Date.now() - donor.createdAt) / 86400000) : 0;

  return {
    unlockedCount,
    totalCount: allBadges.length,
    completionPercentage: allBadges.length > 0 ? Math.round((unlockedCount / allBadges.length) * 100) : 0,
    badges,
    stats: { totalDonations: completedDonations, totalEmergencyResponses: emergencyResponses, daysAsDonor },
  };
};

// ──────────────────────────────────────────────
//  Rewards catalog & redemption
// ──────────────────────────────────────────────

export const getRewardsCatalog = async (filters = {}) => {
  const { category, status = 'ACTIVE', sort_by = 'COST_ASC' } = filters;

  const query = {};
  if (category && category !== 'ALL') query.category = category;
  if (status !== 'ALL') query.status = status;

  const sortMap = { COST_ASC: { pointsCost: 1 }, COST_DESC: { pointsCost: -1 }, POPULARITY: { redemptionCount: -1 } };

  const rewards = await RewardCatalog.find(query).sort(sortMap[sort_by] || { pointsCost: 1 });

  return {
    rewards: rewards.map((r) => ({ ...r.toObject(), available: r.status === 'ACTIVE' })),
    filterOptions: { categories: ['FOOD', 'ENTERTAINMENT', 'HEALTH', 'STATUS'] },
  };
};

export const redeemReward = async (donorId, rewardId, { deliveryMethod = 'IN_APP', deliveryContact = null } = {}) => {
  const [reward, account] = await Promise.all([
    RewardCatalog.findById(rewardId),
    getOrCreateAccount(donorId),
  ]);

  if (!reward) throw Object.assign(new Error('Reward not found'), { statusCode: 404 });
  if (reward.status !== 'ACTIVE') throw Object.assign(new Error('Reward is not available'), { statusCode: 400 });
  if (account.pointsBalance < reward.pointsCost) {
    const err = new Error(`Insufficient points. You have ${account.pointsBalance} but need ${reward.pointsCost}.`);
    err.statusCode = 409;
    err.code = 'INSUFFICIENT_POINTS';
    err.details = { userPoints: account.pointsBalance, requiredPoints: reward.pointsCost, shortfall: reward.pointsCost - account.pointsBalance };
    throw err;
  }

  // Check monthly limit
  if (reward.monthlyLimit) {
    const startOfMonth = new Date(); startOfMonth.setDate(1); startOfMonth.setHours(0, 0, 0, 0);
    const monthlyCount = await RewardRedemption.countDocuments({ rewardId, createdAt: { $gte: startOfMonth }, status: { $nin: ['CANCELLED'] } });
    if (monthlyCount >= reward.monthlyLimit) {
      throw Object.assign(new Error('Monthly redemption limit reached for this reward'), { statusCode: 409 });
    }
  }

  const session = await mongoose.startSession();
  let updatedAccount;
  let redemption;

  try {
    await session.withTransaction(async () => {
      // Deduct points (atomic balance guard preserved).
      updatedAccount = await DonorPoints.findOneAndUpdate(
        { donorId, pointsBalance: { $gte: reward.pointsCost } },
        { $inc: { pointsBalance: -reward.pointsCost } },
        { new: true, session }
      );
      if (!updatedAccount) throw Object.assign(new Error('Insufficient points'), { statusCode: 409 });

      // Create redemption record.
      redemption = await RewardRedemption.create(
        [{
          donorId,
          rewardId,
          pointsSpent: reward.pointsCost,
          deliveryMethod,
          deliveryContact,
          status: 'CONFIRMED',
        }],
        { session }
      ).then((docs) => docs[0]);

      // Log the transaction.
      await PointsTransaction.create(
        [{
          donorId,
          pointsAmount: -reward.pointsCost,
          transactionType: 'REWARD_REDEEMED',
          description: `Reward Redeemed: ${reward.name}`,
          referenceId: String(redemption._id),
          balanceAfter: updatedAccount.pointsBalance,
        }],
        { session }
      );
    });
  } finally {
    session.endSession();
  }

  // Increment reward redemption count
  RewardCatalog.findByIdAndUpdate(rewardId, { $inc: { redemptionCount: 1 } }).exec().catch(() => {});

  // In-app notification
  Notification.create({
    userId: donorId,
    type: 'system',
    title: '🎁 Reward Redeemed!',
    message: `Your ${reward.name} is confirmed. Code: ${redemption.confirmationCode}`,
  }).catch(() => {});

  return {
    redemptionId: redemption._id,
    confirmationCode: redemption.confirmationCode,
    rewardName: reward.name,
    pointsSpent: reward.pointsCost,
    remainingPoints: updatedAccount.pointsBalance,
    redemptionStatus: redemption.status,
    expiresAt: redemption.expiresAt,
  };
};

export const getDonorRedemptions = async (donorId, { page = 1, limit = 20, status } = {}) => {
  const skip = (page - 1) * limit;
  const query = { donorId };
  if (status && status !== 'ALL') query.status = status;

  const [redemptions, total] = await Promise.all([
    RewardRedemption.find(query).populate('rewardId', 'name category iconType').sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit)),
    RewardRedemption.countDocuments(query),
  ]);

  return {
    redemptions,
    pagination: paginationMeta(total, parseInt(page), parseInt(limit)),
  };
};

// ──────────────────────────────────────────────
//  Admin operations
// ──────────────────────────────────────────────

export const adminAdjustPoints = async (donorId, amount, reason, adminId) => {
  if (amount === 0) throw new Error('Amount cannot be zero');

  const session = await mongoose.startSession();
  let updatedAccount;

  try {
    await session.withTransaction(async () => {
      const account = await DonorPoints.findOneAndUpdate(
        { donorId },
        { $setOnInsert: { donorId } },
        { upsert: true, new: true, session }
      );

      if (amount < 0 && account.pointsBalance + amount < 0) {
        throw new Error('Adjustment would result in negative balance');
      }

      const balanceGuard = amount < 0 ? { pointsBalance: { $gte: Math.abs(amount) } } : {};
      updatedAccount = await DonorPoints.findOneAndUpdate(
        { donorId, ...balanceGuard },
        { $inc: { pointsBalance: amount, ...(amount > 0 ? { lifetimePointsEarned: amount } : {}) } },
        { new: true, session }
      );

      if (!updatedAccount) {
        throw new Error('Adjustment would result in negative balance');
      }

      await PointsTransaction.create(
        [{
          donorId,
          pointsAmount: amount,
          transactionType: 'ADMIN_ADJUSTMENT',
          description: reason,
          balanceAfter: updatedAccount.pointsBalance,
          adminId,
        }],
        { session }
      );
    });
  } finally {
    session.endSession();
  }

  return updatedAccount;
};

export const adminUpdateRewardStatus = async (rewardId, status, adminId) => {
  const reward = await RewardCatalog.findByIdAndUpdate(rewardId, { status }, { new: true });
  if (!reward) throw Object.assign(new Error('Reward not found'), { statusCode: 404 });
  return reward;
};

export const getRewardsAnalytics = async () => {
  const [topRewards, tierDistribution, totalPointsIssued] = await Promise.all([
    RewardRedemption.aggregate([
      { $group: { _id: '$rewardId', count: { $sum: 1 }, totalPointsSpent: { $sum: '$pointsSpent' } } },
      { $sort: { count: -1 } },
      { $limit: 5 },
      { $lookup: { from: 'rewardcatalogs', localField: '_id', foreignField: '_id', as: 'reward' } },
      { $unwind: '$reward' },
      { $project: { rewardName: '$reward.name', count: 1, totalPointsSpent: 1 } },
    ]),
    DonorPoints.aggregate([{ $group: { _id: '$tier', count: { $sum: 1 } } }]),
    PointsTransaction.aggregate([
      { $match: { pointsAmount: { $gt: 0 } } },
      { $group: { _id: null, total: { $sum: '$pointsAmount' } } },
    ]).then((r) => r[0]?.total || 0),
  ]);

  return { topRewards, tierDistribution, totalPointsIssued };
};
