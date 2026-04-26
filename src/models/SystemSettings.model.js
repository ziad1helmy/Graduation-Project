import mongoose from 'mongoose';

/**
 * SystemSettings Model - Key-value store for system configuration
 *
 * Used for maintenance mode, system preferences, and feature flags.
 * Each setting is a unique key with a mixed-type value.
 */

const systemSettingsSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      unique: true,
      required: [true, 'Setting key is required'],
      trim: true,
    },

    value: {
      type: mongoose.Schema.Types.Mixed,
      required: [true, 'Setting value is required'],
    },

    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  {
    timestamps: true,
  }
);

// Unique index on key
systemSettingsSchema.index({ key: 1 }, { unique: true });

const SystemSettings = mongoose.model('SystemSettings', systemSettingsSchema);

export default SystemSettings;
