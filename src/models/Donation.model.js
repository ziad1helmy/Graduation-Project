import mongoose from 'mongoose';

/**
 * Donation Model - Track donation lifecycle from matching to completion
 * 
 * Fields:
 * - donorId: reference to Donor user, required
 * - requestId: reference to Request, required
 * - status: 'pending', 'scheduled', 'completed', 'cancelled', default: 'pending'
 * - quantity: amount being donated (units for blood, 1 for organ)
 * - scheduledDate: when donation is scheduled
 * - completedDate: when donation was actually completed
 * - notes: donation notes (blood pressure, any complications, etc)
 * - createdAt: timestamp, auto
 * - updatedAt: timestamp, auto
 */

const donationSchema = new mongoose.Schema(
  {
    donorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Donor ID is required'],
    },
    
    requestId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Request',
      required: [true, 'Request ID is required'],
    },
    
    status: {
      type: String,
      enum: {
        values: ['pending', 'scheduled', 'completed', 'cancelled'],
        message: 'Status must be pending, scheduled, completed, or cancelled',
      },
      default: 'pending',
    },
    
    quantity: {
      type: Number,
      required: [true, 'Quantity is required'],
      min: [1, 'Quantity must be at least 1'],
    },
    
    scheduledDate: {
      type: Date,
      validate: {
        validator: function(v) {
          if (!v) return true; // optional field
          return v > new Date();
        },
        message: 'Scheduled date must be in the future',
      },
    },
    
    completedDate: {
      type: Date,
      validate: {
        validator: function(v) {
          if (!v) return true; // optional field
          return v <= new Date();
        },
        message: 'Completed date must be in the past',
      },
    },
    
    notes: {
      type: String,
      maxlength: [1000, 'Notes cannot exceed 1000 characters'],
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for efficient queries
donationSchema.index({ donorId: 1 });
donationSchema.index({ requestId: 1 });
donationSchema.index({ status: 1 });
donationSchema.index({ donorId: 1, status: 1 });
donationSchema.index({ requestId: 1, status: 1 });

const Donation = mongoose.model('Donation', donationSchema);

export default Donation;
