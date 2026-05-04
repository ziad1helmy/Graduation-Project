import mongoose from "mongoose";
import User from './User.model.js';

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
        required: [true, 'Date of birth is required'],
        validate: {
            validator: function(v) {
                return v instanceof Date && v <= new Date();
            },
            message: 'Date of birth must be in the past',
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

    isAvailable: {
        type: Boolean,
        default: true,
    },

    
    // Derived status is exposed through virtuals.
    // Base User model already stores `isSuspended` for ban status.

    // Location is inherited from the base User model
    // (city, governorate, coordinates, lastUpdated)
})

donorSchema.virtual('isBanned').get(function () {
    return Boolean(this.isSuspended);
});

donorSchema.virtual('availableToDonate').get(function () {
    return Boolean(this.isAvailable) && !this.isSuspended;
});

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