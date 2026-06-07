import mongoose from 'mongoose';

/**
 * Donation Model - Track donation lifecycle from matching to completion
 * 
 * Fields:
 * - donorId: reference to Donor user, required
 * - requestId: reference to Request, required
 * - status: 'pending', 'scheduled', 'completed', 'cancelled', default: 'pending'
 * - quantity: amount being donated (units for blood and component donations)
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

    appointmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Appointment',
      default: null,
      // Note: index defined below via donationSchema.index() with partialFilterExpression
    },
    
    requestId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Request',
      default: null,
    },
    
    status: {
      type: String,
      enum: {
        values: ['pending', 'scheduled', 'completed', 'cancelled', 'rejected'],
        message: 'Status must be pending, scheduled, completed, cancelled, or rejected',
      },
      default: 'pending',
    },
    
    quantity: {
      type: Number,
      required: [true, 'Quantity is required'],
      min: [1, 'Quantity must be at least 1'],
    },

    unitsCollected: {
      type: Number,
      default: null,
      min: [1, 'Units collected must be at least 1'],
    },

    hemoglobinLevel: {
      type: Number,
      default: null,
      min: [0, 'Hemoglobin level must be a positive number'],
    },

    weight: {
      type: Number,
      default: null,
      min: [0, 'Weight must be a positive number'],
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
    verifiedAt: {
      type: Date,
      default: null,
    },
    // Optional QR token issued by hospital for on-site confirmation
    qrToken: {
      type: String,
      default: null,
      index: true,
    },
    qrExpires: {
      type: Date,
      default: null,
    },
    
    // INTEGRITY: Track appointment scheduling deadline
    // Donation must have appointment scheduled within APPOINTMENT_SCHEDULING_DEADLINE_DAYS
    // If deadline passes without appointment, donation auto-cancels via background job
    appointmentScheduleDeadline: {
      type: Date,
      required: true,
      index: true,
      // Set to 14 days from now (can be customized per request urgency)
      default: () => new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
    },

    // Track if donation was auto-cancelled due to missing appointment
    autoCompiledAt: {
      type: Date,
      default: null,
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
donationSchema.index(
  { appointmentId: 1 },
  {
    unique: true,
    partialFilterExpression: { appointmentId: { $type: 'objectId' } },
  }
);

// CRITICAL: Prevent duplicate donations from same donor for same request
// Allows only ONE active (non-cancelled, non-rejected) donation per donor per request
donationSchema.index(
  { donorId: 1, requestId: 1 },
  {
    unique: true,
    partialFilterExpression: {
      status: { $nin: ['cancelled', 'rejected'] },
    },
  }
);

/**
 * INTEGRITY HOOK - Enforce appointment scheduling deadline
 * 
 * Validates that donations transitioning to 'scheduled' status have an appointment.
 * Pending donations must have an appointment scheduled before appointmentScheduleDeadline.
 */
donationSchema.pre('save', async function() {
  // If status is changing to 'scheduled', must have appointmentId
  if (this.isModified('status') && this.status === 'scheduled' && !this.appointmentId) {
    throw new Error('Appointment required to schedule donation');
  }

  // Check if donation is pending and past the deadline
  if (
    this.status === 'pending' &&
    this.appointmentScheduleDeadline &&
    new Date() > this.appointmentScheduleDeadline &&
    !this.appointmentId
  ) {
    throw new Error('Appointment scheduling deadline passed - please reschedule');
  }
});

/**
 * INTEGRITY HOOK - Auto-cancel donations past scheduling deadline
 * 
 * Background job trigger: Find donations past appointmentScheduleDeadline
 * and auto-cancel them if they lack an appointment.
 * 
 * Usage: Run periodically via background worker:
 *   await Donation.updateMany(
 *     {
 *       status: 'pending',
 *       appointmentId: null,
 *       appointmentScheduleDeadline: { $lt: new Date() }
 *     },
 *     {
 *       $set: { 
 *         status: 'cancelled',
 *         autoCompiledAt: new Date(),
 *         notes: 'Auto-cancelled: Appointment not scheduled within deadline'
 *       }
 *     }
 *   );
 */

const Donation = mongoose.model('Donation', donationSchema);

export default Donation;
