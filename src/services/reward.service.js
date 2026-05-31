import mongoose from 'mongoose';
import DonorPoints from '../models/DonorPoints.model.js';
import PointsTransaction from '../models/PointsTransaction.model.js';
import RewardCatalog from '../models/RewardCatalog.model.js';
import RewardRedemption from '../models/RewardRedemption.model.js';
import Badge from '../models/Badge.model.js';
import UserBadge from '../models/UserBadge.model.js';
import Donation from '../models/Donation.model.js';
import Notification from '../models/Notification.model.js';
import * as activityService from './activity.service.js';
import { getRewardsConfig } from './rewardsConfig.service.js';
import { paginationMeta } from '../utils/pagination.js';
import { logger } from '../utils/logger.js';
import Donor from '../models/Donor.model.js';
import { formatPointsTitle, ACTIVITY_TITLE_MAP } from '../constants/rewards.constants.js';

// Points awarded per request/donation type
export const POINTS_BY_TYPE = {
  blood: 200,
  plasma: 150,
  platelets: 175,
  double_red_cells: 175,
};

const TRANSACTION_TYPE_BY_TYPE = {
  blood: 'BLOOD_DONATION',  plasma: 'PLASMA_DONATION',
  platelets: 'PLATELETS_DONATION',
  double_red_cells: 'DOUBLE_RED_CELLS_DONATION',
};

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

const TIER_ORDER = ['bronze', 'silver', 'gold', 'platinum'];

const getTierForPoints = (lifetimePoints, tiers) => {
  if (lifetimePoints >= tiers.platinum) return 'platinum';
  if (lifetimePoints >= tiers.gold) return 'gold';
  if (lifetimePoints >= tiers.silver) return 'silver';
  return 'bronze';
};

const getTierProgress = (lifetimePoints, tiers) => {
  const currentTier = getTierForPoints(lifetimePoints, tiers);
  const currentIndex = TIER_ORDER.indexOf(currentTier);
  const nextTier = TIER_ORDER[currentIndex + 1] || null;
  const currentThreshold = tiers[currentTier] ?? 0;
  const nextThreshold = nextTier ? tiers[nextTier] : null;

  const pointsToNextTier = nextThreshold == null ? 0 : Math.max(0, nextThreshold - lifetimePoints);
  const progressPercentage = nextThreshold == null || nextThreshold <= currentThreshold
    ? 100
    : Math.min(100, Math.max(0, Math.round(((lifetimePoints - currentThreshold) / (nextThreshold - currentThreshold)) * 100)));

  return {
    currentTier,
    nextTier,
    pointsToNextTier,
    progressPercentage,
  };
};

export const seedRewardData = async () => {
  try {
    for (const badge of SEED_BADGES) {
      await Badge.findOneAndUpdate({ badgeName: badge.badgeName }, { $setOnInsert: badge }, { upsert: true });
    }
    for (const reward of SEED_REWARDS) {
      await RewardCatalog.findOneAndUpdate({ name: reward.name }, { $setOnInsert: reward }, { upsert: true });
    }
  } catch (err) {
    logger.error('Reward seed error', {
      message: err.message,
    });
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
    { upsert: true, returnDocument: 'after' }
  );
};

const isMongoDuplicateKeyError = (err) => {
  return err?.code === 11000 || (typeof err?.message === 'string' && err.message.includes('E11000'));
};

// formatPointsTitle moved to src/constants/rewards.constants.js for reuse

/**
 * Award points to a donor atomically.
 * Handles tier promotion detection and bonus points.
 * Returns { account, transaction, newBadges }
 */
