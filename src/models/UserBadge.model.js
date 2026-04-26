import mongoose from 'mongoose';

/**
 * UserBadge — tracks each donor's progress toward and ownership of badges.
 *
 * One document per (donor, badge) pair.
 * Upserted by the badge-check service whenever a relevant metric changes.
 */
const userBadgeSchema = new mongoose.Schema(
  {
    donorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    badgeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Badge',
      required: true,
    },

    unlockStatus: {
      type: String,
      enum: ['LOCKED', 'UNLOCKED'],
      default: 'LOCKED',
    },

    // How far the donor has progressed toward this badge
    progressCurrent: {
      type: Number,
      default: 0,
      min: 0,
    },

    progressTarget: {
      type: Number,
      required: true,
    },

    unlockedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

userBadgeSchema.index({ donorId: 1 });
userBadgeSchema.index({ donorId: 1, badgeId: 1 }, { unique: true });
userBadgeSchema.index({ unlockStatus: 1 });

const UserBadge = mongoose.model('UserBadge', userBadgeSchema);

export default UserBadge;
