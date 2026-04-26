import mongoose from 'mongoose';

/**
 * AuditLog Model - Simplified audit trail for admin actions
 *
 * Tracks who did what, to which entity, and when.
 */

const auditLogSchema = new mongoose.Schema(
  {
    adminId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Admin ID is required'],
    },

    action: {
      type: String,
      required: [true, 'Action is required'],
      // e.g. 'user.verify', 'user.suspend', 'request.cancel',
      //      'request.fulfill', 'system.maintenance', 'emergency.broadcast'
    },

    targetType: {
      type: String,
      enum: {
        values: ['User', 'Request', 'Donation', 'System'],
        message: 'Target type must be User, Request, Donation, or System',
      },
    },

    targetId: {
      type: mongoose.Schema.Types.ObjectId,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

// Indexes for efficient queries
auditLogSchema.index({ adminId: 1 });
auditLogSchema.index({ createdAt: -1 });
auditLogSchema.index({ targetType: 1 });

const AuditLog = mongoose.model('AuditLog', auditLogSchema);

export default AuditLog;
