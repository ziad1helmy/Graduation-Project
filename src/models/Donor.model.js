import mongoose from "mongoose";
import User from './User.model.js';
import ELIGIBILITY_KEYS from '../utils/eligibility-keys.js';

const donorSchema = new mongoose.Schema({
    phoneNumber: {
        type: String,
        required: [true, 'Phone number is required'],
        validate: {
            validator: function(v) {
                return /^[0-9]{11}$/.test(v);
            },
            message: 'Phone number must be 11 digits long',
        },
    },

    bloodType:{
        type: String,
        enum:['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'],
        required: [true, 'Blood type is required'],
    },

    dateOfBirth: {
        type: Date,
        required: [true, ELIGIBILITY_KEYS.DATE_OF_BIRTH_REQUIRED],
        validate: {
            validator: function(v) {
                try {
                    return v instanceof Date && v <= new Date();
                } catch (error) {
                    return false;
                }
            },
            message: ELIGIBILITY_KEYS.INVALID_DATE_OF_BIRTH,
        },
    },

    gender: {
        type: String,
        enum: {
            values: ['male', 'female'],
            message: 'Gender must be male or female',
        },
        required: false,
    },

    lastDonationDate: Date,

    weight: {
        type: Number,
            default: null,
            min: [0, 'Weight must be a positive number'],
    },

    hemoglobinLevel: {
        type: Number,
        min: [0, 'Hemoglobin level must be a positive number'],
        default: null,
    },

    travelHistory: {
        type: [
            {
                country: {
                    type: String,
                    trim: true,
                    required: true,
                },
                returnDate: {
                    type: Date,
                    required: true,
                },
            },
        ],
        default: [],
    },

    temporaryDeferralUntil: {
        type: Date,
        default: null,
    },

    lastDeferralReason: {
        type: String,
        default: null,
    },

    healthHistory: {
        chronicConditions: {
            type: [String],
            default: [],
        },
        medications: {
            type: [String],
            default: [],
        },
        allergies: {
            type: [String],
            default: [],
        },
        recentIllness: {
            type: String,
            default: '',
        },
        notes: {
            type: String,
            default: '',
            maxlength: [1000, 'Health history notes cannot exceed 1000 characters'],
        },
        lastCheckupDate: {
            type: Date,
            default: null,
        },
        updatedAt: {
            type: Date,
            default: null,
        },
    },

    // Participation preference: donor opts in/out of receiving donation requests.
    // Medical eligibility is NOT stored here — it is computed dynamically by
    // the eligibility service from dates, health fields, and deferral state.
    isOptedIn: {
        type: Boolean,
        default: true,
    },

    // Tracks missed donations (no-show) for auto-suspension after 3 strikes.
    missedDonationCount: {
        type: Number,
        default: 0,
        min: 0,
    },
    missedDonationDates: {
        type: [Date],
        default: [],
    },

    settings: {
        pushNotifications: {
            type: Boolean,
            default: true,
        },
        emergencyAlerts: {
            type: Boolean,
            default: true,
        },
        privacyMode: {
            type: Boolean,
            default: false,
        },
        language: {
            type: String,
            enum: ['en', 'ar'],
            default: 'en',
        },
    },

    
    // Derived status is exposed through virtuals.
    // Base User model already stores `isSuspended` for ban status.

    // Location is inherited from the base User model
    // (city, governorate, coordinates, lastUpdated)
})

donorSchema.virtual('isBanned').get(function () {
    return Boolean(this.isSuspended);
});

// derived virtual fields if any

// Indexes for efficient queries
donorSchema.index({ phoneNumber: 1 });
donorSchema.index({ bloodType: 1 });
donorSchema.index({ lastDonationDate: 1 });

donorSchema.set('toJSON', { virtuals: true });
donorSchema.set('toObject', { virtuals: true });
// Enforce strict mode: reject fields not in schema
donorSchema.set('strict', 'throw');

const Donor = User.discriminator('donor', donorSchema);

export default Donor;