const awardPoints = async (donorId, amount, type, description, referenceId = null, rewardsConfig = null) => {
  const normalizedReferenceId = referenceId ? String(referenceId) : null;
  const config = rewardsConfig || await getRewardsConfig();

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
        { upsert: true, returnDocument: 'after', session }
      );

      // Recalculate tier (capture previous tier first)
      const previousTier = account.tier;
      const newTier = getTierForPoints(account.lifetimePointsEarned, config.tiers);
      const tierChanged = newTier !== previousTier;
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

      result = {
        account,
        transaction: transaction[0],
        tierChanged,
        newTier,
        previousTier,
      };
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

  // Award tier bonus and log tier promotion outside transaction (non-critical)
  if (result?.tierChanged) {
    const tierBonusMap = {
      silver: config.tierBonuses.silver,
      gold: config.tierBonuses.gold,
      platinum: config.tierBonuses.platinum,
    };
    const bonus = tierBonusMap[result.newTier];
    if (bonus) {
      await awardPoints(donorId, bonus, 'TIER_BONUS', `Tier promotion bonus: ${result.newTier}`, `tier_${result.newTier}_${donorId}`, config);
    }

    // Log tier promotion activity (fire-and-forget)
    activityService
      .logActivity(donorId, {
        type: 'reward',
        action: 'tier_promoted',
        title: ACTIVITY_TITLE_MAP.tier_promoted,
        description: `Congratulations! You've reached ${result.newTier} tier.`,
        referenceId: `tier_${result.newTier}_${donorId}`,
        referenceType: 'PointsTransaction',
        metadata: {
          previousTier: result.previousTier,
          newTier: result.newTier,
          bonusPoints: bonus,
        },
      })
      .catch((error) => logger.error('Activity log error', { message: error.message }));

    // Notify donor of tier promotion
    Notification.create({
      userId: donorId,
      type: 'system',
      title: `🎉 Tier Upgraded to ${result.newTier.charAt(0).toUpperCase() + result.newTier.slice(1)}!`,
      message: `Congratulations! You've reached ${result.newTier} tier. Keep donating to unlock more rewards!`,
    }).catch(() => {});
  }

  // Log points earned activity (fire-and-forget) for non-tier-bonus awards
  if (type !== 'TIER_BONUS') {
    activityService
      .logActivity(donorId, {
        type: 'reward',
        action: 'earned_points',
        title: formatPointsTitle(amount, type, description),
        description: description,
        referenceId: normalizedReferenceId || `points_${donorId}_${Date.now()}`,
        referenceType: 'PointsTransaction',
        metadata: {
          pointsAmount: amount,
          transactionType: type,
          balanceAfter: result?.account?.pointsBalance ?? null,
        },
      })
      .catch((error) => logger.error('Activity log error', { message: error.message }));
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
    const rewardsConfig = await getRewardsConfig();
    const account = await getOrCreateAccount(donorId);

    // Determine donation type via the Donation -> Request relationship.
    let donation = null;
    let donationType = 'blood';
    try {
      const isValidId = mongoose.Types.ObjectId.isValid(String(donationId));
      if (isValidId) {
        donation = await Donation.findById(donationId).populate('requestId');
        donationType = donation?.requestId?.type || 'blood';
      }
    } catch (e) {
      // Ignore lookup errors and fallback to defaults
      donation = null;
      donationType = 'blood';
    }

    // Base donation points: lookup by type with fallbacks to legacy config
    const basePoints = POINTS_BY_TYPE[donationType] ?? rewardsConfig.points.bloodDonation ?? 0;
    const txType = TRANSACTION_TYPE_BY_TYPE[donationType] || 'BLOOD_DONATION';

    const finalPoints = basePoints;

    await awardPoints(
      donorId,
      finalPoints,
      txType,
      `${donationType.charAt(0).toUpperCase() + donationType.slice(1)} Donation - Successful`,
      `donation_${donationId}`,
      rewardsConfig
    );

    // First donation bonus (one-time)
    if (!account.firstDonationAwarded) {
      await awardPoints(donorId, rewardsConfig.points.firstDonation, 'FIRST_DONATION', 'First Donation Bonus!', `first_donation_${donorId}`, rewardsConfig);
      await DonorPoints.findOneAndUpdate({ donorId }, { firstDonationAwarded: true });
    }

    // Emergency response bonus
    if (isEmergency) {
      await awardPoints(donorId, rewardsConfig.points.emergencyResponse, 'EMERGENCY_RESPONSE', 'Emergency Response Bonus', `emergency_${donationId}`, rewardsConfig);
    }

    // Check badges — await to ensure DB work completes before caller continues.
    // This prevents background badge DB ops from running after the app initiates a shutdown
    // (small change from fire-and-forget to a safe awaited call).
    try {
      await checkAndUpdateBadges(donorId);
    } catch (e) {
      logger.error('Badge check error', { message: e.message });
    }
  } catch (err) {
    // Reward errors must NEVER break the donation flow
    logger.error('Reward donation completion error', {
      message: err.message,
    });
  }
};

