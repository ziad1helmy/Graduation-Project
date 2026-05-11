import mongoose from 'mongoose';

/**
 * Campaign Model - Seasonal and promotional campaigns with point multipliers
 *
 * Fields:
 * - name: Campaign name (e.g., "Summer Blood Drive 2024")
 * - description: Campaign description and goals
 * - active: Whether campaign is currently active
 * - startDate: Campaign start date
 * - endDate: Campaign end date
 * - multiplier: Points multiplier (1.0-3.0), default 1.0
 * - donationTypes: Array of eligible donation types
 * - bloodTypes: Array of eligible blood types (optional)
 * - urgencyLevel: Minimum urgency level to qualify (optional)
 * - maxRedemptions: Maximum number of donors eligible (optional)
 * - banner: Banner image URL for UI display
 * - createdBy: Admin who created the campaign
 * - createdAt: Timestamp
 * - updatedAt: Timestamp
 */

const campaignSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Campaign name is required'],
      trim: true,
      maxlength: [100, 'Campaign name cannot exceed 100 characters'],
    },

    description: {
      type: String,
      trim: true,
      maxlength: [500, 'Description cannot exceed 500 characters'],
    },

    active: {
      type: Boolean,
      default: false,
    },

    startDate: {
      type: Date,
      required: [true, 'Start date is required'],
    },

    endDate: {
      type: Date,
      required: [true, 'End date is required'],
      validate: {
        validator: function(v) {
          return v > this.startDate;
        },
        message: 'End date must be after start date',
      },
    },

    multiplier: {
      type: Number,
      min: [1.0, 'Multiplier cannot be less than 1.0'],
      max: [3.0, 'Multiplier cannot exceed 3.0'],
      default: 1.0,
    },

    donationTypes: {
      type: [String],
      enum: ['blood', 'plasma', 'platelets', 'organ'],
      default: ['blood'],
    },

    bloodTypes: {
      type: [String],
      enum: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'],
      default: [],
    },

    urgencyLevel: {
      type: String,
      enum: ['low', 'medium', 'high', 'critical'],
    },

    maxRedemptions: {
      type: Number,
      min: [1, 'Max redemptions must be at least 1'],
    },

    currentRedemptions: {
      type: Number,
      default: 0,
    },

    banner: {
      type: String,
      trim: true,
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    tags: {
      type: [String],
      default: [],
    },
  },
  { timestamps: true }
);

// Index for active campaign queries
campaignSchema.index({ active: 1, startDate: 1, endDate: 1 });

export default mongoose.model('Campaign', campaignSchema);
