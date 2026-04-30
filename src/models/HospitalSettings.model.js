import mongoose from 'mongoose';

const hospitalSettingsSchema = new mongoose.Schema(
  {
    hospitalId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
    },
    bloodBankSettings: {
      criticalThreshold: {
        type: mongoose.Schema.Types.Mixed,
        default: {},
      },
      lowThreshold: {
        type: mongoose.Schema.Types.Mixed,
        default: {},
      },
      automaticNotifications: {
        type: Boolean,
        default: true,
      },
      notificationEmail: {
        type: String,
        default: null,
      },
    },
    notificationPreferences: {
      email: { type: Boolean, default: true },
      push: { type: Boolean, default: true },
      sms: { type: Boolean, default: false },
    },
  },
  { timestamps: true }
);

const HospitalSettings = mongoose.model('HospitalSettings', hospitalSettingsSchema);

export default HospitalSettings;
