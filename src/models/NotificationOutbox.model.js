import mongoose from 'mongoose';

const notificationOutboxSchema = new mongoose.Schema(
  {
    requestId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Request',
      required: true,
    },
    donorIds: {
      type: [mongoose.Schema.Types.ObjectId],
      ref: 'User',
      default: [],
    },
      userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null,
      },
      type: {
        type: String,
        enum: ['request', 'match'],
        default: 'request',
      },
    status: {
      type: String,
      enum: ['pending', 'ready', 'sent', 'failed'],
      default: 'pending',
    },
    attempts: {
      type: Number,
      default: 0,
    },
    lastError: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

notificationOutboxSchema.index({ requestId: 1 });

const NotificationOutbox = mongoose.model('NotificationOutbox', notificationOutboxSchema);

export default NotificationOutbox;
