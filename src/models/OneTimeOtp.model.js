import mongoose from 'mongoose';

const oneTimeOtpSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },
    purpose: {
      type: String,
      enum: ['password_reset'],
      required: true,
    },
    otpHash: {
      type: String,
      required: true,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
    verifiedAt: {
      type: Date,
      default: null,
    },
    attempts: {
      type: Number,
      default: 0,
    },
    lastSentAt: {
      type: Date,
      default: () => new Date(),
    },
    resetTokenHash: {
      type: String,
      default: null,
    },
    resetTokenExpiresAt: {
      type: Date,
      default: null,
    },
    resetTokenUsedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

oneTimeOtpSchema.index({ email: 1, purpose: 1, createdAt: -1 });
oneTimeOtpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const OneTimeOtp = mongoose.model('OneTimeOtp', oneTimeOtpSchema);

export default OneTimeOtp;
