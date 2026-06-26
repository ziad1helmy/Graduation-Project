import mongoose from 'mongoose';

export const EARNING_RULE_TYPES = [
  'bloodDonation',
  'plasmaDonation',
  'plateletsDonation',
  'doubleRedCellsDonation',
  'emergencyResponse',
  'profileCompletion',
  'referral',
  'firstDonation',
];

export const DEFAULT_EARNING_RULES = [
  { type: 'bloodDonation', title: 'Blood Donation', points: 200, category: 'donation' },
  { type: 'plasmaDonation', title: 'Plasma Donation', points: 150, category: 'donation' },
  { type: 'plateletsDonation', title: 'Platelet Donation', points: 175, category: 'donation' },
  { type: 'doubleRedCellsDonation', title: 'Double Red Cells Donation', points: 175, category: 'donation' },
  { type: 'emergencyResponse', title: 'Emergency Response', points: 100, category: 'bonus' },
  { type: 'profileCompletion', title: 'Profile Completion', points: 50, category: 'bonus' },
  { type: 'referral', title: 'Referral', points: 150, category: 'bonus' },
  { type: 'firstDonation', title: 'First Donation Bonus', points: 100, category: 'bonus' },
];

const earningRuleSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      required: [true, 'Rule type is required'],
      unique: true,
      enum: {
        values: EARNING_RULE_TYPES,
        message: '{VALUE} is not a valid earning rule type',
      },
      trim: true,
    },
    title: {
      type: String,
      required: [true, 'Rule title is required'],
      trim: true,
    },
    points: {
      type: Number,
      required: [true, 'Points value is required'],
      min: [0, 'Points must be non-negative'],
    },
    category: {
      type: String,
      required: [true, 'Category is required'],
      enum: {
        values: ['donation', 'bonus'],
        message: '{VALUE} is not a valid category',
      },
      trim: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

const EarningRule = mongoose.model('EarningRule', earningRuleSchema);

export default EarningRule;
