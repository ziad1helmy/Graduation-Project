import mongoose from 'mongoose';

/**
 * Request Model - Hospital-created requests for blood/organ donations
 * 
 * Fields:
 * - hospitalId: reference to Hospital user, required
 * - type: 'blood' or 'organ', enum, required
 * - bloodType: A+, A-, B+, B-, AB+, AB-, O+, O-, required for blood type
 * - urgency: 'low', 'medium', 'high', 'critical', required
 * - status: 'pending', 'in-progress', 'completed', 'cancelled', default: 'pending'
 * - requiredBy: deadline date, required
 * - quantity: number of units/organs needed, default: 1
 * - organType: specific organ type (kidney, liver, heart, etc) for organ requests
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
      trim: true,
      maxlength: [150, 'Patient type cannot exceed 150 characters'],
    },

    unitsNeeded: {
      type: Number,
      min: [1, 'Units needed must be at least 1'],
      default: 1,
    },

    isEmergency: {
      type: Boolean,
      default: false,
    },
    
    type: {
      type: String,
      enum: {
        values: ['blood', 'plasma', 'platelets', 'organ'],
        message: 'Type must be blood, plasma, platelets, or organ',
      },
      required: [true, 'Request type is required'],
    },
    
    bloodType: {
      type: String,
      enum: {
        values: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'],
        message: 'Blood type must be a valid type',
      },
      validate: {
        validator: function(v) {
          // Blood type is required for blood, plasma, and platelets requests
          if (['blood', 'plasma', 'platelets'].includes(this.type)) {
            return v !== null && v !== undefined;
          }
          return true;
        },
        message: 'Blood type is required for blood, plasma, and platelet donation requests',
      },
    },
    // Cause of the request, e.g. accident, surgery, etc. This will help the donor to understand the urgency of the request and the type of blood/organ needed
    cause: {
      type: String,
      maxlength: [200, 'Cause cannot exceed 200 characters'],
    },
    
    organType: {
      type: String,
      enum: {
        values: ['kidney', 'liver', 'heart', 'lung', 'pancreas', 'cornea'],
        message: 'Organ type must be valid',
      },
      validate: {
        validator: function(v) {
          // Organ type is required only for organ requests
          if (this.type === 'organ') {
            return v !== null && v !== undefined;
          }
          return true;
        },
        message: 'Organ type is required for organ donation requests',
      },
    },
    
    urgency: {
      type: String,
      enum: {
        values: ['low', 'medium', 'high', 'critical'],
        message: 'Urgency must be low, medium, high, or critical',
      },
      required: [true, 'Urgency level is required'],
    },
    
    status: {
      type: String,
      enum: {
        values: ['pending', 'accepted', 'in-progress', 'completed', 'cancelled', 'expired'],
        message: 'Status must be pending, accepted, in-progress, completed, cancelled, or expired',
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
          return v > new Date();
        },
        message: 'Required by date must be in the future',
      },
    },
    
    quantity: {
      type: Number,
      min: [1, 'Quantity must be at least 1'],
      default: 1,
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
    locationHospital: {
      latitude: { type: Number },
      longitude: { type: Number },
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
    hospitalLocation: {
      lat: { type: Number },
      lng: { type: Number },
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
  },
  {
    timestamps: true,
  }
);

// Indexes for efficient queries
requestSchema.index({ status: 1 });
requestSchema.index({ urgency: 1 });
requestSchema.index({ hospitalId: 1, status: 1 });
requestSchema.index({ urgency: 1, status: 1 });
requestSchema.index({ acceptedBy: 1, status: 1 });
requestSchema.index({ hospitalLocationGeo: '2dsphere' });

// Ensure location fields and request quantity fields remain synchronized.
// - `locationHospital` containing `{ latitude, longitude }` is canonical for coordinate storage.
// - `hospitalLocationGeo` containing a GeoJSON `Point` with `[longitude, latitude]` is canonical for geospatial query operations.
// - `hospitalLocation` containing `{ lat, lng }` is maintained for backward compatibility.
// - `unitsNeeded` is canonical internally for quantity tracker, synced with `quantity` for backward compatibility.
requestSchema.pre('validate', function syncRequestFields() {
  try {
    // 1. Synchronize unitsNeeded and quantity
    const hasUnits = this.unitsNeeded !== undefined && this.unitsNeeded !== null;
    const hasQuantity = this.quantity !== undefined && this.quantity !== null;

    if (this.isModified('unitsNeeded') || (hasUnits && !hasQuantity)) {
      this.quantity = this.unitsNeeded;
    } else if (this.isModified('quantity') || (hasQuantity && !hasUnits)) {
      this.unitsNeeded = this.quantity;
    } else if (!hasUnits && !hasQuantity) {
      this.unitsNeeded = 1;
      this.quantity = 1;
    }

    // 2. Synchronize locationHospital, hospitalLocation, hospitalLocationGeo
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

    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      this.locationHospital = { latitude: lat, longitude: lng };
      this.hospitalLocation = { lat, lng };
      this.hospitalLocationGeo = {
        type: 'Point',
        coordinates: [lng, lat],
      };
    }
  } catch (e) {
    // Ignore and let Mongoose handle validation errors
  }
});

// Update hooks to sync location and quantity/unitsNeeded updates automatically
function syncRequestUpdate() {
  const update = this.getUpdate();
  if (!update) return;

  // Enforce same $inc operation on both fields
  if (update.$inc) {
    if (update.$inc.unitsNeeded !== undefined && update.$inc.quantity === undefined) {
      update.$inc.quantity = update.$inc.unitsNeeded;
    } else if (update.$inc.quantity !== undefined && update.$inc.unitsNeeded === undefined) {
      update.$inc.unitsNeeded = update.$inc.quantity;
    }
  }

  // Helper to extract lat/lng from any location update keys
  const extractLocationUpdate = (obj) => {
    let lat = null;
    let lng = null;

    if (obj.locationHospital && Number.isFinite(obj.locationHospital.latitude) && Number.isFinite(obj.locationHospital.longitude)) {
      lat = obj.locationHospital.latitude;
      lng = obj.locationHospital.longitude;
    } else if (obj.hospitalLocation && Number.isFinite(obj.hospitalLocation.lat) && Number.isFinite(obj.hospitalLocation.lng)) {
      lat = obj.hospitalLocation.lat;
      lng = obj.hospitalLocation.lng;
    } else if (obj.hospitalLocationGeo && obj.hospitalLocationGeo.coordinates && Array.isArray(obj.hospitalLocationGeo.coordinates) && obj.hospitalLocationGeo.coordinates.length === 2) {
      lng = obj.hospitalLocationGeo.coordinates[0];
      lat = obj.hospitalLocationGeo.coordinates[1];
    } else {
      // Check if flattened keys are used
      if (obj['locationHospital.latitude'] !== undefined || obj['locationHospital.longitude'] !== undefined) {
        lat = obj['locationHospital.latitude'];
        lng = obj['locationHospital.longitude'];
      } else if (obj['hospitalLocation.lat'] !== undefined || obj['hospitalLocation.lng'] !== undefined) {
        lat = obj['hospitalLocation.lat'];
        lng = obj['hospitalLocation.lng'];
      }
    }
    return { lat, lng };
  };

  // Sync locations on direct update keys
  const directLoc = extractLocationUpdate(update);
  if (Number.isFinite(directLoc.lat) && Number.isFinite(directLoc.lng)) {
    update.locationHospital = { latitude: directLoc.lat, longitude: directLoc.lng };
    update.hospitalLocation = { lat: directLoc.lat, lng: directLoc.lng };
    update.hospitalLocationGeo = {
      type: 'Point',
      coordinates: [directLoc.lng, directLoc.lat],
    };
  }

  // Sync locations on $set update keys
  if (update.$set) {
    const setLoc = extractLocationUpdate(update.$set);
    if (Number.isFinite(setLoc.lat) && Number.isFinite(setLoc.lng)) {
      update.$set.locationHospital = { latitude: setLoc.lat, longitude: setLoc.lng };
      update.$set.hospitalLocation = { lat: setLoc.lat, lng: setLoc.lng };
      update.$set.hospitalLocationGeo = {
        type: 'Point',
        coordinates: [setLoc.lng, setLoc.lat],
      };
    }
  }

  // Sync quantity and unitsNeeded on direct update keys
  if (update.unitsNeeded !== undefined || update.quantity !== undefined) {
    const val = update.unitsNeeded ?? update.quantity;
    if (val !== undefined) {
      update.unitsNeeded = val;
      update.quantity = val;
    }
  }

  // Sync quantity and unitsNeeded on $set update keys
  if (update.$set) {
    if (update.$set.unitsNeeded !== undefined || update.$set.quantity !== undefined) {
      const val = update.$set.unitsNeeded ?? update.$set.quantity;
      if (val !== undefined) {
        update.$set.unitsNeeded = val;
        update.$set.quantity = val;
      }
    }
  }
}

requestSchema.pre('update', syncRequestUpdate);
requestSchema.pre('updateOne', syncRequestUpdate);
requestSchema.pre('updateMany', syncRequestUpdate);
requestSchema.pre('findOneAndUpdate', syncRequestUpdate);

const Request = mongoose.model('Request', requestSchema);

export default Request;
