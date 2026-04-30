import mongoose from "mongoose";
import User from './User.model.js';

const donorSchema = new mongoose.Schema({
    phoneNumber: {
        type: String,
        required: [true, 'Phone number is required'],
        validate: {
            validator: function(v) {
                return /^[0-9]{10}$/.test(v);
            },
            message: 'Phone number must be 10 digits long',
        },
    },

    bloodType:{
        type: String,
        enum:['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'],
        default: null
    },

    gender: {
        type: String,
        enum: {
            values: ['male', 'female', 'not specified'],
            message: 'Gender must be male or female',
        },
        default: 'not specified',
        required: [true, 'Gender is required'],
        // This will be in the validation later
        validate: {
            validator: function(v) {
                return v === 'male' || v === 'female' || v === 'not specified';
            },
            message: 'Gender must be male or female',
        },
    },

    lastDonationDate: Date,

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


    // Location is inherited from the base User model
    // (city, governorate, coordinates, lastUpdated)


    dateOfBirth: {
        type: Date,
        required: [true, 'Date of birth is required'],
        // This will be in the validation later
        validate: {
            validator: function(v) {
                return v instanceof Date && v <= new Date();
            },
        },
        message: 'Date of birth must be in the past',
    },
})

const Donor = User.discriminator('donor', donorSchema);

export default Donor;