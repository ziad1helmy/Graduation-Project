import mongoose from 'mongoose';
import User from './User.model.js';
import { normalizeArabic } from '../utils/textNormalization.js';

const hospitalSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Hospital name is required'],
        trim: true,
        minlength: [3, 'Hospital name must be at least 3 characters long'],
        maxlength: [200, 'Hospital name must be less than 200 characters long'],
    },
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
    licenseNumber: {
        type: String,
        required: [true, 'License number is required'],
        unique: true,
        trim: true,
        minlength: [5, 'License number must be at least 5 characters long'],
        maxlength: [50, 'License number must be less than 50 characters long'],
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
    // New GeoJSON location field for geospatial queries (longitude, latitude)
    location: {
        type: {
            type: String,
            enum: ['Point'],
            default: 'Point',
        },
        coordinates: {
            type: [Number], // [longitude, latitude]
            default: undefined,
        },
    },

    // Backward-compatible legacy fields still used by older controllers and selectors.
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
    contactNumber: {
        type: String,
        trim: true,
        default: null,
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
// 2dsphere index for geospatial queries. sparse to preserve old docs without location.
hospitalSchema.index({ location: '2dsphere' }, { sparse: true });

// Normalize legacy and new hospital display names before saving
hospitalSchema.pre('save', function () {
    if (!this.type) {
        this.type = 'hospital';
    }

    if (this.isModified('name') && !this.isModified('hospitalName')) {
        this.hospitalName = this.name;
    }
    if (this.isModified('hospitalName') && !this.isModified('name')) {
        this.name = this.hospitalName;
    }

    if (this.isModified('phone') && !this.isModified('contactNumber')) {
        this.contactNumber = this.phone;
    }
    if (this.isModified('contactNumber') && !this.isModified('phone')) {
        this.phone = this.contactNumber;
    }

    if (!this.phone && this.contactNumber) {
        this.phone = this.contactNumber;
    }
    if (!this.contactNumber && this.phone) {
        this.contactNumber = this.phone;
    }

    const normalizedName = this.name || this.hospitalName;
    if (normalizedName) {
        this.hospitalNameNormalized = normalizeArabic(normalizedName);
    }

    // If lat/long provided and location not set, populate GeoJSON location for compatibility
    try {
        if ((this.isModified('lat') || this.isModified('long')) && (this.lat !== null && this.long !== null)) {
            this.location = {
                type: 'Point',
                coordinates: [this.long, this.lat],
            };
        } else if (!this.location || !Array.isArray(this.location.coordinates) || this.location.coordinates.length !== 2) {
            // If location not set but lat/long exist, map them
            if (this.lat !== null && this.long !== null) {
                this.location = { type: 'Point', coordinates: [this.long, this.lat] };
            }
        }
    } catch (e) {
        // Do not fail save on mapping errors; keep legacy lat/long
    }
});

// Enforce strict mode: reject fields not in schema
hospitalSchema.set('strict', 'throw');

const Hospital = User.discriminator('hospital', hospitalSchema);

export default Hospital;