/**
 * Called when donor completes their profile (one-time award).
 */
export const onProfileCompleted = async (donorId) => {
  try {
    const rewardsConfig = await getRewardsConfig();
    const account = await getOrCreateAccount(donorId);
    if (account.profileCompletionAwarded) return;

    await awardPoints(donorId, rewardsConfig.points.profileCompletion, 'PROFILE_COMPLETION', 'Profile Completed', `profile_${donorId}`, rewardsConfig);
    await DonorPoints.findOneAndUpdate({ donorId }, { profileCompletionAwarded: true });
  } catch (err) {
    logger.error('Reward profile completion error', {
      message: err.message,
    });
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

    // Fetch the existing UserBadge BEFORE updating so we can detect a status transition.
    // We use the pre-update snapshot to decide if this is a *new* unlock event.
    const existingUserBadge = await UserBadge.findOne({ donorId, badgeId: badge._id }).lean();
    const wasAlreadyUnlocked = existingUserBadge?.unlockStatus === 'UNLOCKED';

    await UserBadge.findOneAndUpdate(
      { donorId, badgeId: badge._id },
      {
        $set: {
          progressCurrent: Math.min(current, badge.unlockThreshold),
          progressTarget: badge.unlockThreshold,
          ...(isUnlocked ? { unlockStatus: 'UNLOCKED' } : {}),
        },
        // unlockedAt is set once on first unlock and never overwritten
        ...(isUnlocked && !wasAlreadyUnlocked ? { $setOnInsert: { donorId, badgeId: badge._id, unlockedAt: new Date() } } : { $setOnInsert: { donorId, badgeId: badge._id } }),
      },
      { upsert: true, returnDocument: 'after' }
    );

    // Only fire side-effects on the *first* unlock transition
    if (isUnlocked && !wasAlreadyUnlocked) {
      if (badge.pointsReward > 0) {
        await awardPoints(donorId, badge.pointsReward, 'BADGE_UNLOCK', `Badge Unlocked: ${badge.badgeName}`, `badge_${badge._id}`);
      }

      newlyUnlocked.push(badge.badgeName);

      // Log badge unlock activity (fire-and-forget)
      activityService
        .logActivity(donorId, {
          type: 'reward',
          action: 'badge_unlocked',
          title: ACTIVITY_TITLE_MAP.badge_unlocked,
          description: `You've unlocked the ${badge.badgeName} badge: ${badge.badgeDescription}`,
          referenceId: badge._id.toString(),
          referenceType: 'Badge',
          metadata: {
            badgeName: badge.badgeName,
            badgeCategory: badge.category,
            badgeRarity: badge.rarity,
            pointsReward: badge.pointsReward,
            unlockedAt: new Date(),
          },
        })
        .catch((error) => logger.error('Activity log error', { message: error.message }));

      Notification.create({
        userId: donorId,
        type: 'system',
        title: `🏆 Badge Unlocked: ${badge.badgeName}`,
        message: badge.badgeDescription,
        data: { badgeId: badge._id, rarity: badge.rarity },
      }).catch(() => {});
    }
  }

  return newlyUnlocked;
};

// ──────────────────────────────────────────────
//  Donor-facing read operations
// ──────────────────────────────────────────────

