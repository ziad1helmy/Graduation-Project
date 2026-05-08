import mongoose from 'mongoose';

const appointmentSchema = new mongoose.Schema(
  {
    donorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Donor ID is required'],
    },

    hospitalId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Hospital ID is required'],
    },

    requestId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Request',
      default: null,
    },

    appointmentDate: {
      type: Date,
      required: [true, 'Appointment date is required'],
      validate: {
        validator: function (v) {
          if (!v) return false;
          return v > new Date();
        },
        message: 'Appointment date must be in the future',
      },
    },

    status: {
      type: String,
      enum: ['pending', 'confirmed', 'completed', 'cancelled'],
      default: 'pending',
    },

    notes: {
      type: String,
      maxlength: [500, 'Notes cannot exceed 500 characters'],
    },

    cancelledAt: {
      type: Date,
      default: null,
    },

    // Dev 1: QR Token for donation scanning
    qrToken: {
      type: String,
      unique: true,
      sparse: true,
      index: true,
    },

    qrScannedAt: {
      type: Date,
      default: null,
    },

    qrExpiresAt: {
      type: Date,
      default: null,
    },

    // Dev 1: Donation type selection
    donationType: {
      type: String,
      enum: ['Whole Blood', 'Platelets', 'Plasma'],
      default: 'Whole Blood',
    },
  },
  { timestamps: true }
);

appointmentSchema.index({ donorId: 1 });
appointmentSchema.index({ hospitalId: 1 });
appointmentSchema.index({ status: 1 });

const Appointment = mongoose.model('Appointment', appointmentSchema);

export default Appointment;
