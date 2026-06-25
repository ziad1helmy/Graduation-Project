import mongoose from 'mongoose';

export const REWARDS_CONFIG_KEY = 'default';

export const DEFAULT_REWARDS_CONFIG = {
  points: {
    bloodDonation: 200,
    plasmaDonation: 150,
    plateletsDonation: 175,
    doubleRedCellsDonation: 175,
    emergencyResponse: 100,
    profileCompletion: 50,
    referral: 150,
    firstDonation: 100,
  },
  tiers: {
    bronze: 0,
    silver: 1000,
    gold: 2500,
    platinum: 5000,
  },
  tierBonuses: {
    silver: 50,
    gold: 150,
    platinum: 500,
  },
};

const rewardsConfigSchema = new mongoose.Schema(
  {
    configKey: {
      type: String,
      unique: true,
      required: [true, 'Config key is required'],
      default: REWARDS_CONFIG_KEY,
      immutable: true,
      trim: true,
    },

    points: {
      bloodDonation: { type: Number, required: true, min: 0 },
      plasmaDonation: { type: Number, required: true, min: 0 },
      plateletsDonation: { type: Number, required: true, min: 0 },
      doubleRedCellsDonation: { type: Number, required: true, min: 0 },
      emergencyResponse: { type: Number, required: true, min: 0 },
      profileCompletion: { type: Number, required: true, min: 0 },
      referral: { type: Number, required: true, min: 0 },
      firstDonation: { type: Number, required: true, min: 0 },
    },

    tiers: {
      bronze: { type: Number, required: true, min: 0 },
      silver: { type: Number, required: true, min: 0 },
      gold: { type: Number, required: true, min: 0 },
      platinum: { type: Number, required: true, min: 0 },
    },

    tierBonuses: {
      silver: { type: Number, required: true, min: 0 },
      gold: { type: Number, required: true, min: 0 },
      platinum: { type: Number, required: true, min: 0 },
    },

    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

const RewardsConfig = mongoose.model('RewardsConfig', rewardsConfigSchema);

export default RewardsConfig;