export const getPointsSummary = async (donorId) => {
  const account = await getOrCreateAccount(donorId);
  const rewardsConfig = await getRewardsConfig();
  const { currentTier, nextTier, pointsToNextTier, progressPercentage } = getTierProgress(account.lifetimePointsEarned, rewardsConfig.tiers);

  return {
    pointsBalance: account.pointsBalance,
    lifetimePointsEarned: account.lifetimePointsEarned,
    currentTier,
    nextTier,
    pointsToNextTier,
    progressPercentage,
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
  const offset = (page - 1) * limit;

  const query = { donorId };

  if (filter === 'EARNED') query.pointsAmount = { $gt: 0 };
  if (filter === 'REDEEMED') query.transactionType = 'REWARD_REDEEMED';
  if (filter === 'ADJUSTMENTS') query.transactionType = 'ADMIN_ADJUSTMENT';
  if (dateFrom) query.createdAt = { ...query.createdAt, $gte: new Date(dateFrom) };
  if (dateTo) query.createdAt = { ...query.createdAt, $lte: new Date(dateTo) };

  const [transactions, total] = await Promise.all([
    PointsTransaction.find(query).sort({ createdAt: -1 }).skip(offset).limit(parseInt(limit)),
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

const getDayWindowStart = (date = new Date()) => {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  return start;
};

const getMonthWindowStart = (date = new Date()) => {
  const start = new Date(date);
  start.setDate(1);
  start.setHours(0, 0, 0, 0);
  return start;
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

  const session = await mongoose.startSession();
  let updatedAccount;
  let redemption;
  const now = new Date();

  try {
    await session.withTransaction(async () => {
      // Serialize redemptions for the same reward inside the transaction
      const lockedReward = await RewardCatalog.findOneAndUpdate(
        { _id: rewardId, status: 'ACTIVE' },
        { $set: { updatedAt: now } },
        { returnDocument: 'after', session }
      );

      if (!lockedReward) {
        throw Object.assign(new Error('Reward is not available'), { statusCode: 400 });
      }

      if (lockedReward.dailyLimit) {
        const dailyCount = await RewardRedemption.countDocuments(
          { rewardId, createdAt: { $gte: getDayWindowStart(now) }, status: { $nin: ['CANCELLED'] } },
          { session }
        );
        if (dailyCount >= lockedReward.dailyLimit) {
          throw Object.assign(new Error('Daily redemption limit reached for this reward'), { statusCode: 409 });
        }
      }

      if (lockedReward.monthlyLimit) {
        const monthlyCount = await RewardRedemption.countDocuments(
          { rewardId, createdAt: { $gte: getMonthWindowStart(now) }, status: { $nin: ['CANCELLED'] } },
          { session }
        );
        if (monthlyCount >= lockedReward.monthlyLimit) {
          throw Object.assign(new Error('Monthly redemption limit reached for this reward'), { statusCode: 409 });
        }
      }

      // Deduct points (atomic balance guard preserved).
      updatedAccount = await DonorPoints.findOneAndUpdate(
        { donorId, pointsBalance: { $gte: lockedReward.pointsCost } },
        { $inc: { pointsBalance: -lockedReward.pointsCost } },
        { returnDocument: 'after', session }
      );
      if (!updatedAccount) throw Object.assign(new Error('Insufficient points'), { statusCode: 409 });

      // Create redemption record.
      redemption = await RewardRedemption.create(
        [{
          donorId,
          rewardId,
          pointsSpent: lockedReward.pointsCost,
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
          pointsAmount: -lockedReward.pointsCost,
          transactionType: 'REWARD_REDEEMED',
          description: `Reward Redeemed: ${lockedReward.name}`,
          referenceId: String(redemption._id),
          balanceAfter: updatedAccount.pointsBalance,
        }],
        { session }
      );

      await RewardCatalog.updateOne(
        { _id: rewardId },
        { $inc: { redemptionCount: 1 } },
        { session }
      );
    });
  } finally {
    session.endSession();
  }

  // Log reward redemption activity (fire-and-forget)
  activityService
    .logActivity(donorId, {
      type: 'reward',
      action: 'redeemed_reward',
      title: ACTIVITY_TITLE_MAP.redeemed_reward,
      description: `Redeemed ${reward.name} for ${reward.pointsCost} points`,
      referenceId: redemption._id.toString(),
      referenceType: 'RewardRedemption',
      metadata: {
        rewardName: reward.name,
        rewardCategory: reward.category,
        pointsSpent: reward.pointsCost,
        deliveryMethod: deliveryMethod,
        confirmationCode: redemption.confirmationCode,
        remainingPoints: updatedAccount.pointsBalance,
      },
    })
    .catch((error) => logger.error('Activity log error', { message: error.message }));

  // In-app notification
  Notification.create({
    userId: donorId,
    type: 'system',
      title: ACTIVITY_TITLE_MAP.redeemed_reward_notification,
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
  const offset = (page - 1) * limit;
  const query = { donorId };
  if (status && status !== 'ALL') query.status = status;

  const [redemptions, total] = await Promise.all([
    RewardRedemption.find(query).populate('rewardId', 'name category iconType').sort({ createdAt: -1 }).skip(offset).limit(parseInt(limit)),
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
        { upsert: true, returnDocument: 'after', session }
      );

      if (amount < 0 && account.pointsBalance + amount < 0) {
        throw new Error('Adjustment would result in negative balance');
      }

      const balanceGuard = amount < 0 ? { pointsBalance: { $gte: Math.abs(amount) } } : {};
      updatedAccount = await DonorPoints.findOneAndUpdate(
        { donorId, ...balanceGuard },
        { $inc: { pointsBalance: amount, ...(amount > 0 ? { lifetimePointsEarned: amount } : {}) } },
        { returnDocument: 'after', session }
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
  const reward = await RewardCatalog.findByIdAndUpdate(rewardId, { status }, { returnDocument: 'after' });
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

/**
 * Public leaderboard — top donors by lifetime points.
 * Uses the existing { lifetimePointsEarned: -1 } index for O(1) sort.
 *
 * @param {number} limit - Number of top donors to return (default 20, max 50)
 * @returns {Array<{ rank, donorId, fullName, tier, lifetimePointsEarned }>}
 */
export const getLeaderboard = async (limit = 20) => {
  const cappedLimit = Math.min(Math.max(1, limit), 50);
  const rewardsConfig = await getRewardsConfig();

  const accounts = await DonorPoints.find({})
    .sort({ lifetimePointsEarned: -1 })
    .limit(cappedLimit)
    .populate('donorId', 'fullName');

  return accounts.map((account, index) => ({
    rank: index + 1,
    donorId: account.donorId?._id || account.donorId,
    fullName: account.donorId?.fullName || 'Anonymous',
    tier: getTierForPoints(account.lifetimePointsEarned, rewardsConfig.tiers),
    lifetimePointsEarned: account.lifetimePointsEarned,
    pointsBalance: account.pointsBalance,
  }));
};

export const getEarningRules = async () => {
  const rewardsConfig = await getRewardsConfig();

  // Return all donation types with their specific point values from POINTS_BY_TYPE,
  // plus bonus activities from the config so the Flutter UI can show accurate rules.
  return [
    { type: 'blood_donation',      title: 'Blood Donation',      points: POINTS_BY_TYPE.blood,        category: 'donation' },
    { type: 'plasma_donation',     title: 'Plasma Donation',     points: POINTS_BY_TYPE.plasma,       category: 'donation' },
    { type: 'platelets_donation',  title: 'Platelet Donation',   points: POINTS_BY_TYPE.platelets,    category: 'donation' },
    { type: 'double_red_cells_donation', title: 'Double Red Cells Donation', points: POINTS_BY_TYPE.double_red_cells, category: 'donation' },
    { type: 'first_donation',      title: 'First Donation Bonus', points: rewardsConfig.points.firstDonation,      category: 'bonus' },
    { type: 'emergency_response',  title: 'Emergency Response',  points: rewardsConfig.points.emergencyResponse,  category: 'bonus' },
    { type: 'profile_completion',  title: 'Profile Completion',  points: rewardsConfig.points.profileCompletion,  category: 'bonus' },
    { type: 'referral',            title: 'Referral',            points: rewardsConfig.points.referral,           category: 'bonus' },
  ];
};
