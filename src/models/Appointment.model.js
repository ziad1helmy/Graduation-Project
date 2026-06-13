import mongoose from 'mongoose';
import { DONATION_TYPE_LABELS, DONATION_TYPE_OPTIONS } from '../constants/donation.constants.js';

const appointmentSchema = new mongoose.Schema(
  {
    donorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Donor ID is required'],
    },

    donorDetails: {
      fullName: {
        type: String,
        default: null,
      },
      phoneNumber: {
        type: String,
        default: null,
      },
      bloodType: {
        type: String,
        default: null,
      },
      email: {
        type: String,
        default: null,
      },
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
          // Only enforce future date on creation; after creation, the deadline
          // naturally passes and updates to status etc. must not be blocked.
          if (!this.isNew) return true;
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

    verificationStatus: {
      type: String,
      enum: ['pending', 'verified', 'rejected', 'completed'],
      default: 'pending',
    },

    verificationSessionId: {
      type: String,
      default: null,
      index: true,
    },

    verificationStartedAt: {
      type: Date,
      default: null,
    },

    verificationVerifiedAt: {
      type: Date,
      default: null,
    },

    verificationRejectedAt: {
      type: Date,
      default: null,
    },

    verificationRejectedReason: {
      type: String,
      default: null,
    },

    verificationChecklist: {
      idVerified: {
        type: Boolean,
        default: false,
      },
      questionnaireCompleted: {
        type: Boolean,
        default: false,
      },
      consentSigned: {
        type: Boolean,
        default: false,
      },
      completedAt: {
        type: Date,
        default: null,
      },
    },

    // Dev 1: Donation type selection
    donationType: {
      type: String,
      enum: DONATION_TYPE_OPTIONS,
      default: DONATION_TYPE_LABELS.WHOLE_BLOOD,
    },

    rescheduleCount: {
      type: Number,
      default: 0,
      min: 0,
    },

    rescheduleHistory: {
      type: [
        {
          previousAppointmentDate: { type: Date, required: true },
          newAppointmentDate: { type: Date, required: true },
          previousDonationType: { type: String, default: null },
          newDonationType: { type: String, default: null },
          reason: {
            type: String,
            default: null,
            maxlength: [500, 'Reschedule reason cannot exceed 500 characters'],
          },
          rescheduledAt: { type: Date, required: true },
          rescheduledBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
        },
      ],
      default: [],
    },
  },
  { timestamps: true }
);

appointmentSchema.index({ donorId: 1 });
appointmentSchema.index({ hospitalId: 1 });
appointmentSchema.index({ status: 1 });
appointmentSchema.index({ donorId: 1, hospitalId: 1, status: 1 }, { unique: true, sparse: true, partialFilterExpression: { status: { $in: ['pending', 'confirmed'] } } });

const Appointment = mongoose.model('Appointment', appointmentSchema);

export default Appointment;
