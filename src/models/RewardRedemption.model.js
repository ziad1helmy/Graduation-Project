import mongoose from 'mongoose';
import crypto from 'crypto';

/**
 * RewardRedemption — records each time a donor redeems a reward.
 *
 * Confirmation code is auto-generated (RWD-XXXXXX format).
 * Delivery is handled in-app; external partner delivery is future work.
 */
const rewardRedemptionSchema = new mongoose.Schema(
  {
    donorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    rewardId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'RewardCatalog',
      required: true,
    },

    pointsSpent: {
      type: Number,
      required: true,
      min: 1,
    },

    // Unique human-readable code shown to the donor
    confirmationCode: {
      type: String,
      unique: true,
      required: true,
    },

    status: {
      type: String,
      enum: ['PENDING', 'CONFIRMED', 'DELIVERED', 'CANCELLED', 'EXPIRED'],
      default: 'CONFIRMED', // we confirm immediately on our end
    },

    deliveryMethod: {
      type: String,
      enum: ['IN_APP', 'EMAIL'],
      default: 'IN_APP',
    },

    deliveryContact: {
      type: String,
      default: null,
    },

    // Redemption expires 30 days after issue by default
    expiresAt: {
      type: Date,
      default: () => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
  },
  { timestamps: true }
);

rewardRedemptionSchema.index({ donorId: 1, createdAt: -1 });
rewardRedemptionSchema.index({ confirmationCode: 1 }, { unique: true });
rewardRedemptionSchema.index({ status: 1 });

// Auto-generate confirmation code before saving
rewardRedemptionSchema.pre('validate', function () {
  if (!this.confirmationCode) {
    const code = crypto.randomBytes(3).toString('hex').toUpperCase();
    this.confirmationCode = `RWD-${new Date().getFullYear()}-${code}`;
  }
});

const RewardRedemption = mongoose.model('RewardRedemption', rewardRedemptionSchema);

export default RewardRedemption;
