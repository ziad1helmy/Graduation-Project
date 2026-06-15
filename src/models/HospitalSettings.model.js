import mongoose from 'mongoose';
import { DEFAULT_SUPPORTED_DONATION_TYPES } from '../constants/donation.constants.js';

const APPOINTMENT_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const DEFAULT_APPOINTMENT_OPENING_TIME = '08:00';
const DEFAULT_APPOINTMENT_CLOSING_TIME = '19:00';
const DEFAULT_APPOINTMENT_WORKING_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DEFAULT_APPOINTMENT_DAILY_CAPACITY = 44;

const buildDefaultHourlySlots = () => {
  const hourlySlots = {};

  for (let hour = 8; hour < 19; hour += 1) {
    const label = `${String(hour).padStart(2, '0')}:00`;
    hourlySlots[label] = 4;
  }

  return hourlySlots;
};

const appointmentSettingsSchema = new mongoose.Schema(
  {
    openingTime: {
      type: String,
      default: DEFAULT_APPOINTMENT_OPENING_TIME,
    },
    closingTime: {
      type: String,
      default: DEFAULT_APPOINTMENT_CLOSING_TIME,
    },
    workingDays: {
      type: [String],
      enum: APPOINTMENT_DAYS,
      default: DEFAULT_APPOINTMENT_WORKING_DAYS,
    },
    defaultSlotsPerHour: {
      type: Number,
      default: 4,
      min: 1,
    },
    hourlySlots: {
      type: Map,
      of: Number,
      default: () => buildDefaultHourlySlots(),
    },
    totalDailyCapacity: {
      type: Number,
      default: DEFAULT_APPOINTMENT_DAILY_CAPACITY,
      min: 0,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    supportedDonationTypes: {
      type: [String],
      enum: DEFAULT_SUPPORTED_DONATION_TYPES,
      default: [...DEFAULT_SUPPORTED_DONATION_TYPES],
    },
    minAdvanceHours: {
      type: Number,
      default: 24,
      min: 0,
    },
    maxAdvanceDays: {
      type: Number,
      default: 30,
      min: 0,
    },
    preparationTips: {
      type: [String],
      default: [
        'Eat a healthy meal before donation',
        'Drink plenty of water',
        'Bring a valid ID',
        "Get a good night's sleep",
      ],
    },
    rescheduleAllowed: {
      type: Boolean,
      default: true,
    },
    maxReschedules: {
      type: Number,
      default: 3,
      min: 0,
    },
    cancellationAllowedHours: {
      type: Number,
      default: 12,
      min: 0,
    },
  },
  { _id: false }
);

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
      pushNotifications: { type: Boolean, default: true },
      emergencyAlerts: { type: Boolean, default: true },
      emailNotifications: { type: Boolean, default: true },
      smsAlerts: { type: Boolean, default: false },
    },
    appointmentSettings: {
      type: appointmentSettingsSchema,
      default: () => ({
        openingTime: DEFAULT_APPOINTMENT_OPENING_TIME,
        closingTime: DEFAULT_APPOINTMENT_CLOSING_TIME,
        workingDays: [...DEFAULT_APPOINTMENT_WORKING_DAYS],
        defaultSlotsPerHour: 4,
        hourlySlots: buildDefaultHourlySlots(),
        totalDailyCapacity: DEFAULT_APPOINTMENT_DAILY_CAPACITY,
        isActive: true,
        supportedDonationTypes: [...DEFAULT_SUPPORTED_DONATION_TYPES],
        minAdvanceHours: 24,
        maxAdvanceDays: 30,
        preparationTips: [
          'Eat a healthy meal before donation',
          'Drink plenty of water',
          'Bring a valid ID',
          "Get a good night's sleep",
        ],
        rescheduleAllowed: true,
        maxReschedules: 3,
        cancellationAllowedHours: 12,
      }),
    },
  },
  { timestamps: true, strict: 'throw' }
);

const HospitalSettings = mongoose.model('HospitalSettings', hospitalSettingsSchema);

export default HospitalSettings;
