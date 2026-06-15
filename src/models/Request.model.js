import mongoose from 'mongoose';
import {
  BLOOD_TYPE_VALUES,
  normalizeBloodTypeList,
} from '../utils/blood-type.js';
import {
  PATIENT_TYPE_ENUM,
  REQUEST_URGENCY_ENUM,
  REQUEST_TYPE_ENUM,
  REQUEST_STATUS_ENUM,
} from '../constants/request.constants.js';

/**
 * Request Model - Hospital-created requests for blood donations
 * 
 * Fields:
 * - hospitalId: reference to Hospital user, required
 * - type: 'blood', 'plasma', or 'platelets', enum, required
 * - bloodType: A+, A-, B+, B-, AB+, AB-, O+, O-, required for blood type
 * - urgency: 'low', 'medium', 'high', 'critical', required
 * - status: 'pending', 'in-progress', 'completed', 'cancelled', default: 'pending'
 * - requiredBy: deadline date, required
 * - quantity: number of units needed, default: 1
 * - notes: additional notes/requirements
 * - createdAt: timestamp, auto
 * - updatedAt: timestamp, auto
 */

const requestSchema = new mongoose.Schema(
  {
    hospitalId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Hospital ID is required'],
    },

    patientType: {
      type: String,
      enum: {
        values: PATIENT_TYPE_ENUM,
        message: `Patient type must be one of: ${PATIENT_TYPE_ENUM.join(', ')}`,
      },
      default: 'general',
    },

    unitsNeeded: {
      type: Number,
      min: [1, 'Units needed must be at least 1'],
      default: 1,
    },

    // Deprecated — kept for backward compatibility with existing documents
    quantity: { type: Number, min: 1, default: 1 },
    // Deprecated — kept for backward compatibility with existing documents
    cause: { type: String },
    // Deprecated — kept for backward compatibility with existing documents
    locationHospital: {
      latitude: { type: Number },
      longitude: { type: Number },
    },
    // Deprecated — kept for backward compatibility with existing documents
    hospitalLocation: {
      lat: { type: Number },
      lng: { type: Number },
    },

    isEmergency: {
      type: Boolean,
      default: false,
    },
    
    type: {
      type: String,
      enum: {
        values: REQUEST_TYPE_ENUM,
        message: `Type must be one of: ${REQUEST_TYPE_ENUM.join(', ')}`,
      },
      required: [true, 'Request type is required'],
    },
    
    bloodType: {
      type: [String],
      set: normalizeBloodTypeList,
      get: normalizeBloodTypeList,
      validate: {
        validator: function(v) {
          if (!['blood', 'plasma', 'platelets', 'double_red_cells'].includes(this.type)) {
            return true;
          }

          const normalized = normalizeBloodTypeList(v);
          if (normalized.length === 0) {
            return false;
          }

          return normalized.every((bloodType) => BLOOD_TYPE_VALUES.includes(bloodType));
        },
        message: 'Blood type is required for blood, plasma, and platelet donation requests and must contain at least one valid blood type',
      },
    },
    urgency: {
      type: String,
      enum: {
        values: REQUEST_URGENCY_ENUM,
        message: `Urgency must be one of: ${REQUEST_URGENCY_ENUM.join(', ')}`,
      },
      required: [true, 'Urgency level is required'],
    },
    
    status: {
      type: String,
      enum: {
        values: REQUEST_STATUS_ENUM,
        message: `Status must be one of: ${REQUEST_STATUS_ENUM.join(', ')}`,
      },
      default: 'pending',
    },

    contactNumber: {
      type: String,
      trim: true,
      validate: {
        validator: function(v) {
          return !v || /^\+?[0-9]{10,15}$/.test(v);
        },
        message: 'Contact number must be a valid phone number',
      },
    },
    
    requiredBy: {
      type: Date,
      required: [true, 'Required by date is required'],
      validate: {
        validator: function(v) {
          if (!v) return false;
          // Only enforce future date on creation; after creation, the deadline
          // naturally passes and updates to status etc. must not be blocked.
          if (!this.isNew) return true;
          return v > new Date();
        },
        message: 'Required by date must be in the future',
      },
    },
    
    notes: {
      type: String,
      maxlength: [500, 'Notes cannot exceed 500 characters'],
    },
    // Add number of the hospital in the request to make it easier for the donor to contact the hospital
    hospitalContact: {
      type: String,
      required: [true, 'Hospital contact number is required'],
      validate: {
        validator: function(v) {
          return /^\d{10,11}$/.test(v);
        },
        message: 'Hospital contact number must be 10-11 digits long',
      },
    },
    hospitalLocationGeo: {
      type: {
        type: String,
        enum: ['Point'],
      },
      coordinates: {
        type: [Number],
        default: undefined,
      },
    },
    hospitalName: {
      type: String,
    },
    qrToken: {
      type: String,
      unique: true,
      sparse: true,
      index: true,
    },
    qrCreatedAt: {
      type: Date,
      default: null,
    },
    qrExpiresAt: {
      type: Date,
      default: null,
    },
    acceptedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    acceptedByName: {
      type: String,
      default: null,
    },
    acceptedByPhoneNumber: {
      type: String,
      default: null,
    },
    acceptedByBloodType: {
      type: String,
      default: null,
    },
    acceptedAt: {
      type: Date,
      default: null,
    },
    cancelledAt: {
      type: Date,
      default: null,
    },
    completedAt: {
      type: Date,
      default: null,
    },
    acceptedDonationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Donation',
      default: null,
    },
    // Fix #7 (MEDIUM): Tracks the last time an admin broadcast this request.
    // Used to enforce a cooldown period between repeat broadcasts.
    // Sparse field — not present on older documents until first broadcast.
    lastBroadcastAt: {
      type: Date,
      default: null,
    },
    escalationLevel: {
      type: Number,
      default: 1,
    },
    acceptanceDeadline: {
      type: Date,
      default: null,
    },
    arrivalDeadline: {
      type: Date,
      default: null,
    },
    manualInterventionFlag: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
    strict: 'throw',
  }
);

