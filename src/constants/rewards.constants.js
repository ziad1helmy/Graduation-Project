export const TYPE_LABEL_MAP = {
  FIRST_DONATION: 'First Donation',
  TIER_BONUS: 'Tier Bonus',
  EMERGENCY_RESPONSE: 'Emergency Response',
  PROFILE_COMPLETION: 'Profile Completion',
  BADGE_UNLOCK: 'Badge Unlock',
  REWARD_REDEEMED: 'Reward Redemption',
  BLOOD_DONATION: 'Blood Donation',
  PLASMA_DONATION: 'Plasma Donation',
  PLATELETS_DONATION: 'Platelets Donation',
  ORGAN_DONATION: 'Organ Donation',
  ADMIN_ADJUSTMENT: 'Admin Adjustment',
  // fallback keys used elsewhere in the code
  blood_donation: 'Blood Donation',
  emergency_response: 'Emergency Response',
  profile_completion: 'Profile Completion',
  referral: 'Referral',
};

export const formatPointsTitle = (amount, type, description) => {
  const label = type && TYPE_LABEL_MAP[type] ? TYPE_LABEL_MAP[type] : (description ? String(description).split('\n')[0] : 'Points Earned');
  return `${amount} Points Earned — ${label}`;
};

export default {
  TYPE_LABEL_MAP,
  formatPointsTitle,
};

export const ACTIVITY_TITLE_MAP = {
  tier_promoted: 'Tier Promoted',
  badge_unlocked: 'Badge Unlocked',
  redeemed_reward: 'Reward Redeemed',
  redeemed_reward_notification: '🎁 Reward Redeemed!',
  donation_created: 'Donation Created',
  donation_verified: 'Donation Verified',
  donation_confirmed: 'Donation Confirmed',
  donation_completed: 'Donation Completed',
  donation_cancelled: 'Donation Cancelled',
};
