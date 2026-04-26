import mongoose from 'mongoose';

/**
 * RewardCatalog — items donors can redeem their points for.
 *
 * Seeded with the 6 rewards from the Flutter UI.
 * Admin can update status; daily/monthly limits are optional.
 *
 * Partner integrations are intentionally NOT implemented here.
 * Redemption generates a unique confirmation code delivered in-app.
 * External voucher delivery is a future-work item.
 */
const rewardCatalogSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    description: {
      type: String,
      required: true,
    },

    pointsCost: {
      type: Number,
      required: true,
      min: 1,
    },

    category: {
      type: String,
      enum: ['FOOD', 'ENTERTAINMENT', 'HEALTH', 'STATUS'],
      required: true,
    },

    // Icon identifier sent to Flutter for rendering the correct icon
    iconType: {
      type: String,
      default: 'gift',
    },

    colorCode: {
      type: String,
      default: '#E53935',
    },

    status: {
      type: String,
      enum: ['ACTIVE', 'INACTIVE', 'LIMITED'],
      default: 'ACTIVE',
    },

    // null = unlimited
    dailyLimit: {
      type: Number,
      default: null,
    },

    monthlyLimit: {
      type: Number,
      default: null,
    },

    redemptionCount: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

rewardCatalogSchema.index({ status: 1 });
rewardCatalogSchema.index({ category: 1 });
rewardCatalogSchema.index({ pointsCost: 1 });

const RewardCatalog = mongoose.model('RewardCatalog', rewardCatalogSchema);

export default RewardCatalog;
