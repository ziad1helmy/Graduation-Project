import mongoose from 'mongoose';

/**
 * DonorPoints — one document per donor tracking their points balance and tier.
 *
 * Design decision: separate collection (not embedded in Donor) so we can
 * update points atomically with $inc without loading the full donor doc.
 *
 * Tiers:
 *   bronze:   0 – 999   lifetime earned
 *   silver:   1000 – 2499
 *   gold:     2500 – 4999
 *   platinum: 5000+
 */
const donorPointsSchema = new mongoose.Schema(
  {
    donorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
    },

    // Current spendable balance (earned – redeemed)
    pointsBalance: {
      type: Number,
      default: 0,
      min: 0,
    },

    // Cumulative lifetime total — never decreases, used for tier calculation
    lifetimePointsEarned: {
      type: Number,
      default: 0,
      min: 0,
    },

    // Derived from lifetimePointsEarned; stored for fast lookups
    tier: {
      type: String,
      enum: ['bronze', 'silver', 'gold', 'platinum'],
      default: 'bronze',
    },

    // Track one-time point grants so they can't be awarded twice
    profileCompletionAwarded: {
      type: Boolean,
      default: false,
    },
    firstDonationAwarded: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

donorPointsSchema.index({ lifetimePointsEarned: -1 }); // for leaderboard

/**
 * Calculate tier from lifetime points earned.
 */
donorPointsSchema.statics.calculateTier = function (lifetimePoints) {
  if (lifetimePoints >= 5000) return 'platinum';
  if (lifetimePoints >= 2500) return 'gold';
  if (lifetimePoints >= 1000) return 'silver';
  return 'bronze';
};

const TIER_THRESHOLDS = { bronze: 0, silver: 1000, gold: 2500, platinum: 5000 };

/**
 * Get points needed to reach the next tier.
 */
donorPointsSchema.statics.pointsToNextTier = function (lifetimePoints) {
  if (lifetimePoints >= 5000) return 0; // already platinum
  if (lifetimePoints >= 2500) return 5000 - lifetimePoints;
  if (lifetimePoints >= 1000) return 2500 - lifetimePoints;
  return 1000 - lifetimePoints;
};

donorPointsSchema.statics.TIER_THRESHOLDS = TIER_THRESHOLDS;

const DonorPoints = mongoose.model('DonorPoints', donorPointsSchema);

export default DonorPoints;
