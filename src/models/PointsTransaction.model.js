import mongoose from 'mongoose';

/**
 * PointsTransaction — immutable audit log of every points event.
 *
 * points_amount is positive for earned, negative for redeemed/deducted.
 * Never delete records from this collection.
 */

// Points values — single source of truth, shared with reward.service.js
export const POINTS_CONFIG = {
  BLOOD_DONATION: 200,
  EMERGENCY_RESPONSE: 100,
  PROFILE_COMPLETION: 50,
  FIRST_DONATION: 100,      // bonus on top of BLOOD_DONATION for first ever
  TIER_BONUS_SILVER: 50,
  TIER_BONUS_GOLD: 150,
  TIER_BONUS_PLATINUM: 500,
};

const TRANSACTION_TYPES = [
  'BLOOD_DONATION',
  'EMERGENCY_RESPONSE',
  'PROFILE_COMPLETION',
  'FIRST_DONATION',
  'TIER_BONUS',
  'BADGE_UNLOCK',
  'REWARD_REDEEMED',
  'ADMIN_ADJUSTMENT',
];

const pointsTransactionSchema = new mongoose.Schema(
  {
    donorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    pointsAmount: {
      type: Number,
      required: true,
      // Positive = earned, negative = spent
    },

    transactionType: {
      type: String,
      enum: TRANSACTION_TYPES,
      required: true,
    },

    description: {
      type: String,
      required: true,
      maxlength: 200,
    },

    // ID of the related entity (donationId, redemptionId, etc.) for dedup
    referenceId: {
      type: String,
      default: null,
    },

    // Snapshot of balance after this transaction (for audit clarity)
    balanceAfter: {
      type: Number,
      required: true,
    },

    // Admin who made the adjustment (only for ADMIN_ADJUSTMENT type)
    adminId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  {
    timestamps: true,
    // Prevent accidental updates to this immutable log
    strict: true,
  }
);

pointsTransactionSchema.index({ donorId: 1, createdAt: -1 });
pointsTransactionSchema.index({ transactionType: 1 });
pointsTransactionSchema.index({ referenceId: 1 }); // deduplication lookups
pointsTransactionSchema.index(
  { donorId: 1, transactionType: 1, referenceId: 1 },
  {
    unique: true,
    // Only enforce uniqueness for reference-backed operations.
    partialFilterExpression: { referenceId: { $type: 'string' } },
  }
);

const PointsTransaction = mongoose.model('PointsTransaction', pointsTransactionSchema);

export default PointsTransaction;
