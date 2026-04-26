import mongoose from 'mongoose';

/**
 * Badge — static definition of all achievable badges.
 *
 * Seeded once at startup. Admin can add more badges later.
 * unlock_condition stores the metric key used by the badge checker.
 *
 * Supported condition types (metric keys):
 *   - completedDonations  → count of completed donations
 *   - emergencyResponses  → count of emergency responses
 */
const badgeSchema = new mongoose.Schema(
  {
    badgeName: {
      type: String,
      required: true,
      trim: true,
      unique: true,
    },

    badgeDescription: {
      type: String,
      required: true,
    },

    // Icon identifier passed to Flutter
    badgeIcon: {
      type: String,
      default: 'star',
    },

    category: {
      type: String,
      enum: ['DONATION', 'EMERGENCY', 'ENGAGEMENT', 'SOCIAL'],
      required: true,
    },

    rarity: {
      type: String,
      enum: ['COMMON', 'RARE', 'EPIC', 'LEGENDARY'],
      default: 'COMMON',
    },

    // Metric the system checks to decide whether to unlock
    unlockCondition: {
      type: String,
      enum: ['completedDonations', 'emergencyResponses'],
      required: true,
    },

    // Value the metric must reach to unlock this badge
    unlockThreshold: {
      type: Number,
      required: true,
      min: 1,
    },

    // Bonus points awarded when this badge is first unlocked
    pointsReward: {
      type: Number,
      default: 0,
    },

    // Display order in the Flutter badges tab
    sortOrder: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

badgeSchema.index({ category: 1 });
badgeSchema.index({ unlockCondition: 1, unlockThreshold: 1 });

const Badge = mongoose.model('Badge', badgeSchema);

export default Badge;
