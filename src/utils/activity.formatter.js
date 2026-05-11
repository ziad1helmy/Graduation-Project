import { DEFAULT_REWARDS_CONFIG } from '../models/RewardsConfig.model.js';

export const ACTIVITY_TYPES = [
  'donation',
  'reward',
  'emergency_response',
  'profile_update',
  'appointment',
  'badge',
  'achievement',
  'referral',
  'subscription',
  'admin_action',
];

const STATUS_BY_ACTION = {
  created_donation: 'pending',
  completed_donation: 'success',
  cancelled_donation: 'cancelled',
  earned_points: 'success',
  redeemed_reward: 'success',
  badge_unlocked: 'success',
  tier_promoted: 'success',
  updated_profile: 'success',
  responded_to_request: 'success',
  emergency_response: 'success',
};

const normalizeDate = (value) => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const formatQuantity = (value, singularLabel, pluralLabel) => {
  if (value === 1) return `1 ${singularLabel} ago`;
  return `${value} ${pluralLabel} ago`;
};

export const getRelativeTime = (value) => {
  const date = normalizeDate(value);
  if (!date) return 'just now';

  const diffMs = Date.now() - date.getTime();
  if (diffMs <= 0) return 'just now';

  const seconds = Math.floor(diffMs / 1000);
  if (seconds < 60) return 'just now';

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return formatQuantity(minutes, 'minute', 'minutes');

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return formatQuantity(hours, 'hour', 'hours');

  const days = Math.floor(hours / 24);
  if (days < 7) return formatQuantity(days, 'day', 'days');

  const weeks = Math.floor(days / 7);
  if (weeks < 5) return formatQuantity(weeks, 'week', 'weeks');

  const months = Math.floor(days / 30);
  if (months < 12) return formatQuantity(months, 'month', 'months');

  const years = Math.floor(days / 365);
  return formatQuantity(years, 'year', 'years');
};

export const deriveActivityStatus = (activity) => {
  const explicitStatus = String(activity?.metadata?.status || '').trim().toLowerCase();
  if (explicitStatus) {
    return explicitStatus;
  }

  return STATUS_BY_ACTION[activity?.action] || 'success';
};

export const extractActivityHospital = (activity) => {
  const metadata = activity?.metadata || {};
  return metadata.hospitalName || metadata.hospital || null;
};

export const extractActivityPoints = (activity) => {
  const metadata = activity?.metadata || {};

  if (typeof metadata.pointsAmount === 'number') return metadata.pointsAmount;
  if (typeof metadata.pointsSpent === 'number') return metadata.pointsSpent;
  if (typeof metadata.pointsReward === 'number') return metadata.pointsReward;
  if (typeof metadata.bonusPoints === 'number') return metadata.bonusPoints;

  if (activity?.type === 'donation' && activity?.action === 'completed_donation') {
    return DEFAULT_REWARDS_CONFIG.points.bloodDonation;
  }

  return 0;
};

export const formatActivityForTimeline = (activity) => {
  const createdAt = normalizeDate(activity?.createdAt);

  return {
    id: activity?._id?.toString?.() || activity?.id?.toString?.() || null,
    title: activity?.title || null,
    hospital: extractActivityHospital(activity),
    points: extractActivityPoints(activity),
    createdAt: createdAt ? createdAt.toISOString() : null,
    relativeTime: createdAt ? getRelativeTime(createdAt) : 'just now',
    type: activity?.type || null,
    status: deriveActivityStatus(activity),
    icon: activity?.icon || null,
  };
};

export default {
  ACTIVITY_TYPES,
  deriveActivityStatus,
  extractActivityHospital,
  extractActivityPoints,
  formatActivityForTimeline,
  getRelativeTime,
};