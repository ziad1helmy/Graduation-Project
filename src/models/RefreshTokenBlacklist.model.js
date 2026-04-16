import mongoose from 'mongoose';

const refreshTokenBlacklistSchema = new mongoose.Schema(
  {
    tokenHash: {
      type: String,
      required: [true, 'Token hash is required'],
      unique: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required'],
    },
    expiresAt: {
      type: Date,
      required: [true, 'Expiry date is required'],
    },
  },
  {
    timestamps: true,
  }
);

refreshTokenBlacklistSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const RefreshTokenBlacklist = mongoose.model(
  'RefreshTokenBlacklist',
  refreshTokenBlacklistSchema
);

export default RefreshTokenBlacklist;
