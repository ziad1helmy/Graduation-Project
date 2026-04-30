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
    
    type: {
      type: String,
      enum: {
        values: ['blood', 'organ'],
        message: 'Type must be either blood or organ',
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
          // Blood type is required only for blood type requests
          if (this.type === 'blood') {
            return v !== null && v !== undefined;
          }
          return true;
        },
        message: 'Blood type is required for blood donation requests',
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
        values: ['pending', 'in-progress', 'completed', 'cancelled'],
        message: 'Status must be pending, in-progress, completed, or cancelled',
      },
      default: 'pending',
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
      required: [true, 'Quantity is required'],
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
          return /^\d{10}$/.test(v);
        },
        message: 'Hospital contact number must be 10 digits long',
      },
    },
    hospitalLocation: {
      lat: { type: Number },
      lng: { type: Number },
    },
    hospitalName: {
      type: String,
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

const Request = mongoose.model('Request', requestSchema);

export default Request;
