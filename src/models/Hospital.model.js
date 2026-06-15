import mongoose from 'mongoose';
import User from './User.model.js';
import { normalizeArabic } from '../utils/textNormalization.js';

const hospitalSchema = new mongoose.Schema({
    type: {
        type: String,
        trim: true,
        default: 'hospital',
    },
    hospitalType: {
        type: String,
        default: 'General Hospital',
        trim: true,
    },
    workingHours: {
        type: String,
        default: '9AM - 5PM',
        trim: true,
    },
    phone: {
        type: String,
        trim: true,
        default: null,
    },
    address: {
        type: mongoose.Schema.Types.Mixed,
        default: null,
    },
    city: {
        type: String,
        trim: true,
        default: null,
    },
    state: {
        type: String,
        trim: true,
        default: null,
    },
    zipCode: {
        type: String,
        trim: true,
        default: null,
    },

    hospitalId: {
        type: String,
        required: [true, 'Hospital ID is required'],
        unique: true,
        trim: true,
        index: true,
    },
    licenseNumber: {
        type: String,
        trim: true,
        default: null,
    },
    adminContactName: {
        type: String,
        trim: true,
        default: null,
    },
    adminContactPhone: {
        type: String,
        trim: true,
        default: null,
    },
    emergencyContact: {
        type: String,
        trim: true,
        default: null,
    },
    bloodBanksAvailable: {
        type: [String],
        enum: ['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-'],
        default: [],
    },
    // Deprecated — kept for backward compatibility with existing documents
    name: { type: String, trim: true },
    // Deprecated — kept for backward compatibility with existing documents
    contactNumber: { type: String, trim: true, default: null },

    capacity: {
        type: Number,
        default: null,
        min: 0,
    },
    lat: {
        type: Number,
        default: null,
        min: -90,
        max: 90,
    },
    long: {
        type: Number,
        default: null,
        min: -180,
        max: 180,
    },
    hospitalName: {
        type: String,
        trim: true,
    },
    hospitalNameNormalized: {
        type: String,
        lowercase: true,
        trim: true,
        index: true,
    },

    // Dev 2 Task 7: Appointment slot configuration
    slotsPerHour: {
        type: Number,
        default: 5,
        min: [1, 'Must have at least 1 slot per hour'],
    },
    workingHoursStart: {
        type: Number,
        default: 9,
        min: [0, 'Working hours start must be between 0-23'],
        max: [23, 'Working hours start must be between 0-23'],
    },
    workingHoursEnd: {
        type: Number,
        default: 17,
        min: [0, 'Working hours end must be between 0-23'],
        max: [23, 'Working hours end must be between 0-23'],
    },
});

// Indexes for efficient queries
hospitalSchema.index({ hospitalName: 1 });

// Sync display names and normalize before saving
hospitalSchema.pre('save', function () {
    if (!this.type) {
        this.type = 'hospital';
    }

    if (this.isModified('fullName') && !this.isModified('hospitalName')) {
        this.hospitalName = this.fullName;
    } else if (this.isModified('hospitalName') && !this.isModified('fullName')) {
        this.fullName = this.hospitalName;
    } else if (!this.hospitalName && this.fullName) {
        this.hospitalName = this.fullName;
    } else if (!this.fullName && this.hospitalName) {
        this.fullName = this.hospitalName;
    }

    const displayName = this.hospitalName || this.fullName;
    if (displayName) {
        this.hospitalNameNormalized = normalizeArabic(displayName);
    }
});

// Enforce strict mode: reject fields not in schema
hospitalSchema.set('strict', 'throw');

const Hospital = User.discriminator('hospital', hospitalSchema);

export default Hospital;