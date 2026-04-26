import mongoose from 'mongoose';

const twoFactorSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
    },
    enabled: {
      type: Boolean,
      default: false,
    },
    secret: {
      type: String,
      default: null,
    },
    backupCodes: {
      type: [String],
      default: [],
    },
    pendingSecret: {
      type: String,
      default: null,
    },
    pendingBackupCodes: {
      type: [String],
      default: [],
    },
    verifiedAt: {
      type: Date,
      default: null,
    },
    disabledAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

twoFactorSchema.index({ userId: 1 }, { unique: true });

const TwoFactor = mongoose.model('TwoFactor', twoFactorSchema);

export default TwoFactor;
