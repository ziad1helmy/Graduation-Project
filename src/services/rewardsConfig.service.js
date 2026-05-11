import RewardsConfig, { DEFAULT_REWARDS_CONFIG, REWARDS_CONFIG_KEY } from '../models/RewardsConfig.model.js';

let cachedRewardsConfig = null;

const cloneConfig = (config) => ({
  points: { ...config.points },
  tiers: { ...config.tiers },
  tierBonuses: { ...config.tierBonuses },
});

const normalizeConfig = (config = DEFAULT_REWARDS_CONFIG) => ({
  points: {
    bloodDonation: Number(config.points?.bloodDonation),
    emergencyResponse: Number(config.points?.emergencyResponse),
    profileCompletion: Number(config.points?.profileCompletion),
    referral: Number(config.points?.referral),
    firstDonation: Number(config.points?.firstDonation),
  },
  tiers: {
    bronze: Number(config.tiers?.bronze),
    silver: Number(config.tiers?.silver),
    gold: Number(config.tiers?.gold),
    platinum: Number(config.tiers?.platinum),
  },
  tierBonuses: {
    silver: Number(config.tierBonuses?.silver),
    gold: Number(config.tierBonuses?.gold),
    platinum: Number(config.tierBonuses?.platinum),
  },
});

const toPlainConfig = (doc) => ({
  points: { ...doc.points },
  tiers: { ...doc.tiers },
  tierBonuses: { ...doc.tierBonuses },
});

export const invalidateRewardsConfigCache = () => {
  cachedRewardsConfig = null;
};

export const initializeDefaultConfig = async () => {
  const config = await RewardsConfig.findOneAndUpdate(
    { configKey: REWARDS_CONFIG_KEY },
    {
      $setOnInsert: {
        configKey: REWARDS_CONFIG_KEY,
        ...cloneConfig(DEFAULT_REWARDS_CONFIG),
      },
    },
    { upsert: true, returnDocument: 'after' }
  );

  cachedRewardsConfig = toPlainConfig(config);
  return cloneConfig(cachedRewardsConfig);
};

export const getRewardsConfig = async () => {
  if (cachedRewardsConfig) {
    return cloneConfig(cachedRewardsConfig);
  }

  const config = await RewardsConfig.findOne({ configKey: REWARDS_CONFIG_KEY });
  if (!config) {
    return initializeDefaultConfig();
  }

  cachedRewardsConfig = toPlainConfig(config);
  return cloneConfig(cachedRewardsConfig);
};

export const updateRewardsConfig = async (updates = {}, updatedBy = null) => {
  const sanitizedConfig = normalizeConfig(updates);

  const config = await RewardsConfig.findOneAndUpdate(
    { configKey: REWARDS_CONFIG_KEY },
    {
      $set: {
        ...sanitizedConfig,
        updatedBy,
      },
      $setOnInsert: {
        configKey: REWARDS_CONFIG_KEY,
      },
    },
    { upsert: true, returnDocument: 'after' }
  );

  cachedRewardsConfig = toPlainConfig(config);
  return cloneConfig(cachedRewardsConfig);
};

export const getRewardsEarningRules = async () => {
  const config = await getRewardsConfig();

  return [
    { type: 'blood_donation', title: 'Blood Donation', points: config.points.bloodDonation },
    { type: 'emergency_response', title: 'Emergency Response', points: config.points.emergencyResponse },
    { type: 'profile_completion', title: 'Profile Completion', points: config.points.profileCompletion },
    { type: 'referral', title: 'Referral', points: config.points.referral },
  ];
};