// Indexes for efficient queries
requestSchema.index({ hospitalId: 1, status: 1 });
requestSchema.index({ urgency: 1, status: 1 });
requestSchema.index({ acceptedBy: 1, status: 1 });
requestSchema.index({ hospitalLocationGeo: '2dsphere' });
requestSchema.index({ arrivalDeadline: 1 });
requestSchema.index({ createdAt: 1 });

requestSchema.pre('init', function normalizeHydratedRequest(doc) {
  if (doc && doc.bloodType !== undefined) {
    doc.bloodType = normalizeBloodTypeList(doc.bloodType);
  }
});

// Sync deprecated fields with canonical ones for backward compatibility.
requestSchema.pre('validate', function syncRequestFields() {
  try {
    if (this.bloodType !== undefined && this.bloodType !== null) {
      this.bloodType = normalizeBloodTypeList(this.bloodType);
    }

    // Sync deprecated quantity → unitsNeeded (only when quantity was explicitly set)
    if (this.isModified('quantity') && !this.isModified('unitsNeeded')) {
      this.unitsNeeded = this.quantity;
    } else if (this.unitsNeeded === undefined || this.unitsNeeded === null) {
      this.unitsNeeded = this.quantity || 1;
    }

    // Sync deprecated location fields → hospitalLocationGeo
    let lat = null;
    let lng = null;
    if (this.locationHospital && Number.isFinite(this.locationHospital.latitude) && Number.isFinite(this.locationHospital.longitude)) {
      lat = this.locationHospital.latitude;
      lng = this.locationHospital.longitude;
    } else if (this.hospitalLocation && Number.isFinite(this.hospitalLocation.lat) && Number.isFinite(this.hospitalLocation.lng)) {
      lat = this.hospitalLocation.lat;
      lng = this.hospitalLocation.lng;
    } else if (this.hospitalLocationGeo && this.hospitalLocationGeo.coordinates && Array.isArray(this.hospitalLocationGeo.coordinates) && this.hospitalLocationGeo.coordinates.length === 2) {
      lng = this.hospitalLocationGeo.coordinates[0];
      lat = this.hospitalLocationGeo.coordinates[1];
    }
    if (Number.isFinite(lat) && Number.isFinite(lng) && !this.hospitalLocationGeo) {
      this.hospitalLocationGeo = { type: 'Point', coordinates: [lng, lat] };
    }
  } catch (e) {
    // Ignore and let Mongoose handle validation errors
  }
});

// Sync deprecated fields on update operations for backward compatibility
function syncRequestUpdate() {
  const update = this.getUpdate();
  if (!update) return;

  // Sync bloodType normalization
  if (update.bloodType !== undefined) {
    update.bloodType = normalizeBloodTypeList(update.bloodType);
  }
  if (update.$set?.bloodType !== undefined) {
    update.$set.bloodType = normalizeBloodTypeList(update.$set.bloodType);
  }

  // Sync deprecated quantity → unitsNeeded on $inc (e.g. reduce inventory)
  if (update.$inc?.quantity && !update.$inc?.unitsNeeded) {
    update.$inc.unitsNeeded = update.$inc.quantity;
  }
}

requestSchema.pre('update', syncRequestUpdate);
requestSchema.pre('updateOne', syncRequestUpdate);
requestSchema.pre('updateMany', syncRequestUpdate);
requestSchema.pre('findOneAndUpdate', syncRequestUpdate);

// Cache invalidation hook for analytics dashboard
import { invalidateAnalyticsCache } from '../utils/analytics-cache.js';

requestSchema.post('save', invalidateAnalyticsCache);
requestSchema.post('findOneAndUpdate', invalidateAnalyticsCache);
requestSchema.post('updateOne', invalidateAnalyticsCache);
requestSchema.post('updateMany', invalidateAnalyticsCache);

const Request = mongoose.model('Request', requestSchema);

export default Request;
